import { v } from "@vivalence/typology";

// the bin's shapes — one blend file walked from intake to embed. an OBJECT is what the blender
// harvest wrote (one mesh object, its GLB in metres, its placement); a MEMBER is the importer's
// reading of one or more objects as ONE component with N placements; an ANNOTATION is the human's
// (or the agent's) naming of a member: slug, symbols, kit count. phases are derived, never stored.

const VEC3 = v.array(v.number(), { minItems: 3, maxItems: 3 });
const QUAT = v.array(v.number(), { minItems: 4, maxItems: 4 });

export const PHASES = ["intake", "interpret", "annotate", "embed"];

export const OBJECT = v.object({
  object: v.string().desc('The blender object\'s name, verbatim. Example: "Motor_Arm0"'),
  file: v.string().desc('The GLB the harvest wrote for it, local frame, metres. Example: "Motor_Arm0.glb"'),
  collection: v.string().optional().desc('The blender collection it sat in. Example: "Drone"'),
  verts: v.integer().optional().desc("Vertex count. Example: 42"),
  tris: v.integer().optional().desc("Triangle count. Example: 80"),
  bbox: VEC3.optional().desc("Size of the bounding box in metres, x y z, Y-up. Example: [0.0413, 0.0075, 0.2086]"),
  materials: v.array(v.string()).optional().desc('Material names. Example: ["Material.001"]'),
  modifiers: v.array(v.string()).optional().desc('Modifier types the harvest applied. Example: ["NODES"]'),
  mirrored: v.array(v.string()).optional().desc('Axes with a negative scale in the source — a mirrored instance. Example: ["x"]'),
  bytes: v.integer().optional().desc("The GLB's size. Example: 5224"),
  translation: VEC3.optional().desc("Metres, Y-up, recentred on the harvest origin. Example: [-0.0887, 0.0021, 0.0823]"),
  rotation: QUAT.optional().desc("Quaternion xyzw. Example: [0, 0, 0, 1]"),
}).desc('One mesh object out of the blend, as harvest.py wrote it. Example: { object: "Motor0", file: "Motor0.glb", tris: 828 }');

export const PLACEMENT = v.object({
  object: v.string().desc('The blender object this placement came from. Example: "Motor_Arm1"'),
  translation: VEC3.optional().desc("Metres, Y-up. Example: [0.0881, 0.0021, 0.0823]"),
  rotation: QUAT.optional().desc("Quaternion xyzw. Example: [0, -0.9483, 0, 0.3173]"),
  mirrored: v.array(v.string()).optional().desc('Axes the source mirrored. Example: ["x", "y"]'),
}).desc('Where one instance of a member sits — a node of the assembly, once embedded. Example: { object: "Motor0", translation: [-0.1395, 0.0199, 0.1579] }');

export const MEMBER = v.object({
  id: v.string().desc('The member\'s id in the bin — the first object\'s name. Example: "Motor_Arm0"'),
  objects: v.array(v.string()).desc('The blender objects folded into this member. Example: ["Motor_Arm0", "Motor_Arm1", "Motor_Arm2", "Motor_Arm3"]'),
  file: v.string().desc('The GLB that gives the geometry — the first object\'s. Example: "Motor_Arm0.glb"'),
  copies: v.integer().optional().desc("Copies welded into ONE object by the source — a name like \"FrameSpacers.00 (x4)\". Example: 4"),
  placements: v.array(PLACEMENT).desc("One per instance. Example: [{ object: \"Motor_Arm0\", translation: [-0.0887, 0.0021, 0.0823] }]"),
  dropped: v.boolean().optional().desc("true keeps the member in the bin but out of the embed — a jig, a helper, a duplicate. Example: true"),
}).desc('The importer\'s reading of one or more objects as ONE component with N placements. Example: { id: "Motor0", objects: ["Motor0", "Motor1"], file: "Motor0.glb", placements: [] }');

