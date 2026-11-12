import { v } from "@vivalence/typology";

const VEC3 = v.array(v.number(), { minItems: 3, maxItems: 3 });
const QUAT = v.array(v.number(), { minItems: 4, maxItems: 4 });

export const FORMATS = {
  glb: { label: "GLB", extensions: ["glb"], importer: "gltf", axis: "Y-up", route: "glb → blender import_scene.gltf → glTF 2.0 per object" },
  gltf: { label: "GLTF", extensions: ["gltf"], importer: "gltf", axis: "Y-up", route: "gltf → blender import_scene.gltf → glTF 2.0 per object" },
  blend: { label: "BLEND", extensions: ["blend"], importer: null, axis: "Z-up", route: "blend → blender → glTF 2.0 per object" },
  usd: { label: "USD", extensions: ["usd", "usda"], importer: "usd", axis: "Y-up", route: "usd → blender wm.usd_import → glTF 2.0 per object" },
  usdz: { label: "USDZ", extensions: ["usdz"], importer: "usd", axis: "Y-up", route: "usdz → blender wm.usd_import → glTF 2.0 per object" },
  usdc: { label: "USDC", extensions: ["usdc"], importer: "usd", axis: "Y-up", route: "usdc → blender wm.usd_import → glTF 2.0 per object" },
  fbx: { label: "FBX", extensions: ["fbx"], importer: "fbx", axis: "Y-up", route: "fbx → blender import_scene.fbx → glTF 2.0 per object" },
  obj: { label: "OBJ", extensions: ["obj"], importer: "obj", axis: "Y-up", route: "obj → blender wm.obj_import → glTF 2.0 per object" },
  stl: { label: "STL", extensions: ["stl"], importer: "stl", axis: "Z-up", route: "stl → blender wm.stl_import → glTF 2.0 per object" },
  "3ds": { label: "3DS", extensions: ["3ds"], importer: "3ds", axis: "Z-up", route: "3ds → blender io_scene_3ds → glTF 2.0 per object" },
  step: { label: "STEP", extensions: ["step", "stp"], importer: "obj", cad: true, axis: "Z-up", route: "step → FreeCAD OCCT tessellation → obj → blender → glTF 2.0 per object" },
  iges: { label: "IGES", extensions: ["iges", "igs"], importer: "obj", cad: true, axis: "Z-up", route: "iges → FreeCAD OCCT tessellation → obj → blender → glTF 2.0 per object" },
};

export const EXTENSIONS = Object.values(FORMATS).flatMap((format) => format.extensions);
export const STAGES = ["sniff", "validate", "decode", "review", "commit"];
export const LEVELS = ["SNIFF", "OK", "WORK", "WARN", "FIX", "ONTO", "DONE", "FAIL"];
export const STATES = ["wait", "run", "parsed", "warn", "done", "fail"];
export const UPS = ["Y", "Z"];
export const RULES = ["fingerprint", "name", "none"];
export const ISOLATES = ["ALL", "COMPONENT", "ASSEMBLY", "STEP"];
export const ONTOLOGIES = ["part", "placement", "step", "guide"];

const T = v.string().desc('Minutes, seconds and hundredths since the job began. Example: "00:04.55"');
const LVL = v.enum(LEVELS).desc('What kind of line. Example: "FIX"');
const MSG = v.string().desc('The line. Example: "applied Z-up → Y-up root rotation (−90° X)"');

export const LINE = v.object({ t: T, lvl: LVL, msg: MSG }).desc('One line of a job\'s decode log. Example: { t: "00:00.04", lvl: "SNIFF", msg: "magic bytes matched BLEND — extension trusted" }');

