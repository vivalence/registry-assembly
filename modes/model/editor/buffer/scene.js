import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { feature, patch, survey } from "./feature.js";
import { IDENTITY, numbers, rounded, token, world } from "./kit/scene.js";

export const stage = (container, { onPick = () => {}, onDive = () => {}, onMove = () => {}, onBox = () => {}, onCursor = () => {}, onHover = () => {}, onCamera = () => {}, onRest = () => {}, onFault = () => {} } = {}) => {
  const made = world(container, { onCamera, onRest: () => onRest(made.snapshot()) });
  const { scene, camera, renderer, controls, groups, palette } = made;
  const marks = new THREE.Group();
  scene.add(marks);
  const pins = new THREE.Group();
  scene.add(pins);

  const caged = token(container, "--joint");
  const pinned = token(container, "--cursor");

  let picked = new Set();
  let marked = new Set();
  let ghosting = false;
  let ghost = false;
  let explode = 0;
  let generation = 0;
  let jointing = false;
  let shells = new Map();
  let boxing = false;
  let pointing = false;
  let cursors = [];
  let veil = { ghosted: new Set(), hidden: new Set(), locked: new Set() };
  let contours = true;
  let aimed = null;
  let hovered = null;
  const surveys = new WeakMap();
  const digits = new Map();
  let grip = null;
  let sweep = null;

  const pivot = new THREE.Object3D();
  scene.add(pivot);

  const hollow = () => [...shells.values()].filter((shell) => picked.has(shell.slug));
  const under = (path) => hollow().some((shell) => path.startsWith(`${shell.path}/`));
  const taken = (group) => picked.has(group.userData.slug) || under(group.userData.path);
  const wears = (set, group) =>
    set.has(group.userData.slug) ||
    [...shells.values()].some((shell) => set.has(shell.slug) && group.userData.path.startsWith(`${shell.path}/`));
  const seen = (group) => group.visible;
  const free = (group) => group.visible && !wears(veil.locked, group);

  const seat = (inverse, matrix) => {
    const local = inverse ? inverse.clone().multiply(matrix) : matrix;
    const translation = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    local.decompose(translation, rotation, scale);
    return {
      translation: rounded(translation.toArray()),
      rotation: rounded(rotation.toArray()),
      scale: rounded(scale.toArray()),
    };
  };

  const settled = (group) => {
    const at = group.position.clone().sub(group.userData.off ?? new THREE.Vector3());
    group.userData.base = at.clone();
    return seat(group.userData.inverse, new THREE.Matrix4().compose(at, group.quaternion, group.scale));
  };

  const carried = () => {
    gizmo.object.updateMatrix();
    return gizmo.object.matrix.clone().multiply(grip.from);
  };

  const still = (delta) => delta.elements.every((one, index) => Math.abs(one - IDENTITY[index]) < 1e-9);

  const gizmo = new TransformControls(camera, renderer.domElement);
  gizmo.setSize(0.8);
  scene.add(gizmo.getHelper());
  gizmo.addEventListener("dragging-changed", (event) => {
    controls.enabled = !event.value;
    if (event.value && gizmo.object) {
      gizmo.object.updateMatrix();
      const set = gizmo.object === pivot ? lit() : [];
      for (const group of set) group.updateMatrix();
      grip = { from: gizmo.object.matrix.clone().invert(), starts: set.map((group) => [group, group.matrix.clone()]) };
    }
    made.touch();
  });
  gizmo.addEventListener("change", () => {
    if (grip && gizmo.dragging && gizmo.object === pivot) {
      const delta = carried();
      for (const [group, start] of grip.starts) delta.clone().multiply(start).decompose(group.position, group.quaternion, group.scale);
    }
    cage();
    made.touch();
  });
  gizmo.addEventListener("mouseUp", () => {
    const object = gizmo.object;
    if (!object || !grip) return;
    const delta = carried();
    const starts = grip.starts;
    grip = null;
    if (still(delta)) return;
    if (object !== pivot) return onMove([{ slug: object.userData.slug, ...settled(object) }]);
    const whole = hollow().filter((shell) => !under(shell.path));
    const pieces = new Map(
      starts
        .filter(([group]) => picked.has(group.userData.slug) && !under(group.userData.path))
        .map(([group]) => [group.userData.slug, settled(group)]),
    );
    onMove([
      ...whole.map((shell) => ({
        slug: shell.slug,
        ...seat(shell.above.clone().invert(), delta.clone().multiply(shell.above).multiply(shell.local)),
      })),
      ...[...pieces].map(([slug, trs]) => ({ slug, ...trs })),
    ]);
  });

  const chosen = (group) => marked.has(group.userData.path) || taken(group);

  const STATUS = [
    [(group) => group.userData.active === false, "removed"],
    [(group) => wears(veil.hidden, group), "hidden"],
    [(group) => chosen(group), "solid"],
    [(group) => ghosting || wears(veil.ghosted, group), "ghost"],
    [() => true, "solid"],
  ];

  const wear = () => {
    for (const group of groups.values()) {
      const status = STATUS.find(([applies]) => applies(group))[1];
      made.dress(group, {
        status,
        picked: status === "solid" && chosen(group),
        hover: hovered === group.userData.path,
        edges: contours,
      });
    }
    made.touch();
  };

  const span = (objects) => objects.reduce((held, object) => held.expandByObject(object), new THREE.Box3());

  const box = (objects, color, opacity) => {
    const helper = new THREE.Box3Helper(span(objects), color);
    helper.material.transparent = true;
    helper.material.opacity = opacity;
    return helper;
  };

  const lit = () => [...groups.values()].filter(taken);

  const cage = () => {
    while (marks.children.length) marks.remove(marks.children[0]);
    if (jointing) {
      for (const group of groups.values()) if (marked.has(group.userData.path) || picked.has(group.userData.slug)) marks.add(box([group], caged, 0.9));
      return;
    }
    const shown = lit();
    if (shown.length) marks.add(box(shown, palette.edgePicked, 0.45));
  };

  const attach = () => {
    const bound = lit().some((group) => wears(veil.locked, group));
    const set = jointing || pointing || bound ? [] : lit().filter((group) => group.userData.active !== false);
    if (set.length === 1 && picked.has(set[0].userData.slug)) gizmo.attach(set[0]);
    else if (set.length) {
      span(set).getCenter(pivot.position);
      pivot.quaternion.identity();
      pivot.scale.set(1, 1, 1);
      gizmo.attach(pivot);
    } else gizmo.detach();
    made.touch();
  };

  const spread = () => {
    for (const group of groups.values()) made.spread(group, explode);
    made.touch();
  };

  const paint = () => {
    ghosting = ghost && (lit().length > 0 || [...groups.values()].some((group) => marked.has(group.userData.path)));
    wear();
    spread();
    attach();
    cage();
    repin();
  };

  const digit = (text) => {
    if (digits.has(text)) return digits.get(text);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const pen = canvas.getContext("2d");
    pen.fillStyle = `#${pinned.getHexString()}`;
    pen.beginPath();
    pen.arc(32, 32, 30, 0, Math.PI * 2);
    pen.fill();
    pen.fillStyle = "#101418";
    pen.font = "600 40px Inter, sans-serif";
    pen.textAlign = "center";
    pen.textBaseline = "middle";
    pen.fillText(text, 32, 35);
    const texture = new THREE.CanvasTexture(canvas);
    digits.set(text, texture);
    return texture;
  };

  const surveyed = (geometry) => {
    if (!surveys.has(geometry)) surveys.set(geometry, survey(geometry.attributes.position.array, geometry.index ? geometry.index.array : null));
    return surveys.get(geometry);
  };

  const filled = (opacity) =>
    new THREE.MeshBasicMaterial({
      color: pinned,
      transparent: true,
      opacity: opacity * 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

  const face = (group, cursor, opacity) => {
    const meshes = [];
    group.traverse((child) => child.isMesh && meshes.push(child));
    const best = meshes
      .map((mesh) => {
        const into = mesh.matrixWorld.clone().invert().multiply(group.matrixWorld);
        const point = new THREE.Vector3().fromArray(cursor.point).applyMatrix4(into).toArray();
        const axis = new THREE.Vector3().fromArray(cursor.axis).transformDirection(into).toArray();
        return { mesh, held: patch(surveyed(mesh.geometry), point, axis) };
      })
      .filter((one) => one.held)
      .sort((a, b) => a.held.off - b.held.off)[0];
    if (!best) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(best.held.positions, 3));
    const sheet = new THREE.Mesh(geometry, filled(opacity));
    sheet.matrixAutoUpdate = false;
    sheet.matrix.copy(best.mesh.matrixWorld);
    sheet.renderOrder = 19;
    pins.add(sheet);
  };

  const pin = (cursor, label, opacity) => {
    const group = groups.get(cursor.path);
    if (!group) return;
    group.updateMatrixWorld(true);
    if (cursor.kind !== "hole") face(group, cursor, opacity);
    const anchor = new THREE.Group();
    anchor.matrixAutoUpdate = false;
    anchor.matrix.copy(group.matrixWorld);
    const holder = new THREE.Group();
    holder.position.fromArray(cursor.point);
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3().fromArray(cursor.axis).normalize());
    const reach = cursor.radius ?? 0.0015;
    const stem = Math.max(reach * 3, 0.006);
    const inked = () => new THREE.LineBasicMaterial({ color: pinned, transparent: true, opacity, depthTest: false });
    const round = [];
    for (let k = 0; k < 40; k++) round.push(new THREE.Vector3(Math.cos((k / 40) * Math.PI * 2) * reach, Math.sin((k / 40) * Math.PI * 2) * reach, 0));
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(round), inked());
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, stem)]), inked());
    ring.renderOrder = line.renderOrder = 20;
    holder.add(ring, line);
    if (cursor.kind === "hole") {
      const bore = new THREE.Mesh(new THREE.CircleGeometry(reach, 40), filled(opacity));
      bore.renderOrder = 19;
      holder.add(bore);
    }
    if (label) {
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: digit(label), depthTest: false, transparent: true, opacity, sizeAttenuation: false }));
      badge.position.set(0, 0, stem);
      badge.scale.setScalar(0.035);
      badge.renderOrder = 21;
      holder.add(badge);
    }
    anchor.add(holder);
    pins.add(anchor);
  };

  function repin() {
    while (pins.children.length) pins.remove(pins.children[0]);
    pins.visible = pointing;
    cursors.forEach((cursor, index) => pin(cursor, String(index + 1), 1));
    if (pointing && aimed) pin(aimed, null, 0.55);
    made.touch();
  }

  const point = (list) => {
    cursors = list ?? [];
    paint();
  };

  const select = (slugs, joins = []) => {
    picked = new Set(slugs ?? []);
    marked = new Set(joins ?? []);
    paint();
  };

  const rest = () => onRest(made.snapshot());

  const frame = (smooth = false) => {
    made.go(made.pose("iso"), smooth ? 550 : 0);
    if (!smooth) rest();
  };

  const look = (name) => made.go(made.pose(name));

  const place = (saved) => {
    const target = numbers(saved?.target, 3);
    const position = numbers(saved?.position, 3);
    if (!target || !position) return false;
    made.go(made.pose({ target, position }), 0);
    return true;
  };

  const ghosts = (on) => {
    ghost = on;
    paint();
  };

  const veils = ({ ghosted = [], hidden = [], locked = [], edges = true }) => {
    veil = { ghosted: new Set(ghosted), hidden: new Set(hidden), locked: new Set(locked) };
    contours = edges;
    paint();
  };

  const spreads = (amount) => {
    explode = amount;
    spread();
    cage();
  };

  const focus = (slug) => {
    const shown = [...groups.values()].filter((group) => group.userData.slug === slug);
    if (!shown.length) return false;
    const fitted = made.fit(span(shown), 0);
    if (fitted) rest();
    return fitted;
  };

  const posed = (at) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3().fromArray(numbers(at.translation, 3) ?? [0, 0, 0]),
      new THREE.Quaternion().fromArray(numbers(at.rotation, 4) ?? [0, 0, 0, 1]),
      new THREE.Vector3().fromArray(numbers(at.scale, 3) ?? [1, 1, 1]),
    );

  const clear = () => {
    gizmo.detach();
    grip = null;
    made.raise([]);
  };

  const show = async (entries, slugs = [], { refit = true, joins = [], on = null, hollows = [] } = {}) => {
    const mine = ++generation;
    const loaded = await made.load(entries);
    if (mine !== generation || !made.alive) return;
    gizmo.detach();
    grip = null;
    picked = new Set(slugs ?? []);
    marked = new Set(joins ?? []);
    const malformed = made.raise(loaded);
    shells = new Map(
      hollows
        .filter((one) => !groups.has(one.path))
        .map((one) => [one.path, {
          slug: one.slug,
          path: one.path,
          above: new THREE.Matrix4().fromArray(one.parentMatrix ?? IDENTITY),
          local: posed(one),
        }]),
    );
    paint();
    if (on && focus(on)) return;
    if (refit) frame();
    if (malformed.length) onFault(`the stage was handed a TRS it cannot use — ${malformed.join(" · ")}`);
  };

  const mode = (which) => {
    jointing = which === "joint";
    boxing = which === "box";
    pointing = which === "cursor";
    aimed = null;
    if (!jointing && !boxing && !pointing) gizmo.setMode(which);
    paint();
  };

  const pressed = new THREE.Vector2();

  const found = (event) => made.struck(event, free)?.object ?? null;

  const spot = (hit) => {
    const mesh = hit?.object;
    const group = mesh ? groups.get(mesh.userData.path) : null;
    if (!group || group.userData.active === false || hit.faceIndex == null) return null;
    const held = feature(surveyed(mesh.geometry), hit.faceIndex, mesh.worldToLocal(hit.point.clone()).toArray());
    if (!held) return null;
    group.updateMatrixWorld(true);
    const into = group.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
    return {
      slug: group.userData.slug,
      path: group.userData.path,
      kind: held.kind,
      point: rounded(new THREE.Vector3().fromArray(held.point).applyMatrix4(into).toArray()),
      axis: rounded(new THREE.Vector3().fromArray(held.axis).transformDirection(into).toArray()),
      ...(held.radius && { radius: Number((held.radius * into.getMaxScaleOnAxis()).toFixed(5)) }),
    };
  };

  const hover = (path) => {
    if (path === hovered) return;
    hovered = path;
    wear();
  };

  const onDown = (event) => pressed.set(event.clientX, event.clientY);
  const onClick = (event) => {
    if (gizmo.dragging || pressed.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 4) return;
    if (pointing) {
      const held = spot(made.struck(event, seen));
      if (held) onCursor(held);
      return;
    }
    const hit = found(event);
    onPick(hit?.userData.slug ?? null, hit?.userData.path ?? null, event);
  };
  const onPointerMove = (event) => {
    if (gizmo.dragging) return;
    if (pointing) {
      if (event.buttons) return;
      aimed = spot(made.struck(event, seen));
      renderer.domElement.style.cursor = aimed ? "crosshair" : "default";
      repin();
      return onHover(aimed ? { slug: aimed.slug, path: aimed.path, ref: groups.get(aimed.path).userData.ref, spot: aimed } : null);
    }
    if (event.buttons) return;
    const hit = found(event);
    const group = hit ? groups.get(hit.userData.path) : null;
    hover(group ? group.userData.path : null);
    renderer.domElement.style.cursor = group ? "pointer" : "default";
    onHover(group ? { slug: group.userData.slug, path: group.userData.path, ref: group.userData.ref } : null);
  };
  const onLeave = () => hover(null);
  const onDouble = (event) => {
    if (gizmo.dragging) return;
    const hit = found(event);
    if (hit) onDive(hit.userData.slug);
  };
  const lasso = document.createElement("div");
  lasso.style.cssText = "position:absolute;display:none;pointer-events:none;border:1px solid var(--pick-edge);background:var(--pick);opacity:0.4";
  container.appendChild(lasso);

  const onSweepDown = (event) => {
    if (event.button !== 0 || jointing || gizmo.axis || !(boxing || event.altKey)) return;
    controls.enabled = false;
    sweep = { x: event.clientX, y: event.clientY, to: null };
    renderer.domElement.setPointerCapture?.(event.pointerId);
  };
  const onSweepMove = (event) => {
    if (!sweep) return;
    sweep.to = { x: event.clientX, y: event.clientY };
    const rect = container.getBoundingClientRect();
    lasso.style.display = "block";
    lasso.style.left = `${Math.min(sweep.x, sweep.to.x) - rect.left}px`;
    lasso.style.top = `${Math.min(sweep.y, sweep.to.y) - rect.top}px`;
    lasso.style.width = `${Math.abs(sweep.to.x - sweep.x)}px`;
    lasso.style.height = `${Math.abs(sweep.to.y - sweep.y)}px`;
  };
  const onSweepUp = (event) => {
    if (!sweep) return;
    const was = sweep;
    sweep = null;
    controls.enabled = true;
    lasso.style.display = "none";
    if (!was.to || Math.hypot(was.to.x - was.x, was.to.y - was.y) < 4) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const centre = new THREE.Vector3();
    const caught = [...groups.values()].filter(free).filter((group) => {
      if (group.userData.active === false) return false;
      span([group]).getCenter(centre).project(camera);
      const x = rect.left + ((centre.x + 1) / 2) * rect.width;
      const y = rect.top + ((1 - centre.y) / 2) * rect.height;
      return centre.z < 1 && x >= Math.min(was.x, was.to.x) && x <= Math.max(was.x, was.to.x) && y >= Math.min(was.y, was.to.y) && y <= Math.max(was.y, was.to.y);
    });
    onBox([...new Set(caught.map((group) => group.userData.slug))], event);
  };
  renderer.domElement.addEventListener("pointerdown", onSweepDown, true);
  renderer.domElement.addEventListener("pointermove", onSweepMove);
  renderer.domElement.addEventListener("pointerup", onSweepUp);
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("click", onClick);
  renderer.domElement.addEventListener("dblclick", onDouble);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", onLeave);

  const dispose = () => {
    renderer.domElement.removeEventListener("pointerdown", onSweepDown, true);
    renderer.domElement.removeEventListener("pointermove", onSweepMove);
    renderer.domElement.removeEventListener("pointerup", onSweepUp);
    lasso.remove();
    renderer.domElement.removeEventListener("pointerdown", onDown);
    renderer.domElement.removeEventListener("click", onClick);
    renderer.domElement.removeEventListener("dblclick", onDouble);
    renderer.domElement.removeEventListener("pointermove", onPointerMove);
    renderer.domElement.removeEventListener("pointerleave", onLeave);
    gizmo.detach();
    gizmo.dispose();
    made.dispose();
  };

  return { show, select, point, clear, frame, focus, mode, look, orbit: made.orbit, zoom: made.zoom, ghosts, veils, spreads, pose: made.snapshot, place, dispose };
};
