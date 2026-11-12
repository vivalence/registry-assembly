<script>
  import { thousands } from "../job.js";

  let { selected } = $props();

  let chosen = $state(null);
  const tab = $derived(selected?.traits?.includes(chosen) ? chosen : selected?.traits?.[0] ?? null);
  const payload = $derived(tab ? selected?.trait?.[tab] ?? {} : null);

  const millimetres = (vector) => vector.map((value) => Math.round(value * 1000)).join(" × ") + " mm";
  const label = (item) => item?.path ?? item?.name ?? item?.fastener ?? item?.slug ?? JSON.stringify(item);

  const show = (key, value) => {
    if (value == null) return "—";
    if (key === "bbox" && Array.isArray(value) && value.length === 3) return millimetres(value);
    if (key === "scale" && typeof value === "number") return `${value} m per unit`;
    if (key === "tris" && typeof value === "number") return thousands(value);
    if (Array.isArray(value)) {
      if (!value.length) return "none";
      if (typeof value[0] === "object") return `${value.length} · ${value.slice(0, 6).map(label).join(" · ")}${value.length > 6 ? " · …" : ""}`;
      return value.join(" · ");
    }
    if (typeof value === "object") return Object.entries(value).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(" ") : v}`).join(" · ");
    return String(value);
  };

  const fields = $derived.by(() => {
    if (!selected) return [];
    const held = Object.entries(payload ?? {}).map(([key, value]) => ({ key, value: show(key, value) }));
    held.push({ key: "symbols", value: selected.symbols?.length ? selected.symbols.join(" · ") : "none", mute: !selected.symbols?.length });
    return held;
  });
</script>

<div class="head">
  <b>{(selected?.ontology ?? "literal").toUpperCase()}</b>
  {#if selected}
    <span class="kind {selected.ontology}">{selected.ontology === "placement" ? `← ${selected.ref}` : selected.tail}</span>
    <span class="sub">{selected.slug}{selected.source ? `  ←  ${selected.source}` : ""}</span>
  {:else}
    <span class="sub">—</span>
  {/if}
  <span class="gap"></span>
  <span class="tabs" class:bare={!selected}>
    {#each selected?.traits ?? [] as trait}
      <button class:on={trait === tab} onclick={() => (chosen = trait)}>{trait}</button>
    {/each}
  </span>
</div>

<div class="fields">
  {#each fields as field}
    <div class="row">
      <span class="k">{field.key}</span>
      <span class="v" class:mute={field.mute}>{field.value}</span>
    </div>
  {:else}
    <div class="row"><span class="k">—</span><span class="v mute">nothing selected</span></div>
  {/each}
</div>

<style>
  .kind {
    font-size: 11px;
    letter-spacing: 0.1em;
  }
  .kind.mute {
    color: var(--mute);
  }
  .head {
    align-items: center;
    min-height: 47px;
  }
  .tabs {
    display: flex;
    height: 22px;
    border: 1px solid var(--line);
  }
  .tabs.bare {
    border-color: transparent;
  }
  .tabs button {
    font: inherit;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    padding: 3px 9px;
    border: 0;
    border-right: 1px solid var(--rule);
    background: transparent;
    color: var(--mute);
    cursor: pointer;
  }
  .tabs button:last-child {
    border-right: 0;
  }
  .tabs button:hover {
    color: var(--ink);
  }
  .tabs button.on {
    background: var(--part);
    color: var(--bg);
  }
  .fields {
    height: 84px;
    overflow-y: auto;
    border-bottom: 1px solid var(--line);
  }
  .row {
    display: flex;
    gap: 12px;
    padding: 5px 18px;
    border-bottom: 1px solid var(--hair);
    font-size: 12px;
    line-height: 18px;
  }
  .k {
    color: var(--dim);
    width: 100px;
    flex: none;
  }
  .v {
    flex: 1;
    min-width: 0;
    color: var(--ink-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .v.mute {
    color: var(--mute);
  }
</style>
