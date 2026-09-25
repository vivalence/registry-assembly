import { v } from "@vivalence/typology";

// the shapes that type the payloads. one description shared by the payload in trait{}, the
// repository verb's parameter, a tool's input and the harness's reading of what it may write.
// four ontologies: a PART is what a thing is, a PLACEMENT is one occurrence of it under a part's
// layer, a STEP names the placements it installs, a GUIDE orders steps over a subject part.
// composition is part + placement; process is guide + step, and the two meet only by slug. a
// placement always places something — there is no kind and no hole. metres, Y-up, quaternion
// xyzw: glTF's node TRS verbatim.
//
// a slug is unique in the daemon: one name, one literal. a literal may carry the mode that minted
// it as an annotation; nothing resolves a literal by anything but its slug.

const VEC3 = v.array(v.number(), { minItems: 3, maxItems: 3 });
const QUAT = v.array(v.number(), { minItems: 4, maxItems: 4 });

// what a literal of each ontology may carry, and what it is to the fold — read by the writer,
// rendered by a harness, restated by a mode that draws a form from it
//   traits  the traits a literal of this ontology may carry — mint refuses any other
//   layer   placements may name it as their layer — a part's own; a step is not a layer
export const ONTOLOGIES = {
  part: { traits: ["LABELED", "SOURCED", "MODELED", "PARAMETRIC", "COUNTED"], layer: true },
  placement: { traits: ["LABELED", "PLACED", "JOINED"], layer: false },
  step: { traits: ["LABELED", "ASSEMBLED", "INSTRUCTED", "ANNOTATED", "STAGED"], layer: false },
  guide: { traits: ["LABELED", "SEQUENCED", "INSTRUCTED", "ANNOTATED", "STAGED"], layer: false },
};

// a tint is a theme role, never a colour — the stage maps it to the theme's token
export const TINTS = ["info", "success", "warning", "danger", "accent", "contrast"];

export const PATH = v.string().desc('A placement\'s path inside a folded stack — names joined by "/", a grafted part prefixing its own. Example: "motor.0/propeller.0"');

export const GENERATOR = v.object({
  generator: v.string().desc('A key in generators/. Example: "fastener.bolt"'),
  params: v.record(v.string(), v.any()).desc('What the generator takes. Example: { thread: "M3", length: 16 } '),
}).desc('Geometry generated at read from a generator and its params. Example: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }');

// the trait payloads, by trait — what a literal of an ontology carries under trait[TRAIT]
export const LABELED = v.object({
  name: v.string().desc('A name for eyes. Example: "Bolt, short"'),
  description: v.string().optional().desc('One line more. Example: "M3x16"'),
}).desc('A name and, optionally, a description. Example: { name: "Motor arm" }');

export const SOURCED = v.object({
  file: v.string().desc('The file the geometry came from. Example: "DRONEAID_model_latest.blend"'),
  object: v.string().optional().desc('The object inside that file. Example: "Frame_Bottom"'),
  scale: v.number().optional().desc("Metres per unit of the source, applied at embed — the round trip's factor. Example: 0.05"),
  url: v.string().optional().desc('Where the source lives. Example: "https://example.org/pt10.step"'),
  credit: v.string().optional().desc('Who made it. Example: "Partizan"'),
}).desc('Where a part\'s geometry came from — the back-pointer for the Blender round trip. Example: { file: "model.blend", object: "Frame_Bottom", scale: 0.05 }');

export const MODELED = v.object({
  file: v.string().desc('File path of the GLB, metres, Y-up. Example: "parts/bottom_plate.glb"'),
  tris: v.integer().optional().desc("Triangle count. Example: 2160"),
  bbox: VEC3.optional().desc("Size of the bounding box in metres, x y z. Example: [0.2823, 0.002, 0.097]"),
}).desc('A part\'s own geometry as a file on the freight. A part that has only an interior carries none. Example: { file: "parts/arm.glb", tris: 80, bbox: [0.1263, 0.0075, 0.1729] }');

export const PARAMETRIC = GENERATOR;

