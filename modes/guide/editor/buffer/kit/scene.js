// the stage kit — one three.js world under every assembly mode. `world` is the substrate: a GLB per
// part from the cargo (or generated json), one group per placement composed through its parent
// frame, the rig scaled to the model, ONE material law (`dress`: a placement keeps its file's own
// material; a look only veils, tints or lights it), explode, the camera's moves, the ray.
// `stage` is the guide's reading over it: a status per placement (fresh · solid · ghost · hidden),
// a tint per placement, settle on a step change, focus, a marquee.
// colours come from the theme through the container's CSS variables — never from here.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const cache = new Map();

const gltf = (url) => {
  if (!cache.has(url)) cache.set(url, new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject)));
  return cache.get(url);
};

export const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export const numbers = (held, length) => (Array.isArray(held) && held.length === length && held.every((one) => Number.isFinite(one)) ? held : null);
export const rounded = (list) => list.map((one) => Number(one.toFixed(5)));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// the named views: a heading off the model's centre, scaled by its size
export const VIEWS = {
  iso: [1, 0.88, 1],
  top: [0.0001, 1, 0.0001],
  under: [0.0001, -1, 0.0001],
  front: [1, 0.14, 0.0001],
  back: [-1, 0.17, 0.0001],
  left: [0.0001, 0.14, 1],
  right: [0.0001, 0.14, -1],
};
export const ORDER = ["iso", "top", "front", "right", "back", "left", "under"];

export const token = (element, name) => new THREE.Color(getComputedStyle(element).getPropertyValue(name).trim() || "white");

// what a status does to a placement's own material — the veil's theme role, how much of it shows
export const VEILS = {
  ghost: { role: "ghost", opacity: 0.12, hover: 0.4 },
  removed: { role: "removed", opacity: 0.08, hover: 0.3 },
};

