<script>
  let { rows, counts, chosen, onpick } = $props();

  const ONTOLOGIES = ["part", "placement", "step"];
  const rail = (depth) => (depth ? `${"   ".repeat(depth - 1)}  └` : "");
  const summary = $derived(ONTOLOGIES.map((ontology) => `${counts?.[ontology] ?? 0} ${ontology}`).join(" · "));
  const stamp = (row) => row.ontology.toUpperCase();
</script>

<div class="head">
  <b>LITERALS</b>
  <span class="sub">{summary}</span>
  <span class="gap"></span>
  <span class="legend">▣ part · ▤ placement</span>
</div>

{#each rows as row (row.key)}
  <button class="row" class:on={row.key === chosen} onclick={() => onpick(row.key)}>
    <span class="rail">{rail(row.depth)}</span>
    <span class="glyph {row.ontology}">{row.ontology === "placement" ? "▤" : "▣"}</span>
    <span class="name" class:deep={row.depth > 0}>{row.name}</span>
    <span class="kind {row.ontology}">{stamp(row)}</span>
    <span class="tail">{row.tail}</span>
  </button>
{:else}
  <div class="empty">nothing committed here yet — drop a model file</div>
{/each}

<style>
  .glyph.placement,
  .kind.placement {
    color: var(--mute);
  }
  .legend {
    color: var(--mute);
    font-size: 11px;
  }
  .row {
    display: flex;
    width: 100%;
    gap: 10px;
    align-items: baseline;
    padding: 8px 18px;
    border: 0;
    border-bottom: 1px solid var(--hair);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .row:hover {
    background: var(--hover);
  }
  .row.on {
    background: var(--pick);
  }
  .rail {
    color: var(--dash);
    flex: none;
    white-space: pre;
    font-size: 11.5px;
  }
  .glyph {
    flex: none;
  }
  .glyph.group {
    color: var(--mute);
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name.deep {
    color: var(--ink-2);
  }
  .kind {
    font-size: 10.5px;
    letter-spacing: 0.1em;
    flex: none;
  }
  .tail {
    color: var(--mute);
    font-size: 10.5px;
    flex: none;
    width: 56px;
    text-align: right;
  }
  .empty {
    padding: 26px 18px;
    color: var(--mute);
    text-align: center;
    font-size: 12px;
  }
</style>
