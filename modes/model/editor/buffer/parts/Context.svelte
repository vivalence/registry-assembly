<script>
  let { rows = [], onpick, ondrop, onclear } = $props();
</script>

<div class="column">
  <div class="top">
    <span class="title">context</span>
    <span class="count">{rows.length ? rows.length : "empty"}</span>
    <span class="rule"></span>
    {#if rows.length}
      <button class="clear" onclick={onclear}>clear</button>
    {/if}
  </div>
  <div class="rows">
    {#each rows as row (row.key)}
      <div class="row {row.kind}" role="button" tabindex="-1" onclick={() => onpick(row)} onkeydown={() => {}}>
        <span class="pip {row.ontology}"></span>
        <span class="label">{row.slug}</span>
        <span class="kind">{row.kind}</span>
        <button class="drop" aria-label="drop" onclick={(event) => (event.stopPropagation(), ondrop(row))}>×</button>
      </div>
    {/each}
  </div>
</div>

<style>
  .column {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 9px 11px 11px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }
  .title {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--placement);
    white-space: nowrap;
  }
  .count {
    font-size: 9px;
    color: var(--faint);
    white-space: nowrap;
  }
  .rule {
    flex: 1;
    height: 1px;
    background: var(--line);
  }
  .clear {
    padding: 0 4px;
    background: transparent;
    border: none;
    color: var(--mute);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.06em;
    cursor: pointer;
  }
  .clear:hover,
  .drop:hover {
    color: var(--ink);
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: auto;
    min-height: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 0 2px 0 4px;
    border-left: 2px solid transparent;
    cursor: pointer;
  }
  .row:hover {
    background: var(--void);
  }
  .row.subject {
    border-left-color: var(--part);
  }
  .row.focus {
    border-left-color: var(--step);
  }
  .pip {
    width: 5px;
    height: 5px;
    flex: 0 0 5px;
    border-radius: 1px;
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
    font-size: 10px;
    line-height: 22px;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kind {
    font-size: 9px;
    color: var(--faint);
    white-space: nowrap;
  }
  .drop {
    width: 18px;
    height: 18px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--mute);
    font: inherit;
    font-size: 11px;
    line-height: 1;
    cursor: pointer;
  }
</style>
