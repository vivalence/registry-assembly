<script>
  // the stage as a pane: the three.js stage underneath, the controls over it — the view button
  // (click: next view · hold: choose · double-click: the step's view), ghost, explode, zoom, fit,
  // help — and the view cube, a CSS-3D cube that mirrors the camera; click a face to look from it,
  // drag it to orbit, double-click it for the step's view.
  import { onMount, untrack } from "svelte";

  let {
    entries = [],
    status = {},
    tints = {},
    labels = {},
    explode = 0,
    overview = false,
    step = null,
    view = "iso",
    selected = [],
    ghost = false,
    focus = null,
    select = false,
    empty = "nothing on the stage",
    onpick = () => {},
    onmarquee = null,
    onghost = null,
    onexplode = null,
    onfault = () => {},
  } = $props();

  const ORDER = ["iso", "top", "front", "right", "back", "left", "under"];
  const FACES = [
    ["front", "rotateY(90deg)"],
    ["back", "rotateY(-90deg)"],
    ["top", "rotateX(90deg)"],
    ["under", "rotateX(-90deg)"],
    ["left", "rotateY(0deg)"],
    ["right", "rotateY(180deg)"],
  ];
  const HELP = [
    ["drag", "orbit"],
    ["right drag · ⇧/⌃/⌘ drag", "pan"],
    ["wheel · middle drag", "zoom"],
    ["double-click part", "frame that part"],
    ["double-click empty · F", "frame all"],
    ["view cube", "click a face · drag to orbit · double-click home"],
    ["1–5", "iso · top · under · front · back"],
    ...(select ? [["click · ⇧/⌘-click", "select · add"], ["⌥ drag", "box-select"]] : []),
    ["view button", "click next · hold choose · double-click home"],
  ];

  let host = $state(null);
  let held = $state(null);
  let hover = $state(null);
  let current = $state("step");
  let menu = $state(false);
  let help = $state(false);
  let cube = $state("none");
  let hold = 0;
  let holding = false;
  let click = 0;
  let drag = null;
  let cubeElement = null;

  onMount(() => {
    let made = null;
    let dropped = false;
    import("./scene.js").then(({ stage }) => {
      if (dropped || !host) return;
      made = stage(host, {
        select,
        onPick: (slug, path, event) => onpick(slug, path, event),
        onMarquee: onmarquee,
        onHover: (one) => (hover = one),
        onCamera: (elements) => {
          const e = elements;
          const f = [1, -1, 1];
          const R = [[e[0], e[4], e[8]], [e[1], e[5], e[9]], [e[2], e[6], e[10]]];
          const M = (i, j) => (f[i] * R[i][j] * f[j]).toFixed(5);
          cube = `matrix3d(${[M(0, 0), M(1, 0), M(2, 0), 0, M(0, 1), M(1, 1), M(2, 1), 0, M(0, 2), M(1, 2), M(2, 2), 0, 0, 0, 0, 1].join(",")})`;
        },
        onFault: (words) => onfault(words),
      });
      held = made;
    });
    const onKey = (event) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? "")) return;
      if (!host?.matches(":hover") && document.activeElement !== host?.querySelector("canvas")) return;
      const key = event.key.toLowerCase();
      if (key === "f") held?.frame(null);
      else if (key.length === 1 && "12345".includes(key)) go(["iso", "top", "under", "front", "back"][+key - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      dropped = true;
      window.removeEventListener("keydown", onKey);
      made?.dispose();
      held = null;
    };
  });

  $effect(() => {
    const shown = entries;
    const stage = held;
    if (!stage) return;
    stage.show(shown);
  });

  $effect(() => {
    const next = { status, tints, labels, explode, overview, step, view, selected, ghost };
    const stage = held;
    if (!stage) return;
    untrack(() => (current = "step"));
    stage.update(next);
  });

  $effect(() => {
    const on = focus;
    const stage = held;
    if (!stage) return;
    if (on?.length) stage.frame(on);
    else if (on) stage.frame(null);
  });

  const go = (which) => {
    current = which;
    held?.view(which);
    menu = false;
  };

  export const snapshot = () => held?.snapshot() ?? null;
  export const frame = (slugs = null) => held?.frame(slugs);
  export const home = () => go("step");

  const press = (event) => {
    if (event.button !== 0) return;
    holding = false;
    clearTimeout(hold);
    hold = setTimeout(() => {
      holding = true;
      menu = true;
      help = false;
    }, 380);
  };
  const release = (event) => {
    clearTimeout(hold);
    if (holding) {
      const item = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-view]");
      if (item) go(item.dataset.view);
      holding = false;
      return;
    }
    if (menu) return (menu = false);
    if (click) {
      clearTimeout(click);
      click = 0;
      return go("step");
    }
    click = setTimeout(() => {
      click = 0;
      const list = ["step", ...ORDER];
      go(list[(list.indexOf(current) + 1) % list.length]);
    }, 260);
  };

  const cubeDown = (event) => {
    event.stopPropagation();
    drag = { x: event.clientX, y: event.clientY, moved: false, face: event.target.dataset?.face ?? null };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const cubeMove = (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    held?.orbit?.(dx, dy);
    current = null;
    drag.x = event.clientX;
    drag.y = event.clientY;
  };
  const cubeUp = () => {
    const was = drag;
    drag = null;
    if (was && !was.moved && was.face) go(was.face);
  };
</script>

<div class="stage" bind:this={host} onpointerdown={() => ((menu = false), (help = false))}>
  {#if !entries.length}
    <div class="dark">{empty}</div>
  {/if}
  {#if hover}
    <div class="tip" style="left:{hover.x}px;top:{hover.y}px">{hover.label}</div>
  {/if}
</div>

<div class="cube-wrap" role="presentation" onpointerdown={cubeDown} onpointermove={cubeMove} onpointerup={cubeUp} ondblclick={() => go("step")} bind:this={cubeElement}>
  <div class="cube" style="transform:{cube}">
    {#each FACES as [face, turn] (face)}
      <div class="face" class:lit={face === current} data-face={face} style="transform:{turn} translateZ(28px)">{face === "under" ? "BOTTOM" : face.toUpperCase()}</div>
    {/each}
  </div>
</div>

<div class="bar" role="toolbar">
  <div class="controls">
    <div class="menu-anchor">
      <button class="ctl view" class:custom={!current} title="Click: next view · Hold: choose · Double-click: step view" onpointerdown={press} onpointerup={release} onpointerleave={() => !holding && clearTimeout(hold)}>{current ?? "custom"}</button>
      {#if menu}
        <div class="menu">
          {#each ["step", ...ORDER] as which, index (which)}
            <div class="item" class:lit={which === current} data-view={which} onpointerup={() => go(which)}><span>{which === current ? "✓ " : ""}{which}</span><span class="n">{index + 1}</span></div>
          {/each}
        </div>
      {/if}
    </div>
    {#if onghost}
      <button class="ctl" class:lit={ghost} title="Show later steps and kit parts as ghosts" onclick={onghost}>ghost</button>
    {/if}
    {#if onexplode}
      <label class="ctl range" title="Explode"><input type="range" min="0" max="1" step="0.01" value={explode} oninput={(event) => onexplode(+event.target.value)} /></label>
    {/if}
  </div>
  <div class="controls">
    <button class="ctl square" title="Zoom in" onclick={() => held?.zoom(0.75)}>+</button>
    <button class="ctl square" title="Zoom out" onclick={() => held?.zoom(1 / 0.75)}>−</button>
    <button class="ctl square" title="Frame all (F)" onclick={() => held?.frame(null)}><span class="fit"></span></button>
    <button class="ctl square round" title="Camera controls" onclick={() => ((help = !help), (menu = false))}>?</button>
  </div>
  {#if help}
    <div class="help">
      {#each HELP as [keys, does] (keys)}
        <div><b>{keys}</b>{does}</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .stage {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .stage :global(canvas) {
    cursor: grab;
  }
  .stage :global(.marquee) {
    position: absolute;
    border: 1.5px dashed var(--stage-picked);
    background: color-mix(in srgb, var(--stage-picked) 8%, transparent);
    pointer-events: none;
    z-index: 2;
  }
  .dark {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-family: var(--font-family-code);
    font-size: 12px;
    color: var(--text-light);
    pointer-events: none;
  }
  .tip {
    position: absolute;
    pointer-events: none;
    background: var(--ink);
    color: var(--paper);
    font: 600 11.5px var(--font-family-body);
    padding: 4px 8px;
    border-radius: 4px;
    white-space: nowrap;
    transform: translate(12px, -120%);
    z-index: 2;
  }
  .cube-wrap {
    position: absolute;
    left: 16px;
    bottom: 16px;
    width: 80px;
    height: 80px;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .cube {
    position: relative;
    width: 56px;
    height: 56px;
    transform-style: preserve-3d;
  }
  .face {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--cube-face);
    border: 1.5px solid var(--ink);
    box-sizing: border-box;
    font: 700 9.5px var(--font-family-body);
    letter-spacing: 0.04em;
    color: var(--ink);
    backface-visibility: hidden;
  }
  .face.lit {
    background: var(--cube-on);
  }
  .face:hover {
    background: var(--step);
  }
  .bar {
    position: absolute;
    left: 104px;
    bottom: 22px;
    z-index: 2;
    display: flex;
    flex-direction: column-reverse;
    gap: 6px;
    font: 500 11px var(--font-family-body);
    color: var(--ink);
  }
  .controls {
    position: relative;
    display: flex;
    gap: 4px;
  }
  .menu-anchor {
    position: relative;
  }
  .ctl {
    border: 1px solid var(--control-edge);
    background: var(--paper);
    border-radius: 5px;
    height: 26px;
    font: 600 12px var(--font-family-body);
    color: var(--ink);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    user-select: none;
  }
  .ctl.view {
    min-width: 60px;
  }
  .ctl.custom {
    font-style: italic;
    color: var(--text-light);
  }
  .ctl.lit {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }
  .ctl.square {
    width: 26px;
    padding: 0;
    font-size: 15px;
  }
  .ctl.round {
    border-radius: 13px;
    font-size: 12px;
  }
  .ctl.range {
    gap: 6px;
    padding: 0 8px;
    cursor: default;
  }
  .ctl.range input {
    width: 72px;
    accent-color: var(--ink);
    margin: 0;
    cursor: pointer;
  }
  .fit {
    width: 11px;
    height: 11px;
    border: 1.5px dashed var(--ink);
    border-radius: 2px;
    display: block;
  }
  .menu {
    position: absolute;
    left: 0;
    bottom: 32px;
    background: var(--paper);
    border-radius: 6px;
    box-shadow: 0 6px 24px color-mix(in srgb, var(--ink) 18%, transparent);
    padding: 4px;
    min-width: 130px;
  }
  .item {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 8px;
    border-radius: 4px;
    cursor: pointer;
    font: 600 12px var(--font-family-body);
    color: var(--ink);
  }
  .item.lit {
    background: var(--menu-on);
  }
  .item:hover {
    background: var(--paper-3);
  }
  .item .n {
    color: var(--text-light);
    font-weight: 500;
  }
  .help {
    position: absolute;
    left: 0;
    bottom: 64px;
    background: var(--paper);
    border-radius: 6px;
    box-shadow: 0 6px 24px color-mix(in srgb, var(--ink) 18%, transparent);
    padding: 10px 12px;
    white-space: nowrap;
    line-height: 1.75;
  }
  .help b {
    display: inline-block;
    min-width: 150px;
  }
</style>
