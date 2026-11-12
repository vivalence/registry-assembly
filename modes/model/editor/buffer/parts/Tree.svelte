<script>
  import { untrack } from "svelte";
  import { FILTERS, SCOPES } from "../../schematics.js";

  let { scroll = 0, onscroll, scope = "daemon", rows = [], empty = "nothing matches", filter = "ALL", query = "", cursor = null, selected = [], subject = null, focus = null, crumbs = [], root = null, above = null, renaming = null, crud = [], onscope, onfilter, onquery, onpick, onopen, ontoggle, onsingle, oncrumb, onup, onrename, oncommit, oncancel } = $props();

  let list = $state(null);
  let restored = false;

  $effect(() => {
    if (restored || !list || !rows.length) return;
    restored = true;
    const offset = untrack(() => scroll);
    const settle = (tries) =>
      requestAnimationFrame(() => {
        if (!list) return;
        list.scrollTop = offset;
        if (Math.abs(list.scrollTop - offset) > 1 && tries) settle(tries - 1);
      });
    settle(30);
  });
  let typing = $state(null);

  $effect(() => {
    typing?.focus();
    typing?.select();
  });

  const chosen = (slug) => selected.includes(slug);
  const LABELS = { daemon: "daemon", buffer: "buffer" };
  const FILTERED = { ALL: "all", PART: "part", PLACEMENT: "place", GUIDE: "guide" };

  const label = (row) => (row.ontology === "placement" ? (row.trait?.PLACED?.name ?? row.name) : row.slug);
  const inactive = (row) => row.ontology === "placement" && row.trait?.PLACED?.active === false;
  const note = (row) => {
    if (row.ontology === "placement") return inactive(row) ? "inactive" : "";
    if (row.ontology === "step") return "step";
    if (row.ontology === "guide") return "guide";
    if (row.trait?.PARAMETRIC) return row.trait.PARAMETRIC.generator.split(".").pop();
    const inside = Number.parseInt(row.tail, 10);
    if (Number.isFinite(inside) && row.tail.includes("placement")) return `${inside}p`;
    if (row.modeled?.tris) return `${row.modeled.tris}t`;
    return "leaf";
  };
  const singled = (row) => (row.ontology === "placement" ? row.ref : row.slug);

  let shownCursor = untrack(() => cursor);

  $effect(() => {
    const at = cursor;
    if (!list || at === shownCursor) return;
    shownCursor = at;
    list.querySelector('[data-cursor="on"]')?.scrollIntoView({ block: "nearest" });
  });
</script>