export const world = (container, { onCamera = () => {}, onRest = () => {}, onFrame = () => {} } = {}) => {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none";
  renderer.domElement.tabIndex = 0;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 100);
  camera.position.set(0.6, 0.45, 0.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  // the comp's rig, authored for a 30-unit drone; `rig()` rescales it to the model's bounds
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  scene.add(fill);
  const under = new THREE.DirectionalLight(0xffffff, 0.5);
  scene.add(under);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.ShadowMaterial({ opacity: 0.12 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(80, 32, token(container, "--stage-line"), token(container, "--stage-hair"));
  grid.material.transparent = true;
  grid.material.opacity = 0.6;
  scene.add(grid);

  const colour = (name) => token(container, name);
  const palette = {
    fresh: colour("--stage-fresh"),
    picked: colour("--stage-picked"),
    ghost: colour("--stage-ghost"),
    removed: colour("--tint-danger"),
    edge: colour("--stage-edge"),
    edgeLight: colour("--stage-edge-light"),
    edgeFresh: colour("--stage-edge-fresh"),
    edgeGhost: colour("--stage-edge-ghost"),
    edgePicked: colour("--stage-edge-picked"),
    tint: (one) => (one.startsWith("#") ? new THREE.Color(one) : colour(`--tint-${one}`)),
  };

  const groups = new Map(); // path → group
  const bounds = new THREE.Box3();
  const centre = new THREE.Vector3();
  let size = 0.3;
  let tween = null;
  let dirty = true;
  let alive = true;
  const touch = () => (dirty = true);

  // an edge reads against its own face: light on a dark part, dark on a light one
  const edged = (material) => {
    const c = [].concat(material)[0]?.color ?? new THREE.Color("white");
    const base = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.25 ? palette.edgeLight : palette.edge;
    const line = new THREE.LineBasicMaterial({ color: base, transparent: true });
    line.userData.base = base;
    return line;
  };

  const mount = (id, built, nodes, malformed) => {
    for (const at of nodes) {
      const group = new THREE.Group();
      const body = built.clone(true);
      body.traverse((child) => {
        if (!child.isMesh) return;
        child.material = Array.isArray(child.material) ? child.material.map((one) => one.clone()) : child.material.clone();
        for (const material of [].concat(child.material)) {
          material.userData.colour = material.color?.clone() ?? new THREE.Color("white");
          material.userData.emissive = material.emissive?.clone() ?? new THREE.Color("black");
        }
        child.userData.slug = at.slug;
        child.userData.path = at.path;
        child.castShadow = true;
        child.add(new THREE.LineSegments(new THREE.EdgesGeometry(child.geometry, 28), edged(child.material)));
      });
      group.add(body);
      const matrix = new THREE.Matrix4().fromArray(at.parentMatrix ?? IDENTITY);
      const translation = numbers(at.translation, 3) ?? [0, 0, 0];
      const rotation = numbers(at.rotation, 4) ?? [0, 0, 0, 1];
      const scale = numbers(at.scale, 3) ?? [1, 1, 1];
      if (at.translation && !numbers(at.translation, 3)) malformed.push(`${at.path} translation ${JSON.stringify(at.translation)}`);
      if (at.rotation && !numbers(at.rotation, 4)) malformed.push(`${at.path} rotation ${JSON.stringify(at.rotation)}`);
      if (at.scale && !numbers(at.scale, 3)) malformed.push(`${at.path} scale ${JSON.stringify(at.scale)}`);
      const local = new THREE.Matrix4().compose(new THREE.Vector3().fromArray(translation), new THREE.Quaternion().fromArray(rotation), new THREE.Vector3().fromArray(scale));
      group.applyMatrix4(matrix.clone().multiply(local));
      group.name = at.path ?? id;
      group.userData = { slug: at.slug, path: at.path, ref: id, active: at.active, inverse: matrix.clone().invert(), base: group.position.clone() };
      scene.add(group);
      groups.set(at.path, group);
    }
  };

  const rig = () => {
    const k = size / 30;
    const at = (light, x, y, z) => light.position.set(centre.x + x * k, centre.y + y * k, centre.z + z * k);
    at(sun, 18, 40, 14);
    at(fill, -20, 10, -18);
    at(under, 0, -30, 8);
    sun.target.position.copy(centre);
    Object.assign(sun.shadow.camera, { left: -32 * k, right: 32 * k, top: 32 * k, bottom: -32 * k, near: k, far: 120 * k });
    sun.shadow.camera.updateProjectionMatrix();
    ground.scale.setScalar(k);
    ground.position.set(centre.x, bounds.min.y - 0.9 * k, centre.z);
    grid.scale.setScalar(k);
    grid.position.set(centre.x, bounds.min.y - 0.89 * k, centre.z);
  };

  const measure = () => {
    bounds.makeEmpty();
    for (const group of groups.values()) if (group.userData.active !== false) bounds.expandByObject(group);
    if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-0.1, -0.1, -0.1), new THREE.Vector3(0.1, 0.1, 0.1));
    bounds.getCenter(centre);
    size = Math.max(bounds.getSize(new THREE.Vector3()).length(), 0.02);
    rig();
  };

  const clear = () => {
    for (const group of groups.values()) scene.remove(group);
    groups.clear();
    touch();
  };

  const built = async (entry) => {
    if (entry.url) return (await gltf(entry.url).catch(() => null))?.scene ?? null;
    if (entry.json) {
      try {
        return new THREE.ObjectLoader().parse(entry.json);
      } catch {
        return null;
      }
    }
    return null;
  };

  // the fold's entries, fetched — then raised: mounted and measured, the malformed TRS named
  const load = async (entries) => {
    const loaded = [];
    for (const entry of entries) loaded.push([entry, await built(entry)]);
    return loaded;
  };
  const raise = (loaded) => {
    const malformed = [];
    clear();
    for (const [entry, object] of loaded) if (object) mount(entry.id, object, entry.nodes, malformed);
    measure();
    return malformed;
  };

  // the ONE material law. a placement wears its file's own material; a look never replaces it:
  //   status  fresh · solid · ghost · removed · hidden
  //   picked  the selection's light        hover  the pointer's
  //   tint    a theme role over a solid    edges  false hides a solid's contours
  const dress = (group, { status = "solid", picked = false, hover = false, tint = null, edges = true } = {}) => {
    group.visible = status !== "hidden";
    const veil = VEILS[status] ?? null;
    group.traverse((child) => {
      if (child.isLineSegments) {
        child.visible = edges || picked || !!veil;
        child.material.opacity = veil ? (hover ? 0.7 : 0.35) : 1;
        child.material.color.copy(picked ? palette.edgePicked : status === "fresh" ? palette.edgeFresh : veil ? palette.edgeGhost : child.material.userData.base);
        return;
      }
      if (!child.isMesh) return;
      for (const material of [].concat(child.material)) {
        material.transparent = !!veil;
        material.opacity = veil ? (hover ? veil.hover : veil.opacity) : 1;
        material.depthWrite = !veil;
        child.castShadow = !veil;
        material.color.copy(veil ? palette[veil.role] : tint && status === "solid" ? palette.tint(tint) : material.userData.colour);
        if (material.emissive) {
          material.emissive.copy(picked ? palette.picked : status === "fresh" || hover ? palette.fresh : material.userData.emissive);
          material.emissiveIntensity = picked ? 0.45 : status === "fresh" ? 0.38 : hover ? 0.22 : 1;
        }
      }
    });
  };

  // explode: a group flies out of the bounds' centre and lifts, by its own distance
  const spread = (group, amount) => {
    const base = group.userData.base;
    const off = base.clone().sub(centre).multiplyScalar(0.55 * amount);
    off.y += (size * 0.35 + Math.max(0, base.y - bounds.min.y) * 0.4) * amount;
    group.userData.off = off;
    group.position.copy(base).add(off);
  };

  // camera — named views around the centre, a pose { target, position } verbatim; a move is a
  // spherical tween so a view swings round the model instead of cutting through it
  const pose = (view, wide = false) => {
    if (view && typeof view === "object" && view.target && view.position) return { t: new THREE.Vector3().fromArray(view.target), p: new THREE.Vector3().fromArray(view.position) };
    const heading = new THREE.Vector3(...(VIEWS[view] ?? VIEWS.iso)).normalize();
    const reach = size * Math.max(1.05, 1.45 / Math.max(0.4, camera.aspect)) * (wide ? 1.35 : 1) * 1.4;
    return { t: centre.clone(), p: centre.clone().add(heading.multiplyScalar(reach)) };
  };
  const clip = () => {
    camera.near = Math.max(0.0005, size * 0.005);
    camera.far = Math.max(10, size * 60);
    camera.updateProjectionMatrix();
  };
  const go = (to, ms = 700) => {
    clip();
    if (!ms) {
      tween = null;
      controls.target.copy(to.t);
      camera.position.copy(to.p);
      return touch();
    }
    const fromOff = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const toOff = new THREE.Spherical().setFromVector3(to.p.clone().sub(to.t));
    let dT = toOff.theta - fromOff.theta;
    dT = Math.atan2(Math.sin(dT), Math.cos(dT));
    tween = { start: performance.now(), ms, ft: controls.target.clone(), tt: to.t.clone(), fromOff, toOff, dT };
    touch();
  };
  // the view cube's drag: orbit by pixels
  const orbit = (dx, dy) => {
    tween = null;
    const off = camera.position.clone().sub(controls.target);
    const sp = new THREE.Spherical().setFromVector3(off);
    sp.theta -= dx * 0.012;
    sp.phi = Math.max(0.02, Math.min(Math.PI - 0.02, sp.phi - dy * 0.012));
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sp));
    touch();
  };
  const zoom = (factor) => {
    const off = camera.position.clone().sub(controls.target);
    const length = Math.max(size * 0.15, Math.min(size * 12, off.length() * factor));
    go({ t: controls.target.clone(), p: controls.target.clone().add(off.setLength(length)) }, 300);
  };
  // the camera keeps its heading and backs off until the box fits
  const fit = (box, ms = 550) => {
    if (box.isEmpty()) return false;
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const d = Math.max(size * 0.2, (r / Math.sin((camera.fov * Math.PI) / 360)) * (camera.aspect < 1 ? 1.5 : 1.4));
    const heading = camera.position.clone().sub(controls.target).normalize();
    go({ t: c, p: c.clone().addScaledVector(heading, d) }, ms);
    return true;
  };
  const snapshot = () => ({ target: rounded(controls.target.toArray()), position: rounded(camera.position.toArray()) });

  // the ray — the nearest mesh under the pointer whose placement passes `within`
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const local = (event) => {
    const rect = container.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height];
  };
  const struck = (event, within = (group) => group.visible) => {
    const [x, y, w, h] = local(event);
    pointer.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects([...groups.values()], true).find((hit) => hit.object.isMesh && within(groups.get(hit.object.userData.path))) ?? null;
  };

  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    touch();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const halt = () => (tween = null);
  const rest = () => onRest();
  controls.addEventListener("start", halt);
  controls.addEventListener("change", touch);
  controls.addEventListener("end", rest);

  let frameId = 0;
  const loop = (now) => {
    if (!alive) return;
    onFrame(now);
    if (tween) {
      const t = Math.min(1, (now - tween.start) / tween.ms);
      const k = ease(t);
      const a = tween.fromOff;
      const b = tween.toOff;
      controls.target.lerpVectors(tween.ft, tween.tt, k);
      const sp = new THREE.Spherical(a.radius + (b.radius - a.radius) * k, a.phi + (b.phi - a.phi) * k, a.theta + tween.dT * k);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sp));
      if (t >= 1) {
        tween = null;
        rest();
      }
      dirty = true;
    }
    if (controls.update()) dirty = true;
    if (dirty) {
      dirty = false;
      renderer.render(scene, camera);
      onCamera(camera.matrixWorldInverse.elements);
    }
    frameId = requestAnimationFrame(loop);
  };
  frameId = requestAnimationFrame(loop);

  const dispose = () => {
    alive = false;
    cancelAnimationFrame(frameId);
    observer.disconnect();
    controls.removeEventListener("start", halt);
    controls.removeEventListener("change", touch);
    controls.removeEventListener("end", rest);
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };

  return {
    scene,
    camera,
    renderer,
    controls,
    palette,
    groups,
    bounds,
    centre,
    get size() {
      return size;
    },
    get alive() {
      return alive;
    },
    touch,
    load,
    raise,
    dress,
    spread,
    pose,
    go,
    orbit,
    zoom,
    fit,
    snapshot,
    local,
    struck,
    dispose,
  };
};

