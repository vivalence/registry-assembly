<script>
  let { slug = "", taking = [], words = "", onkeep, onconfirm } = $props();
</script>

<div class="veil">
  <div class="dialog">
    <div class="head">
      <b>retract · closure</b>
      <span class="gap"></span>
      <span class="sub">{taking.length}</span>
    </div>
    <div class="words">{words}</div>
    <div class="rows">
      {#each taking as row (row.slug)}
        <div class="row">
          <span class="pip {row.ontology}"></span>
          <span class="slug" class:root={row.slug === slug}>{row.slug}</span>
          <span class="note">{row.ontology}</span>
        </div>
      {/each}
    </div>
    <div class="acts">
      <button class="keep" onclick={onkeep}>keep</button>
      <button class="go" onclick={onconfirm}>retract {taking.length}</button>
    </div>
  </div>
</div>

<style>
  .veil {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    background: var(--scrim);
  }
  .dialog {
    width: min(440px, 86%);
    display: flex;
    flex-direction: column;
    gap: 11px;
    padding: 16px 18px 15px;
    background: var(--field);
    border: 1px solid var(--edge);
    border-radius: var(--radius);
    box-shadow: var(--raised);
  }
  .dialog .head {
    padding: 0;
    border: none;
  }
  .dialog .head b {
    color: var(--fail);
  }
  .dialog .head .sub {
    color: var(--dim);
  }
  .words {
    font-size: 11px;
    line-height: 1.7;
    color: var(--ink-2);
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 180px;
    overflow: auto;
    padding: 8px 9px;
    background: var(--recess);
    border: 1px solid var(--hair);
    border-radius: var(--radius);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 7px;
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
  .slug {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    line-height: 1.7;
    color: var(--ink-2);
  }
  .slug.root {
    color: var(--hot);
  }
  .note {
    font-size: 9px;
    color: var(--faint);
  }
  .acts {
    display: flex;
    gap: 6px;
  }
  .keep,
  .go {
    flex: 1;
    padding: 6px 0;
    border-radius: var(--radius);
    font: inherit;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .keep {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--dim);
  }
  .go {
    background: var(--warn-bg);
    border: 1px solid var(--fail);
    color: var(--warn-ink);
  }
</style>
