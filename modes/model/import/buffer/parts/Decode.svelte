<script>
  import { label, megabytes, metres, status, thousands } from "../job.js";

  let { job } = $props();

  const rows = $derived.by(() => {
    if (!job) return [];
    const meta = job.meta;
    const held = [{ k: "source", v: job.name }];
    if (meta) held.push({ k: "route", v: meta.route, tone: "component" });
    held.push({ k: "payload", v: megabytes(job.bytes) });
    if (meta) {
      held.push({ k: "triangles", v: thousands(meta.triangles) });
      held.push({ k: "meshes / materials", v: `${meta.meshes ?? "—"} / ${meta.materials ?? "—"}` });
      held.push({ k: "animation clips", v: String(meta.animations ?? 0) });
      held.push({ k: "axis", v: meta.axis ?? "—" });
      held.push({ k: "scene unit", v: metres(meta.unit) + (meta.declared != null && meta.declared !== meta.unit ? ` (file says ${metres(meta.declared)})` : ""), tone: meta.declared == null ? "step" : undefined });
    }
    held.push({ k: "stage", v: `${label(job)}  ${Math.round(job.progress)}%`, tone: job.state === "done" ? "component" : job.state === "warn" ? "step" : job.state === "fail" ? "fail" : undefined });
    return held;
  });
</script>

<div class="head">
  <b>DECODE LOG</b>
  <span class="sub">{job?.name ?? "—"}</span>
</div>
<div class="log">
  {#each job?.log ?? [] as line}
    <div class="line">
      <span class="t">{line.t}</span>
      <span class="lvl {line.lvl.toLowerCase()}">{line.lvl}</span>
      <span class="msg">{line.msg}</span>
    </div>
  {:else}
    <div class="line"><span class="t">—</span><span class="lvl idle">···</span><span class="msg">{job ? "awaiting its turn" : "nothing decoding"}</span></div>
  {/each}
</div>

<div class="head"><b>FORMAT META</b></div>
{#each rows as row}
  <div class="meta">
    <span class="k">{row.k}</span>
    <span class="v {row.tone ?? ''}">{row.v}</span>
  </div>
{/each}

<style>
  .log {
    padding: 12px 18px 22px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .line {
    display: flex;
    gap: 10px;
    font-size: 11.5px;
  }
  .t {
    color: var(--mute);
    flex: none;
  }
  .lvl {
    flex: none;
    width: 44px;
  }
  .msg {
    flex: 1;
    min-width: 0;
    color: var(--ink-3);
  }
  .sniff,
  .ok,
  .done {
    color: var(--part);
  }
  .work,
  .onto {
    color: var(--placement);
  }
  .warn,
  .fix {
    color: var(--step);
  }
  .fail {
    color: var(--fail);
  }
  .idle {
    color: var(--mute);
  }
  .meta {
    display: flex;
    gap: 12px;
    padding: 8px 18px;
    border-bottom: 1px solid var(--hair);
  }
  .k {
    color: var(--dim);
    width: 148px;
    flex: none;
  }
  .v {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
