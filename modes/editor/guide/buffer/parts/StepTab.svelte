<script>
  // the step's tab: prerequisites (what shows solid, with tints), the parts it pulls in, its
  // numbered lines, its notes, its camera, its pictures, its tools
  import Lines from "./Lines.svelte";
  import Notes from "./Notes.svelte";
  import Camera from "./Camera.svelte";
  import { TINTS } from "../../schematics.js";

  let { ins, n = 0, steps = [], pre, scope, images = [], tools = [], names = {}, tintsOpen = null, folding = null, ctl } = $props();

  const pad = (v) => String(v).padStart(2, "0");
  const material = (slug) => (slug ? `var(--material-${slug.slice(slug.indexOf(".") + 1)}, var(--iron))` : "var(--iron)");
  const LABELS = { pre: "Prerequisites", parts: "Parts", lines: "Instructions", notes: "Notes", camera: "Camera", media: "Media", tools: "Tools" };
  const metas = $derived({
    pre: pre.summary,
    parts: `${scope.here} in this step`,
    lines: `${ins.lines.length} ${ins.lines.length === 1 ? "line" : "lines"}`,
    notes: String(ins.notes.length),
    camera: ins.staged?.camera ? "saved" : "none",
    media: String(images.length),
    tools: String(tools.filter((tool) => tool.on).length),
  });
  const shown = (key) => !folding || folding.open === key;
  const listed = $derived(!folding || folding.mode === "accordion" || folding.open === null);
  const tintVar = (role) => (role ? `var(--tint-${role})` : "repeating-linear-gradient(135deg, var(--paper) 0 4px, var(--hair) 4px 8px)");
</script>

<div class="head">
  <div class="badge">{pad(n)}</div>
  <input class="name" value={ins.name} placeholder="Untitled step" oninput={(event) => ctl.editStep((held) => (held.name = event.target.value))} />