export const COUNTED = v.object({
  qty: v.integer().desc("How many the kit ships. What the build uses is bom(), derived. Example: 6"),
}).desc("The kit's count of a part — what says it is a thing you order. Example: { qty: 6 }");

export const SECTION = v.object({
  name: v.string().desc('The section\'s heading. Example: "Frame"'),
  steps: v.array(v.string()).desc('Step slugs in order. Example: ["drone.01", "drone.02"]'),
}).desc('One section of a guide — a heading over steps in order. Example: { name: "Frame", steps: ["drone.01"] }');

export const SEQUENCED = v.object({
  subject: v.string().optional().desc('The part this guide builds — what the stage draws. Example: "drone_rig"'),
  sections: v.array(SECTION).desc('The sections in order; the step order is their steps flattened. Example: [{ name: "Frame", steps: ["drone.01"] }]'),
}).desc('A guide\'s subject and its steps in sections. Example: { subject: "drone_rig", sections: [{ name: "Frame", steps: ["drone.01", "drone.02"] }] }');

export const ANCHOR = v.object({
  literals: v.array(v.string()).optional().desc('Placement slugs the anchor sits on — their centre. Example: ["drone_rig.arm.0"]'),
  offset: VEC3.optional().desc("Metres off that centre. Example: [0, 0.02, 0]"),
  position: VEC3.optional().desc("A point in the subject's frame, metres; wins over literals. Example: [0.1, 0.02, 0]"),
}).desc('Where a line or a note points on the stage: a position, or placements plus an offset; absent, it stays in the panel. Example: { literals: ["drone_rig.arm.0"], offset: [0, 0.02, 0] }');

export const LINE = v.object({
  text: v.string().desc('One sentence. Example: "Place one arm at the appropriate position on top."'),
  at: ANCHOR.optional(),
}).desc('One numbered line of an instruction, optionally anchored on the stage. Example: { text: "Thread the 16mm bolt.", at: { literals: ["drone_rig.bolt.0"] } }');

export const NOTE = v.object({
  text: v.string().desc('The callout. Example: "Don\'t tighten it yet! Leave it loose."'),
  symbols: v.array(v.string()).optional().desc('Its kind and family — note.* and warn.* symbols. Example: ["note.warning", "warn.loose"]'),
  images: v.array(v.string()).optional().desc('File paths. Example: ["manual/cf5a470bc835.webp"]'),
  at: ANCHOR.optional(),
}).desc('A callout beside the instruction — a tip, a warning, a torque. Example: { text: "Leave it loose.", symbols: ["note.warning", "warn.loose"] }');

export const PLACED = v.object({
  layer: v.string().desc('The slug of the layer this placement belongs to — a part\'s own layer, or a step of it. Example: "motor"'),
  name: v.string().desc('Its name among the siblings under the same parent, in the same layer. Instances number from 0. Example: "propeller.0"'),
  parent: PATH.optional().desc('The path of the placement above it in this same layer; absent at the layer\'s root. Example: "housing.0"'),
  ref: v.string().desc('The slug of the part it places. Never absent — a placement that places nothing is not a placement. Example: "propeller"'),
  translation: VEC3.optional().desc("Metres, Y-up, in the parent's frame. Example: [0.0053, 0.0097, 0.0007]"),
  rotation: QUAT.optional().desc("Quaternion xyzw. Example: [0, 0, 0, 1]"),
  scale: VEC3.optional().desc("Per axis. Example: [1, 1, 1]"),
  active: v.boolean().optional().desc("false removes it from this layer on — how a step takes something away. Example: false"),
  params: v.record(v.string(), v.any()).optional().desc("Overrides the part's generator params for this one occurrence — a cable's route. Example: { route: [[0, 0, 0], [0.1, 0, 0]] }"),
}).desc('One occurrence of a part: which layer it is in, what it places, where. The same layer, parent and name again is an over — only what changes. Example: { layer: "motor", name: "propeller.0", ref: "propeller", translation: [0, 0.022, 0] }');