export const META = v.object({
  source: v.string().desc('The file, by name. Example: "drone_rig.fbx"'),
  route: v.string().desc('The hops from the file to glTF. Example: "fbx → blender import_scene.fbx → glTF 2.0 per object"'),
  bytes: v.integer().desc("The payload's size. Example: 41000000"),
  triangles: v.integer().optional().desc("Triangles over every mesh. Example: 212400"),
  meshes: v.integer().optional().desc("Mesh objects found. Example: 18"),
  materials: v.integer().optional().desc("Distinct materials. Example: 9"),
  animations: v.integer().optional().desc("Animation clips the file carried. Example: 3"),
  axis: v.string().optional().desc('The source\'s up axis and what was done about it. Example: "Z-up → Y-up"'),
  unit: v.number().optional().desc("Metres per unit of the source, as decoded. Example: 0.01"),
  declared: v.number().optional().desc("Metres per unit the file itself declares, when it declares one. Example: 1"),
  decoder: v.string().optional().desc('What decoded it. Example: "blender 5.2.2 LTS"'),
}).desc('What the decode read off the file. Example: { source: "drone_rig.fbx", route: "fbx → …", bytes: 41000000, meshes: 18 }');

export const MINTED = v.object({
  model: v.string().desc('The root part minted for the import — the one nothing places. Example: "drone_rig"'),
  parts: v.array(v.string()).desc('Every part row minted, the root and the collections among them. Example: ["drone_rig", "arm", "motor"]'),
  placements: v.array(v.string()).desc('Every placement row minted — what a revert takes back alongside the parts. Example: ["drone_rig.arm.0"]'),
  placed: v.integer().desc("How many placements. Example: 30"),
  collections: v.integer().desc("The file's collections, each a part of its own. Example: 6"),
}).desc('What a commit minted. Example: { model: "drone_rig", parts: ["drone_rig", "arm"], placements: ["drone_rig.arm.0"], placed: 4, collections: 1 }');

export const OBJECT = v.object({
  object: v.string().desc('The source object\'s name, verbatim. Example: "Motor_Arm0"'),
  file: v.string().desc('The GLB the decode wrote for it, local frame. Example: "Motor_Arm0.glb"'),
  collection: v.string().optional().desc('The collection path it sat in. Example: "Drone/Arms"'),
  tris: v.integer().optional().desc("Triangles. Example: 80"),
  verts: v.integer().optional().desc("Vertices. Example: 42"),
  bbox: VEC3.optional().desc("Size of its box in source units, Y-up. Example: [0.8, 0.15, 4.2]"),
  translation: VEC3.optional().desc("Where it sits, source units, Y-up. Example: [-1.77, 0.04, 1.65]"),
  rotation: QUAT.optional().desc("Quaternion xyzw. Example: [0, 0, 0, 1]"),
  mirrored: v.array(v.string()).optional().desc('Axes with a negative scale in the source. Example: ["x"]'),
  hidden: v.boolean().optional().desc("Hidden in the source. Example: false"),
  placed: v.boolean().optional().desc("false when the decoder found no node for this object — it has NO position of its own and would otherwise land on the model's origin. Example: true"),
  materials: v.array(v.string()).optional().desc('Material names. Example: ["Material.001"]'),
}).desc('One mesh object as the decode read it — numbers in the SOURCE\'s units, nothing assumed yet. Example: { object: "Motor0", file: "Motor0.glb", tris: 828 }');

export const READING = v.object({
  source: v.string().desc('The file, by name. Example: "drone_rig.fbx"'),
  format: v.string().desc('The format sniffed. Example: "fbx"'),
  route: v.string().desc('The hops from the file to glTF. Example: "fbx → blender import_scene.fbx → glTF 2.0 per object"'),
  decoder: v.string().desc('What decoded it. Example: "blender 5.2.2 LTS"'),
  intake: v.string().desc('Where the decode landed on the mountpoint. Example: "intake/drone_rig"'),
  bytes: v.integer().desc("The payload's size. Example: 41000000"),
  declared: v.object({
    unit: v.number().optional().desc("Metres per unit the file declares, when it does. Example: 1"),
    up: v.enum(UPS).desc('The up axis the format or file declares. Example: "Z"'),
  }).desc("What the file says about itself — the facts the knobs default from. Example: { unit: 1, up: \"Z\" }"),
  meshes: v.integer().desc("Mesh objects. Example: 30"),
  hidden: v.integer().desc("Of which hidden. Example: 0"),
  empties: v.array(v.string()).desc('Empties in the source — cameras and lights are not parts. Example: ["Empty.001"]'),
  strays: v.array(v.string()).optional().desc('Objects the decoder found no node for — they carry no position and will sit on the root\'s origin. Example: ["Camera"]'),
  others: v.array(v.string()).desc('Object types the decode skipped. Example: ["CAMERA", "LIGHT"]'),
  materials: v.integer().desc("Distinct materials. Example: 4"),
  animations: v.integer().desc("Animation clips. Example: 0"),
  triangles: v.integer().desc("Triangles over every mesh. Example: 70600"),
  objects: v.array(OBJECT).desc("Every mesh object, source units. Example: []"),
}).desc("The dry parse — everything the file yields, in the file's own frame and units, before any choice is made. Example: { source: \"drone_rig.fbx\", format: \"fbx\", declared: { unit: 0.01, up: \"Y\" }, objects: [] }");

