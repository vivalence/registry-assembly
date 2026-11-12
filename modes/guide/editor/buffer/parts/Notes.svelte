<script>
  // the callouts of a step or a guide: text and a kind — a plain note, a tip, a warning
  let { notes = [], onset, onkind, onremove, onadd } = $props();

  const FAMILIES = ["ORIENTATION", "LENGTH", "WIRES", "LOOSE", "TIGHT", "MAGNET", "FORCE"];
  const options = [["", "note"], ["TIP", "tip"], ["WARNING", "warning"], ...FAMILIES.map((one) => [one, `warning · ${one.toLowerCase()}`])];
  const tone = (note) => (note.kind === "TIP" ? "tip" : note.kind ? "warning" : "plain");
</script>

<div class="notes">
  {#each notes as note, k (k)}
    <div class="note {tone(note)}">
      <div class="top">
        <textarea value={note.text} rows="2" oninput={(event) => onset(k, event.target.value)}></textarea>
        <button class="x" onclick={() => onremove(k)}>×</button>
      </div>
      <select value={note.kind ?? ""} onchange={(event) => onkind(k, event.target.value)}>
        {#each options as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </div>
  {/each}
  <button class="add" onclick={onadd}>+ note</button>
</div>

<style>
  .notes {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .note {
    border-left: 3px solid var(--iron);
    background: var(--paper-2);
    border-radius: 0 4px 4px 0;
    padding: 6px 6px 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    --tone: var(--iron);
    --tone-ink: var(--ink-2);
  }
  .note.tip {
    background: var(--tip-surface);
    border-left-color: var(--tip);
    --tone: var(--tip);
    --tone-ink: var(--ink);
  }
  .note.warning {
    background: var(--warn-bg);
    border-left-color: var(--warn-edge);
    --tone: var(--warn-edge);
    --tone-ink: var(--warn-ink);
  }
  .top {
    display: flex;
    gap: 4px;
  }
  textarea {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    font: 500 12.5px var(--font-family-body);
    line-height: 1.45;
    color: var(--tone-ink);
    resize: vertical;
    outline-color: var(--tone);
  }
  .x {
    border: 0;
    background: transparent;
    color: var(--dim);
    cursor: pointer;
    font-size: 13px;
    align-self: flex-start;
  }
  select {
    align-self: flex-start;
    border: 1px solid var(--tone);
    border-radius: 3px;
    background: var(--paper);
    font: 500 11px var(--font-family-body);
    color: var(--tone-ink);
    padding: 2px 4px;
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
</style>