export const ANNOTATION = v.object({
  slug: v.string().desc('The component\'s slug — the row the embed mints. Example: "arm"'),
  name: v.string().desc('A name for eyes. Example: "Motor arm"'),
  description: v.string().optional().desc('One line more. Example: "10\\" carbon"'),
  symbols: v.array(v.string()).optional().desc('Symbols besides the kind\'s root — material.* source.* and a product family. Example: ["material.carbon", "source.3d_scan", "family.arm"]'),
  qty: v.integer().optional().desc("How many the kit ships; absent when the kit does not list it. Example: 4"),
}).desc('The naming of a member — what becomes the component row. Example: { slug: "arm", name: "Motor arm", symbols: ["material.carbon"], qty: 4 }');

export const EMBEDDED = v.object({
  slug: v.string().desc('The minted row\'s slug. Example: "arm"'),
  ontology: v.string().desc('Its kind. Example: "component"'),
  file: v.string().optional().desc('Where the GLB went on the freight. Example: "parts/arm.glb"'),
}).desc('What the embed minted for a member. Example: { slug: "arm", ontology: "component", file: "parts/arm.glb" }');

export const BIN = v.object({
  source: v.string().optional().desc('The blend file, by name. Example: "DRONEAID_model_latest.blend"'),
  blender: v.string().optional().desc('The blender that harvested it. Example: "5.2.2 LTS"'),
  scale: v.number().optional().desc("Metres per blender unit, as harvested. Example: 0.05"),
  origin: v.string().optional().desc('The object every translation is recentred on. Example: "Frame_Star"'),
  intake: v.string().optional().desc('The harvest directory under the mountpoint. Example: "intake/DRONEAID_model_latest"'),
  objects: v.array(OBJECT).default([]).desc("Every object the harvest wrote. Example: []"),
  members: v.array(MEMBER).default([]).desc("The interpretation. Example: []"),
  annotations: v.record(v.string(), ANNOTATION).default({}).desc("By member id. Example: {}"),
  embedded: v.record(v.string(), EMBEDDED).default({}).desc("By member id. Example: {}"),
  assembly: v.object({
    slug: v.string().desc('The assembly the placements compose. Example: "pt10"'),
    name: v.string().desc('A name for eyes. Example: "PT10 V3"'),
  }).optional().desc('The assembly row the embed places every instance into. Example: { slug: "pt10", name: "PT10 V3" }'),
  target: v.string().optional().desc('The topography `write` serializes into. Example: "@droneaid/topography/model"'),
}).desc("One blend file, walked from intake to embed — the buffer's data. Example: { source: \"model.blend\", objects: [], members: [] }");

// what an upload streams back while the pipeline runs — the bin after every step, so the screen follows
export const PROGRESS = v.object({
  stage: v.enum(["upload", "harvest", "interpret", "annotate", "embed"]).desc('The step that just landed. Example: "harvest"'),
  fraction: v.number({ minimum: 0, maximum: 1 }).desc("How far along, 0 to 1. Example: 0.4"),
  bin: BIN.optional().desc("The bin after the step, when the step changed it. Example: { objects: [] }"),
  counts: v.record(v.string(), v.integer()).optional().desc("The phase counts of that bin. Example: { intake: 30, interpret: 0, annotate: 0, embed: 0 }"),
  done: v.boolean().optional().desc("true on the last step. Example: true"),
}).desc('One step of an upload. Example: { stage: "embed", fraction: 1, done: true }');

export const HARVEST = v.object({
  file: v.string().desc('The blend file, relative to the mountpoint. Example: "DRONEAID_model_latest.blend"'),
  scale: v.number({ exclusiveMinimum: 0 }).desc("Metres per blender unit — the operator's number, never assumed. Example: 0.05"),
  origin: v.string().optional().desc('The object every translation is recentred on. Example: "Frame_Star"'),
}).desc('What the blender run takes. Example: { file: "model.blend", scale: 0.05, origin: "Frame_Star" }');
