<script>
  // the numbered body — one sentence per line
  let { lines = [], indent = false, onset, onremove, onadd } = $props();
</script>

<div class="lines">
  {#each lines as line, k (k)}
    <div class="line">
      <span class="n">{k + 1}</span>
      <textarea value={line.text} rows="2" oninput={(event) => onset(k, event.target.value)}></textarea>
      <button class="x" onclick={() => onremove(k)}>×</button>
    </div>
  {/each}
  <button class="add" class:indent onclick={onadd}>+ line</button>
</div>

<style>
  .lines {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .line {
    display: flex;
    gap: 6px;
    align-items: flex-start;
  }
  .n {
    flex: none;
    width: 16px;
    padding-top: 7px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--dim);
    text-align: right;
  }
  textarea {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--hair);
    border-radius: 4px;
    padding: 6px 8px;
    font: 500 12.5px var(--font-family-body);
    line-height: 1.45;
    resize: vertical;
    color: var(--ink-2);
    outline-color: var(--step);
  }
  .x {
    border: 0;
    background: transparent;
    color: var(--dim);
    cursor: pointer;
    padding: 6px 2px;
    font-size: 13px;
  }
  .add {
    align-self: flex-start;
    border: 0;
    background: transparent;
    color: var(--ink-2);
    font: 600 12px var(--font-family-body);
    cursor: pointer;
    padding: 2px 0;
  }
  .add.indent {
    margin-left: 22px;
  }
</style>
