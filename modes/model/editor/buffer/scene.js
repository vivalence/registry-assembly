import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const cache = new Map();

const gltf = (url) => {
  if (!cache.has(url)) cache.set(url, new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject)));
  return cache.get(url);
};

const token = (element, name) => new THREE.Color(getComputedStyle(element).getPropertyValue(name).trim() || "white");

const rounded = (list) => list.map((one) => Number(one.toFixed(5)));

const numbers = (held, length) => (Array.isArray(held) && held.length === length && held.every((one) => Number.isFinite(one)) ? held : null);

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

export const stage = (container, { onPick = () => {}, onDive = () => {}, onMove = () => {}, onHover = () => {}, onCamera = () => {}, onRest = () => {}, onFault = () => {} } = {}) => {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.001, 100);
  camera.position.set(0.6, 0.4, 0.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  scene.add(new THREE.HemisphereLight(token(container, "--sky"), token(container, "--ground"), 1.1));
  const key = new THREE.DirectionalLight(token(container, "--sky"), 1.35);
  key.position.set(0.5, 1, 0.45);
  scene.add(key);
  const fill = new THREE.DirectionalLight(token(container, "--fill"), 0.4);
  fill.position.set(-0.6, 0.2, -0.5);
  scene.add(fill);
  const marks = new THREE.Group();
  scene.add(marks);

  const aqua = token(container, "--part");
  const glow = token(container, "--glow");
  const rim = token(container, "--rim");
  const skin = token(container, "--iron");
  const gone = token(container, "--fail");
  const caged = token(container, "--joint");
  const faded = token(container, "--ghost");
  const outline = token(container, "--ghost-edge");

  const plain = () => new THREE.MeshStandardMaterial({ color: skin, flatShading: true, metalness: 0.35, roughness: 0.55 });
  const ghosted = () => new THREE.MeshStandardMaterial({ color: faded, flatShading: true, transparent: true, opacity: 0.1, depthWrite: false });
  const chosen = () => new THREE.MeshStandardMaterial({ color: aqua, emissive: glow, flatShading: true, roughness: 0.3 });
  const removed = () => new THREE.MeshStandardMaterial({ color: gone, transparent: true, opacity: 0.08, depthWrite: false });
  const edged = () => new THREE.LineBasicMaterial({ color: rim, transparent: true, opacity: 0.8 });

  const groups = new Map();
  const bounds = new THREE.Box3();
  let picked = new Set();
  let marked = new Set();
  let ghosting = false;
  let ghost = false;
  let explode = 0;
  let tween = null;
  let dirty = true;
  let generation = 0;
  let jointing = false;
  let malformed = [];
  const touch = () => (dirty = true);

  const gizmo = new TransformControls(camera, renderer.domElement);
  gizmo.setSize(0.8);
  scene.add(gizmo.getHelper());
  gizmo.addEventListener("dragging-changed", (event) => {
    controls.enabled = !event.value;
    touch();
  });
  gizmo.addEventListener("change", () => {
    cage();
    touch();
  });
  gizmo.addEventListener("mouseUp", () => {
    const object = gizmo.object;
    if (!object?.userData?.slug) return;
    const at = object.position.clone().sub(object.userData.off ?? new THREE.Vector3());
    object.userData.base = at.clone();
    const world = new THREE.Matrix4().compose(at, object.quaternion, object.scale);
    const local = object.userData.inverse ? object.userData.inverse.clone().multiply(world) : world;
    const translation = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    local.decompose(translation, rotation, scale);
    onMove(object.userData.slug, {
      translation: rounded(translation.toArray()),
      rotation: rounded(rotation.toArray()),
      scale: rounded(scale.toArray()),
    });
  });

  const stateOf = (group) =>
    group.userData.active === false ? "removed" : marked.has(group.userData.path) ? "held" : picked.has(group.userData.slug) ? "picked" : ghosting ? "ghost" : "plain";

  const dress = (group) => {
    const state = stateOf(group);
    const bright = state === "picked" || state === "held";
    const faint = state === "ghost";
    group.traverse((child) => {
      if (child.isMesh) child.material = bright ? chosen() : state === "removed" ? removed() : faint ? ghosted() : plain();
      if (!child.isLineSegments) return;
      child.visible = bright || faint;
      child.material.color.copy(faint ? outline : rim);
      child.material.opacity = faint ? 0.6 : 0.8;
    });
  };

  const box = (object, color, opacity) => {
    const helper = new THREE.Box3Helper(new THREE.Box3().setFromObject(object), color);
    helper.material.transparent = true;
    helper.material.opacity = opacity;
    return helper;
  };

  const lit = () => [...groups.values()].filter((group) => picked.has(group.userData.slug));

  const cage = () => {
    while (marks.children.length) marks.remove(marks.children[0]);
    if (jointing) {
      for (const group of groups.values()) if (marked.has(group.userData.path) || picked.has(group.userData.slug)) marks.add(box(group, caged, 0.9));
      return;
    }
    const shown = lit();
    if (shown.length === 1) marks.add(box(shown[0], aqua, 0.45));
  };

  const mount = (id, built, nodes) => {
    for (const at of nodes) {
      const group = new THREE.Group();
      const body = built.clone(true);
      body.traverse((child) => {
        if (!child.isMesh) return;
        child.userData.slug = at.slug;
        child.userData.path = at.path;
        child.add(new THREE.LineSegments(new THREE.EdgesGeometry(child.geometry, 28), edged()));
      });
      group.add(body);
      const matrix = new THREE.Matrix4().fromArray(at.parentMatrix ?? IDENTITY);
      group.userData.inverse = matrix.clone().invert();
      const translation = numbers(at.translation, 3) ?? [0, 0, 0];
      const rotation = numbers(at.rotation, 4) ?? [0, 0, 0, 1];
      const scale = numbers(at.scale, 3) ?? [1, 1, 1];
      if (at.translation && !numbers(at.translation, 3)) malformed.push(`${at.path} translation ${JSON.stringify(at.translation)}`);
      if (at.rotation && !numbers(at.rotation, 4)) malformed.push(`${at.path} rotation ${JSON.stringify(at.rotation)}`);
      if (at.scale && !numbers(at.scale, 3)) malformed.push(`${at.path} scale ${JSON.stringify(at.scale)}`);
      const local = new THREE.Matrix4().compose(new THREE.Vector3().fromArray(translation), new THREE.Quaternion().fromArray(rotation), new THREE.Vector3().fromArray(scale));
      group.applyMatrix4(matrix.clone().multiply(local));
      group.name = at.path ?? id;
      group.userData.slug = at.slug;
      group.userData.path = at.path;
      group.userData.ref = id;
      group.userData.active = at.active;
      group.userData.base = group.position.clone();
      scene.add(group);
      groups.set(at.path, group);
      if (at.active !== false) bounds.expandByObject(group);
    }
    touch();
  };

  const clear = () => {
    gizmo.detach();
    for (const group of groups.values()) scene.remove(group);
    groups.clear();
    bounds.makeEmpty();
    touch();
  };

  const attach = () => {
    const shown = picked.size === 1 && !jointing ? lit() : [];
    const group = shown[0];
    if (group && group.userData.active !== false) gizmo.attach(group);
    else gizmo.detach();
    touch();
  };

  const spread = () => {
    const centre = bounds.getCenter(new THREE.Vector3());
    const size = Math.max(bounds.getSize(new THREE.Vector3()).length(), 0.01);
    for (const group of groups.values()) {
      const base = group.userData.base;
      const out = base.clone().sub(centre).multiplyScalar(0.55 * explode);
      out.y += (size * 0.35 + Math.max(0, base.y - bounds.min.y) * 0.4) * explode;
      group.userData.off = out;
      group.position.copy(base).add(out);
    }
    touch();
  };

  const paint = () => {
    ghosting = ghost && (lit().length > 0 || [...groups.values()].some((group) => marked.has(group.userData.path)));
    for (const group of groups.values()) dress(group);
    spread();
    attach();
    cage();
  };

  const select = (slugs, joins = []) => {
    picked = new Set(slugs ?? []);
    marked = new Set(joins ?? []);
    paint();
  };

  const tweenTo = (target, position, ms = 700) => {
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const to = new THREE.Spherical().setFromVector3(position.clone().sub(target));
    const turn = Math.atan2(Math.sin(to.theta - from.theta), Math.cos(to.theta - from.theta));
    tween = { start: performance.now(), ms, origin: controls.target.clone(), target: target.clone(), from, to, turn };
    touch();
  };

  const fit = (target, reach, keep, smooth = false) => {
    if (target.isEmpty()) return false;
    const center = target.getCenter(new THREE.Vector3());
    const size = Math.max(target.getSize(new THREE.Vector3()).length(), 0.01);
    const heading = keep ? camera.position.clone().sub(controls.target).normalize() : new THREE.Vector3(...VIEWS.iso).normalize();
    const distance = size * reach;
    camera.near = Math.max(0.0005, distance * 0.005);
    camera.far = Math.max(10, distance * 60);
    camera.updateProjectionMatrix();
    const position = center.clone().add(heading.multiplyScalar(distance));
    if (smooth) return (tweenTo(center, position, 550), true);
    tween = null;
    camera.position.copy(position);
    controls.target.copy(center);
    touch();
    onRest(pose());
    return true;
  };

  const spanned = () => {
    const box = new THREE.Box3();
    for (const group of groups.values()) if (group.userData.active !== false) box.expandByObject(group);
    return box;
  };

  const frame = (smooth = false) => fit(explode ? spanned() : bounds, 1.4, false, smooth);

  const look = (name) => {
    const target = spanned();
    if (target.isEmpty()) return;
    const center = target.getCenter(new THREE.Vector3());
    const reach = Math.max(target.getSize(new THREE.Vector3()).length(), 0.01) * 1.4;
    tweenTo(center, center.clone().add(new THREE.Vector3(...(VIEWS[name] ?? VIEWS.iso)).normalize().multiplyScalar(reach)));
  };

  const orbit = (dx, dy) => {
    tween = null;
    const around = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    around.theta -= dx * 0.012;
    around.phi = Math.max(0.02, Math.min(Math.PI - 0.02, around.phi - dy * 0.012));
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(around));
    touch();
  };

  const zoom = (factor) => {
    const size = Math.max(spanned().getSize(new THREE.Vector3()).length(), 0.01);
    const off = camera.position.clone().sub(controls.target);
    off.setLength(Math.max(size * 0.15, Math.min(size * 12, off.length() * factor)));
    tweenTo(controls.target.clone(), controls.target.clone().add(off), 300);
  };

  const pose = () => ({ target: rounded(controls.target.toArray()), position: rounded(camera.position.toArray()) });

  const place = (saved) => {
    const target = numbers(saved?.target, 3);
    const position = numbers(saved?.position, 3);
    if (!target || !position) return false;
    tween = null;
    controls.target.fromArray(target);
    camera.position.fromArray(position);
    const distance = Math.max(camera.position.distanceTo(controls.target), 0.001);
    camera.near = Math.max(0.0005, distance * 0.005);
    camera.far = Math.max(10, distance * 60);
    camera.updateProjectionMatrix();
    touch();
    return true;
  };

  const ghosts = (on) => {
    ghost = on;
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
    const target = new THREE.Box3();
    for (const group of shown) target.expandByObject(group);
    return fit(target, 2.6, true);
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

  const show = async (entries, slugs = [], { refit = true, joins = [], on = null } = {}) => {
    const mine = ++generation;
    const loaded = [];
    for (const entry of entries) loaded.push([entry, await built(entry)]);
    if (mine !== generation) return;
    clear();
    malformed = [];
    picked = new Set(slugs ?? []);
    marked = new Set(joins ?? []);
    for (const [entry, object] of loaded) if (object) mount(entry.id, object, entry.nodes);
    paint();
    if (on && focus(on)) return;
    if (refit) frame();
    if (malformed.length) onFault(`the stage was handed a TRS it cannot use — ${malformed.join(" · ")}`);
  };

  const mode = (which) => {
    jointing = which === "joint";
    if (!jointing) gizmo.setMode(which);
    attach();
    cage();
  };

  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pressed = new THREE.Vector2();

  const found = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects([...groups.values()], true).find((hit) => hit.object.isMesh)?.object ?? null;
  };

  const onDown = (event) => pressed.set(event.clientX, event.clientY);
  const onClick = (event) => {
    if (gizmo.dragging || pressed.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 4) return;
    const hit = found(event);
    onPick(hit?.userData.slug ?? null, hit?.userData.path ?? null, event);
  };
  const onPointerMove = (event) => {
    if (gizmo.dragging) return;
    const hit = found(event);
    const group = hit ? groups.get(hit.userData.path) : null;
    renderer.domElement.style.cursor = group ? "pointer" : "default";
    onHover(group ? { slug: group.userData.slug, path: group.userData.path, ref: group.userData.ref } : null);
  };
  const onDouble = (event) => {
    if (gizmo.dragging) return;
    const hit = found(event);
    if (hit) onDive(hit.userData.slug);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("click", onClick);
  renderer.domElement.addEventListener("dblclick", onDouble);
  renderer.domElement.addEventListener("pointermove", onPointerMove);

  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    touch();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const halt = () => (tween = null);
  const rest = () => onRest(pose());
  controls.addEventListener("change", touch);
  controls.addEventListener("start", halt);
  controls.addEventListener("end", rest);
  let frameId = 0;
  const loop = () => {
    if (tween) {
      const t = Math.min(1, (performance.now() - tween.start) / tween.ms);
      const k = ease(t);
      controls.target.lerpVectors(tween.origin, tween.target, k);
      const around = new THREE.Spherical(tween.from.radius + (tween.to.radius - tween.from.radius) * k, tween.from.phi + (tween.to.phi - tween.from.phi) * k, tween.from.theta + tween.turn * k);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(around));
      if (t >= 1) {
        tween = null;
        rest();
      }
      dirty = true;
    }
    if (controls.update() || dirty) {
      dirty = false;
      renderer.render(scene, camera);
      onCamera(camera.matrixWorldInverse.elements);
    }
    frameId = requestAnimationFrame(loop);
  };
  frameId = requestAnimationFrame(loop);

  const dispose = () => {
    cancelAnimationFrame(frameId);
    observer.disconnect();
    renderer.domElement.removeEventListener("pointerdown", onDown);
    renderer.domElement.removeEventListener("click", onClick);
    renderer.domElement.removeEventListener("dblclick", onDouble);
    renderer.domElement.removeEventListener("pointermove", onPointerMove);
    controls.removeEventListener("change", touch);
    controls.removeEventListener("start", halt);
    controls.removeEventListener("end", rest);
    gizmo.detach();
    gizmo.dispose();
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };

  return { show, select, clear, frame, focus, mode, look, orbit, zoom, ghosts, spreads, pose, place, dispose };
};
