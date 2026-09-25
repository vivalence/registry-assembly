<script>
  // the guide's own tab: the subject it builds, its name and description, its intro, its notes,
  // its overview camera, the inventory of what the build uses
  import Lines from "./Lines.svelte";
  import Notes from "./Notes.svelte";
  import Camera from "./Camera.svelte";

  let { meta, subjects = [], subject = null, subjOpen = false, subjQ = "", subjectName = "", inventory, names = {}, ctl } = $props();

  const query = $derived(subjQ.trim().toLowerCase());
  const hit = (text) => !query || text.toLowerCase().includes(query);
  const rows = $derived.by(() => {
    const out = [];
    for (const root of subjects) {
      const inside = root.inside.filter((one) => hit(one.name) || hit(one.slug));
      if (query && !hit(root.name) && !hit(root.slug) && !inside.length) continue;
      out.push({ slug: root.slug, name: root.name, meta: `${root.placements} placements`, depth: 0 });
      for (const one of query ? inside : root.inside) out.push({ slug: one.slug, name: one.name, meta: `${one.placements} placements`, depth: 1 });
    }
    return out;
  });
  const material = (slug) => (slug ? `var(--material-${slug.slice(slug.indexOf(".") + 1)}, var(--iron))` : "var(--iron)");
</script>

<div class="tab">
  <div class="h first">Subject</div>
  <div class="subject">
    <button class="picker" onclick={ctl.toggleSubjects}>
      <span class="crumbs">{subject ? subjectName || subject : "— pick the part this guide builds"}</span>
      <span class="caret" class:open={subjOpen}>›</span>
    </button>
    <div class="note">{subject ? `${inventory.placements} placements in scope` : "no subject — the stage stays empty"}</div>
    {#if subjOpen}
      <div class="dropdown">
        <div class="search"><input value={subjQ} placeholder="Search assemblies and parts" oninput={(event) => ctl.subjectQuery(event.target.value)} /></div>
        <div class="options">
          {#if !rows.length}
            <div class="none">No match</div>
          {/if}
          {#each rows as row (row.slug)}
            <div class="option" class:on={row.slug === subject} style="padding-left:{8 + row.depth * 18}px">
              <button class="name" class:root={row.depth === 0} onclick={() => ctl.setSubject(row.slug)}>{row.name}</button>
              <span class="meta">{row.meta}</span>
              {#if row.slug === subject}<span class="tag">subject</span>{/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="h">Name</div>
  <input class="field big" value={meta.name} oninput={(event) => ctl.editGuide((held) => (held.name = event.target.value))} />
  <div class="h">Description</div>
  <input class="field" value={meta.description} oninput={(event) => ctl.editGuide((held) => (held.description = event.target.value))} />

  <div class="h">Intro</div>
  <Lines
    lines={meta.lines}
    onset={(k, text) => ctl.editGuide((held) => (held.lines[k] = { ...held.lines[k], text }))}
    onremove={(k) => ctl.editGuide((held) => held.lines.splice(k, 1))}
    onadd={() => ctl.editGuide((held) => held.lines.push({ text: "" }))} />

  <div class="h">Notes</div>
  <Notes
    notes={meta.notes}
    {names}
    onset={(k, text) => ctl.editGuide((held) => (held.notes[k] = { ...held.notes[k], text }))}
    onkind={(k, kind) => ctl.editGuide((held) => (held.notes[k] = { ...held.notes[k], symbols: ctl.noteSymbols(kind) }))}
    onremove={(k) => ctl.editGuide((held) => held.notes.splice(k, 1))}
    onadd={() => ctl.editGuide((held) => held.notes.push({ text: "", symbols: [] }))} />

  <div class="h">Camera</div>
  <Camera has={!!meta.staged?.camera} onsnap={() => ctl.snapshot("guide")} ongo={() => ctl.goCamera("guide")} onclear={() => ctl.clearCamera("guide")} />

  <div class="h">Inventory</div>
  <div class="sub">Parts</div>
  <div class="inv">
    {#each inventory.parts as item (item.slug)}
      <div class="item"><span class="swatch" style="background:{material(item.material)}"></span><span class="grow">{item.name}</span><span class="count">×{item.n}</span></div>
    {/each}
  </div>
  <div class="sub">Fasteners</div>
  <div class="inv">
    {#each inventory.fasteners as item (item.slug)}
      <div class="item"><span class="swatch" style="background:{material(item.material)}"></span><span class="grow">{item.name}</span><span class="count">×{item.n}</span></div>
    {/each}
  </div>
  <div class="sub">Tools</div>
  <div class="inv">
    {#each inventory.tools as item (item.slug)}
      <div class="item"><span class="swatch ink"></span><span class="grow">{item.name}</span><span class="count">steps {item.steps}</span></div>
    {/each}
  </div>
</div>

<style>
  .tab {
    flex: 1;
    overflow-y: auto;
    padding: 14px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .h {
    font: 700 13px var(--font-family-body);
    color: var(--ink);
    border-top: 1px solid var(--hair);
    padding: 14px 16px 0;
    margin: 10px -16px 0;
  }
  .h.first {
    border-top: 0;
    padding-top: 0;
    margin: 0 -16px -2px;
  }
  .sub {
    font-size: 11px;
    color: var(--dim);
    margin: 2px 0 -6px;
  }
  .subject {
    position: relative;
  }
  .picker {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1.5px solid var(--ink);
    background: var(--paper);
    border-radius: 5px;
    padding: 7px 9px;
    cursor: pointer;
    text-align: left;
    font: 600 13px var(--font-family-body);
    color: var(--ink);
  }
  .crumbs {
    flex: 1;
    min-width: 0;
  }
  .caret {
    flex: none;
    transition: transform 0.15s;
  }
  .caret.open {
    transform: rotate(90deg);
  }
  .note {
    font-size: 11px;
    color: var(--dim);
    margin-top: 4px;
  }
  .dropdown {
    margin-top: 6px;
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
    background: var(--paper);
  }
  .search {
    padding: 6px;
    border-bottom: 1px solid var(--line);
    background: var(--paper-2);
  }
  .search input,
  .field {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--hair);
    border-radius: 4px;
    padding: 5px 8px;
    font: 500 12px var(--font-family-body);
    color: var(--ink);
    outline-color: var(--step);
  }
  .field {
    padding: 7px 9px;
    font-size: 13px;
  }
  .field.big {
    font-size: 14px;
    font-weight: 600;
  }
  .options {
    max-height: 320px;
    overflow-y: auto;
  }
  .none {
    padding: 12px;
    font-size: 12px;
    color: var(--dim);
    text-align: center;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-bottom: 1px solid var(--paper-2);
  }
  .option.on {
    background: var(--step-surface);
  }
  .option .name {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font: 500 12px var(--font-family-body);
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .option .name.root {
    font-weight: 700;
    font-size: 12.5px;
  }
  .meta {
    flex: none;
    font-size: 10.5px;
    color: var(--dim);
  }
  .tag {
    flex: none;
    font: 700 10px var(--font-family-body);
    color: var(--ink);
    background: var(--step);
    border-radius: 3px;
    padding: 1px 5px;
  }
  .inv {
    display: flex;
    flex-direction: column;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 12.5px;
    color: var(--ink);
    border-bottom: 1px solid var(--paper-2);
  }
  .swatch {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    flex: none;
  }
  .swatch.ink {
    background: var(--ink);
  }
  .grow {
    flex: 1;
  }
  .count {
    color: var(--dim);
    font-variant-numeric: tabular-nums;
  }
</style>
