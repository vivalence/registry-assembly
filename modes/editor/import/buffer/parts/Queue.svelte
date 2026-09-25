<script>
  let { jobs, active, committed, onenqueue, onselect, onclear } = $props();

  import { label, status } from "../job.js";

  let picker = $state(null);

  const chosen = (event) => {
    onenqueue(event.target.files ?? []);
    event.target.value = "";
  };
</script>

<input type="file" multiple accept=".glb,.gltf,.blend,.usd,.usda,.usdz,.usdc,.fbx,.obj,.stl,.3ds,.step,.stp,.iges,.igs" bind:this={picker} onchange={chosen} hidden />

<button class="drop" onclick={() => picker?.click()}>
  <div class="zone">
    <div class="title">DROP MODEL FILES</div>
    <div class="formats">glb · gltf · blend · usd · usdz · usdc · fbx · obj · stl · 3ds · step · iges</div>
  </div>
</button>

<div class="bar">
  <b>QUEUE</b>
  <span class="sub">{jobs.length} asset{jobs.length === 1 ? "" : "s"} · {committed} committed</span>
  <span class="gap"></span>
  <button class="act" onclick={onclear}>CLEAR</button>
</div>

{#each jobs as job, index (job.id)}
  <button class="job {job.state}" class:active={job.id === active} onclick={() => onselect(job.id)}>
    <div class="row">
      <span class="num">{String(index + 1).padStart(2, "0")}</span>
      <span class="name">{job.name}</span>
      <span class="ext">{job.extension.toUpperCase()}</span>
      <span class="status">{status(job)}</span>
    </div>
    <div class="row track">
      <div class="rail"><div class="fill" style:width="{Math.round(job.progress)}%"></div></div>
      <span class="stage">{label(job)}</span>
    </div>
  </button>
{/each}

{#if !jobs.length}
  <div class="empty">queue empty — drop an asset to begin</div>
{/if}

<style>
  button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    text-align: left;
    cursor: pointer;
  }
  .drop {
    display: block;
    width: 100%;
    padding: 26px 18px;
    border-bottom: 1px solid var(--line);
    background: var(--panel);
  }
  .drop:hover {
    background: var(--lift);
  }
  .zone {
    border: 1px dashed var(--dash);
    padding: 22px 14px;
    text-align: center;
  }
  .title {
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--part);
  }
  .formats {
    color: var(--dim);
    margin-top: 9px;
    font-size: 11px;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 11px 18px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .bar b {
    font-weight: 700;
    letter-spacing: 0.12em;
  }
  .bar .sub {
    color: var(--dim);
    font-size: 11px;
  }
  .bar .gap {
    flex: 1;
    min-width: 16px;
  }
  .act {
    border: 1px solid var(--dash);
    color: var(--mute);
    padding: 4px 12px;
    letter-spacing: 0.08em;
  }
  .act:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .job {
    display: block;
    width: 100%;
    padding: 13px 18px;
    border-bottom: 1px solid var(--rule);
  }
  .job:hover {
    background: var(--hover);
  }
  .job.active {
    background: var(--pick);
  }
  .row {
    display: flex;
    gap: 12px;
    align-items: baseline;
  }
  .num {
    color: var(--mute);
    width: 22px;
    flex: none;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ext {
    border: 1px solid var(--badge);
    color: var(--dim);
    padding: 1px 7px;
    font-size: 11px;
    flex: none;
  }
  .status {
    flex: none;
    letter-spacing: 0.08em;
    font-size: 11px;
  }
  .track {
    gap: 10px;
    align-items: center;
    margin-top: 9px;
    padding-left: 34px;
  }
  .rail {
    flex: 1;
    height: 6px;
    background: var(--rule);
    position: relative;
    overflow: hidden;
  }
  .fill {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    transition: width 200ms;
  }
  .stage {
    color: var(--dim);
    font-size: 11px;
    width: 96px;
    flex: none;
    text-align: right;
  }
  .done .status {
    color: var(--part);
  }
  .done .fill {
    background: var(--part);
  }
  .warn .status {
    color: var(--step);
  }
  .warn .fill {
    background: var(--step);
  }
  .run .status {
    color: var(--ink);
  }
  .run .fill {
    background: var(--ink);
  }
  .parsed .status {
    color: var(--placement);
  }
  .parsed .fill {
    background: var(--placement);
  }
  .wait .status {
    color: var(--mute);
  }
  .wait .fill {
    background: var(--mute);
  }
  .fail .status {
    color: var(--fail);
  }
  .fail .fill {
    background: var(--fail);
  }
  .empty {
    padding: 26px 18px;
    color: var(--mute);
    text-align: center;
    font-size: 12px;
  }
</style>
