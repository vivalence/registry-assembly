<script>
  let { nature = "", words = "", onclear } = $props();
</script>

<div class="notice">
  <span class="nature">{nature}</span>
  <span class="words">{words}</span>
  <button onclick={onclear} aria-label="dismiss">×</button>
</div>

<style>
  .notice {
    position: absolute;
    left: 50%;
    bottom: 22px;
    transform: translateX(-50%);
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 70%;
    padding: 9px 13px;
    background: var(--warn-bg);
    border: 1px solid var(--fail);
    border-radius: var(--radius);
    box-shadow: var(--lifted);
  }
  .nature {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--fail);
    white-space: nowrap;
  }
  .words {
    font-size: 11px;
    line-height: 1.6;
    color: var(--warn-ink);
  }
  button {
    padding: 1px 7px;
    background: transparent;
    border: 1px solid var(--fail);
    border-radius: var(--radius);
    color: var(--warn-ink);
    font: inherit;
    font-size: 10px;
    cursor: pointer;
  }
</style>
