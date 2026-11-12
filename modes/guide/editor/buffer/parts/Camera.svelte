<script>
  // a camera snapshot: take it from the stage, fly to it, clear it
  let { has = false, onsnap, ongo, onclear } = $props();
</script>

<div class="camera">
  <button class="snap" onclick={onsnap}>◉ {has ? "Retake" : "Snapshot"}</button>
  <button class="go" disabled={!has} title="Fly to the snapshotted view" onclick={ongo}>Go to snapshot</button>
  {#if has}
    <button class="clear" title="Clear snapshot" onclick={onclear}>×</button>
  {/if}
</div>

<style>
  .camera {
    display: flex;
    gap: 5px;
  }
  .snap,
  .go,
  .clear {
    border-radius: 4px;
    font: 600 12px var(--font-family-body);
    cursor: pointer;
  }
  .snap {
    flex: 1;
    border: 0;
    background: var(--ink);
    color: var(--paper);
    padding: 7px 10px;
  }
  .go {
    flex: 1;
    border: 1.5px solid var(--ink);
    background: var(--paper);
    color: var(--ink);
    padding: 6px 10px;
  }
  .go:disabled {
    border-color: var(--hair);
    color: var(--dim);
    cursor: default;
  }
  .clear {
    flex: none;
    border: 1px solid var(--hair);
    background: var(--paper);
    color: var(--danger);
    padding: 6px 9px;
  }
</style>