export const JOINED = v.object({
  joins: v.array(PATH).desc('The placements this one holds together, by their paths in the fold. Example: ["bottom_plate.0", "arm.0"]'),
}).desc('What a fastener\'s placement holds. Which kind of joint it is, is a joint.* symbol on the literal; how far it is done up is a step\'s note. Example: { joins: ["bottom_plate.0", "arm.0"] }');

export const ASSEMBLED = v.object({
  placements: v.array(
    v.object({
      literal: v.string().desc('A placement\'s slug in the subject\'s composition. Example: "drone_rig.arm.0"'),
      active: v.boolean().desc("true installs it at this step, false takes it out again. Example: true"),
    }).desc('One opinion on a placement. Example: { literal: "drone_rig.arm.0", active: true }'),
  ).desc('The placements this step installs or removes, by slug. Example: [{ literal: "drone_rig.arm.0", active: true }]'),
}).desc('What a step does to the build — the placements it names, by slug; the fold reads them in guide order. Example: { placements: [{ literal: "drone_rig.arm.0", active: true }] }');

export const INSTRUCTED = v.object({
  lines: v.array(LINE).desc('The numbered body, one sentence per line. Example: [{ text: "Place one arm on top." }]'),
  images: v.array(v.string()).desc('File paths. Example: ["manual/cf5a470bc835.webp"]'),
}).desc('What a step (or a guide\'s intro) tells the builder — numbered lines and media. Example: { lines: [{ text: "Thread the 16mm bolt." }], images: [] }');

export const ANNOTATED = v.object({
  notes: v.array(NOTE).desc('Callouts beside the body. Example: [{ text: "Leave it loose.", symbols: ["note.warning"] }]'),
}).desc('The callouts of a step or a guide. Example: { notes: [{ text: "Leave it loose.", symbols: ["note.warning", "warn.loose"] }] }');

export const STAGED = v.object({
  camera: v.object({
    target: VEC3.desc("What the camera looks at, metres. Example: [0, 0.02, 0]"),
    position: VEC3.desc("Where the camera sits, metres. Example: [0.3, 0.25, 0.3]"),
  }).optional().desc("The stage's camera for this step. Example: { target: [0, 0, 0], position: [0.3, 0.25, 0.3] }"),
  explode: v.number({ minimum: 0, maximum: 1 }).optional().desc("How far the parts fly apart, 0 to 1. Example: 0.4"),
  ghost: v.boolean().optional().desc("true draws what is not built yet as a ghost. Example: true"),
  built: v.object({
    steps: v.array(v.string()).desc('Steps whose placements count as built. Example: ["drone.01", "drone.02"]'),
    placements: v.array(v.string()).desc('Placements built on their own. Example: ["drone_rig.plate.0"]'),
    parts: v.array(v.string()).optional().desc('Parts built wherever they are placed, with everything under them. Example: ["motor"]'),
  }).optional().desc("What the stage shows as already built; absent, every earlier step. Example: { steps: [\"drone.01\"], placements: [] }"),
  tints: v.record(v.string(), v.enum(TINTS)).optional().desc('Placement slug → a theme role. Example: { "drone_rig.arm.0": "warning" }'),
}).desc("How the stage shows a step or a guide's overview. Example: { camera: { target: [0, 0, 0], position: [0.3, 0.25, 0.3] }, explode: 0 }");

/** @deprecated PREPARED is derived by the fold — the enum member stays until the rows are re-read without it. */
export const PREPARED = v.object({
  parts: v.record(v.string(), v.integer()).optional().desc('Part slug → how many to lay out. Example: { bolt_m3_16: 6, arm: 4 }'),
  tools: v.array(v.string()).optional().desc('tool.* symbols. Example: ["tool.hex_2_0"]'),
}).desc('What a step lays out — derived now: tools are its tool.* symbols, parts the bill\'s delta. Example: { parts: { arm: 4 }, tools: ["tool.hex_2_0"] }');

export const TRAITS = { LABELED, SOURCED, MODELED, PARAMETRIC, COUNTED, SEQUENCED, PLACED, JOINED, ASSEMBLED, INSTRUCTED, ANNOTATED, STAGED, PREPARED };

