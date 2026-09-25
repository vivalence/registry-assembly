import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// the stage: every placed instance of every loaded GLB, in metres, Y-up, as the blend arranged it.
// a loaded object is one Group per instance; a member's instances share a material so the pick
// lights them together. wireframe is the resting state, shaded is the selection — the sketch's.
// the selection is a set: a pick carries its modifier keys out, the view decides what they mean.

const loader = new GLTFLoader();
const cache = new Map();

const fetchGltf = (url) => {
  if (!cache.has(url)) cache.set(url, new Promise((res, rej) => loader.load(url, res, undefined, rej)));
  return cache.get(url);
};

const rgb = (name, fallback) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value ? new THREE.Color(value) : new THREE.Color(fallback);
};

export const stage = (container, { onPick = () => {} } = {}) => {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.001, 100);
  // off the origin from the start: a camera at 0,0,0 sits inside whatever loads first
  camera.position.set(0.6, 0.4, 0.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(0.5, 1, 0.6);
  scene.add(key);

  const primary = rgb("--colors-skeleton-0-primary-base", "#2a7f7f");
  const ink = rgb("--text-support", "#6b7386");
  const paper = rgb("--colors-skeleton-3-surface", "#d8dbe0");
  const rest = () => new THREE.MeshStandardMaterial({ color: paper, metalness: 0.1, roughness: 0.85, transparent: true, opacity: 0.35 });
  const wire = () => new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.5 });
  const lit = () => new THREE.MeshStandardMaterial({ color: primary, metalness: 0.2, roughness: 0.5 });

  const held = new Map(); // id → { groups: [Group] }
  const bounds = new THREE.Box3();
  let chosen = new Set();
  // render on demand: a frame is drawn when the camera moves, the scene changes or the canvas
  // resizes — never on a timer. an idle stage costs nothing.
  let dirty = true;
  const touch = () => (dirty = true);

  const style = (entry, on) => {
    for (const group of entry.groups) {
      group.traverse((child) => {
        if (child.isMesh) child.material = on ? lit() : rest();
        if (child.isLineSegments) child.visible = !on;
      });
    }
  };

  const mount = (id, built, placements) => {
    const entry = { groups: [] };
    for (const at of placements) {
      const group = built.clone(true);
      group.traverse((child) => {
        if (!child.isMesh) return;
        child.material = rest();
        child.userData.id = id;
        child.add(new THREE.LineSegments(new THREE.EdgesGeometry(child.geometry, 25), wire()));
      });
      if (at.translation) group.position.fromArray(at.translation);
      if (at.rotation) group.quaternion.fromArray(at.rotation);
      group.name = at.object ?? id;
      scene.add(group);
      entry.groups.push(group);
      bounds.expandByObject(group);
    }
    held.set(id, entry);
    if (chosen.has(id)) style(entry, true);
    touch();
    return entry;
  };

  // one geometry, N placements: an instance per placement, edges drawn once per mesh
  const place = async (id, url, placements) => mount(id, (await fetchGltf(url)).scene, placements);

  // an object built by the domain's /geometry door — three.js JSON — placed like a loaded GLB
  const placeObject = (id, json, placements) => mount(id, new THREE.ObjectLoader().parse(json), placements);

  const clear = () => {
    for (const entry of held.values()) for (const group of entry.groups) scene.remove(group);
    held.clear();
    bounds.makeEmpty();
    touch();
  };

  const select = (ids) => {
    const next = new Set(ids ?? []);
    for (const id of chosen) if (!next.has(id) && held.has(id)) style(held.get(id), false);
    for (const id of next) if (!chosen.has(id) && held.has(id)) style(held.get(id), true);
    chosen = next;
    touch();
  };

  const frame = () => {
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3()).length();
    camera.near = Math.max(0.0005, size * 0.01);
    camera.far = size * 40;
    camera.position.copy(center).add(new THREE.Vector3(size * 0.9, size * 0.6, size * 0.9));
    controls.target.copy(center);
    camera.updateProjectionMatrix();
    touch();
  };

  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pressed = new THREE.Vector2();
  const onDown = (event) => pressed.set(event.clientX, event.clientY);
  const onClick = (event) => {
    if (pressed.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 4) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects([...held.values()].flatMap((entry) => entry.groups), true).find((found) => found.object.isMesh);
    onPick(hit?.object.userData.id ?? null, event);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("click", onClick);

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

  controls.addEventListener("change", touch);
  let frameId = 0;
  const loop = () => {
    // update() answers true while damping still moves the camera
    if (controls.update() || dirty) {
      dirty = false;
      renderer.render(scene, camera);
    }
    frameId = requestAnimationFrame(loop);
  };
  frameId = requestAnimationFrame(loop);

  const dispose = () => {
    cancelAnimationFrame(frameId);
    observer.disconnect();
    renderer.domElement.removeEventListener("pointerdown", onDown);
    renderer.domElement.removeEventListener("click", onClick);
    controls.removeEventListener("change", touch);
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };

  return { place, placeObject, clear, select, frame, dispose, has: (id) => held.has(id) };
};