export const SETTINGS = v.object({
  into: v.string().desc('The name of the part this import mints as its root — the one nothing places, holding everything the file carried. Every import is its own; an existing part is never written into. Defaults to the file\'s stem. Example: "DRONEAID model latest"'),
  unit: v.number({ exclusiveMinimum: 0 }).desc("Metres per source unit. Defaults to the declared unit, or 1. Example: 0.05"),
  up: v.enum(UPS).desc('The source\'s up axis. Defaults to the declared one. Example: "Z"'),
  recentre: v.string().optional().desc('Recentre every placement on one object, or on "centre"; absent keeps the source origin. Example: "Frame_Star"'),
  fold: v.enum(RULES).desc('How objects become parts: same stem AND geometry, same stem only, or one part per object. Example: "fingerprint"'),
  groups: v.boolean().desc("Keep the source's collections as group nodes. Example: true"),
  hidden: v.boolean().desc("Import objects the source hides. Example: false"),
  chord: v.number({ exclusiveMinimum: 0 }).optional().desc("B-rep tessellation chord tolerance, millimetres. Example: 0.05"),
}).desc('The operator\'s choices — every one shown beside what the file declared and what it yields. Example: { into: "DRONEAID model latest", unit: 0.05, up: "Z", fold: "fingerprint", groups: true, hidden: false }');

export const JOB = v.object({
  id: v.string().desc('The job\'s id in the queue. Example: "k3j9x"'),
  name: v.string().desc('The file\'s name. Example: "drone_rig.fbx"'),
  extension: v.string().desc('Its extension, lower case. Example: "fbx"'),
  bytes: v.integer().desc("Its size. Example: 41000000"),
  state: v.enum(STATES).desc('Where the job stands — parsed is the dry read awaiting the operator\'s choices. Example: "parsed"'),
  stage: v.enum(STAGES).optional().desc('The stage it is in or stopped at. Example: "decode"'),
  progress: v.number({ minimum: 0, maximum: 100 }).desc("Percent. Example: 62"),
  log: v.array(LINE).desc("Its decode log, in order. Example: []"),
  meta: META.optional().desc("Its format meta, once decoded. Example: { source: \"drone_rig.fbx\" }"),
  reading: READING.optional().desc("The dry parse, once decoded. Example: { source: \"drone_rig.fbx\", objects: [] }"),
  settings: SETTINGS.optional().desc("The operator's choices over the reading. Example: { unit: 0.05, up: \"Z\", fold: \"fingerprint\", groups: true, hidden: false }"),
  minted: MINTED.optional().desc("What it minted, once committed. Example: { assembly: \"drone_rig\", components: [], placed: 0 }"),
}).desc('One dropped file walking sniff → validate → decode → remap → commit. Example: { id: "k3j9x", name: "drone_rig.fbx", extension: "fbx", bytes: 41000000, state: "wait", progress: 0, log: [] }');

