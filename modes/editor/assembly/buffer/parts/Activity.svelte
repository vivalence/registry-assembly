<script>
  let { code = "IDLE", rows = [] } = $props();
</script>

<div class="column">
  <div class="top">
    <span class="dot {code}"></span>
    <span class="word {code}">{code.toLowerCase()}</span>
    <span class="rule"></span>
  </div>
  <div class="rows">
    {#each rows.slice(0, 14) as row, index (index)}
      <div class="row" style="opacity:{Math.max(0.35, 1 - index * 0.07)}">
        <span class="tone" class:fail={row.fail} class:write={row.write && !row.fail}></span>
        <span class="nature">{row.nature}</span>
        <span class="words">{row.words}</span>
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
  .dot {
    width: 7px;
    height: 7px;
    flex: none;
    border-radius: 50%;
    background: var(--mute);
  }
  .dot.RUNNING {
    background: var(--part);
    box-shadow: 0 0 5px var(--part);
    animation: tracker 1.4s ease-in-out infinite;
  }
  .dot.DONE {
    background: var(--good);
  }
  .dot.FAILED {
    background: var(--fail);
  }
  .word {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mute);
    white-space: nowrap;
  }
  .word.RUNNING {
    color: var(--part);
  }
  .word.DONE {
    color: var(--good);
  }
  .word.FAILED {
    color: var(--fail);
  }
  .rule {
    flex: 1;
    height: 1px;
    background: var(--line);
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
  }
  .tone {
    width: 5px;
    height: 5px;
    flex: 0 0 5px;
    border-radius: 50%;
    background: var(--mute);
  }
  .tone.write {
    background: var(--good);
  }
  .tone.fail {
    background: var(--fail);
  }
  .nature {
    flex: 0 0 auto;
    font-size: 10px;
    line-height: 22px;
    color: var(--ink-2);
    white-space: nowrap;
  }
  .words {
    flex: 1;
    min-width: 0;
    font-size: 10px;
    line-height: 22px;
    color: var(--mute);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @keyframes tracker {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
</style>