// the verbs' parameters — what an aperture nature takes and what a tool takes are one description.
// plain field maps. a verb that names an existing literal is an over: what it carries replaces
// that trait, what it leaves out stays.
const SLUG = v.string().desc('A literal\'s slug — unique in the daemon. Example: "frame"');
const NAME = v.string().desc('A name for eyes. Example: "Bolt, short"');
const DESCRIPTION = v.string().optional().desc('One line more. Example: "M3x16"');
const SYMBOLS = v.array(v.string()).optional().desc('The family symbols on the literal besides its ontology\'s root; on an over, the whole set again. Example: ["material.fastener", "joint.bolted"]');
const UPTO = v.integer({ minimum: 0 }).optional().desc("How many steps of a guide to fold: 0 is nothing built, absent is every step; a part ignores it. Example: 4");
const LINES = v.array(LINE).optional().desc('The numbered body, whole. Example: [{ text: "Thread the 16mm bolt." }]');
const IMAGES = v.array(v.string()).optional().desc('File paths, whole. Example: ["manual/cf5a470bc835.webp"]');
const NOTES = v.array(NOTE).optional().desc('The callouts, whole. Example: [{ text: "Leave it loose.", symbols: ["note.warning"] }]');
const STAGING = STAGED.optional().desc("How the stage shows it, whole. Example: { explode: 0.4 }");

export const VERBS = {
  part: {
    slug: SLUG,
    name: NAME.optional(),
    description: DESCRIPTION,
    sourced: SOURCED.optional(),
    modeled: MODELED.optional(),
    parametric: GENERATOR.optional(),
    qty: v.integer().optional().desc("How many the kit ships — what makes it a thing you order. Example: 6"),
    symbols: SYMBOLS,
  },
  placement: {
    ...PLACED.properties,
    label: v.string().optional().desc('A name for eyes, when the placement\'s own name is not one. Example: "Front left motor"'),
    description: DESCRIPTION,
    joins: JOINED.properties.joins.optional(),
    symbols: SYMBOLS,
  },
  step: {
    slug: SLUG.desc('A step\'s slug — its guide and a number. Example: "drone.01"'),
    name: NAME.optional(),
    description: DESCRIPTION,
    placements: ASSEMBLED.properties.placements.optional(),
    lines: LINES,
    images: IMAGES,
    notes: NOTES,
    staged: STAGING,
    symbols: SYMBOLS.desc('The step\'s tool.* symbols, whole — what it lays out. Example: ["tool.hex_2_0"]'),
  },
  guide: {
    slug: SLUG.desc('A guide\'s slug. Example: "drone"'),
    name: NAME.optional(),
    description: DESCRIPTION,
    subject: v.string().optional().desc('The part it builds. Example: "drone_rig"'),
    sections: v.array(SECTION).optional().desc('Its sections, whole. Example: [{ name: "Frame", steps: ["drone.01"] }]'),
    lines: LINES,
    images: IMAGES,
    notes: NOTES,
    staged: STAGING,
    symbols: SYMBOLS,
  },
  sequence: {
    guide: SLUG.desc('The guide whose steps these are. Example: "drone"'),
    sections: v.array(SECTION).desc('Its sections, whole. Example: [{ name: "Frame", steps: ["drone.01", "drone.02"] }]'),
  },
  move: {
    slug: SLUG.desc('The placement to move — its slug, layer and path as it is. Example: "frame.arm.0"'),
    layer: v.string().optional().desc('The part it moves to; absent keeps the layer. Example: "chassis"'),
    parent: PATH.optional().desc('The path it goes under in that layer; absent keeps its parent, "" puts it at the layer\'s root. Example: "housing.0"'),
    name: v.string().optional().desc('Its new name among its siblings; absent keeps the name. Example: "arm.front"'),
  },
  retract: {
    slugs: v.array(v.string()).desc('The literals to unmint. Example: ["drone_rig", "arm"]'),
    closure: v.boolean().optional().desc("true takes everything only these reach with them — a root and its whole interior in one call; what something else still references stays. Example: true"),
    dry: v.boolean().optional().desc("true answers what would go and takes nothing — what a screen asks before it retracts. Example: true"),
  },
  rename: {
    slug: SLUG.desc('The part, step or guide to rename, as it is named now. Example: "frame"'),
    to: SLUG.desc('Its new slug — free in the daemon. Example: "frame_carbon"'),
  },
  duplicate: {
    slug: SLUG.desc('The literal to duplicate. Example: "frame"'),
    to: v.string().optional().desc('The copy\'s slug — for a placement, its name among its siblings; absent takes the next free one. Example: "frame_b"'),
  },
  fold: {
    slug: SLUG.desc('The part or guide to fold. Example: "drone"'),
    upto: UPTO,
  },
  tree: {
    slugs: v.array(v.string()).optional().desc('The literals to read and what they reach; absent reads every root in the daemon, [] reads nothing. Example: ["drone_rig"]'),
  },
};

