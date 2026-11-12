<script>
  import { preview } from "../../fold.js";
  import { humanize, size } from "../job.js";

  let { job, committed = false, onchange, oncommit, onrevert } = $props();

  const UPS = ["Y", "Z"];
  const RULES = ["fingerprint", "name", "none"];
  const reading = $derived(job.reading);
  const settings = $derived(job.settings);
  const declared = $derived(reading.declared ?? {});
  const raw = $derived(preview(reading, { ...settings, unit: 1 }));
  const now = $derived(preview(reading, settings));
  const cad = $derived(["step", "iges"].includes(reading.format));
  const centre = $derived.by(() => {
    const spots = (reading.objects ?? []).map((object) => object.translation ?? [0, 0, 0]);
    if (!spots.length) return null;
    return [0, 1, 2].map((axis) => spots.reduce((sum, at) => sum + at[axis], 0) / spots.length);
  });
  const objectOrigin = $derived(settings.recentre && settings.recentre !== "centre" ? settings.recentre : null);
  const set = (key, value) => onchange({ ...settings, [key]: value });
  const slugOf = (name) =>
    (name ?? "")
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  const intoTyped = (event) => set("into", event.target.value);

  const unitTyped = (event) => {
    const value = Number(event.target.value);
    if (value > 0) set("unit", value);
  };

  const chordTyped = (event) => {
    const value = Number(event.target.value);
    if (value > 0) set("chord", value);
  };
</script>

