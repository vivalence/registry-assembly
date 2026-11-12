<script>
  // the steps column folded to a rail of badges: a dot opens each section, the step on screen is
  // filled, + adds a step to the last section, ☰ slides the whole steps pane over the stage
  let { groups = [], step = 0, ctl, onmenu } = $props();

  const pad = (n) => String(n).padStart(2, "0");
</script>

<div class="rail">
  <button class="menu" title="All steps" onclick={onmenu}>☰</button>
  {#each groups as group, k (k)}
    <span class="dot" title={group.name}></span>
    {#each group.steps as row (row.slug)}
      <button class="badge" class:on={row.n === step} title={row.step?.name || "Untitled step"} onclick={() => ctl.pick(row.n)}>{pad(row.n)}</button>
    {/each}
  {/each}
  <button class="badge add" title="Add a step" onclick={() => (groups.length ? ctl.addStep(groups.length - 1) : ctl.addSection())}>+</button>
</div>

<style>
  .rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 0;
    height: 100%;
    overflow-y: auto;
  }
  .menu {
    flex: none;
    width: 36px;
    height: 36px;
    margin-bottom: 6px;
    border: 1px solid var(--hair);
    border-radius: 6px;
    background: var(--paper);
    color: var(--ink);
    font-size: 16px;
    cursor: pointer;
  }
  .dot {
    flex: none;
    width: 4px;
    height: 4px;
    margin-top: 4px;
    border-radius: 2px;
    background: var(--iron);
  }
  .badge {
    flex: none;
    width: 36px;
    height: 28px;
    border: 1.5px solid var(--hair);
    border-radius: 4px;
    background: var(--paper);
    color: var(--ink);
    font: 700 11.5px var(--font-family-body);
    cursor: pointer;
  }
  .badge.on {
    border-color: var(--step);
    background: var(--step);
    box-shadow: -3px 0 0 var(--step);
  }
  .badge.add {
    border-style: dashed;
    font-size: 14px;
  }
</style>