</div>
{#snippet heading(key, first = false)}
  {#if !folding}
    <div class="h" class:first><span>{LABELS[key]}</span>{#if key === "pre" || key === "parts"}<span class="meta">{metas[key]}</span>{/if}</div>
  {:else if listed}
    <button class="h fold" class:first class:open={folding.open === key} onclick={() => ctl.fold(folding.mode === "accordion" && folding.open === key ? null : key)}>
      <span>{#if folding.mode === "accordion"}<span class="chevron">›</span>{/if}{LABELS[key]}</span><span class="meta">{metas[key]}{folding.mode === "pages" ? " ›" : ""}</span>
    </button>
  {/if}
{/snippet}

<div class="tab" class:paged={folding?.mode === "pages"}>
  {#if folding?.mode === "pages" && folding.open}
    <button class="back" onclick={() => ctl.fold(null)}>‹ {LABELS[folding.open]}</button>
  {/if}
  {@render heading("pre", true)}
  {#if shown("pre")}
  <div class="segments">
    <button class:on={!pre.custom} onclick={() => pre.custom && ctl.autoBuilt()}>All earlier steps</button>
    <button class:on={pre.custom} onclick={() => !pre.custom && ctl.customBuilt()}>Custom</button>
  </div>
  {#if pre.custom}
    <div class="pre">
      {#each pre.items as item (item.id)}
        <div class="item">
          <button class="swatch-btn" title="Display colour" style="background:{tintVar(item.tint)}" class:tinted={!!item.tint} onclick={() => ctl.openTints(item.id)}></button>
          <span class="badge-s">{item.badge}</span>
          <span class="grow">{item.name}</span>
          <span class="meta">{item.meta}</span>
          <button class="x" onclick={() => ctl.removeBuilt(item.id)}>×</button>
        </div>
        {#if tintsOpen === item.id}
          <div class="palette">
            <button title="Material" class="tint" style="background:{tintVar(null)}" class:ring={!item.tint} onclick={() => ctl.setTint(item.id, null)}></button>
            {#each TINTS as role (role)}
              <button title={role} class="tint" style="background:{tintVar(role)}" class:ring={item.tint === role} onclick={() => ctl.setTint(item.id, role)}></button>
            {/each}
          </div>
        {/if}
      {/each}
      {#if !pre.items.length}
        <div class="none">Nothing is done before this step.</div>
      {/if}
      <div class="scope">
        <div class="scope-head">
          <input value={pre.q} placeholder="Add a step, part or placement" oninput={(event) => ctl.preQuery(event.target.value)} />
        </div>
        <div class="types">
          {#if pre.steps.length}
            <div class="group">Steps</div>
            {#each pre.steps as one (one.id)}
              <button class="placement flat" onclick={() => ctl.addBuilt("step", one.id)}><span class="grow">{one.label}</span><span class="add">+</span></button>
            {/each}
          {/if}
          {#if pre.types.length}
            <div class="group">Parts</div>
            {#each pre.types as type (type.id)}
              <div class="type">
                <button class="caret" class:open={type.open} onclick={() => ctl.preOpen(type.id)}>›</button>
                <button class="type-name" onclick={() => ctl.preOpen(type.id)}>{type.name}</button>
                <span class="meta">{type.count} placed</span>
                {#if !type.added}<button class="add-part" title="Every placement of this part" onclick={() => ctl.addBuilt("part", type.id)}>+ all</button>{/if}
              </div>
              {#if type.open}
                {#each type.items as item (item.id)}
                  <button class="placement" style="padding-left:{36 + item.depth * 12}px" onclick={() => ctl.addBuilt("placement", item.id)}>
                    <span class="grow">{item.label}</span>
                    <span class="where {item.where === 'here' ? 'here' : item.where === 'kit' ? 'kit' : 'placed'}">{item.where === "here" ? "this step" : item.where === "kit" ? "kit" : `step ${item.where}`}</span>
                    <span class="add">+</span>
                  </button>
                {/each}
              {/if}
            {/each}
          {/if}
          {#if !pre.steps.length && !pre.types.length}
            <div class="none pad">Nothing matches.</div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
  {/if}

  {@render heading("parts")}
  {#if shown("parts")}
  <div class="scope">
    <div class="scope-head">
      <div class="segments">
        {#each scope.filters as [key, label] (key)}
          <button class:on={scope.filter === key} onclick={() => ctl.scopeFilter(key)}>{label}</button>
        {/each}
      </div>
      <input value={scope.q} placeholder="Search parts" oninput={(event) => ctl.scopeQuery(event.target.value)} />
    </div>
    <div class="types">
      {#each scope.types as type (type.slug)}
        <div class="type" class:some={type.selected > 0}>
          <button class="caret" class:open={type.open} onclick={() => ctl.toggleOpen(type.slug)}>›</button>
          <button class="box" class:on={type.selected > 0} title="select all" onclick={() => ctl.selectType(type)}>{type.selected === type.items.length ? "✓" : type.selected ? "–" : ""}</button>
          <span class="swatch" style="background:{material(type.material)}"></span>
          <button class="type-name" onclick={() => ctl.toggleOpen(type.slug)}>{type.name}</button>
          <span class="meta">{type.summary}</span>
        </div>
        {#if type.open}
          {#each type.items as item (item.slug)}
            <button class="placement" class:on={item.selected} onclick={() => ctl.selectOne(item.slug)}>
              <span class="box small" class:on={item.selected}>{item.selected ? "✓" : ""}</span>
              <span class="grow">{item.label}</span>
              <span class="where {item.where === 'here' ? 'here' : item.where === 'kit' ? 'kit' : 'placed'}">{item.where === "here" ? "this step" : item.where === "kit" ? "kit" : `step ${item.where}`}</span>
            </button>
          {/each}
        {/if}
      {/each}
      {#if !scope.types.length}
        <div class="none pad">{scope.emptyText}</div>
      {/if}
    </div>
    <div class="scope-foot" class:some={scope.selected > 0}>
      <span class="grow strong">{scope.selected ? `${scope.selected} selected` : "Nothing selected"}</span>
      {#if scope.removable}
        <button class="remove" onclick={() => ctl.removeSelected()}>Remove</button>
      {/if}
      <button class="pull" disabled={!scope.pullable} onclick={() => ctl.pullSelected()}>{scope.pullLabel}</button>
    </div>
  </div>
  {/if}

  {@render heading("lines")}
  {#if shown("lines")}
  <Lines
    lines={ins.lines}
    indent
    onset={(k, text) => ctl.editStep((held) => (held.lines[k] = { ...held.lines[k], text }))}
    onremove={(k) => ctl.editStep((held) => held.lines.splice(k, 1))}
    onadd={() => ctl.editStep((held) => held.lines.push({ text: "" }))} />
  {/if}

  {@render heading("notes")}
  {#if shown("notes")}
  <Notes
    notes={ins.notes}
    {names}
    onset={(k, text) => ctl.editStep((held) => (held.notes[k] = { ...held.notes[k], text }))}
    onkind={(k, kind) => ctl.editStep((held) => (held.notes[k] = { ...held.notes[k], symbols: ctl.noteSymbols(kind) }))}
    onremove={(k) => ctl.editStep((held) => held.notes.splice(k, 1))}
    onadd={() => ctl.editStep((held) => held.notes.push({ text: "", symbols: [] }))} />
  {/if}

  {@render heading("camera")}
  {#if shown("camera")}
  <Camera has={!!ins.staged?.camera} onsnap={() => ctl.snapshot("step")} ongo={() => ctl.goCamera("step")} onclear={() => ctl.clearCamera("step")} />
  {/if}

  {@render heading("media")}
  {#if shown("media")}
  <div class="media">
    {#each images as image, k (image.path)}
      <div class="picture" title={image.path} role="button" tabindex="0" onclick={() => ctl.showPicture(image.path)} onkeydown={(event) => event.key === "Enter" && ctl.showPicture(image.path)}>
        <img src={image.url} alt="" />
        <span class="page">{k + 1}</span>
        <button class="rm" title="remove" onclick={(event) => (event.stopPropagation(), ctl.editStep((held) => held.images.splice(k, 1)))}>×</button>
      </div>
    {/each}
    <button class="asset" onclick={() => ctl.openPicker()}>+ asset</button>
  </div>
  {/if}

  {@render heading("tools")}
  {#if shown("tools")}
  <div class="tools">
    {#each tools as tool (tool.slug)}
      <button class="chip" class:on={tool.on} title={tool.slug} onclick={() => ctl.toggleTool(tool.slug)}>⚒ {tool.name}</button>
    {/each}
  </div>
  {/if}
</div>

<style>
  .head {
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .badge {
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
  }
  .name {
    flex: 1;
    min-width: 0;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    padding: 4px 6px;
    font: 700 15px var(--font-family-body);
    color: var(--ink);
    outline-color: var(--step);
  }
  .name:hover {
    border-color: var(--hair);
  }
  .name:focus {
    background: var(--paper);
    border-color: var(--ink);
  }
  .tab {
    flex: 1;
    overflow-y: auto;
    padding: 4px 16px 16px;
    display: flex;
    flex-direction: column;
  }
  .h {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-top: 1px solid var(--hair);
    padding: 14px 16px 0;
    margin: 20px -16px 8px;
    font: 700 13px var(--font-family-body);
    color: var(--ink);
  }
  .h.fold {
    width: calc(100% + 32px);
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
    margin: 12px -16px 4px;
    padding: 12px 16px 0;
  }
  .paged .h.fold {
    margin: 0 -16px;
    padding: 12px 16px;
  }
  .h.fold.first {
    border-top: 0;
  }
  .chevron {
    display: inline-block;
    width: 14px;
    color: var(--dim);
    transition: transform 0.15s;
  }
  .h.fold.open .chevron {
    transform: rotate(90deg);
  }
  .back {
    align-self: flex-start;
    margin: 10px 0 4px;
    border: 0;
    background: transparent;
    padding: 4px 0;
    font: 700 13px var(--font-family-body);
    color: var(--ink);
    cursor: pointer;
  }
  .h.first {
    border-top: 0;
    padding-top: 0;
    margin-top: 14px;
  }
  .meta {
    font-size: 11px;
    color: var(--dim);
    font-weight: 500;
  }
  .segments {
    display: flex;
    background: var(--paper-2);
    border-radius: 5px;
    padding: 2px;
    gap: 2px;
  }
  .segments button {
    flex: 1;
    border: 0;
    border-radius: 4px;
    padding: 5px 6px;
    font: 600 11.5px var(--font-family-body);
    cursor: pointer;
    background: transparent;
    color: var(--dim);
  }
  .segments button.on {
    background: var(--paper);
    color: var(--ink);
    box-shadow: 0 1px 2px color-mix(in srgb, var(--ink) 15%, transparent);
  }
  .pre {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 6px 5px 8px;
    border: 1px solid var(--line);
    border-radius: 4px;
  }
  .swatch-btn {
    flex: none;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1.5px solid var(--hair);
    cursor: pointer;
    padding: 0;
  }
  .swatch-btn.tinted {
    border-color: var(--ink);
  }
  .badge-s {
    flex: none;
    font: 700 11px var(--font-family-body);
    color: var(--dim);
    font-variant-numeric: tabular-nums;
  }
  .grow {
    flex: 1;
    min-width: 0;
    font: 600 12px var(--font-family-body);
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }
  .strong {
    font-weight: 600;
  }
  .x,
  .rm {
    flex: none;
    border: 0;
    background: transparent;
    cursor: pointer;
    color: var(--dim);
    font-size: 14px;
    padding: 0 2px;
  }
  .palette {
    display: flex;
    gap: 6px;
    padding: 4px 0 4px 8px;
  }
  .tint {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }
  .tint.ring {
    border-color: var(--ink);
  }
  .none {
    font-size: 12px;
    color: var(--dim);
    padding: 4px 0;
  }
  .none.pad {
    padding: 14px 10px;
    text-align: center;
  }
  .group {
    padding: 6px 10px 4px;
    font: 700 10.5px var(--font-family-body);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--dim);
    background: var(--paper-2);
  }
  .placement.flat {
    padding-left: 10px;
  }
  .add {
    flex: none;
    font: 700 13px var(--font-family-body);
    color: var(--dim);
  }
  .add-part {
    flex: none;
    border: 1px solid var(--hair);
    border-radius: 3px;
    background: var(--paper);
    padding: 1px 6px;
    font: 600 11px var(--font-family-body);
    color: var(--ink);
    cursor: pointer;
  }
  .scope {
    flex: none;
    border: 1px solid var(--line);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .scope-head {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-bottom: 1px solid var(--line);
    background: var(--paper-2);
  }
  .scope-head input {
    border: 1px solid var(--hair);
    border-radius: 4px;
    padding: 5px 8px;
    font: 500 12px var(--font-family-body);
    color: var(--ink);
    outline-color: var(--step);
  }
  .types {
    max-height: 300px;
    overflow-y: auto;
  }
  .type {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-bottom: 1px solid var(--paper-2);
  }
  .type.some {
    background: var(--tip-surface);
  }
  .caret {
    flex: none;
    border: 0;
    background: transparent;
    cursor: pointer;
    padding: 0;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    color: var(--ink);
    font-size: 16px;
    transition: transform 0.15s;
  }
  .caret.open {
    transform: rotate(90deg);
  }
  .box {
    flex: none;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border: 1.5px solid var(--hair);
    background: var(--paper);
    color: var(--paper);
    font: 700 10px var(--font-family-body);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }
  .box.on {
    background: var(--ink);
    border-color: var(--ink);
  }
  .box.small {
    width: 14px;
    height: 14px;
    font-size: 9px;
  }
  .swatch {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    flex: none;
  }
  .type-name {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    text-align: left;
    font: 600 12px var(--font-family-body);
    color: var(--ink);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .placement {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px 4px 36px;
    border: 0;
    border-bottom: 1px solid var(--paper-2);
    cursor: pointer;
    background: transparent;
    font: 500 12px var(--font-family-body);
    color: var(--ink);
  }
  .placement:hover {
    background: var(--paper-2);
  }
  .placement.on {
    background: var(--tip-surface);
  }
  .where {
    flex: none;
    font: 700 10.5px var(--font-family-body);
    border-radius: 3px;
    padding: 1px 6px;
    border: 1px solid var(--hair);
    background: var(--paper);
    color: var(--ink);
  }
  .where.here {
    background: var(--step);
    border-color: var(--step);
  }
  .where.kit {
    background: var(--paper-2);
    border-color: var(--paper-2);
    color: var(--ink-2);
  }
  .scope-foot {
    padding: 8px;
    border-top: 1px solid var(--line);
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--paper-2);
    font: 600 12px var(--font-family-body);
    color: var(--ink);
  }
  .scope-foot.some {
    background: var(--tip-surface);
  }
  .remove {
    border: 1px solid var(--hair);
    background: var(--paper);
    color: var(--danger);
    border-radius: 4px;
    padding: 5px 8px;
    font: 600 11.5px var(--font-family-body);
    cursor: pointer;
  }
  .pull {
    border: 0;
    background: var(--ink);
    color: var(--paper);
    border-radius: 4px;
    padding: 6px 10px;
    font: 600 11.5px var(--font-family-body);
    cursor: pointer;
  }
  .pull:disabled {
    background: var(--hair);
    cursor: default;
  }
  .media {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .picture {
    position: relative;
    aspect-ratio: 4 / 3;
    border-radius: 4px;
    overflow: hidden;
    cursor: zoom-in;
    background: var(--paper-2);
  }
  .picture img {
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
  .rm {
    position: absolute;
    top: 2px;
    right: 2px;
    background: color-mix(in srgb, var(--paper) 92%, transparent);
    border-radius: 2px;
    font-size: 11px;
    line-height: 1;
    padding: 2px 4px;
    color: var(--ink-2);
  }
  .asset {
    aspect-ratio: 4 / 3;
    border: 1.5px dashed var(--hair);
    border-radius: 4px;
    background: transparent;
    font: 600 11.5px var(--font-family-body);
    color: var(--ink-2);
    cursor: pointer;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .chip {
    border: 1px solid var(--hair);
    background: var(--paper);
    color: var(--ink-2);
    border-radius: 4px;
    padding: 4px 8px;
    font: 600 11.5px var(--font-family-body);
    cursor: pointer;
  }
  .chip.on {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--paper);
  }
</style>