<div class="head">
  <b>REVIEW</b>
  {#if committed}<span class="sub">committed — the choices below are what minted these literals</span>{/if}
  <span class="gap"></span>
  {#if committed}
    <button class="act undo" onclick={onrevert}>REVERT</button>
  {:else}
    <button class="act go" onclick={oncommit}>COMMIT</button>
  {/if}
</div>

<div class="grid" class:locked={committed}>
  <div class="row cols">
    <span></span>
    <span>FILE SAYS</span>
    <span>YOU CHOOSE</span>
    <span>RESULT</span>
  </div>
  <div class="row">
    <span class="k">into</span>
    <span class="declared">{humanize(reading.source) || reading.source}</span>
    <span class="knob"><input type="text" value={settings.into ?? ""} oninput={intoTyped} /></span>
    <span class="result"><i>new part</i><b>{slugOf(settings.into) || "—"}</b></span>
  </div>
  <div class="row">
    <span class="k">unit</span>
    <span class="declared">{declared.unit != null ? `${declared.unit} m per unit` : "no unit"}</span>
    <span class="knob"><input type="number" step="any" min="0" value={settings.unit} oninput={unitTyped} /><span class="dim">m per unit</span></span>
    <span class="result" class:warn={now.extent.some((value) => value > 10 || value < 0.001)}><i>extent</i><b>{size(now.extent)}</b></span>
  </div>
  <div class="row">
    <span class="k">up axis</span>
    <span class="declared">{declared.up ? `${declared.up}-up` : "—"}</span>
    <span class="knob tabs">{#each UPS as up}<button class:on={settings.up === up} onclick={() => set("up", up)}>{up}-up</button>{/each}</span>
    <span class="result"><i>stored</i><b>Y-up</b></span>
  </div>
  <div class="row">
    <span class="k">fold</span>
    <span class="declared">{raw.objects} object{raw.objects === 1 ? "" : "s"}</span>
    <span class="knob tabs">{#each RULES as rule}<button class:on={settings.fold === rule} onclick={() => set("fold", rule)}>{rule}</button>{/each}</span>
    <span class="result"><i>components</i><b>{now.components}</b><i>nodes</i><b>{now.nodes}</b></span>
  </div>
  <div class="row">
    <span class="k">groups</span>
    <span class="declared">{reading.objects.filter((object) => object.collection).length ? `${new Set(reading.objects.map((object) => object.collection).filter(Boolean)).size} collection(s)` : "no collections"}</span>
    <span class="knob tabs"><button class:on={settings.groups} onclick={() => set("groups", true)}>keep</button><button class:on={!settings.groups} onclick={() => set("groups", false)}>drop</button></span>
    <span class="result"><i>group nodes</i><b>{now.groups}</b></span>
  </div>
  <div class="row">
    <span class="k">hidden</span>
    <span class="declared">{reading.hidden} hidden · {reading.empties.length} empt{reading.empties.length === 1 ? "y" : "ies"}{reading.others.length ? ` · skipped ${reading.others.join(", ").toLowerCase()}` : ""}</span>
    <span class="knob tabs"><button class:on={settings.hidden} onclick={() => set("hidden", true)}>keep</button><button class:on={!settings.hidden} onclick={() => set("hidden", false)}>drop</button></span>
    <span class="result"><i>objects</i><b>{now.objects}</b></span>
  </div>
  <div class="row">
    <span class="k">origin</span>
    <span class="declared">{centre ? `centre ${centre.map((value) => value.toFixed(1)).join(" · ")}` : "—"}</span>
    <span class="knob tabs"><button class:on={!settings.recentre} onclick={() => set("recentre", undefined)}>file</button><button class:on={settings.recentre === "centre"} onclick={() => set("recentre", "centre")}>centre</button><select class:on={Boolean(objectOrigin)} value={objectOrigin ?? ""} onchange={(event) => set("recentre", event.target.value || undefined)}><option value="">object</option>{#each reading.objects as object}<option value={object.object}>{object.object}</option>{/each}</select></span>
    <span class="result"><i>origin</i><b>{objectOrigin ?? (settings.recentre === "centre" ? "the model's centre" : "the file's")}</b></span>
  </div>
  {#if cad}
    <div class="row">
      <span class="k">chord</span>
      <span class="declared">b-rep, exact</span>
      <span class="knob"><input type="number" step="any" min="0" value={settings.chord ?? 0.05} oninput={chordTyped} /><span class="dim">mm</span></span>
      <span class="result"><i>triangles</i><b>{reading.triangles.toLocaleString("en")}</b></span>
    </div>
  {/if}
</div>

<style>
  .act {
    font: inherit;
    padding: 4px 12px;
    letter-spacing: 0.08em;
    border: 1px solid var(--part);
    color: var(--part);
    background: none;
    cursor: pointer;
  }
  .act:hover {
    background: var(--part);
    color: var(--bg);
  }
  .act.undo {
    border-color: var(--fail);
    color: var(--fail);
  }
  .act.undo:hover {
    background: var(--fail);
    color: var(--bg);
  }
  .grid.locked .knob {
    opacity: 0.55;
    pointer-events: none;
  }
  .grid {
    border-bottom: 1px solid var(--line);
  }
  .row {
    display: grid;
    grid-template-columns: 60px 124px 220px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
    padding: 7px 18px;
    border-bottom: 1px solid var(--hair);
    font-size: 11.5px;
  }
  .cols {
    color: var(--mute);
    font-size: 10px;
    letter-spacing: 0.12em;
    padding-top: 6px;
    padding-bottom: 4px;
  }
  .k {
    color: var(--dim);
  }
  .declared {
    color: var(--mute);
  }
  .knob {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 220px;
  }
  .knob input {
    font: inherit;
    font-size: 11.5px;
    flex: 1;
    min-width: 0;
    padding: 2px 6px;
    background: var(--panel);
    color: var(--ink);
    border: 1px solid var(--line);
  }
  .knob input:focus {
    outline: 0;
    border-color: var(--part);
  }
  .tabs {
    gap: 0;
    border: 1px solid var(--line);
  }
  .tabs button {
    flex: 1;
    font: inherit;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    padding: 3px 6px;
    border: 0;
    border-right: 1px solid var(--rule);
    background: transparent;
    color: var(--mute);
    cursor: pointer;
  }
  .tabs button:last-child,
  .tabs select:last-child {
    border-right: 0;
  }
  .tabs select {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    padding: 3px 4px;
    border: 0;
    background: transparent;
    color: var(--mute);
    cursor: pointer;
  }
  .tabs select.on {
    background: var(--part);
    color: var(--bg);
  }
  .tabs button:hover {
    color: var(--ink);
  }
  .tabs button.on {
    background: var(--part);
    color: var(--bg);
  }
  .result {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    column-gap: 8px;
    row-gap: 2px;
    align-items: baseline;
  }
  .result i {
    font-style: normal;
    color: var(--mute);
  }
  .result b {
    font-weight: 400;
    color: var(--ink-3);
    overflow-wrap: anywhere;
  }
  .result.warn b {
    color: var(--step);
  }
  .dim {
    color: var(--mute);
  }
</style>
