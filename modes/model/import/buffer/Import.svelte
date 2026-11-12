<script>
  import { onMount } from "svelte";
  import { Connection, shard } from "@vivalence/typology";
  import Queue from "./parts/Queue.svelte";
  import Decode from "./parts/Decode.svelte";
  import Review from "./parts/Review.svelte";
  import { defaults } from "./job.js";
  import Stage from "./parts/Stage.svelte";
  import Tree from "./parts/Tree.svelte";
  import Node from "./parts/Node.svelte";

  const { terminal, buffer, surface } = $props();
  const recorded = terminal.client.runtime.entities.file.$entities;

  const FONT = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap";
  const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
  const identify = () => Math.random().toString(36).slice(2, 8);

  let jobs = $state(clone(buffer.data?.jobs ?? []));
  let active = $state(buffer.data?.active ?? null);
  let node = $state(buffer.data?.node ?? null);
  let isolate = $state(buffer.data?.isolate ?? "ALL");
  let tree = $state.raw({ rows: [], counts: {}, parts: [] });
  let fault = $state(null);
  let hovering = $state(false);
  const files = new Map();
  let inflight = false;

  const job = $derived(jobs.find((held) => held.id === active) ?? jobs[0] ?? null);
  const committed = $derived(jobs.filter((held) => held.state === "done").length);
  // the filter switches the READING, it does not cut the tree: ALL is the hierarchy, PART is the
  // kit flat (a placed part is no row of the tree — only the placements that name it are)
  const visible = $derived(
    isolate === "ALL" ? tree.rows : isolate === "PART" ? tree.parts : tree.rows.filter((held) => held.ontology === isolate.toLowerCase()),
  );
  const byPart = $derived(Object.fromEntries((tree.parts ?? []).map((held) => [held.slug, held])));
  const selected = $derived([...tree.rows, ...(tree.parts ?? [])].find((held) => held.key === node) ?? null);
  const minted = $derived(jobs.flatMap((held) => held.minted?.parts ?? []));
  

  const asset = (path) =>
    path
      ? ($recorded.find((file) => file.path === path && file.mode.daemon === buffer.mode.daemon)?.url ?? null)
      : null;
  const fresh = (url, stamp) => (url ? `${url}${url.includes("?") ? "&" : "?"}job=${stamp}` : null);

  const previewing = $derived(job?.state === "parsed" && job.reading && job.settings ? job : null);

  const entries = $derived.by(() => {
    if (previewing) {
      const unit = previewing.settings.unit;
      return previewing.reading.objects
        .filter((object) => previewing.settings.hidden || !object.hidden)
        .map((object) => ({ id: object.object, url: fresh(asset(`${previewing.reading.intake}/${object.file}`), previewing.id), nodes: [{ path: object.object, ...(object.translation && { translation: object.translation.map((value) => value * unit) }), ...(object.rotation && { rotation: object.rotation }), scale: [unit, unit, unit] }] }));
    }
    if (!selected) return [];
    const scene = selected.scene ?? [];
    if (!scene.length) {
      const file = selected.modeled?.file ?? byPart[selected.ref]?.modeled?.file ?? null;
      return file ? [{ id: selected.slug, url: asset(file), nodes: [{}] }] : [];
    }
    const grouped = new Map();
    for (const at of scene) {
      if (!grouped.has(at.ref)) grouped.set(at.ref, []);
      grouped.get(at.ref).push(at);
    }
    return [...grouped].map(([slug, nodes]) => ({ id: slug, url: asset(byPart[slug]?.modeled?.file), nodes })).filter((entry) => entry.url);
  });

  const retain = (patch) => {
    buffer.data = { ...buffer.data, ...patch };
    terminal.client.runtime.entities.buffer.updateOne({ id: buffer.id }, { data: buffer.data }).catch((error) => (fault = `buffer · ${error.message}`));
  };
  const keep = () => retain({ jobs: clone(jobs), active, node, isolate });

  const upload = new Connection(terminal.client.runtime.remote, shard.transmitter.fetcher)
    .use(shard.connection.authorize(terminal.client.runtime.lighthouse.$authority))
    .branch(buffer.mode.reference.absolute);

  async function refresh() {
    try {
      tree = await buffer.mode.call.tree({ slugs: [...new Set(minted)] });
      fault = null;
    } catch (error) {
      fault = `tree · ${error.message}`;
    }
  }

  function enqueue(list) {
    for (const file of [...list]) {
      const held = { id: identify(), name: file.name, extension: file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "", bytes: file.size, state: "wait", progress: 0, log: [] };
      files.set(held.id, file);
      jobs.push(held);
      active = held.id;
    }
    keep();
    pump();
  }

  const pick = () => jobs.find((held) => held.state === "wait" && files.has(held.id));

  async function pump() {
    if (inflight) return;
    inflight = true;
    try {
      for (let next = pick(); next; next = pick()) await run(next);
    } finally {
      inflight = false;
    }
  }

  const follow = (held, event) => {
    held.log.push({ t: event.t, lvl: event.lvl, msg: event.msg });
    held.stage = event.stage;
    held.progress = event.progress;
    if (event.meta) held.meta = event.meta;
    if (event.minted) held.minted = event.minted;
    if (event.reading) {
      held.reading = event.reading;
      held.settings = { ...defaults(event.reading), ...(held.settings ?? {}) };
    }
  };

  async function run(held) {
    const file = files.get(held.id);
    held.state = "run";
    held.stage = "sniff";
    held.progress = 0;
    held.log = [];
    keep();
    try {
      for await (const event of upload.stream("/parse", undefined, { method: "POST", raw: { body: file }, headers: { "x-viva-name": encodeURIComponent(file.name) } })) {
        follow(held, event);
        held.state = event.failed ? "fail" : event.done ? "parsed" : event.lvl === "WARN" || held.state === "warn" ? "warn" : "run";
        if (event.done && !event.failed) {
          held.stage = "review";
          held.progress = 60;
        }
        keep();
      }
      if (held.state === "run" || held.state === "warn") {
        held.state = "fail";
        held.log.push({ t: "—", lvl: "FAIL", msg: "the stream ended before a DONE line" });
      }
    } catch (error) {
      held.state = "fail";
      held.log.push({ t: "—", lvl: "FAIL", msg: error.message });
    }
    files.delete(held.id);
    keep();
  }

  async function commit(held) {
    if (held.state !== "parsed" || !held.settings) return;
    held.state = "run";
    held.stage = "commit";
    held.progress = 60;
    keep();
    try {
      for await (const event of upload.stream("/commit", undefined, { method: "POST", body: { name: held.name, settings: held.settings } })) {
        follow(held, event);
        held.state = event.failed ? "fail" : event.done ? "done" : event.lvl === "WARN" || held.state === "warn" ? "warn" : "run";
        keep();
        if (event.done && !event.failed) {
          await refresh();
        }
      }
      if (held.state === "run" || held.state === "warn") {
        held.state = "parsed";
        held.stage = "review";
        held.log.push({ t: "—", lvl: "FAIL", msg: "the stream ended before a DONE line — settings kept, commit again" });
      }
    } catch (error) {
      held.state = "parsed";
      held.stage = "review";
      held.log.push({ t: "—", lvl: "FAIL", msg: error.message });
    }
    keep();
  }

  async function revert(held) {
    if (held.state !== "done" || !held.minted) return;
    const slugs = [...new Set([...(held.minted.placements ?? []), ...held.minted.parts])];
    try {
      const gone = await buffer.mode.call.revert({ slugs });
      held.log.push({ t: "—", lvl: "ONTO", msg: `reverted — ${gone.retracted.length} literal(s) retracted, ${gone.files.length} geometry file(s) gone; the file stands parsed` });
      held.state = "parsed";
      held.stage = "review";
      held.progress = 60;
      held.minted = null;
      node = null;
      keep();
      await refresh();
    } catch (error) {
      held.log.push({ t: "—", lvl: "FAIL", msg: `revert · ${error.message}` });
      keep();
    }
  }

  const adjust = (held, settings) => {
    held.settings = settings;
    keep();
  };

  function clear() {
    jobs = jobs.filter((held) => held.state === "run" || held.state === "warn");
    for (const id of [...files.keys()]) if (!jobs.some((held) => held.id === id)) files.delete(id);
    active = jobs[0]?.id ?? null;
    node = null;
    keep();
    refresh();
  }

  const select = (id) => {
    active = id;
    keep();
  };

  const choose = (key) => {
    node = key;
    keep();
  };

  const filter = (next) => {
    isolate = next;
    keep();
  };

  const picked = (slug) => {
    if (!slug) return;
    const found = byPart[slug] ?? tree.rows.find((held) => held.slug === slug || held.ref === slug);
    if (found) choose(found.key);
  };

  const dragging = (event) => {
    event.preventDefault();
    hovering = true;
  };
  const dropped = (event) => {
    event.preventDefault();
    hovering = false;
    enqueue(event.dataTransfer?.files ?? []);
  };

  onMount(() => {
    if (!document.querySelector('link[data-viva-font="jetbrains"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT;
      link.dataset.vivaFont = "jetbrains";
      document.head.appendChild(link);
    }
    for (const held of jobs) {
      if (held.state === "wait" || ((held.state === "run" || held.state === "warn") && held.stage !== "commit")) {
        held.state = "fail";
        held.log.push({ t: "—", lvl: "FAIL", msg: "the file is not held any more — drop it again" });
      } else if (held.state === "run" || held.state === "warn") {
        held.state = "parsed";
        held.stage = "review";
        held.log.push({ t: "—", lvl: "WARN", msg: "the commit was cut off — commit again" });
      }
    }
    keep();
    refresh();
  });
</script>

<div class="import" class:hovering role="region" aria-label="Import" ondragover={dragging} ondragleave={() => (hovering = false)} ondrop={dropped}>
  <div class="column left">
    <Queue {jobs} active={job?.id ?? null} {committed} onenqueue={enqueue} onselect={select} onclear={clear} />
    {#if job?.reading && job.settings && (job.state === "parsed" || job.state === "done")}
      <Review {job} committed={job.state === "done"} onchange={(settings) => adjust(job, settings)} oncommit={() => commit(job)} onrevert={() => revert(job)} />
    {/if}
    <Decode {job} />
    {#if fault}<div class="fault">{fault}</div>{/if}
  </div>
  <div class="column right">
    <Node {selected} />
    <Stage {selected} {entries} {isolate} preview={previewing ? `preview · ${previewing.name} · ${previewing.reading.objects.length} objects at ${previewing.settings.unit} m per unit` : null} onisolate={filter} onpick={picked} />
    <Tree rows={visible} counts={tree.counts} chosen={selected?.key ?? null} onpick={choose} />
  </div>
</div>

<style>
  .import {
    --bg: #0a0a0a;
    --panel: #0f0f0f;
    --hover: #131313;
    --lift: #141414;
    --pick: #151515;
    --line: #2a2a2a;
    --rule: #1c1c1c;
    --hair: #161616;
    --badge: #2f2f2f;
    --dash: #6a6a6a;
    --ink: #e8e8e8;
    --ink-2: #c8c8c8;
    --ink-3: #bdbdbd;
    --dim: #9a9a9a;
    --mute: #8a8a8a;
    --part: #3ddc97;
    --placement: #7a9bff;
    --step: #e0b341;
    --fail: #e05a5a;
    --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 480px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
    background: var(--bg);
    color: var(--ink);
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.5;
    overflow: hidden;
    outline: 2px dashed transparent;
    outline-offset: -6px;
    transition: outline-color 120ms;
  }
  .import.hovering {
    outline-color: var(--part);
  }
  .import :global(*) {
    box-sizing: border-box;
  }
  .import :global(::selection) {
    background: var(--part);
    color: var(--bg);
  }
  .column {
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .left {
    border-right: 1px solid var(--line);
  }
  .fault {
    padding: 10px 18px;
    color: var(--fail);
    font-size: 11px;
    border-top: 1px solid var(--line);
  }
  .import :global(.head) {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 12px 18px;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .import :global(.head b) {
    font-weight: 700;
    letter-spacing: 0.12em;
  }
  .import :global(.head .sub) {
    color: var(--dim);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .import :global(.head .gap) {
    flex: 1;
    min-width: 12px;
  }
  .import :global(.part) {
    color: var(--part);
  }
  .import :global(.placement) {
    color: var(--placement);
  }
  .import :global(.step) {
    color: var(--step);
  }
</style>
