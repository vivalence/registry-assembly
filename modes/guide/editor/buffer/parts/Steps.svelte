<script>
  // the steps column: sections in order, each with its steps, a New row, + section at the foot.
  // steps drag between sections and before one another; sections drag before one another.
  // the drag itself is transient, never in the buffer.
  let { title = "", groups = [], step = 0, editing = null, ctl } = $props();

  let dnd = $state(null);
  let over = $state(null);

  const pad = (n) => String(n).padStart(2, "0");
  const lineFor = (kind, id) => over && over.kind === kind && over.id === id;

  const startStep = (event, slug) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", slug);
    dnd = { kind: "step", id: slug };
  };
  const startSection = (event, k) => {
    if (event.target.tagName === "INPUT") return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(k));
    dnd = { kind: "section", id: k };
  };
  const overStep = (event, slug, k) => {
    event.preventDefault();
    if (!dnd) return;
    if (dnd.kind === "step" && dnd.id !== slug) over = { kind: "step", id: slug };
    if (dnd.kind === "section") over = { kind: "section", id: k };
  };
  const overSection = (event, k) => {
    event.preventDefault();
    if (dnd) over = { kind: "section", id: k };
  };
  const dropStep = (event, slug, k) => {
    event.preventDefault();
    event.stopPropagation();
    const was = dnd;
    dnd = null;
    over = null;
    if (!was) return;
    if (was.kind === "step" && was.id !== slug) ctl.moveStep(was.id, k, slug);
    if (was.kind === "section") ctl.moveSection(was.id, k);
  };
  const dropSection = (event, k) => {
    event.preventDefault();
    event.stopPropagation();
    const was = dnd;
    dnd = null;
    over = null;
    if (!was) return;
    if (was.kind === "step") ctl.moveStep(was.id, k, null);
    else ctl.moveSection(was.id, k);
  };
  const end = () => ((dnd = null), (over = null));
</script>

<div class="column">
  <div class="head"><div class="title">{title}</div></div>
  <div class="scroll" role="list" ondragend={end}>
    {#each groups as group, k (k)}
      <div class="section" class:line={lineFor("section", k)} draggable="true" role="listitem" ondragstart={(event) => startSection(event, k)} ondragover={(event) => overSection(event, k)} ondrop={(event) => dropSection(event, k)}>
        <span class="grip">⋮⋮</span>
        <input value={group.name} onchange={(event) => ctl.renameSection(k, event.target.value)} onclick={(event) => event.stopPropagation()} />
        {#if !group.steps.length}
          <button class="x" title="Delete empty section" onclick={() => ctl.removeSection(k)}>×</button>
        {/if}
      </div>
      {#each group.steps as row (row.slug)}
        <div
          class="step-row"
          class:active={row.n === step}
          class:line={lineFor("step", row.slug)}
          class:dragging={dnd?.kind === "step" && dnd.id === row.slug}
          draggable="true"
          role="listitem"
          ondragstart={(event) => startStep(event, row.slug)}
          onclick={() => ctl.pick(row.n)}
          ondragover={(event) => overStep(event, row.slug, k)}
          ondrop={(event) => dropStep(event, row.slug, k)}>
          <span class="grip">⋮⋮</span>
          <div class="badge" class:on={row.n === step}>{pad(row.n)}</div>
          <input
            value={row.step?.name ?? ""}
            placeholder="Untitled step"
            class:untitled={!row.step?.name}
            onchange={(event) => ctl.renameStep(row.slug, event.target.value)}
            onfocus={() => row.n !== step && ctl.pick(row.n)}
            onkeydown={(event) => (event.key === "Enter" || event.key === "Escape") && event.target.blur()} />
          {#if row.n === step}
            <button class="x" title="Delete step · its parts return to the kit" onclick={(event) => (event.stopPropagation(), ctl.deleteStep(row.slug))}>×</button>
          {/if}
        </div>
      {/each}
      <div class="new" role="button" tabindex="0" title="Add a step to this section" onclick={() => ctl.addStep(k)} onkeydown={(event) => event.key === "Enter" && ctl.addStep(k)} ondragover={(event) => overSection(event, k)} ondrop={(event) => dropSection(event, k)}>
        <div class="badge dashed">{pad(group.next)}</div>
        <div class="label">New</div>
      </div>
    {/each}
    <button class="add-section" onclick={() => ctl.addSection()}>+ section</button>
  </div>
</div>

<style>
  .column {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
  }
  .head {
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--line);
  }
  .title {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0 8px;
  }
  .section {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 14px 8px 4px 8px;
  }
  .section input {
    flex: 1;
    min-width: 0;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    padding: 3px 5px;
    font: 700 13.5px var(--font-family-body);
    color: var(--ink);
    outline-color: var(--step);
  }
  .section input:hover,
  .step-row input:hover {
    border-color: var(--hair);
  }
  .section input:focus,
  .step-row input:focus {
    background: var(--paper);
    border-color: var(--ink);
  }
  .line {
    box-shadow: inset 0 2px 0 var(--ink);
  }
  .grip {
    flex: none;
    width: 10px;
    color: var(--dim);
    font-size: 11px;
    letter-spacing: -2px;
    cursor: grab;
    user-select: none;
  }
  .x {
    flex: none;
    width: 22px;
    height: 22px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    color: var(--danger);
    font: 500 15px var(--font-family-body);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .x:hover {
    background: var(--warn-bg);
  }
  .step-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px 6px 7px;
    cursor: pointer;
    border-left: 3px solid transparent;
  }
  .step-row.active {
    border-left-color: var(--step);
    background: var(--step-surface);
  }
  .step-row.dragging {
    opacity: 0.4;
  }
  .badge {
    min-width: 26px;
    height: 20px;
    border-radius: 3px;
    background: var(--paper-2);
    color: var(--ink);
    font-size: 11.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    font-variant-numeric: tabular-nums;
  }
  .badge.on {
    background: var(--step);
  }
  .badge.dashed {
    background: transparent;
    border: 1.5px dashed var(--hair);
    color: var(--dim);
  }
  .step-row input {
    flex: 1;
    min-width: 0;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    padding: 3px 5px;
    margin: -3px 0;
    font: 600 13px var(--font-family-body);
    color: var(--ink);
    outline-color: var(--step);
    text-overflow: ellipsis;
  }
  .step-row input.untitled {
    color: var(--dim);
  }
  .new {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px 6px 25px;
    cursor: pointer;
    opacity: 0.55;
  }
  .new:hover {
    opacity: 1;
    background: var(--paper-2);
  }
  .label {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--dim);
  }
  .add-section {
    margin: 12px 12px 0;
    border: 1.5px dashed var(--hair);
    background: transparent;
    border-radius: 5px;
    width: calc(100% - 24px);
    height: 32px;
    font: 600 12.5px var(--font-family-body);
    color: var(--ink-2);
    cursor: pointer;
  }
  .add-section:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
</style>
