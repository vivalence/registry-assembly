import * as THREE from "three";
import { v } from "@vivalence/typology";

// geometry generated at read: a PARAMETRIC component names a generator and its params; the
// generator builds an Object3D in metres, Y-up, its origin where the part meets what it holds.
// three builds geometry without a DOM, so this runs in the daemon and in the browser alike.

const mm = (x) => x / 1000;

// ISO metric coarse: nominal diameter, button head diameter and height, hex across flats, nut height
const THREADS = {
  M2: { d: 2, head: 3.8, headHeight: 1.3, flats: 4, nut: 1.6 },
  M3: { d: 3, head: 5.7, headHeight: 1.65, flats: 5.5, nut: 2.4 },
  M4: { d: 4, head: 7.6, headHeight: 2.2, flats: 7, nut: 3.2 },
  M5: { d: 5, head: 9.5, headHeight: 2.75, flats: 8, nut: 4 },
};

const THREAD = v.enum(Object.keys(THREADS)).desc('ISO metric thread. Example: "M3"');

const STEEL = { color: 0x8a8f98, metalness: 0.8, roughness: 0.4 };
const SILICONE = { color: 0x4caf50, metalness: 0, roughness: 0.9 };
const BOARD = { color: 0x2b2f36, metalness: 0.1, roughness: 0.7 };
const SLEEVE = { color: 0xb3261e, metalness: 0, roughness: 0.8 };

const mesh = (geometry, name, look = STEEL) => Object.assign(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial(look)), { name });

// the underside of the head sits at the origin; the shaft goes down -Y into the material
const bolt = ({ thread, length }) => {
  const spec = THREADS[thread];
  const group = new THREE.Group();
  const shaft = mesh(new THREE.CylinderGeometry(mm(spec.d) / 2, mm(spec.d) / 2, mm(length), 24), "shaft");
  shaft.position.y = -mm(length) / 2;
  const head = mesh(new THREE.CylinderGeometry(mm(spec.head) / 2, mm(spec.head) / 2 * 0.85, mm(spec.headHeight), 24), "head");
  head.position.y = mm(spec.headHeight) / 2;
  group.add(shaft, head);
  return group;
};

// a hex prism standing on the origin, going up +Y
const standoff = ({ thread, length }) => {
  const spec = THREADS[thread];
  const radius = mm(spec.flats) / 2 / Math.cos(Math.PI / 6);
  const body = mesh(new THREE.CylinderGeometry(radius, radius, mm(length), 6), "body");
  body.position.y = mm(length) / 2;
  return new THREE.Group().add(body);
};

const nut = ({ thread }) => {
  const spec = THREADS[thread];
  const radius = mm(spec.flats) / 2 / Math.cos(Math.PI / 6);
  const body = mesh(new THREE.CylinderGeometry(radius, radius, mm(spec.nut), 6), "body");
  body.position.y = mm(spec.nut) / 2;
  return new THREE.Group().add(body);
};

// a box standing on the origin, its footprint centred — a board, a pad, a receiver
const box = ({ x, y, z }) => {
  const body = mesh(new THREE.BoxGeometry(mm(x), mm(y), mm(z)), "body", BOARD);
  body.position.y = mm(y) / 2;
  return new THREE.Group().add(body);
};

// a tube standing on the origin — a grommet: outer and inner diameter, length, all millimetres
const bushing = ({ outer, inner, length }) => {
  const ring = new THREE.Shape().absarc(0, 0, mm(outer) / 2, 0, Math.PI * 2, false);
  ring.holes.push(new THREE.Path().absarc(0, 0, mm(inner) / 2, 0, Math.PI * 2, true));
  const body = mesh(new THREE.ExtrudeGeometry(ring, { depth: mm(length), bevelEnabled: false, curveSegments: 24 }), "body", SILICONE);
  body.rotation.x = -Math.PI / 2;
  return new THREE.Group().add(body);
};

// a cable along a route of points in the placement's own frame, metres — straight between the points it is given
const route = ({ route: points, diameter }) => {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, "catmullrom", 0.5);
  const body = mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 8), mm(diameter) / 2, 8, false), "body", SLEEVE);
  return new THREE.Group().add(body);
};

const POINT = v.array(v.number(), { minItems: 3, maxItems: 3 });

export const generators = {
  "fastener.bolt": {
    params: v.object({ thread: THREAD, length: v.number().desc("Shaft length in millimetres. Example: 16") }),
    build: bolt,
  },
  "fastener.standoff": {
    params: v.object({ thread: THREAD, length: v.number().desc("Length in millimetres. Example: 27") }),
    build: standoff,
  },
  "fastener.nut": {
    params: v.object({ thread: THREAD }),
    build: nut,
  },
  "solid.box": {
    params: v.object({ x: v.number().desc("Width along x in millimetres. Example: 20"), y: v.number().desc("Height along y in millimetres. Example: 4"), z: v.number().desc("Depth along z in millimetres. Example: 12") }),
    build: box,
  },
  "solid.bushing": {
    params: v.object({ outer: v.number().desc("Outer diameter in millimetres. Example: 6"), inner: v.number().desc("Bore in millimetres. Example: 3"), length: v.number().desc("Length in millimetres. Example: 5") }),
    build: bushing,
  },
  "cable.route": {
    params: v.object({ route: v.array(POINT, { minItems: 2 }).desc("Points along the cable, metres, in the placement's frame. Example: [[0, 0, 0], [0.1, 0.01, 0]]"), diameter: v.number().desc("Cable diameter in millimetres. Example: 2.4") }),
    build: route,
  },
};

// build a PARAMETRIC payload, params defaulted and coerced against the generator's schema
export const generate = ({ generator, params }) => {
  const held = generators[generator];
  if (!held) throw new Error(`[assembly] no generator "${generator}" — one of ${Object.keys(generators).join(", ")}`);
  const filled = held.params.cast({ ...params });
  if (!held.params.check(filled)) throw new Error(`[assembly] ${generator} params: ${[...held.params.errors(filled)].map((error) => `${error.path} ${error.message}`).join("; ")}`);
  return held.build(filled);
};
