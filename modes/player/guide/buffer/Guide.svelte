<script>
  import { onMount, untrack } from "svelte";
  import Stage from "./kit/Stage.svelte";
  import { entries as entriesOf } from "./kit/frames.js";
  import { anchored, chips as chipsOf, installs, kindOf, kit as kitOf, pad, sections as sectionsOf, statuses, tints as tintsOf } from "./kit/guide.js";

  const { terminal, buffer, surface } = $props();
  const data = buffer.$data ?? null;
  const files = terminal.client.runtime.entities.file.$entities;

  const SCREEN = { guide: null, step: 0, done: [], explode: 0, ghost: false, view: null, focus: null, lightbox: null };
  const screened = (held = {}) => ({ ...SCREEN, ...held });

  let local = $state(screened(buffer.data ?? {}));
  let guides = $state.raw([]);
  let held = $state.raw(null);
  let geometry = $state.raw({});
  let notice = $state(null);
  let loaded = $state(false);
  let list = $state(null);
  let stage = $state(null);
  let sending = null;
  let token = 0;
  let mounted = false;
  let lastStep = null;
  let lastList = null;
  let width = $state(0);
  let height = $state(0);
  let toc = $state(false);
  let swipe = null;
  let sheet = $state("shown");
  let dragging = $state(null);

  $effect(() => {
    const next = (data ? $data : buffer.data) ?? {};
    local = screened(next);
  });

  const say = (nature, words) => (notice = { nature, words });

  const persist = () => {
    sending = null;
    terminal.client.runtime.entities.buffer.updateOne({ id: buffer.id }, { data: buffer.data }).catch((error) => say("buffer", error.message));
  };
  const retain = (patch, { soon = false } = {}) => {
    buffer.data = { ...(buffer.data ?? {}), ...patch };
    local = screened(buffer.data);
    clearTimeout(sending);
    if (!soon) return persist();
    sending = setTimeout(persist, 400);
  };

  const call = (route, input = {}) => buffer.mode.connection.call(`/${route}`, input);

  const asset = (path) =>
    path
      ? ($files.find((file) => file.path === path && file.mode.daemon === buffer.mode.daemon)?.url ?? null)
      : null;

  async function refresh() {
    try {
      guides = await call("guides", {});
      loaded = true;
    } catch (error) {
      say("/guides refused", error.message);
    }
  }

  async function reread() {
    const slug = local.guide;
    const mine = ++token;
    if (!slug) {
      held = null;
      return;
    }
    try {
      const next = await call("read", { guide: slug });
      const more = {};
      for (const [part, traits] of Object.entries(next.fold.parts)) {
        if (traits.PARAMETRIC && !traits.MODELED && !geometry[part]) more[part] = await call("geometry", traits.PARAMETRIC).catch(() => null);
      }
      if (mine !== token) return;
      if (Object.keys(more).length) geometry = { ...geometry, ...more };
      held = next;
    } catch (error) {
      if (mine !== token) return;
      const known = await call("guides", {}).catch(() => null);
      if (known && !known.some((one) => one.slug === slug)) return retain({ guide: null, step: 0 });
      say("/read refused", error.message);
    }
  }

  $effect(() => {
    const slug = local.guide;
    void slug;
    if (mounted) reread();
  });

  const steps = $derived(held?.steps ?? []);
  const n = $derived(steps.length);
  const step = $derived(Math.min(local.step ?? 0, n));
  const current = $derived(step > 0 ? (steps[step - 1] ?? null) : null);
  const guide = $derived(held?.guide ?? null);
  const fold = $derived(held?.fold ?? null);
  const parts = $derived(held?.parts ?? {});
  const names = $derived(held?.symbols ?? {});
  const groups = $derived(sectionsOf(guide, steps));
  const staged = $derived(step > 0 ? (current?.trait?.STAGED ?? {}) : (guide?.trait?.STAGED ?? {}));
  const ghost = $derived(local.ghost ?? staged.ghost ?? false);
  const explode = $derived(local.explode ?? staged.explode ?? 0);
  const overview = $derived(step === 0 && !staged.camera);
  const view = $derived(local.view ?? staged.camera ?? "iso");
  const fresh = $derived(current ? installs(current) : []);
  const status = $derived(statuses(fold, steps, step, { ghost }));
  const tints = $derived(tintsOf(steps, step, fold));
  const labels = $derived.by(() => {
    const out = {};
    for (const one of fold?.placements ?? []) out[one.slug] = `${parts[one.ref]?.name ?? one.ref}${one.at != null ? ` · step ${pad(one.at + 1)}` : " · not in the guide"}`;
    return out;
  });
  const stageEntries = $derived(entriesOf(fold, { asset, geometry }));
  const focused = $derived(local.focus && local.focus.step === step ? local.focus : null);
  const framed = $derived(focused ? focused.slugs : null);

  const layout = $derived(width >= 1200 ? "wide" : width < 768 ? "phone" : height > width ? "docked" : "float");
  const split = $derived(layout === "docked" || layout === "phone");
  const where = $derived(step === 0 ? "Overview" : (groups.find((group) => group.steps.some((row) => row.n === step))?.name ?? ""));
  const PEEK = 132;
  const stops = $derived({ peek: PEEK, shown: Math.round(height * 0.57), full: height });
  const sheetHeight = $derived(dragging ? dragging.height : stops[sheet]);
  const peeked = $derived(layout === "phone" && sheet === "peek" && !dragging);
  const doneCount = $derived((local.done ?? []).length);

  const isDone = $derived(!!current && (local.done ?? []).includes(current.slug));
  const progress = $derived(n ? Math.round(((local.done ?? []).length / n) * 100) : 0);

  // the step's content — chips, numbered lines, notes, pictures, tools
  const body = $derived.by(() => {
    if (!held) return null;
    if (step === 0) {
      const counts = kitOf(fold);
      const firstOf = (ref) => {
        const found = (fold?.placements ?? []).filter((one) => one.ref === ref && one.at != null).map((one) => one.at);
        return found.length ? Math.min(...found) + 1 : null;
      };
      return {
        chips: chipsOf(fold?.parts, counts, parts).map((chip) => ({ ...chip, at: firstOf(chip.slug), slugs: (fold?.placements ?? []).filter((one) => one.ref === chip.slug).map((one) => one.slug) })),
        lines: guide.trait.INSTRUCTED?.lines ?? [],
        notes: guide.trait.ANNOTATED?.notes ?? [],
        images: guide.trait.INSTRUCTED?.images ?? [],
        tools: [],
      };
    }
    const chips = chipsOf(fold?.parts, current.prepared?.parts ?? {}, parts).map((chip) => ({ ...chip, at: null, slugs: (fold?.placements ?? []).filter((one) => one.ref === chip.slug && fresh.includes(one.slug)).map((one) => one.slug) }));
    return {
      chips,
      lines: current.trait.INSTRUCTED?.lines ?? [],
      notes: current.trait.ANNOTATED?.notes ?? [],
      images: current.trait.INSTRUCTED?.images ?? [],
      tools: (current.prepared?.tools ?? []).map((tool) => names[tool] ?? tool),
    };
  });

  const patchFor = (index) => {
    const at = index > 0 ? steps[index - 1]?.trait?.STAGED : guide?.trait?.STAGED;
    return { step: index, view: null, focus: null, lightbox: null, explode: at && "explode" in at ? at.explode : index === 0 ? 0.75 : 0, ghost: at && "ghost" in at ? at.ghost : false };
  };
  const goTo = (index) => retain(patchFor(Math.max(0, Math.min(n, index))));
  const go = (delta) => goTo(step + delta);

  const setFocus = (id, slugs, event) => {
    const ids = focused?.ids ?? [];
    const add = event && (event.shiftKey || event.metaKey || event.ctrlKey);
    const had = ids.includes(id);
    const nextIds = add ? (had ? ids.filter((one) => one !== id) : [...ids, id]) : had && ids.length === 1 ? [] : [id];
    const byId = { ...(focused?.byId ?? {}), [id]: slugs };
    const all = [...new Set(nextIds.flatMap((one) => byId[one] ?? []))];
    retain({ focus: nextIds.length ? { step, ids: nextIds, byId, slugs: all } : null });
  };

  const toggleDone = () => {
    if (!current) return;
    const done = local.done ?? [];
    if (isDone) return retain({ done: done.filter((one) => one !== current.slug) });
    retain({ done: [...done, current.slug] });
    if (step < n) setTimeout(() => go(1), 350);
  };

  const advance = () => (step === n ? retain({ guide: null }) : go(1));
  const nextLabel = $derived(step === 0 ? "Start building" : step === n ? "Finished" : split ? "Next" : "Next step");
  const choose = (index) => {
    toc = false;
    goTo(index);
  };

  const grabbed = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragging = { y: event.clientY, from: stops[sheet], height: stops[sheet], moved: false };
  };
  const dragged = (event) => {
    if (!dragging) return;
    const dy = event.clientY - dragging.y;
    dragging = { ...dragging, height: Math.max(PEEK, Math.min(height, dragging.from - dy)), moved: dragging.moved || Math.abs(dy) > 4 };
  };
  const dropped = () => {
    if (!dragging) return;
    const { height: at, moved } = dragging;
    dragging = null;
    if (!moved) return (sheet = sheet === "shown" ? "full" : "shown");
    sheet = Object.entries(stops).reduce((best, [name, h]) => (Math.abs(h - at) < Math.abs(stops[best] - at) ? name : best), "shown");
  };
  const frameLine = (id, slugs, event) => {
    setFocus(id, slugs, event);
    if (layout === "phone") sheet = "peek";
  };

  const swiped = (event) => (swipe = { x: event.clientX, y: event.clientY });
  const released = (event) => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };

  const pick = (slug) => {
    if (!slug) return;
    const one = fold?.placements.find((held) => held.slug === slug);
    if (one?.at != null && one.at + 1 !== step) goTo(one.at + 1);
  };

  const openBox = (images, k) => retain({ lightbox: { list: images, k } });
  const closeBox = () => retain({ lightbox: null });
  const turnBox = (delta) => {
    const box = local.lightbox;
    if (!box) return;
    retain({ lightbox: { ...box, k: (box.k + delta + box.list.length) % box.list.length } });
  };

  const kindClass = (note) => {
    const kind = kindOf(note);
    return kind === "note.tip" ? "tip" : kind === "note.warning" ? "warning" : "plain";
  };

  const material = (chip) => (chip.material ? `var(--material-${chip.material.slice(chip.material.indexOf(".") + 1)}, var(--iron))` : "var(--iron)");

  $effect(() => {
    const at = step;
    const shown = list;
    if (!shown || (at === lastStep && shown === lastList)) return;
    lastStep = at;
    lastList = shown;
    untrack(() => {
      const active = shown.querySelector("[data-active]");
      if (!active) return;
      const header = shown.querySelector("[data-section]");
      const hh = header ? header.getBoundingClientRect().height : 34;
      const top = active.getBoundingClientRect().top - shown.getBoundingClientRect().top + shown.scrollTop - hh;
      shown.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
  });

  function keyed(event) {
    if (/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName ?? "")) return;
    if (event.key === "ArrowRight") go(1);
    if (event.key === "ArrowLeft") go(-1);
    if (event.key === "Escape") retain({ lightbox: null });
  }

  onMount(() => {
    mounted = true;
    refresh();
    reread();
  });
</script>

<svelte:window onkeydown={keyed} />
<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
</svelte:head>

{#snippet content(inline)}
  <div class="content">
    {#if body.chips.length}
      <div class="chips">
        {#each body.chips as chip, k (chip.slug)}
          <button class="chip" class:on={focused?.ids.includes(`c${k}`)} title={step > 0 ? "Show in 3D" : chip.at ? `Installed in step ${pad(chip.at)}` : "Not installed by any step yet"} onclick={(event) => setFocus(`c${k}`, chip.slugs, event)}>
            <span class="swatch" style="background:{material(chip)}"></span>{chip.name}{chip.n > 1 ? ` ×${chip.n}` : ""}
          </button>
        {/each}
      </div>
    {/if}
    {#each body.lines as line, k (k)}
      <button class="line" class:on={focused?.ids.includes(`t${k}`)} title="Show in 3D" onclick={(event) => frameLine(`t${k}`, anchored(line.at, step > 0 ? fresh : []), event)}><span class="n">{body.lines.length > 1 ? k + 1 : ""}</span><span>{line.text}</span></button>
    {/each}
    {#each body.notes as note, k (k)}
      <div class="note {kindClass(note)}">{#if kindClass(note) === "tip"}<b>Tip · </b>{/if}{note.text}</div>
    {/each}
    {#if body.images.length}
      <div class="images">
        {#each body.images as image, k (image)}
          <button class="image" onclick={() => openBox(body.images, k)}><img src={asset(image)} alt="" /><span class="page">{k + 1}</span></button>
        {/each}
      </div>
    {/if}
    {#if body.tools.length}
      <div class="tools"><span class="label">Tools</span>{#each body.tools as tool (tool)}<span class="tool">⚒ {tool}</span>{/each}</div>
    {/if}
    {#if inline}
      {#if step === 0}
        <button class="primary" onclick={() => go(1)}>Start</button>
      {:else}
        <button class="done" class:is={isDone} onclick={toggleDone}>{isDone ? "✓ Completed" : "Completed"}</button>
      {/if}
    {/if}
  </div>
{/snippet}

{#snippet rows(open)}
  <div class="section" data-section>Overview</div>
  {#if step === 0 && open}
    <div class="active" data-active>
      <div class="toc-row"><div class="badge">—</div><div class="heading">{guide?.name ?? "Overview"}</div></div>
      {#if body}{@render content(true)}{/if}
    </div>
  {:else}
    <button class="idle" class:current={step === 0} data-active={step === 0 ? true : undefined} onclick={() => choose(0)}><div class="num" class:past={step > 0}>—</div><div class="name" class:past={step > 0}>{guide?.name ?? "Overview"}</div></button>
  {/if}
  {#each groups as group (group.name)}
    <div class="section" data-section>{group.name}</div>
    {#each group.steps as row (row.slug)}
      {#if row.n === step && open}
        <div class="active" data-active>
          <div class="toc-row"><div class="badge">{pad(row.n)}</div><div class="heading">{row.step?.name || "Untitled step"}</div></div>
          {#if body}{@render content(true)}{/if}
        </div>
      {:else}
        <button class="idle" class:current={row.n === step} data-active={row.n === step ? true : undefined} onclick={() => choose(row.n)}>
          <div class="num" class:past={row.n < step} class:is={(local.done ?? []).includes(row.slug)}>{(local.done ?? []).includes(row.slug) && row.n !== step ? "✓" : pad(row.n)}</div>
          <div class="name" class:past={row.n < step}>{row.step?.name || "Untitled step"}</div>
        </button>
      {/if}
    {/each}
  {/each}
{/snippet}

{#snippet picker()}
  <div class="head">
    <div class="title">Guides</div>
    <div class="source">{loaded ? (guides.length ? "pick one to build" : "the daemon holds no guide yet") : "reading the daemon…"}</div>
  </div>
  <div class="list">
    {#each guides as one (one.slug)}
      <button class="idle" onclick={() => retain({ guide: one.slug, ...patchFor(0), done: [] })}>
        <div class="num">{one.steps}</div>
        <div class="name">{one.name}<span class="sub">{one.subject ? ` · builds ${one.subject}` : " · no subject yet"}</span></div>
      </button>
    {/each}
  </div>
{/snippet}

{#snippet opened()}
  {#if layout === "phone"}<div class="where">{where}{step > 0 ? ` · step ${step} of ${n}` : ""}</div>{/if}
  <div class="pane-heading"><div class="badge">{step === 0 ? "—" : pad(step)}</div><div class="heading">{step === 0 ? (guide?.name ?? "Overview") : current?.name || "Untitled step"}</div></div>
  {#if body}{@render content(false)}{/if}
{/snippet}

<div class="player {layout}" role="application" aria-label="Assembly guide" bind:clientWidth={width} bind:clientHeight={height}>
  <div class="field" class:dragging style={layout === "phone" ? `bottom:${Math.min(sheetHeight, stops.shown)}px` : null}>
    <Stage
      entries={stageEntries}
      {status}
      {tints}
      {labels}
      {explode}
      {overview}
      {step}
      {view}
      selected={framed ?? []}
      {ghost}
      focus={framed}
      empty={local.guide ? "loading the stage…" : "no guide open"}
      onpick={pick}
      onghost={() => retain({ ghost: !ghost })}
      onexplode={(value) => retain({ explode: value }, { soon: true })}
      onfault={(words) => say("stage", words)} />
    {#if split && local.guide}
      <div class="card">
        {#if layout === "phone"}<button class="menu-btn" aria-label="Steps" onclick={() => (toc = true)}>☰</button>{/if}
        <div class="card-text">
          <div class="title">{guide?.name ?? local.guide}</div>
          {#if layout === "phone"}<div class="bar"><div class="fill" style="width:{progress}%"></div></div>{/if}
        </div>
        {#if layout === "docked"}<div class="bar"><div class="fill" style="width:{progress}%"></div></div>{/if}
        <div class="count">{doneCount} / {n}</div>
      </div>
    {/if}
  </div>

  <div class="panel" class:columns={layout === "docked" && !!local.guide} class:dragging style={layout === "phone" ? `height:${sheetHeight}px` : null}>
    {#if !local.guide}
      {@render picker()}
    {:else if !split}
      <div class="head">
        <div class="title">{guide?.name ?? local.guide}</div>
        <div class="source">{guide?.trait?.LABELED?.description ?? (held ? "" : "reading…")}</div>
        <div class="progress">
          <div class="bar"><div class="fill" style="width:{progress}%"></div></div>
          <div class="count">{doneCount} / {n} done</div>
        </div>
      </div>
      <div class="list" bind:this={list}>{@render rows(true)}</div>
      <div class="foot">
        <button class="back" disabled={step === 0} onclick={() => go(-1)}>Back</button>
        <button class="next" onclick={advance}>{nextLabel}</button>
      </div>
    {:else if layout === "docked"}
      <div class="list steps" bind:this={list}>{@render rows(false)}</div>
      <div class="pane">
        <div class="pane-body">{@render opened()}</div>
        <div class="foot">
          <button class="back" disabled={step === 0} onclick={() => go(-1)}>Back</button>
          {#if step > 0}
            <button class="done" class:is={isDone} onclick={toggleDone}>{isDone ? "✓ Completed" : "Completed"}</button>
            <button class="next short" onclick={advance}>{nextLabel}</button>
          {:else}
            <button class="next" onclick={advance}>{nextLabel}</button>
          {/if}
        </div>
      </div>
    {:else}
      <div class="grip" role="slider" aria-label="Sheet" aria-valuenow={sheetHeight} tabindex="0" onpointerdown={grabbed} onpointermove={dragged} onpointerup={dropped} onpointercancel={dropped} onkeydown={(event) => event.key === "Enter" && (sheet = sheet === "shown" ? "full" : "shown")}><span></span></div>
      {#if peeked}
        <button class="peek" onclick={() => (sheet = "shown")}><span class="badge">{step === 0 ? "—" : pad(step)}</span><span class="heading">{step === 0 ? (guide?.name ?? "Overview") : current?.name || "Untitled step"}</span></button>
      {:else}
        <div class="pane-body" role="presentation" onpointerdown={swiped} onpointerup={released} onpointercancel={() => (swipe = null)}>{@render opened()}</div>
      {/if}
      <div class="foot stacked">
        {#if step > 0 && !peeked}<button class="done" class:is={isDone} onclick={toggleDone}>{isDone ? "✓ Completed" : "Completed"}</button>{/if}
        <div class="pair">
          <button class="back" disabled={step === 0} onclick={() => go(-1)}>Back</button>
          <button class="next" onclick={advance}>{nextLabel}</button>
        </div>
      </div>
    {/if}
  </div>

  {#if toc && layout === "phone" && local.guide}
    <div class="toc">
      <div class="toc-head">
        <div class="title">{guide?.name ?? local.guide}</div>
        <button class="menu-btn" aria-label="Close steps" onclick={() => (toc = false)}>×</button>
      </div>
      <div class="list" bind:this={list}>{@render rows(false)}</div>
    </div>
  {/if}

  {#if local.lightbox}
    {@const box = local.lightbox}
    <div class="scrim" role="presentation" onclick={closeBox}>
      <div class="box" role="presentation" onclick={(event) => event.stopPropagation()}>
        <img src={asset(box.list[box.k])} alt="" />
        <div class="box-foot">
          <span class="grow">{box.list[box.k]} · {box.k + 1} of {box.list.length}</span>
          <button class="ghost-btn" onclick={() => turnBox(-1)}>←</button>
          <button class="ghost-btn" onclick={() => turnBox(1)}>→</button>
          <button class="solid-btn" onclick={closeBox}>Close</button>
        </div>
      </div>
    </div>
  {/if}

  {#if notice}
    <div class="notice" role="status"><b>{notice.nature}</b> {notice.words}<button onclick={() => (notice = null)}>×</button></div>
  {/if}
</div>

<style>
  .player {
    --paper: #fff;
    --paper-2: #eef0f4;
    --paper-3: #f3f4f7;
    --cube-face: #f7f8fa;
    --cube-on: #fdf1c4;
    --control-edge: #c9ced6;
    --menu-on: #eef0f5;
    --ground: #e7e9ed;
    --hair: #d5d9e0;
    --line: #e5e7eb;
    --ink: #17214d;
    --ink-2: #1f2433;
    --dim: #6b7280;
    --iron: #9aa0ab;
    --danger: #b3261e;
    --step: #f6c630;
    --step-surface: #fdf8e7;
    --step-deep: #f6e3a1;
    --good: #3f8a3a;
    --good-surface: #e7f3e4;
    --tip: #3b6fd1;
    --tip-surface: #eef3fb;
    --warn-bg: #fdf0df;
    --warn-ink: #a85500;
    --warn-edge: #c46a0a;
    --stage-line: #b3b9c4;
    --stage-hair: #cfd3da;
    --stage-fresh: #f6c630;
    --stage-picked: #3b82f6;
    --stage-ghost: #9aa3b5;
    --stage-edge: #1a1d24;
    --stage-edge-light: #9aa1ad;
    --stage-edge-fresh: #6b4e00;
    --stage-edge-ghost: #5b6475;
    --stage-edge-picked: #1d4ed8;
    --tint-info: #3b6fd1;
    --tint-success: #4f9a47;
    --tint-warning: #d98a1c;
    --tint-danger: #c0392b;
    --tint-accent: #7c5cc4;
    --tint-contrast: #9aa3b5;
    --material-carbon: #2b2f3a;
    --material-printed: #4a4f5c;
    --material-fastener: #9aa0ab;
    --material-electronics: #3f6b3a;
    --material-motor: #6b6a2a;
    --material-soft_goods: #8cc63f;
    --text-light: #6b7280;
    --font-family-body: Inter, system-ui, sans-serif;
    --font-family-code: "IBM Plex Mono", monospace;
    -webkit-font-smoothing: antialiased;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 620px;
    overflow: hidden;
    background: var(--ground);
    color: var(--ink-2);
    font-family: var(--font-family-body);
    font-size: 13px;
  }
  .player :global(*) {
    box-sizing: border-box;
  }
  .field {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 412px;
  }
  .scrim {
    position: absolute;
    inset: 0 0 0 412px;
    background: color-mix(in srgb, var(--ink) 55%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    z-index: 5;
  }
  .box {
    background: var(--paper);
    border-radius: 8px;
    padding: 10px;
    max-width: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 20px 60px color-mix(in srgb, var(--ink) 30%, transparent);
  }
  .box img {
    max-width: min(900px, 100%);
    max-height: calc(100vh - 160px);
    object-fit: contain;
    border-radius: 4px;
    display: block;
  }
  .box-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--dim);
  }
  .grow {
    flex: 1;
  }
  .ghost-btn,
  .solid-btn,
  .back,
  .next,
  .primary,
  .done {
    font: 600 12px var(--font-family-body);
    border-radius: 4px;
    cursor: pointer;
  }
  .ghost-btn {
    border: 1.5px solid var(--ink);
    background: var(--paper);
    color: var(--ink);
    padding: 3px 10px;
  }
  .solid-btn {
    border: 0;
    background: var(--ink);
    color: var(--paper);
    padding: 5px 12px;
  }
  .panel {
    position: absolute;
    left: 16px;
    top: 16px;
    bottom: 16px;
    width: 380px;
    background: var(--paper);
    border-radius: 8px;
    box-shadow: 0 2px 12px color-mix(in srgb, var(--ink) 10%, transparent);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 3;
  }
  .head {
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--line);
  }
  .title {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }
  .source {
    font-size: 12px;
    color: var(--dim);
    margin-top: 3px;
    line-height: 1.35;
  }
  .progress {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
  }
  .bar {
    flex: 1;
    height: 4px;
    background: var(--paper-2);
    border-radius: 2px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--step);
  }
  .count {
    font-size: 11px;
    color: var(--dim);
    font-variant-numeric: tabular-nums;
  }
  .list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0 12px;
  }
  .section {
    font-size: 11.5px;
    color: var(--dim);
    padding: 14px 20px 4px;
  }
  .active {
    background: var(--step-surface);
    border-left: 3px solid var(--step);
    padding: 12px 18px 16px 17px;
  }
  .toc-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .badge {
    flex: none;
    min-width: 30px;
    height: 24px;
    border-radius: 4px;
    background: var(--step);
    color: var(--ink);
    font-size: 12.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
  }
  .heading {
    flex: 1;
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.3;
    padding-top: 1px;
  }
  .content {
    padding-left: 42px;
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--paper-2);
    border: 1.5px solid transparent;
    border-radius: 4px;
    padding: 3px 7px;
    font: 600 11.5px var(--font-family-body);
    color: var(--ink);
    cursor: pointer;
  }
  .chip:hover {
    border-color: var(--ink);
  }
  .chip.on {
    background: var(--step-deep);
    border-color: var(--step);
  }
  .swatch {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    flex: none;
  }
  .line {
    display: flex;
    gap: 8px;
    text-align: left;
    border: 0;
    border-radius: 5px;
    padding: 5px 8px;
    margin: 0 -8px;
    background: transparent;
    font: 400 13px var(--font-family-body);
    line-height: 1.5;
    color: var(--ink-2);
    cursor: pointer;
  }
  .line:hover {
    background: var(--step-surface);
  }
  .line.on {
    background: var(--step-deep);
    box-shadow: inset 0 0 0 1.5px var(--step);
  }
  .line .n {
    flex: none;
    color: var(--dim);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .note {
    padding: 7px 10px;
    font-size: 12.5px;
    line-height: 1.45;
    border-radius: 0 3px 3px 0;
    border-left: 3px solid var(--iron);
    background: var(--paper-2);
    color: var(--ink-2);
  }
  .note.tip {
    background: var(--tip-surface);
    border-left-color: var(--tip);
    color: var(--ink);
  }
  .note.warning {
    background: var(--warn-bg);
    border-left-color: var(--warn-edge);
    color: var(--warn-ink);
  }
  .images {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .image {
    position: relative;
    border: 0;
    padding: 0;
    border-radius: 4px;
    overflow: hidden;
    cursor: zoom-in;
    aspect-ratio: 4 / 3;
    background: var(--paper-2);
  }
  .image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .page {
    position: absolute;
    left: 3px;
    bottom: 3px;
    font-size: 9.5px;
    font-weight: 700;
    background: color-mix(in srgb, var(--paper) 92%, transparent);
    color: var(--ink);
    border-radius: 2px;
    padding: 0 4px;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid var(--step-deep);
  }
  .tools .label {
    font-size: 11px;
    color: var(--dim);
    margin-right: 2px;
  }
  .tool {
    border: 1.5px solid var(--ink);
    border-radius: 4px;
    padding: 3px 8px;
    font: 600 11.5px var(--font-family-body);
    color: var(--ink);
    background: var(--paper);
    white-space: nowrap;
  }
  .primary,
  .done {
    margin-top: 6px;
    height: 38px;
    border-radius: 5px;
    border: 0;
    font-size: 13.5px;
    flex: none;
  }
  .primary {
    background: var(--ink);
    color: var(--paper);
  }
  .done {
    border: 1.5px solid var(--good);
    background: var(--good);
    color: var(--paper);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .done.is {
    background: var(--good-surface);
    color: var(--good);
  }
  .idle {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: 0;
    background: transparent;
    text-align: left;
    padding: 8px 20px;
    cursor: pointer;
    font-family: inherit;
  }
  .idle:hover {
    background: var(--paper-2);
  }
  .num {
    min-width: 30px;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--ink-2);
    padding-left: 3px;
    font-variant-numeric: tabular-nums;
  }
  .num.past {
    color: var(--dim);
  }
  .num.is {
    color: var(--good);
  }
  .name {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--ink);
  }
  .name.past {
    color: var(--dim);
  }
  .sub {
    font-weight: 500;
    color: var(--dim);
  }
  .foot {
    border-top: 1px solid var(--line);
    padding: 12px 20px 16px;
    display: flex;
    gap: 8px;
  }
  .back {
    flex: none;
    padding: 0 16px;
    height: 40px;
    border-radius: 5px;
    border: 1.5px solid var(--ink);
    background: var(--paper);
    color: var(--ink);
    font-size: 14px;
  }
  .back:disabled {
    border-color: var(--hair);
    color: var(--dim);
    cursor: default;
  }
  .next {
    flex: 1;
    height: 40px;
    border-radius: 5px;
    border: 0;
    background: var(--ink);
    color: var(--paper);
    font-size: 14px;
  }
  .notice {
    position: absolute;
    right: 16px;
    top: 16px;
    z-index: 6;
    background: var(--warn-bg);
    color: var(--warn-ink);
    border: 1px solid var(--warn-edge);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .notice button {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 14px;
  }
  .float .field,
  .float .scrim {
    left: 352px;
  }
  .float .panel {
    width: 320px;
  }
  .docked .field {
    left: 0;
    bottom: 460px;
  }
  .docked .panel,
  .phone .panel {
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
  }
  .docked .panel {
    top: auto;
    height: 460px;
    border-radius: 12px 12px 0 0;
    box-shadow: 0 -4px 20px color-mix(in srgb, var(--ink) 10%, transparent);
  }
  .panel.columns {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
  }
  .docked .scrim,
  .phone .scrim {
    left: 0;
    z-index: 8;
  }
  .phone .field {
    left: 0;
    transition: bottom 0.2s ease;
  }
  .phone .panel {
    top: auto;
    transition: height 0.2s ease;
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -6px 24px color-mix(in srgb, var(--ink) 14%, transparent);
  }
  .steps {
    min-height: 0;
    border-right: 1px solid var(--line);
    padding: 8px 0;
  }
  .steps .section {
    padding: 10px 20px 4px;
  }
  .steps .idle {
    padding: 9px 20px;
  }
  .idle.current {
    background: var(--step-surface);
    border-left: 3px solid var(--step);
    padding-left: 17px;
  }
  .idle.current .num,
  .idle.current .name {
    color: var(--ink);
    font-weight: 700;
  }
  .pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .pane-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 18px 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .pane-body .content {
    padding-left: 0;
    margin-top: 0;
    gap: 10px;
  }
  .pane-body .line {
    font-size: 14px;
  }
  .pane-heading {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .pane-heading .heading {
    font-size: 18px;
    padding-top: 0;
  }
  .where {
    font-size: 11.5px;
    color: var(--dim);
  }
  .docked .foot {
    padding: 12px 24px 16px;
  }
  .docked .foot button,
  .phone .foot button {
    height: 44px;
    font-size: 14px;
    margin-top: 0;
  }
  .docked .foot .back {
    padding: 0 18px;
  }
  .foot .done {
    flex: 1;
  }
  .next.short {
    flex: none;
    padding: 0 18px;
  }
  .phone .panel.dragging,
  .phone .field.dragging {
    transition: none;
  }
  .peek {
    display: flex;
    align-items: center;
    gap: 12px;
    border: 0;
    background: transparent;
    padding: 0 18px 8px;
    text-align: left;
    cursor: pointer;
    min-width: 0;
  }
  .peek .heading {
    font-size: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .grip {
    display: flex;
    justify-content: center;
    padding: 8px 0 6px;
    cursor: grab;
    touch-action: none;
  }
  .grip span {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--hair);
  }
  .phone .pane-body {
    padding: 8px 18px 12px;
    touch-action: pan-y;
  }
  .phone .chip {
    padding: 5px 9px;
    font-size: 12px;
  }
  .foot.stacked {
    flex-direction: column;
    padding: 10px 14px 14px;
    margin-top: auto;
  }
  .phone .foot .done {
    flex: none;
    height: 48px;
    font-size: 15px;
  }
  .pair {
    display: flex;
    gap: 8px;
  }
  .pair button {
    flex: 1;
  }
  .card {
    position: absolute;
    left: 16px;
    top: 16px;
    right: 16px;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--paper);
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 2px 12px color-mix(in srgb, var(--ink) 10%, transparent);
  }
  .card-text {
    flex: 1;
    min-width: 0;
  }
  .card .title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card > .bar {
    flex: none;
    width: 140px;
  }
  .card-text .bar {
    margin-top: 5px;
  }
  .phone .card {
    left: 10px;
    top: 10px;
    right: 10px;
    gap: 10px;
    padding: 10px 12px;
  }
  .menu-btn {
    flex: none;
    width: 36px;
    height: 36px;
    border: 1px solid var(--hair);
    border-radius: 6px;
    background: var(--paper);
    color: var(--ink);
    font-size: 15px;
    cursor: pointer;
  }
  .toc {
    position: absolute;
    inset: 0;
    z-index: 7;
    background: var(--paper);
    display: flex;
    flex-direction: column;
  }
  .toc-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 12px 12px 20px;
    border-bottom: 1px solid var(--line);
  }
  .toc-head .title {
    flex: 1;
    min-width: 0;
  }
  .docked .notice,
  .phone .notice {
    top: 80px;
  }
</style>
