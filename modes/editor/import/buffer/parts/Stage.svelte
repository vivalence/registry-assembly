<script>
  import { stage } from "../scene.js";

  let { selected, entries, isolate, preview = null, onisolate, onpick } = $props();

  const ISOLATES = ["ALL", "PART", "PLACEMENT", "STEP"];
  let container = $state(null);
  let world = null;

  const subject = $derived(
    preview ? preview : !selected ? "nothing selected" : selected.ontology === "placement" ? `placement · ${selected.slug} ← ${selected.ref}` : `${selected.ontology} · ${selected.slug} · ${selected.tail}`,
  );

  $effect(() => {
    if (!container) return;
    world = stage(container, { onPick: (id) => onpick(id) });
    return () => {
      world?.dispose();
      world = null;
    };
  });

  $effect(() => {
    const held = entries;
    const lit = !preview && selected?.ref ? [selected.ref] : [];
    world?.show(held, lit);
  });
</script>

<div class="frame">
  <div class="box">
    <div class="canvas" bind:this={container}></div>
    <div class="subject">{subject}</div>
    <div class="isolates">
      {#each ISOLATES as kind}
        <button class:on={isolate === kind} onclick={() => onisolate(kind)}>{kind}</button>
      {/each}
    </div>
  </div>
</div>

<style>
  .frame {
    padding: 18px;
    border-bottom: 1px solid var(--line);
  }
  .box {
    border: 1px solid var(--line);
    aspect-ratio: 16 / 9;
    position: relative;
    background: var(--panel);
    overflow: hidden;
  }
  .canvas {
    position: absolute;
    inset: 0;
  }
  .subject {
    position: absolute;
    left: 0;
    top: 0;
    padding: 5px 11px;
    color: var(--mute);
    font-size: 11px;
    pointer-events: none;
  }
  .isolates {
    position: absolute;
    left: 0;
    bottom: 0;
    display: flex;
    border-top: 1px solid var(--line);
    border-right: 1px solid var(--line);
    background: var(--bg);
  }
  .isolates button {
    font: inherit;
    font-size: 11px;
    letter-spacing: 0.06em;
    padding: 5px 11px;
    border: 0;
    border-right: 1px solid var(--rule);
    background: transparent;
    color: var(--mute);
    cursor: pointer;
  }
  .isolates button:hover {
    color: var(--ink);
  }
  .isolates button.on {
    background: var(--part);
    color: var(--bg);
  }
</style>
