import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const cache = new Map();

const gltf = (url) => {
  if (!cache.has(url)) cache.set(url, new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject)));
  return cache.get(url);
};

const token = (element, name, fallback) => {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return new THREE.Color(value || fallback);
};

export const stage = (container, { onPick = () => {} } = {}) => {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.001, 100);
  camera.position.set(0.6, 0.4, 0.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(0.5, 1, 0.6);
  scene.add(key);

  const lit = token(container, "--component", "#3ddc97");
  const skin = token(container, "--ink-3", "#bdbdbd");
  const edge = token(container, "--mute", "#8a8a8a");
  const resting = () => new THREE.MeshStandardMaterial({ color: skin, metalness: 0.1, roughness: 0.85, transparent: true, opacity: 0.3 });
  const wire = () => new THREE.LineBasicMaterial({ color: edge, transparent: true, opacity: 0.55 });
  const chosen = () => new THREE.MeshStandardMaterial({ color: lit, metalness: 0.2, roughness: 0.5 });

  const held = new Map();
  const bounds = new THREE.Box3();
  let picked = new Set();
  let dirty = true;
  let generation = 0;
  const touch = () => (dirty = true);

  const style = (entry, on) => {
    for (const group of entry.groups) {
      group.traverse((child) => {
        if (child.isMesh) child.material = on ? chosen() : resting();
        if (child.isLineSegments) child.visible = !on;
      });
    }
  };

  const mount = (id, built, nodes) => {
    const entry = { groups: [] };
    for (const at of nodes) {
      const group = built.clone(true);
      group.traverse((child) => {
        if (!child.isMesh) return;
        child.material = resting();
        child.userData.id = id;
        child.add(new THREE.LineSegments(new THREE.EdgesGeometry(child.geometry, 25), wire()));
      });
      if (at.translation) group.position.fromArray(at.translation);
      if (at.rotation) group.quaternion.fromArray(at.rotation);
      if (at.scale) group.scale.fromArray(at.scale);
      group.name = at.path ?? id;
      scene.add(group);
      entry.groups.push(group);
      bounds.expandByObject(group);
    }
    held.set(id, entry);
    if (picked.has(id)) style(entry, true);
    touch();
  };

  const clear = () => {
    for (const entry of held.values()) for (const group of entry.groups) scene.remove(group);
    held.clear();
    bounds.makeEmpty();
    touch();
  };

  const select = (ids) => {
    const next = new Set(ids ?? []);
    for (const id of picked) if (!next.has(id) && held.has(id)) style(held.get(id), false);
    for (const id of next) if (!picked.has(id) && held.has(id)) style(held.get(id), true);
    picked = next;
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

  const show = async (entries, lit = []) => {
    const mine = ++generation;
    clear();
    select(lit);
    for (const entry of entries) {
      if (!entry.url) continue;
      const built = await gltf(entry.url).catch(() => null);
      if (mine !== generation) return;
      if (built) mount(entry.id, built.scene, entry.nodes);
    }
    frame();
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

  return { show, select, clear, frame, dispose };
};