export const EVENT = v.object({
  stage: v.enum(STAGES).desc('The stage the line belongs to. Example: "decode"'),
  progress: v.number({ minimum: 0, maximum: 100 }).desc("Percent after this line. Example: 40"),
  t: T,
  lvl: LVL,
  msg: MSG,
  meta: META.optional().desc("The format meta, on the line that read it. Example: { source: \"drone_rig.fbx\" }"),
  reading: READING.optional().desc("The dry parse, on the line that finished it. Example: { source: \"drone_rig.fbx\", objects: [] }"),
  minted: MINTED.optional().desc("What was minted, on the DONE line. Example: { assembly: \"drone_rig\", components: [], placed: 0 }"),
  done: v.boolean().optional().desc("true on the last line, committed or failed. Example: true"),
  failed: v.boolean().optional().desc("true when the last line is a FAIL. Example: true"),
}).desc('One line of an import as it streams. Example: { stage: "sniff", progress: 0, t: "00:00.04", lvl: "SNIFF", msg: "magic bytes matched FBX — extension trusted" }');

export const PLACED = v.object({
  path: v.string().desc('The placement\'s path in the folded stack — names joined by "/". Example: "motor.0/arm.0"'),
  ref: v.string().desc('The part it places. Example: "arm"'),
  translation: VEC3.optional().desc("Metres, Y-up. Example: [-0.0887, 0.0021, 0.0823]"),
  rotation: QUAT.optional().desc("Quaternion xyzw. Example: [0, 0, 0, 1]"),
  scale: VEC3.optional().desc("Per axis. Example: [1, 1, 1]"),
}).desc('One placement of a folded layer stack, as the stage draws it. Example: { path: "motor.0/arm.0", ref: "arm", translation: [0, 0, 0] }');

export const ROW = v.object({
  key: v.string().desc('Unique in the tree — the path of keys above it and this row\'s slug. Example: "drone_rig/drone_rig.arm.0"'),
  depth: v.integer({ minimum: 0 }).desc("0 at a part nothing places; a placement nests as deep as the file did. Example: 2"),
  ontology: v.enum(ONTOLOGIES).desc('What the row is. Example: "placement"'),
  slug: v.string().desc('The row\'s slug — a placement\'s is its layer and its path. Example: "drone_rig.arm.0"'),
  name: v.string().desc('A name for eyes. Example: "Motor arm"'),
  tail: v.string().desc('The right-hand count or what it places. Example: "← motor_arm"'),
  ref: v.string().optional().desc('The part a placement places. Example: "motor_arm"'),
  layer: v.string().optional().desc('The layer a placement belongs to. Example: "drone_rig"'),
  source: v.string().optional().desc('The file the geometry came from. Example: "drone_rig.fbx"'),
  traits: v.array(v.string()).desc('The row\'s traits. Example: ["LABELED", "SOURCED", "MODELED", "COUNTED"]'),
  trait: v.record(v.string(), v.any()).desc('The row\'s trait payloads, by trait. Example: { LABELED: { name: "Motor arm" }, COUNTED: { qty: 4 } }'),
  symbols: v.array(v.string()).desc('The symbols on the row besides its ontology\'s root. Example: ["material.carbon"]'),
  modeled: v.object({ file: v.string(), tris: v.integer().optional(), bbox: VEC3.optional() }).optional().desc('Its own geometry on the freight, when it has any. Example: { file: "parts/arm.glb", tris: 80 }'),
  scene: v.array(PLACED).optional().desc("The folded placements the stage draws for this row. Example: []"),
  used: v.integer({ minimum: 0 }).optional().desc("How many placements name this part. Example: 4"),
  mode: v.string().optional().desc('The mode that minted it, as an annotation. Example: "import"'),
}).desc('One row of the tree — a part, a placement of one, or a step. Example: { key: "drone_rig/drone_rig.arm.0", depth: 1, ontology: "placement", slug: "drone_rig.arm.0", name: "arm.0", tail: "← arm", traits: [] }');

export const TREE = v.object({
  rows: v.array(ROW).desc("Top to bottom: a part nothing places, its placements, their parts' interiors, its steps. Example: []"),
  counts: v.record(v.string(), v.integer()).desc("Literals by ontology. Example: { part: 25, placement: 36, step: 0 }"),
  parts: v.array(ROW).desc("Every part the tree reaches, flat and by slug — the kit, and what the stage reads to draw a placement's ref. Example: []"),
}).desc("What this buffer minted and what it reaches. Example: { rows: [], counts: {}, parts: {} }");