// the tree a screen lists — a reading of the literals, top to bottom, with what the stage draws
export const SCENE = v.object({
  path: PATH,
  ref: v.string().desc('The part it places. Example: "arm"'),
  translation: VEC3.optional(),
  rotation: QUAT.optional(),
  scale: VEC3.optional(),
}).desc('One folded placement the stage draws. Example: { path: "arm.0", ref: "arm", translation: [0.1, 0, 0] }');

export const ROW = v.object({
  key: v.string().desc('Unique in the tree — the keys above it and this literal\'s slug. Example: "drone_rig/drone_rig.arm.0"'),
  depth: v.integer({ minimum: 0 }).desc("0 at a part nothing places or a guide; a placement nests as deep as its layers do; a step sits under its guide. Example: 2"),
  ontology: v.enum(Object.keys(ONTOLOGIES)).desc('What the literal is. Example: "placement"'),
  slug: v.string().desc('The literal\'s slug — a placement\'s is its layer and its path, a step\'s its guide and a number. Example: "drone_rig.arm.0"'),
  name: v.string().desc('A name for eyes. Example: "Motor arm"'),
  tail: v.string().desc('The right-hand count or what it places. Example: "← motor_arm"'),
  ref: v.string().optional().desc('The part a placement places. Example: "motor_arm"'),
  layer: v.string().optional().desc('The layer a placement belongs to. Example: "drone_rig"'),
  source: v.string().optional().desc('The file the geometry came from. Example: "drone_rig.fbx"'),
  traits: v.array(v.string()).desc('The literal\'s traits. Example: ["LABELED", "SOURCED", "MODELED", "COUNTED"]'),
  trait: v.record(v.string(), v.any()).desc('The trait payloads, by trait. Example: { LABELED: { name: "Motor arm" }, COUNTED: { qty: 4 } }'),
  symbols: v.array(v.string()).desc('The symbols on the literal besides its ontology\'s root. Example: ["material.carbon"]'),
  modeled: MODELED.optional().desc('Its own geometry on the freight, when it has any. Example: { file: "parts/arm.glb", tris: 80 }'),
  scene: v.array(SCENE).optional().desc("The folded placements the stage draws for this literal. Example: []"),
  used: v.integer({ minimum: 0 }).optional().desc("How many placements name this part. Example: 4"),
  mode: v.string().optional().desc('The mode that minted it, as an annotation. Example: "import"'),
}).desc('One row of the tree — a part, a placement of one, a guide or a step. Example: { key: "drone_rig/drone_rig.arm.0", depth: 1, ontology: "placement", slug: "drone_rig.arm.0", name: "arm.0", tail: "← arm", traits: [] }');

export const TREE = v.object({
  rows: v.array(ROW).desc("Top to bottom: a part nothing places, its placements, their parts' interiors; then every guide, its steps, their placements. Example: []"),
  counts: v.record(v.string(), v.integer()).desc("Literals by ontology. Example: { part: 25, placement: 36, step: 0, guide: 0 }"),
  parts: v.array(ROW).desc("Every part the tree reaches, flat and by slug — the kit, and what the stage reads to draw a placement's ref. Example: []"),
}).desc("What the named literals reach, as a screen lists it. Example: { rows: [], counts: {}, parts: [] }");