<div class="top">
  <div class="scopes">
    {#each SCOPES as one}
      <button class="chip" class:on={scope === one} onclick={() => onscope(one)}>{LABELS[one]}</button>
    {/each}
  </div>

  {#if renaming}
    <div class="crud">
      <input class="rename" bind:this={typing} value={renaming.value} oninput={(event) => onrename(event.target.value)} onkeydown={(event) => (event.key === "Enter" ? oncommit() : event.key === "Escape" ? oncancel() : null)} />
      <button class="act go" onclick={oncommit}>ok</button>
      <button class="act fit" onclick={oncancel}>esc</button>
    </div>
  {:else}
    <div class="crud">
      {#each crud as one}
        <button class="act" class:off={!one.on} class:danger={one.danger && one.on} title={one.title} onclick={() => one.on && one.run()}>{one.label}</button>
      {/each}
    </div>
  {/if}

  {#if scope === "daemon"}
    <div class="filters">
      {#each FILTERS as one}
        <button class="filter" class:on={filter === one} onclick={() => onfilter(one)}>{FILTERED[one]}</button>
      {/each}
    </div>
    <input class="search" value={query} placeholder="search" oninput={(event) => onquery(event.target.value)} />
  {:else}
    <div class="walk">
      <button class="step" class:live={root && root !== subject} onclick={() => root && oncrumb(root)}>root</button>
      <button class="step" class:live={!!above} onclick={onup}>up</button>
      <span class="hint">{subject ? `root ${root ?? "—"}` : "pick a model in the daemon view"}</span>
    </div>
    {#if crumbs.length}
      <div class="crumbs">
        {#each crumbs as slug, index (slug + index)}
          <button class="crumb" class:here={index === crumbs.length - 1} onclick={() => oncrumb(slug)}>{slug}</button>
          {#if index < crumbs.length - 1}<span class="sep">›</span>{/if}
        {/each}
      </div>
    {/if}
  {/if}
</div>

<div class="rows" bind:this={list} role="tree" onscrollend={() => onscroll?.(Math.round(list.scrollTop))}>
  {#each rows as row (row.key)}
    <div
      class="row"
      class:subject={subject === row.slug || (row.ontology === "placement" && row.ref === subject)}
      class:on={chosen(row.slug)}
      class:focused={focus === row.slug}
      data-cursor={cursor === row.key ? "on" : "off"}
      role="treeitem"
      tabindex="-1"
      aria-selected={chosen(row.slug)}
      style="padding-left:{5 + row.depth * 11}px"
      onclick={(event) => onpick(row, event)}
      ondblclick={() => onopen(row)}
      onkeydown={() => {}}>
      <button class="caret" tabindex="-1" aria-label="expand" onclick={(event) => (event.stopPropagation(), ontoggle(row))}>
        {#if row.kids}<span class="tri" class:open={row.opened}></span>{/if}
      </button>
      <span class="pip {row.ontology}"></span>
      <span class="label" class:struck={inactive(row)}>{label(row)}</span>
      <span class="note">{note(row)}</span>
      {#if scope === "buffer" && singled(row) && singled(row) !== subject && row.ontology !== "step"}
        <button class="single" tabindex="-1" onclick={(event) => (event.stopPropagation(), onsingle(row))}>subject</button>
      {/if}
    </div>
  {:else}
    <div class="empty">{empty}</div>
  {/each}
</div>

<style>
  .top {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 9px 10px 7px;
    background: var(--panel);
    border-bottom: 1px solid var(--hair);
    min-width: 0;
    overflow: hidden;
  }
  .scopes,
  .crud,
  .filters,
  .walk {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .scopes {
    gap: 6px;
  }
  .chip {
    padding: 2px 8px;
    background: transparent;
    border: 1px solid var(--hair);
    border-radius: var(--radius);
    color: var(--mute);
    font: inherit;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
  }
  .chip.on,
  .filter.on {
    background: var(--pick);
    border-color: var(--pick-edge);
    color: var(--pick-ink);
  }
  .act {
    flex: 1 1 0;
    min-width: 0;
    padding: 4px 2px;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--ink-2);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    overflow: hidden;
    white-space: nowrap;
    cursor: pointer;
  }
  .act:hover {
    border-color: var(--edge);
  }
  .act.off {
    color: var(--edge);
    cursor: default;
  }
  .act.danger {
    color: var(--fail);
  }
  .act.go,
  .act.fit {
    flex: 0 0 auto;
    padding: 3px 8px;
  }
  .act.go {
    border-color: var(--part);
    color: var(--part);
  }
  .act.fit {
    color: var(--dim);
  }
  .rename {
    flex: 1;
    min-width: 0;
    padding: 3px 7px;
    background: var(--field);
    border: 1px solid var(--part);
    border-radius: var(--radius);
    color: var(--ink);
    font: inherit;
    font-size: 11px;
    outline: none;
  }
  .filter {
    flex: 1 1 0;
    min-width: 0;
    padding: 3px 2px;
    background: transparent;
    border: 1px solid var(--hair);
    border-radius: var(--radius);
    color: var(--mute);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    overflow: hidden;
    white-space: nowrap;
    cursor: pointer;
  }
  .search {
    width: 100%;
    padding: 4px 7px;
    background: var(--field);
    border: 1px solid var(--hair);
    border-radius: var(--radius);
    color: var(--ink);
    font: inherit;
    font-size: 11px;
    outline: none;
  }
  .rename:focus,
  .search:focus {
    background: var(--pick);
    border-color: var(--pick-edge);
  }
  .walk {
    gap: 5px;
  }
  .step {
    padding: 2px 7px;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--edge);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
  }
  .step.live {
    color: var(--dim);
  }
  .step.live:first-child {
    color: var(--part);
  }
  .hint {
    flex: 1;
    min-width: 0;
    font-size: 9px;
    color: var(--faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .crumbs {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .crumb {
    max-width: 118px;
    padding: 0;
    background: none;
    border: none;
    color: var(--dim);
    font: inherit;
    font-size: 10px;
    line-height: 1.7;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  .crumb.here {
    color: var(--part);
  }
  .sep {
    font-size: 9px;
    color: var(--faint);
  }
  .rows {
    overflow: auto;
    padding: 4px 0 8px;
    background: var(--recess);
    min-height: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 9px 0 5px;
    border-left: 2px solid transparent;
    user-select: none;
    cursor: pointer;
  }
  .row:hover {
    background: var(--void);
  }
  .row.on,
  .row.subject {
    background: var(--pick);
    border-left-color: var(--part);
  }
  .row.focused {
    border-left-color: var(--step);
  }
  .row[data-cursor="on"] {
    outline: 1px solid var(--line);
    outline-offset: -1px;
  }
  .caret {
    width: 27px;
    height: 27px;
    flex: 0 0 27px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--radius);
    color: var(--ink-2);
    cursor: pointer;
  }
  .caret:hover {
    background: var(--lift);
    color: var(--ink);
  }
  .tri {
    display: block;
    width: 0;
    height: 0;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    border-left: 7px solid currentColor;
    transition: transform 0.12s;
  }
  .tri.open {
    transform: rotate(90deg);
  }
  .pip {
    width: 5px;
    height: 5px;
    flex: 0 0 5px;
    border-radius: 1px;
    background: var(--mute);
  }
  .pip.part {
    background: var(--part);
  }
  .pip.placement {
    border-radius: 50%;
    background: var(--placement);
  }
  .pip.step {
    border-radius: 0;
    background: var(--step);
  }
  .pip.guide {
    background: var(--guide);
  }
  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 27px;
    font-size: 11px;
    color: var(--ink-2);
  }
  .row.on .label,
  .row.subject .label {
    color: var(--pick-ink);
  }
  .label.struck {
    color: var(--faint);
    text-decoration: line-through;
  }
  .note {
    font-size: 10px;
    color: var(--faint);
    white-space: nowrap;
  }
  .single {
    flex: 0 0 auto;
    padding: 0 5px;
    background: transparent;
    border: none;
    color: var(--mute);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.06em;
    cursor: pointer;
  }
  .single:hover {
    color: var(--part);
  }
  .empty {
    padding: 22px 12px;
    text-align: center;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
  }
</style>
