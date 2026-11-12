<script>
  import { onMount, untrack } from "svelte";
  import { GIZMOS } from "../../schematics.js";

  let { entries = [], selected = [], joins = [], subject = null, focus = null, gizmo = "translate", fastener = null, ghost = false, explode = 0, drawing = null, camera = null, view = "iso", onmode, onpick, ondive, onmove, onfault, onjoined, onghost, onexplode, oncamera, onview } = $props();

  const ORDER = ["iso", "top", "front", "right", "back", "left", "under"];
  const KEYED = ["iso", "top", "under", "front", "back"];
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
    ["click · ⇧/⌘-click", "select · add"],
    ["double-click placement", "open what it places"],
    ["drag an axis", "release writes one /placement"],
    ["F", "frame all"],
    ["view cube", "click a face · drag to orbit · double-click home"],
    ["1–5", "iso · top · under · front · back"],
    ["view button", "click next · hold choose · double-click home"],
  ];

  let host = $state(null);
  let held = $state(null);
  let hover = $state(null);
  let current = $state(untrack(() => view));
  let menu = $state(false);
  let help = $state(false);
  let cube = $state("none");
  let drawn = { subject: null, count: 0 };
  let restoring = true;
  let hold = 0;
  let holding = false;
  let click = 0;
  let drag = null;

  onMount(() => {
    let made = null;
    let dropped = false;
    import("../scene.js").then(({ stage }) => {
      if (dropped || !host) return;
      made = stage(host, {
        onPick: (slug, path, event) => onpick(slug, path, event),
        onDive: (slug) => slug && ondive?.(slug),
        onMove: onmove,
        onHover: (one) => (hover = one),
        onRest: (pose) => drawing && oncamera?.({ subject: drawing, ...pose }),
        onCamera: (e) => {
          const f = [1, -1, 1];
          const R = [[e[0], e[4], e[8]], [e[1], e[5], e[9]], [e[2], e[6], e[10]]];
          const M = (i, j) => (f[i] * R[i][j] * f[j]).toFixed(5);
          cube = `matrix3d(${[M(0, 0), M(1, 0), M(2, 0), 0, M(0, 1), M(1, 1), M(2, 1), 0, M(0, 2), M(1, 2), M(2, 2), 0, 0, 0, 0, 1].join(",")})`;
        },
        onFault: (words) => onfault?.(words),
      });
      held = made;
    });
    const onKey = (event) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? "")) return;
      if (!host?.parentElement?.matches(":hover")) return;
      const key = event.key.toLowerCase();
      if (key === "f") home();
      else if (key.length === 1 && "12345".includes(key)) go(KEYED[+key - 1]);
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      dropped = true;
      window.removeEventListener("keydown", onKey, true);
      made?.dispose();
      held = null;
    };
  });

  $effect(() => {
    const shown = entries;
    const at = drawing;
    const stage = held;
    if (!stage) return;
    let refit = drawn.subject !== at || drawn.count === 0;
    let placed = false;
    const saved = untrack(() => camera);
    if (restoring && at && saved?.subject === at) {
      if (refit) (placed = stage.place(saved)), (refit = !placed);
      if (shown.length) restoring = false;
    } else if (at) restoring = false;
    drawn = { subject: at, count: shown.length };
    if (refit && at) untrack(() => name("iso"));
    stage.show(shown, untrack(() => selected), { refit, joins: untrack(() => joins), on: refit || placed ? null : untrack(() => focus) });
  });

  $effect(() => {
    const on = selected;
    const marks = joins;
    held?.select(on, marks);
  });

  $effect(() => {
    const which = gizmo;
    held?.mode(which);
  });

  let aimed = untrack(() => focus);

  $effect(() => {
    const on = focus;
    const stage = held;
    if (!stage || on === aimed) return;
    aimed = on;
    if (on) stage.focus(on);
  });

  $effect(() => {
    const on = ghost;
    held?.ghosts(on);
  });

  $effect(() => {
    const amount = explode;
    held?.spreads(amount);
  });

  const name = (which) => {
    current = which;
    onview?.(which);
  };

  const go = (which) => {
    name(which);
    held?.look(which);
    menu = false;
  };

  const home = () => {
    name("iso");
    held?.frame(true);
    menu = false;
  };

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
      return home();
    }
    click = setTimeout(() => {
      click = 0;
      go(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
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
    held?.orbit(dx, dy);
    if (current) name(null);
    drag.x = event.clientX;
    drag.y = event.clientY;
  };

  const cubeUp = () => {
    const was = drag;
    drag = null;
    if (was?.moved && drawing) oncamera?.({ subject: drawing, ...held.pose() });
    if (was && !was.moved && was.face) go(was.face);
  };
</script>

<div class="bar">
  {#each GIZMOS as which}
    <button class="chip" class:on={gizmo === which} onclick={() => onmode(which)}>{which}</button>
  {/each}
</div>

<div class="field" role="presentation" onpointerdown={() => ((menu = false), (help = false))}>
  <div class="canvas" bind:this={host}></div>
  {#if !subject}
    <div class="dark">stage dark · nothing folded</div>
  {/if}
  {#if gizmo === "joint"}
    <div class="joins">
      <div class="title">joined · {fastener ?? "select the fastener first"}</div>
      <div class="draft">{joins.length ? joins.join("  ·  ") : "click the placements it holds — their real path in the fold"}</div>
      <div class="actions">
        <span class="gap"></span>
        <button class="write" onclick={onjoined}>write</button>
      </div>
    </div>
  {:else if hover}
    <div class="hud">{hover.path}  ·  {hover.ref}</div>
  {/if}

  {#if subject}
    <div class="views" role="toolbar" onpointerdown={(event) => event.stopPropagation()}>
      {#if help}
        <div class="help">
          {#each HELP as [keys, does] (keys)}
            <div><b>{keys}</b>{does}</div>
          {/each}
        </div>
      {/if}
      <div class="cube-wrap" role="presentation" onpointerdown={cubeDown} onpointermove={cubeMove} onpointerup={cubeUp} ondblclick={home}>
        <div class="cube" style="transform:{cube}">
          {#each FACES as [face, turn] (face)}
            <div class="face" class:on={face === current} data-face={face} style="transform:{turn} translateZ(22px)">{face}</div>
          {/each}
        </div>
      </div>
      <div class="column">
        <div class="row">
          <button class="control" title="Zoom in" onclick={() => held?.zoom(0.75)}>+</button>
          <button class="control" title="Zoom out" onclick={() => held?.zoom(1 / 0.75)}>−</button>
          <button class="control icon" title="Frame all (F)" onclick={home}><span class="fit"></span></button>
          <button class="control" class:on={help} title="Camera controls" onclick={() => ((help = !help), (menu = false))}>?</button>
        </div>
        <div class="row">
          <div class="anchor">
            <button class="control view" class:custom={!current} title="Click: next view · Hold: choose · Double-click: home" onpointerdown={press} onpointerup={release} onpointerleave={() => !holding && clearTimeout(hold)}>{current ?? "custom"}</button>
            {#if menu}
              <div class="menu">
                {#each ORDER as which (which)}
                  <div class="item" class:on={which === current} data-view={which} role="menuitem" tabindex="-1" onpointerup={() => go(which)}><span>{which}</span><span class="n">{KEYED.indexOf(which) + 1 || ""}</span></div>
                {/each}
              </div>
            {/if}
          </div>
          <button class="control" class:on={ghost} title="Ghost what is not picked" onclick={() => onghost?.(!ghost)}>ghost</button>
          <label class="slider" title="Explode"><input type="range" min="0" max="1" step="0.01" value={explode} oninput={(event) => onexplode?.(+event.target.value)} /></label>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 10px;
    background: var(--panel);
    border-bottom: 1px solid var(--line);
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .gap {
    flex: 1;
    min-width: 6px;
  }
  .field {
    position: relative;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    background: var(--stage);
  }
  .canvas {
    position: absolute;
    inset: 0;
  }
  .dark {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--faint);
    pointer-events: none;
  }
  .chip {
    padding: 3px 9px;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--mute);
    font: inherit;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
  }
  .chip.on {
    background: var(--pick);
    border-color: var(--pick-edge);
    color: var(--pick-ink);
  }
  .joins {
    position: absolute;
    left: 12px;
    top: 12px;
    max-width: 320px;
    padding: 8px 10px;
    background: var(--field);
    border: 1px solid var(--hair);
    border-radius: var(--radius);
    box-shadow: var(--float);
  }
  .title {
    margin-bottom: 5px;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  .draft {
    font-size: 11px;
    line-height: 1.6;
    color: var(--ink-2);
  }
  .actions {
    display: flex;
    gap: 4px;
    margin-top: 7px;
  }
  .write {
    padding: 2px 9px;
    background: transparent;
    border: 1px solid var(--part);
    border-radius: var(--radius);
    color: var(--part);
    font: inherit;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .hud {
    position: absolute;
    left: 12px;
    right: 12px;
    top: 10px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: lowercase;
    color: var(--dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
  }
  .views {
    position: absolute;
    left: 14px;
    bottom: 14px;
    z-index: 2;
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }
  .cube-wrap {
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .cube {
    position: relative;
    width: 44px;
    height: 44px;
    transform-style: preserve-3d;
  }
  .face {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--field);
    border: 1px solid var(--edge);
    backface-visibility: hidden;
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;
  }
  .face.on,
  .face:hover {
    background: var(--pick);
    border-color: var(--pick-edge);
    color: var(--pick-ink);
  }
  .column {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .anchor {
    position: relative;
  }
  .control {
    height: 32px;
    min-width: 32px;
    padding: 0 10px;
    display: grid;
    place-items: center;
    background: var(--field);
    border: 1px solid var(--hair);
    border-radius: var(--radius);
    box-shadow: var(--nudge);
    font: 600 13px var(--sans);
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }
  .control:hover {
    background: var(--recess);
  }
  .control:active {
    background: var(--void);
  }
  .control.on {
    background: var(--pick);
    border-color: var(--pick-edge);
    color: var(--pick-ink);
  }
  .control.icon {
    padding: 0;
  }
  .control.view {
    min-width: 64px;
  }
  .control.custom {
    font-style: italic;
    color: var(--dim);
  }
  .fit {
    width: 12px;
    height: 12px;
    border: 1.5px dashed currentColor;
    border-radius: 2px;
  }
  .slider {
    height: 32px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    background: var(--field);
    border: 1px solid var(--hair);
    border-radius: var(--radius);
    box-shadow: var(--nudge);
  }
  .slider input {
    width: 110px;
    margin: 0;
    accent-color: var(--part);
    cursor: pointer;
  }
  .menu {
    position: absolute;
    left: 0;
    bottom: calc(100% + 6px);
    min-width: 130px;
    padding: 4px;
    background: var(--field);
    border: 1px solid var(--edge);
    border-radius: var(--radius);
    box-shadow: var(--raised);
  }
  .item {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 8px;
    border-radius: var(--radius);
    font: 600 12px var(--sans);
    color: var(--ink);
    cursor: pointer;
  }
  .item.on {
    background: var(--pick);
    color: var(--pick-ink);
  }
  .item:hover {
    background: var(--recess);
  }
  .item .n {
    color: var(--faint);
    font-weight: 500;
  }
  .help {
    position: absolute;
    left: 0;
    bottom: calc(100% + 8px);
    min-width: 220px;
    padding: 10px 12px;
    background: var(--field);
    border: 1px solid var(--edge);
    border-radius: var(--radius);
    box-shadow: var(--raised);
    font-size: 11px;
    line-height: 1.9;
    color: var(--ink-2);
    white-space: nowrap;
  }
  .help b {
    display: inline-block;
    min-width: 150px;
    font-weight: 600;
    color: var(--ink);
  }
</style>
