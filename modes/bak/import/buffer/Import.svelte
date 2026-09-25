<script>
  import { untrack } from "svelte";
  import { Connection, Url, shard } from "@vivalence/typology";
  import { stage } from "./scene.js";

  // the importer's screen: drop a .blend, and it is uploaded, harvested, read as members, named
  // and minted — literals at the end, the phase bar counting the walk as it runs. the bin is the
  // buffer's data; every door writes it back and this view follows its own buffer. anything done
  // TO a part happens on the right, over the selection; a phase card takes a drop of it.

  let { daemon, mode, buffer } = $props();

  const PHASES = [
    { key: "intake", sub: "file · scale · placement" },
    { key: "interpret", sub: "members · split · match" },
    { key: "annotate", sub: "slug · symbols · qty" },
    { key: "embed", sub: "rows · freight · assembly" },
  ];
  const ORDER = PHASES.map((phase) => phase.key);

  let container = $state(null);
  // NOT $state: the markup never reads the stage, and an effect that writes a $state it also
  // reads invalidates itself — that is the /scan storm. nothing tracks it at all.
  let world = null;
  let drawing = null;
  let anchor = null;
  let picker = $state(null);
  let bin = $state.raw(settle(buffer?.data?.bin));
  let counts = $state.raw(tally(bin));
  let selected = $state.raw(new Set([].concat(buffer?.data?.selected ?? [])));
  let pending = $state.raw(null);
  let scale = $state("");
  let fault = $state(null);
  let note = $state(null);
  let busy = $state(null);
  let open = $state({});
  let over = $state(null);
  let dragging = $state(false);
  let hovering = $state(false);
  let draft = $state({ slug: "", name: "", qty: "", symbols: "" });

  function settle(held = {}) {
    return { objects: [], members: [], annotations: {}, embedded: {}, ...held };
  }

  function tally(held) {
    const placed = new Set(held.members.flatMap((member) => member.objects));
    const out = { intake: held.objects.filter((object) => !placed.has(object.object)).length, interpret: 0, annotate: 0, embed: 0 };
    for (const member of held.members) {
      if (member.dropped) continue;
      out[held.embedded[member.id] ? "embed" : held.annotations[member.id] ? "annotate" : "interpret"]++;
    }
    return out;
  }

  const phaseOf = (member) => (member.dropped ? "dropped" : bin.embedded[member.id] ? "embed" : bin.annotations[member.id] ? "annotate" : "interpret");

  const byObject = $derived(Object.fromEntries(bin.objects.map((object) => [object.object, object])));
  const byMember = $derived(Object.fromEntries(bin.members.map((member) => [member.id, member])));
  const placed = $derived(new Set(bin.members.flatMap((member) => member.objects)));
  const groups = $derived.by(() => {
    const held = new Map();
    const into = (collection, row) => {
      if (!held.has(collection)) held.set(collection, []);
      held.get(collection).push(row);
    };
    for (const member of bin.members) into(byObject[member.id]?.collection ?? "—", member);
    for (const object of bin.objects) if (!placed.has(object.object)) into(object.collection ?? "—", { id: object.object, objects: [object.object], file: object.file, placements: [], loose: true });
    return [...held.entries()].map(([name, members]) => ({ name, members }));
  });
  // the rows as the tree shows them, top to bottom — what a shift-click ranges over
  const visible = $derived(groups.flatMap((group) => (open[group.name] === false ? [] : group.members.map((row) => row.id))));
  const isRow = (id) => Boolean(byMember[id]) || (Boolean(byObject[id]) && !placed.has(id));
  const chosen = $derived([...selected].filter(isRow));
  const current = $derived(chosen.length === 1 ? byMember[chosen[0]] ?? null : null);
  const focus = $derived(chosen.length === 1 ? byObject[chosen[0]] ?? null : null);
  const annotation = $derived(current ? bin.annotations[current.id] ?? null : null);
  const minted = $derived(current ? bin.embedded[current.id] ?? null : null);
  const stageOf = (id) => (byMember[id] ? phaseOf(byMember[id]) : placed.has(id) ? null : byObject[id] ? "intake" : null);
  // a dropped member sits still; a minted row has no way back — the domain mints, it never unmints
  const movable = (id, phase) => {
    const held = stageOf(id);
    return Boolean(held) && held !== "dropped" && held !== "embed" && held !== phase;
  };
  const canMove = (phase) => chosen.some((id) => movable(id, phase));
  const summary = $derived.by(() => {
    const held = {};
    for (const id of chosen) held[stageOf(id)] = (held[stageOf(id)] ?? 0) + 1;
    return Object.entries(held).map(([phase, n]) => `${n} ${phase}`).join(" · ");
  });
  const mm = (value) => Math.round((value ?? 0) * 1000);
  const at = (vector) => (vector ? vector.map((x) => (x * 100).toFixed(2)).join(" ") : "—");
  const blend = (file) => Boolean(file) && /\.blend$/i.test(file.name);

  async function call(route, input) {
    busy = route;
    fault = null;
    try {
      const verb = route.split("/").filter(Boolean).reduce((held, key) => held?.[key], mode.call);
      return await verb(input ?? {});
    } catch (error) {
      fault = `${route} · ${error.message}`;
      return null;
    } finally {
      busy = null;
    }
  }

  const door = async (route, input) => {
    const answered = await call(route, { buffer: buffer.id, ...input });
    if (answered?.bin) take(answered.bin);
    return answered;
  };

  function take(next) {
    bin = settle(next);
    counts = tally(bin);
  }

  const retain = (patch) => {
    if (!buffer?.id || !daemon?.entities?.buffer) return;
    buffer.data = { ...buffer.data, ...patch };
    daemon.entities.buffer.updateOne({ id: buffer.id }, { data: buffer.data }).catch((error) => (fault = `buffer · ${error.message}`));
  };

  const choose = (next) => {
    selected = next;
    world?.select(next);
    retain({ selected: [...next] });
    const one = next.size === 1 ? [...next][0] : null;
    const named = one ? bin.annotations[one] : null;
    draft = named ? { slug: named.slug, name: named.name, qty: named.qty ?? "", symbols: (named.symbols ?? []).join(" ") } : { slug: "", name: "", qty: "", symbols: "" };
  };

  // a click selects; ⌘ or ctrl toggles; shift ranges from the last plain click over the visible rows
  const pick = (id, event = {}) => {
    const toggling = event.metaKey || event.ctrlKey;
    const next = new Set(toggling ? selected : []);
    if (event.shiftKey && anchor && visible.includes(anchor) && visible.includes(id)) {
      const [from, to] = [visible.indexOf(anchor), visible.indexOf(id)].sort((a, b) => a - b);
      for (const held of visible.slice(from, to + 1)) next.add(held);
    } else if (toggling && next.has(id)) {
      next.delete(id);
      anchor = id;
    } else {
      next.add(id);
      anchor = id;
    }
    choose(next);
  };

  const url = (file) => daemon.getAsset({ path: `${bin.intake}/${file}` })?.url ?? null;

  async function populate() {
    const scene = world;
    if (!scene) return;
    // one draw at a time: a newer populate, or a rebuilt stage, retires this one at the next await
    const token = (drawing = Symbol("populate"));
    const stale = () => drawing !== token || world !== scene;
    scene.clear();
    // the catalog may not have caught up with a fresh harvest yet — read it again before giving up
    if (bin.objects.length && !url(bin.objects[0].file)) await daemon.cargo?.refetch?.();
    let framed = false;
    const put = async (id, held, placements) => {
      try {
        await scene.place(id, held, placements);
      } catch (error) {
        fault = `${id} · ${error.message ?? "no geometry"}`;
        return;
      }
      // the first part frames the camera, so a long load is never watched from inside a plate
      if (!framed && !stale()) {
        framed = true;
        scene.frame();
      }
    };
    for (const member of bin.members) {
      if (stale()) return;
      const held = url(member.file);
      if (held) await put(member.id, held, member.placements.length ? member.placements : [{ object: member.id }]);
    }
    for (const object of bin.objects) {
      if (stale()) return;
      if (placed.has(object.object)) continue;
      const held = url(object.file);
      if (held) await put(object.object, held, [{ object: object.object, translation: object.translation, rotation: object.rotation }]);
    }
    if (stale()) return;
    scene.frame();
    scene.select(selected);
  }

  // bytes ride a plain http connection of their own: the multiplex carries text
  let line = null;
  const http = () => {
    if (!line) {
      line = new Connection(new Url(daemon.url), shard.transmitter.fetcher);
      if (daemon.lighthouse?.$authority) line.use(shard.connection.authorize(daemon.lighthouse.$authority));
    }
    return line;
  };

  // the whole walk in one: the file goes up, the daemon harvests, reads, names and mints, and the
  // bin comes back after every step
  async function upload(file) {
    const factor = Number(scale);
    if (!blend(file)) return (fault = `${file?.name ?? "that"} is not a .blend`);
    if (!(factor > 0)) return (fault = "the scale — metres per blender unit — is the one thing the file cannot tell");
    busy = "/upload";
    fault = null;
    note = `${file.name} · uploading`;
    try {
      const query = new URLSearchParams({ buffer: buffer.id, scale: String(factor) });
      const path = `/mode/${mode.type ?? mode.manifest?.type}/${mode.slug ?? mode.manifest?.slug}/upload?${query}`;
      for await (const step of http().stream(path, undefined, { method: "POST", raw: { body: file }, headers: { "x-viva-name": encodeURIComponent(file.name) } })) {
        if (step.bin) take(step.bin);
        note = `${file.name} · ${step.stage}${step.done ? " · done" : "…"}`;
        if (step.stage === "harvest") {
          await daemon.cargo?.refetch?.();
          populate();
        }
      }
      pending = null;
    } catch (error) {
      fault = `upload · ${error.message}`;
    } finally {
      busy = null;
    }
    await populate();
  }

  const fileOver = (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    hovering = true;
  };
  const fileDrop = (event) => {
    if (!event.dataTransfer?.types?.includes("Files")) return;
    event.preventDefault();
    hovering = false;
    const file = [...(event.dataTransfer.files ?? [])][0] ?? null;
    if (file) pending = file;
  };
  const chosenFile = (event) => {
    pending = event.target.files?.[0] ?? null;
    event.target.value = "";
  };

  async function clear() {
    if (!(await door("/clear"))) return;
    note = null;
    pending = null;
    choose(new Set());
    world?.clear();
  }

  const unmerge = async () => current && (await door("/unmerge", { id: current.id })) && populate();
  const merge = async () => {
    const ids = chosen.filter((id) => byMember[id] && !bin.embedded[id]);
    if (ids.length < 2 || !(await door("/merge", { ids }))) return;
    choose(new Set([ids[0]]));
    await populate();
  };
  const drop = (dropped) => {
    const ids = chosen.filter((id) => byMember[id] && !bin.embedded[id] && Boolean(byMember[id].dropped) !== dropped);
    return ids.length ? door("/drop", { ids, dropped }) : null;
  };
  const name = async () => {
    if (!current) return;
    const held = { slug: draft.slug.trim(), name: draft.name.trim() || draft.slug.trim(), ...(draft.qty !== "" && { qty: Number(draft.qty) }), symbols: draft.symbols.split(/[\s,]+/).filter(Boolean) };
    await door("/annotate", { id: current.id, annotation: held });
  };

  // a part moves by the door its next phase names, and back by the door that undoes it: intake ⇄
  // interpret is /interpret ⇄ /dissolve, interpret ⇄ annotate is /annotate ⇄ /forget, annotate →
  // embed is /embed. a loose object bound for annotate or embed walks every door on the way.
  async function move(phase, ids) {
    const held = ids.filter((id) => movable(id, phase));
    if (!held.length) return;
    const to = ORDER.indexOf(phase);
    const loose = held.filter((id) => stageOf(id) === "intake");
    let members = held.filter((id) => stageOf(id) !== "intake");
    if (to === 0) {
      const objects = members.flatMap((id) => byMember[id]?.objects ?? []);
      if (!(await door("/dissolve", { ids: members }))) return;
      choose(new Set(objects));
      return populate();
    }
    const named = members.filter((id) => stageOf(id) === "annotate");
    if (to < 2 && named.length && !(await door("/forget", { ids: named }))) return;
    if (loose.length) {
      const answered = await door("/interpret", { objects: loose });
      if (!answered) return;
      const fresh = answered.bin.members.filter((member) => member.objects.some((object) => loose.includes(object))).map((member) => member.id);
      members = [...new Set([...members, ...fresh])];
    }
    if (to >= 2) {
      const unnamed = members.filter((id) => !bin.annotations[id]);
      if (unnamed.length && !(await door("/annotate", { ids: unnamed }))) return;
    }
    if (to >= 3) {
      const wanted = members.filter((id) => !bin.embedded[id]);
      if (wanted.length) {
        if (!(await door("/embed", { ids: wanted }))) return;
        await daemon.cargo?.refetch?.();
      }
    }
    choose(new Set(members));
    await populate();
  }

  // a drag carries the selection; dragging a row outside it selects that row alone first
  const draggable = (id) => ORDER.some((phase) => movable(id, phase));
  const dragStart = (event, id) => {
    if (!selected.has(id)) choose(new Set([id]));
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", [...selected].join("\n"));
    dragging = true;
  };
  const dragEnd = () => {
    dragging = false;
    over = null;
  };
  const dragOver = (event, phase) => {
    if (!dragging || !canMove(phase)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    over = phase;
  };
  const dropOn = async (event, phase) => {
    event.preventDefault();
    over = null;
    dragging = false;
    await move(phase, chosen);
  };

  // this buffer's row and no other: a filter without an id would match every buffer, and another
  // buffer's bin would walk in here as an import nobody asked for
  $effect(() => {
    if (!buffer?.id) return;
    return daemon?.entities?.buffer?.subscribe?.({ id: buffer.id }, (row) =>
      untrack(() => {
        if (row?.id === buffer.id && row?.data?.bin && row.data.bin !== bin) take(row.data.bin);
      }),
    );
  });

  $effect(() => {
    if (!container) return;
    const held = stage(container, { onPick: (id, event) => id && pick(id, event) });
    world = held;
    let alive = true;
    // every read below sits under an await, where svelte tracks nothing: this effect depends on
    // `container` and nothing else
    (async () => {
      await daemon.cargo?.refetch?.();
      if (alive && bin.objects.length) await populate();
    })();
    return () => {
      alive = false;
      held.dispose();
      world = null;
    };
  });
</script>

<div class="import" class:hovering ondragover={fileOver} ondragleave={() => (hovering = false)} ondrop={fileDrop} role="presentation">
  <nav class="phases">
    {#each PHASES as phase (phase.key)}
      <div
        class="phase"
        class:live={counts[phase.key] > 0}
        class:open={dragging && canMove(phase.key)}
        class:over={over === phase.key}
        role="group"
        ondragover={(event) => dragOver(event, phase.key)}
        ondragleave={() => over === phase.key && (over = null)}
        ondrop={(event) => dropOn(event, phase.key)}
      >
        <div class="count"><b>{counts[phase.key]}</b> {phase.key}</div>
        <div class="sub">{phase.sub}</div>
      </div>
    {/each}
  </nav>

  <div class="body">
    <aside class="left">
      {#if !bin.objects.length}
        <div class="intake">
          <input type="file" accept=".blend" bind:this={picker} onchange={chosenFile} hidden />
          <button class="zone" class:ready={blend(pending)} onclick={() => picker?.click()} disabled={busy}>
            {#if pending}<b>{pending.name}</b><span class="dim">{Math.round(pending.size / 1024)} kB</span>{:else}<b>drop a .blend</b><span class="dim">or click to choose one</span>{/if}
          </button>
          <div class="field"><span>scale</span><input type="number" step="any" min="0" placeholder="metres per blender unit" bind:value={scale} /></div>
          <button class="act" disabled={busy || !blend(pending) || !(Number(scale) > 0)} onclick={() => upload(pending)}>import every part</button>
          <div class="dim">every mesh object becomes a component, every placement a node of the assembly named after the file</div>
        </div>
      {:else}
        <div class="source">
          <span class="id" title={bin.source}>{bin.source}</span>
          <span class="dim">{bin.objects.length} obj{bin.scale != null ? ` · ×${bin.scale}` : ""}{bin.assembly ? ` · ${bin.assembly.slug}` : ""}</span>
          <button disabled={busy} onclick={clear} title="empty the bin — the rows already minted stay in the daemon">clear</button>
        </div>
        <div class="tree" role="listbox" aria-multiselectable="true">
          {#each groups as group (group.name)}
            <div class="collection" onclick={() => (open[group.name] = !open[group.name])} role="button" tabindex="0" onkeydown={(event) => event.key === "Enter" && (open[group.name] = !open[group.name])}>
              <span class="caret">{open[group.name] === false ? "▸" : "▾"}</span><span>{group.name}</span><span class="dim">{group.members.length}</span>
            </div>
            {#if open[group.name] !== false}
              {#each group.members as row (row.id)}
                <div
                  class="member"
                  class:on={selected.has(row.id)}
                  class:dropped={row.dropped}
                  draggable={draggable(row.id) ? "true" : "false"}
                  ondragstart={(event) => dragStart(event, row.id)}
                  ondragend={dragEnd}
                  onclick={(event) => pick(row.id, event)}
                  role="option"
                  aria-selected={selected.has(row.id)}
                  tabindex="0"
                  onkeydown={(event) => event.key === "Enter" && pick(row.id, event)}
                >
                  <span class="dot {row.loose ? 'intake' : phaseOf(row)}"></span>
                  <span class="id">{bin.annotations[row.id]?.slug ?? row.id}{row.objects.length > 1 ? ` ×${row.objects.length}` : ""}{row.copies ? ` (x${row.copies})` : ""}</span>
                  <span class="dim">{byObject[row.id]?.tris ?? "—"} tri</span>
                </div>
              {/each}
            {/if}
          {/each}
        </div>
      {/if}
    </aside>

    <div class="stage" bind:this={container}></div>

    <aside class="right">
      {#if chosen.length > 1}
        <div class="head"><b>{chosen.length} selected</b><span class="dim">{summary}</span></div>
        <div class="label">move to</div>
        <div class="moves">
          {#each PHASES as phase (phase.key)}<button disabled={busy || !canMove(phase.key)} onclick={() => move(phase.key, chosen)}>{phase.key}</button>{/each}
        </div>
        <div class="acts">
          <button disabled={busy || chosen.filter((id) => byMember[id] && !bin.embedded[id]).length < 2} onclick={merge}>merge</button>
          <button disabled={busy || !chosen.some((id) => byMember[id] && !byMember[id].dropped && !bin.embedded[id])} onclick={() => drop(true)}>drop</button>
          <button disabled={busy || !chosen.some((id) => byMember[id]?.dropped)} onclick={() => drop(false)}>take back</button>
        </div>
        <div class="list">
          {#each chosen as id (id)}
            <div class="line"><span class="dot {stageOf(id)}"></span><span class="id">{bin.annotations[id]?.slug ?? id}</span><span class="dim">{stageOf(id)}</span></div>
          {/each}
        </div>
      {:else if current || focus}
        <div class="head"><span class="dot {current ? phaseOf(current) : 'intake'}"></span><b>{chosen[0]}</b><span class="dim">{current ? phaseOf(current) : "intake"}</span></div>
        <dl>
          <dt>mesh</dt><dd>{focus?.file ?? "—"} · {focus?.tris ?? "—"} tris</dd>
          <dt>size</dt><dd>{focus?.bbox ? focus.bbox.map(mm).join(" × ") + " mm" : "—"}</dd>
          <dt>material</dt><dd>{(focus?.materials ?? []).join(", ") || "—"}</dd>
          <dt>modifiers</dt><dd>{(focus?.modifiers ?? []).join(", ") || "none"}</dd>
          <dt>at</dt><dd>{at(focus?.translation)} cm</dd>
          {#if current}
            <dt>placed</dt><dd>{current.objects.join(", ")}{current.copies ? ` · ${current.copies} welded` : ""}{current.placements.some((held) => held.mirrored?.length) ? " · mirrored" : ""}</dd>
          {/if}
          {#if minted}<dt>row</dt><dd>{minted.ontology} {minted.slug} · {minted.file}</dd>{/if}
        </dl>
        {#if current && !current.dropped && !minted}
          <div class="label">annotate</div>
          <div class="field"><span>slug</span><input bind:value={draft.slug} placeholder="the component's slug" /></div>
          <div class="field"><span>name</span><input bind:value={draft.name} placeholder="a name for eyes" /></div>
          <div class="field"><span>qty</span><input type="number" bind:value={draft.qty} placeholder={`${current.placements.length * (current.copies ?? 1)} in the model`} /></div>
          <div class="field"><span>symbols</span><input bind:value={draft.symbols} placeholder="material.* source.* family.*" /></div>
          <button class="act" disabled={busy || !draft.slug.trim()} onclick={name}>{annotation ? "rename" : "annotate"}</button>
        {/if}
        <div class="label">move to</div>
        <div class="moves">
          {#each PHASES as phase (phase.key)}<button disabled={busy || !canMove(phase.key)} onclick={() => move(phase.key, chosen)}>{phase.key}</button>{/each}
        </div>
        {#if current && !minted}
          <div class="acts">
            {#if current.objects.length > 1}<button disabled={busy} onclick={unmerge}>unmerge</button>{/if}
            <button disabled={busy} onclick={() => drop(!current.dropped)}>{current.dropped ? "take back" : "drop"}</button>
          </div>
        {/if}
      {:else}
        <div class="dim">select a part — in the tree or on the stage. shift ranges, ⌘ adds. drag it onto a phase to move it there.</div>
      {/if}
    </aside>
  </div>

  {#if fault || note || busy}
    <footer class="foot">
      {#if fault}<span class="fault">{fault}</span>{/if}
      {#if note}<span class="dim">{note}</span>{/if}
      {#if busy}<span class="dim">{busy}…</span>{/if}
    </footer>
  {/if}
</div>

<style>
  .import {
    --s1: var(--colors-skeleton-1-surface);
    --s2: var(--colors-skeleton-2-surface);
    --s3: var(--colors-skeleton-3-surface);
    --b0: var(--colors-skeleton-0-boundary);
    --b2: var(--colors-skeleton-2-boundary);
    --t1: var(--text-primary);
    --t2: var(--text-body);
    --t3: var(--text-support);
    --primary: var(--colors-skeleton-0-primary-base);
    --warning: var(--colors-skeleton-0-warning-base);
    --danger: var(--colors-skeleton-0-danger-base);
    --code: var(--font-family-code);
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 480px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--s1);
    color: var(--t1);
    font-family: var(--code);
    font-size: var(--font-size-sm);
    outline: 2px dashed transparent;
    outline-offset: -6px;
    transition: outline-color 120ms;
  }
  .import.hovering {
    outline-color: var(--primary);
  }
  .import * {
    box-sizing: border-box;
  }
  .foot {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 12px;
    background: var(--s2);
    border-top: 1px solid var(--b0);
    white-space: nowrap;
  }
  .foot .dim,
  .fault {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dim {
    color: var(--t3);
  }
  .phases {
    flex: none;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-bottom: 1px solid var(--b0);
  }
  .phase {
    padding: 8px 14px;
    border-right: 1px solid var(--b0);
    color: var(--t3);
    outline: 2px dashed transparent;
    outline-offset: -4px;
    transition: outline-color 120ms;
  }
  .phase.live {
    color: var(--t1);
  }
  .phase.open {
    outline-color: var(--b2);
  }
  .phase.over {
    outline-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
  }
  .phase .count b {
    font-size: var(--font-size-xl);
    font-weight: 500;
    margin-right: 6px;
  }
  .phase .sub {
    font-size: var(--font-size-xs);
  }
  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(220px, 24%) 1fr minmax(220px, 24%);
  }
  .left,
  .right {
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: var(--s2);
    overflow: auto;
  }
  .left {
    border-right: 1px solid var(--b0);
  }
  .right {
    border-left: 1px solid var(--b0);
    padding: 12px;
    gap: 8px;
  }
  .stage {
    position: relative;
    min-width: 0;
    min-height: 0;
    background: var(--s1);
  }
  .stage :global(canvas) {
    display: block;
    outline: none;
  }
  .intake {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }
  .zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 28px 12px;
    border: 2px dashed var(--b2);
    border-radius: 4px;
    background: transparent;
    color: var(--t1);
    font: inherit;
    cursor: pointer;
  }
  .zone:hover:not(:disabled),
  .zone.ready {
    border-color: var(--primary);
  }
  .zone b {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .source {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--b0);
    white-space: nowrap;
  }
  .tree {
    flex: 1;
    overflow: auto;
    padding: 6px 0;
  }
  .collection,
  .member {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
  }
  .collection {
    color: var(--t2);
    margin-top: 4px;
  }
  .member {
    padding-left: 24px;
  }
  .member[draggable="true"] {
    cursor: grab;
  }
  .member:hover {
    background: var(--s3);
  }
  .member.on {
    background: color-mix(in srgb, var(--primary) 16%, transparent);
    color: var(--primary);
  }
  .member.dropped .id {
    text-decoration: line-through;
    color: var(--t3);
  }
  .id {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .caret {
    width: 10px;
    color: var(--t3);
  }
  .dot {
    width: 7px;
    height: 7px;
    flex: none;
    border-radius: 50%;
    background: var(--b2);
  }
  .dot.interpret {
    background: var(--t3);
  }
  .dot.annotate {
    background: var(--warning);
  }
  .dot.embed {
    background: var(--primary);
  }
  .dot.dropped {
    background: var(--danger);
  }
  .acts,
  .moves {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .moves button {
    flex: 1;
  }
  .list {
    display: flex;
    flex-direction: column;
    max-height: 40%;
    overflow: auto;
  }
  .label {
    color: var(--t3);
    font-size: var(--font-size-xs);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .field {
    display: grid;
    grid-template-columns: 64px 1fr;
    align-items: center;
    gap: 8px;
  }
  .field span {
    color: var(--t3);
  }
  input {
    min-width: 0;
    padding: 4px 6px;
    border: 1px solid var(--b0);
    border-radius: 3px;
    background: var(--s1);
    color: var(--t1);
    font: inherit;
  }
  button {
    padding: 5px 10px;
    border: 1px solid var(--b0);
    border-radius: 3px;
    background: transparent;
    color: var(--t2);
    font: inherit;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    border-color: var(--primary);
    color: var(--primary);
  }
  button.act {
    border-color: var(--primary);
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 12%, transparent);
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px 12px;
    margin: 0;
    padding: 8px;
    border: 1px solid var(--b0);
    border-radius: 3px;
    background: var(--s1);
  }
  dt {
    color: var(--t3);
  }
  dd {
    margin: 0;
    color: var(--t1);
    overflow-wrap: anywhere;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }
  .fault {
    color: var(--warning);
  }
  @media (max-width: 900px) {
    .body {
      grid-template-columns: 1fr;
      grid-template-rows: 40% 1fr;
    }
    .right {
      display: none;
    }
    .phases {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