export const stage = (container, { onPick = () => {}, onMarquee = null, onHover = () => {}, onCamera = () => {}, onFault = () => {}, select = false } = {}) => {
  let S = { status: {}, tints: {}, labels: {}, selected: new Set(), explode: 0, overview: false, step: null, view: "iso", ghost: false };
  let hovered = null;
  let settle = null;
  let generation = 0;

  // settle: on a step change the fresh parts ease in from their exploded seat
  const settling = (now) => {
    if (!settle) return;
    settle.t = Math.min(1, (now - settle.start) / 900);
    if (settle.t >= 1) settle = null;
    paint();
  };
  const made = world(container, { onCamera, onFrame: settling });
  const { groups, camera, renderer } = made;

  const explodeOf = (status) => (settle && status === "fresh" ? S.explode + (1 - S.explode) * (1 - ease(settle.t)) : S.explode);

  const paint = () => {
    for (const group of groups.values()) {
      const slug = group.userData.slug;
      const status = S.status[slug] ?? "hidden";
      made.dress(group, { status, picked: S.selected.has(slug), hover: hovered === group.userData.path, tint: S.tints[slug] ?? null });
      made.spread(group, explodeOf(status));
    }
    made.touch();
  };

  const view = (name) => made.go(made.pose(name === "step" || name == null ? S.view : name, S.overview));
  const frame = (slugs = null) => {
    const want = slugs ? new Set(slugs) : null;
    const box = new THREE.Box3();
    for (const group of groups.values()) {
      if (!group.visible) continue;
      if (want ? !want.has(group.userData.slug) : (S.status[group.userData.slug] ?? "hidden") === "ghost") continue;
      box.expandByObject(group);
    }
    return made.fit(box);
  };

  // picking + marquee
  const hit = (event) => {
    let object = made.struck(event)?.object ?? null;
    while (object && !object.userData?.ref) object = object.parent;
    return object ?? null;
  };
  let down = null;
  let marquee = null;
  const box = document.createElement("div");
  box.className = "marquee";
  box.style.display = "none";
  container.appendChild(box);
  const onMarqueeMove = (event) => {
    if (!marquee) return;
    const [x, y] = made.local(event);
    marquee.x1 = x;
    marquee.y1 = y;
    Object.assign(box.style, { display: "block", left: `${Math.min(marquee.x0, x)}px`, top: `${Math.min(marquee.y0, y)}px`, width: `${Math.abs(x - marquee.x0)}px`, height: `${Math.abs(y - marquee.y0)}px` });
  };
  const onMarqueeUp = () => {
    window.removeEventListener("pointermove", onMarqueeMove);
    window.removeEventListener("pointerup", onMarqueeUp);
    if (!marquee) return;
    const r = { l: Math.min(marquee.x0, marquee.x1), r: Math.max(marquee.x0, marquee.x1), t: Math.min(marquee.y0, marquee.y1), b: Math.max(marquee.y0, marquee.y1) };
    const { width, height } = container.getBoundingClientRect();
    const slugs = [];
    if (r.r - r.l > 3 && r.b - r.t > 3) {
      for (const group of groups.values()) {
        if (!group.visible) continue;
        const c = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3()).project(camera);
        const sx = ((c.x + 1) / 2) * width;
        const sy = ((1 - c.y) / 2) * height;
        if (c.z < 1 && sx >= r.l && sx <= r.r && sy >= r.t && sy <= r.b) slugs.push(group.userData.slug);
      }
    }
    box.style.display = "none";
    const add = marquee.add;
    marquee = null;
    if (slugs.length || !add) onMarquee?.([...new Set(slugs)], add);
  };
  const onDown = (event) => {
    if (event.target !== renderer.domElement) return;
    if (select && onMarquee && event.altKey && event.button === 0) {
      event.stopPropagation();
      event.preventDefault();
      const [x, y] = made.local(event);
      marquee = { x0: x, y0: y, x1: x, y1: y, add: event.shiftKey || event.metaKey };
      window.addEventListener("pointermove", onMarqueeMove);
      window.addEventListener("pointerup", onMarqueeUp);
      return;
    }
    renderer.domElement.focus({ preventScroll: true });
    down = { x: event.clientX, y: event.clientY, button: event.button };
  };
  const onUp = (event) => {
    const was = down;
    down = null;
    if (!was || was.button !== 0 || Math.hypot(event.clientX - was.x, event.clientY - was.y) > 4) return;
    const found = hit(event);
    onPick(found?.userData.slug ?? null, found?.userData.path ?? null, event);
  };
  const onMove = (event) => {
    if (event.buttons) return;
    const found = hit(event);
    const path = found?.userData.path ?? null;
    if (path !== hovered) {
      hovered = path;
      paint();
    }
    renderer.domElement.style.cursor = found ? "pointer" : "grab";
    const [x, y] = made.local(event);
    onHover(found ? { slug: found.userData.slug, path, ref: found.userData.ref, label: S.labels[found.userData.slug] ?? found.userData.slug, x, y } : null);
  };
  const onDouble = (event) => {
    const found = hit(event);
    if (found) frame([found.userData.slug]);
    else frame(null);
  };
  const onLeave = () => {
    if (hovered) {
      hovered = null;
      paint();
    }
    onHover(null);
  };
  container.addEventListener("pointerdown", onDown, true);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("dblclick", onDouble);
  renderer.domElement.addEventListener("pointerleave", onLeave);

  let last = { step: null, view: null };
  let shown = null;

  // the fold's entries — loaded, mounted; the camera goes home
  const show = async (entries) => {
    const mine = ++generation;
    const ids = entries.map((entry) => entry.id).join("\n");
    const loaded = await made.load(entries);
    if (mine !== generation || !made.alive) return;
    const malformed = made.raise(loaded);
    paint();
    if (ids !== shown) view("step");
    shown = ids;
    if (malformed.length) onFault(`the stage was handed a TRS it cannot use — ${malformed.join(" · ")}`);
  };

  // what the screen says about the placements — status, tints, labels, explode, the step's view
  const update = (next) => {
    const stepped = next.step !== last.step;
    const fresh = Object.values(next.status ?? {}).some((one) => one === "fresh");
    if (stepped && last.step !== null && fresh) settle = { start: performance.now(), t: 0 };
    S = { ...S, ...next, selected: new Set(next.selected ?? []) };
    const key = typeof S.view === "object" ? JSON.stringify(S.view) : S.view;
    if (groups.size && (key !== last.view || stepped)) view("step");
    last = { step: next.step ?? null, view: key };
    paint();
  };

  const dispose = () => {
    container.removeEventListener("pointerdown", onDown, true);
    renderer.domElement.removeEventListener("pointerup", onUp);
    renderer.domElement.removeEventListener("pointermove", onMove);
    renderer.domElement.removeEventListener("dblclick", onDouble);
    renderer.domElement.removeEventListener("pointerleave", onLeave);
    made.dispose();
    box.remove();
  };

  return { show, update, view, frame, zoom: made.zoom, orbit: made.orbit, snapshot: made.snapshot, dispose };
};
