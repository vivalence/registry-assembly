import { v, mime } from "@vivalence/typology";
import { FILTERS, GIZMOS, SCOPES } from "./schematics.js";

export { aperture } from "./aperture/index.js";
export { harness } from "./harness.js";
export { tools } from "./tools/index.js";

export const manifest = {
  type: "model",
  slug: "editor",
  name: "Model editor",
  version: "0.4.0",
  description:
    "The composition editor of the assembly domain: every model the daemon holds, or the one in the buffer, as a tree that creates, duplicates, " +
    "renames and retracts; the subject folded on a three.js stage with a gizmo that moves a placement, a set of them or a whole sub-assembly, a box that selects, an undo list, a cursor mode that keeps cursors on holes and faces and mates one piece onto another, and a joint mode that says what " +
    "a fastener holds; and an inspector whose form is the domain's own schematic. The agent works from the dock, through this mode's harness " +
    "and tools; the view holds no conversation. Guides and steps are authored in @assembly/guide/editor.",
  traits: ["SURFACED", "EXPOSED", "HARNESS", "TOOLING", "CONVERSATION"],
};

export const buffer = v.buffer({
  data: {
    subject: v.string().optional().desc('The part folded on the stage, by slug. Example: "frame"'),
    selected: v.array(v.string()).optional().desc('The literals selected, by slug. Example: ["frame.arm.0"]'),
    scope: v.enum(SCOPES).optional().desc('What the tree lists — every model in the daemon, or the one in the buffer. Example: "buffer"'),
    filter: v.enum(FILTERS).optional().desc('Which ontology the daemon listing narrows to. Example: "PART"'),
    query: v.string().optional().desc('The daemon listing\'s search over slug and name. Example: "bolt"'),
    opened: v.array(v.string()).optional().desc('The tree keys expanded, each the path of slugs above a row. Example: ["drone_rig"]'),
    caret: v.string().optional().desc('The tree key the keyboard sits on. Example: "drone_rig/drone_rig.arm.0"'),
    cursors: v.array(v.record(v.string(), v.any())).optional().desc('The spots pointed at on the stage in cursor mode, in click order, kept until removed — each a hole, a disc or a face in its placement\'s own frame; the first stays, the last one\'s piece moves. Example: [{ slug: "frame.plate.0", path: "plate.0", kind: "hole", point: [0.03, 0.002, 0.03], axis: [0, 1, 0], radius: 0.0015 }]'),
    mating: v.record(v.string(), v.any()).optional().desc("How the next mate lands — the axes the same way round, and a gap along the axis in metres. Example: { flip: false, offset: 0.003 }"),
    focus: v.string().optional().desc('The literal the stage is framed on — a view, never a change to the rows. Example: "frame.arm.0"'),
    desk: v.string().optional().desc('What a tool or a duplicate last wrote — the agent reads it as the last written literal. Example: "bolt_m3_12"'),
    gizmo: v.enum(GIZMOS).optional().desc('What the stage does to a placement. Example: "translate"'),
    joins: v.array(v.string()).optional().desc('The placements a joint draft holds, by their path in the fold. Example: ["arm.0"]'),
    draft: v.record(v.string(), v.any()).optional().desc('The inspector\'s edited values, unsaved — the verb\'s own shape. Example: { slug: "arm", qty: 5 }'),
    draftOf: v.string().optional().desc('The slug the draft belongs to. Example: "arm"'),
    move: v.record(v.string(), v.string()).optional().desc('What is typed in the move panel, unrun. Example: { layer: "chassis", parent: "" }'),
    renaming: v.record(v.string(), v.string()).optional().desc('A rename typed in the tree, unrun. Example: { slug: "frame", value: "frame_carbon" }'),
    undo: v.array(v.record(v.string(), v.any())).optional().desc('What the stage moved, newest first — each entry the /placement writes that put it back. Example: [{ words: "moved tail.0", writes: [{ layer: "interceptor", name: "tail.0", ref: "tail", translation: [0, 0, 0] }] }]'),
    redo: v.array(v.record(v.string(), v.any())).optional().desc('What an undo took back, newest first — each entry the /placement writes that put it on again; a new move empties it. Example: [{ words: "moved tail.0", writes: [{ layer: "interceptor", name: "tail.0", ref: "tail", translation: [0.03, 0, 0] }] }]'),
    log: v.array(v.record(v.string(), v.any())).optional().desc('Every write the screen made or was refused, newest first — the header shows the last. Example: [{ nature: "/placement", words: "placement tail.0", write: true }]'),
    ghost: v.boolean().optional().desc("Whether what is not picked shows as a ghost on the stage. Example: true"),
    ghosted: v.array(v.string()).optional().desc('The placements shown as ghosts on the stage, by slug — a view, never a change to the entities. Example: ["interceptor.frame.0"]'),
    hidden: v.array(v.string()).optional().desc('The placements the stage does not draw, by slug, with all they hold. Example: ["interceptor.top.0"]'),
    locked: v.array(v.string()).optional().desc('The placements the stage neither selects nor moves, by slug; a cursor still lands on them. Example: ["interceptor.frame.0"]'),
    edges: v.boolean().optional().desc("Whether every piece draws its contours. Example: true"),
    explode: v.number({ minimum: 0, maximum: 1 }).optional().desc("How far the stage flies the placements apart, 0 to 1 — a view, never a change to the rows. Example: 0.4"),
    camera: v.record(v.string(), v.any()).optional().desc('Where the stage camera rests, per subject — a view, never a change to the rows. Example: { subject: "drone", target: [0, 0.02, 0], position: [0.3, 0.25, 0.3] }'),
    view: v.string().optional().desc('The named view the stage sits in, absent after a free orbit. Example: "top"'),
    scrolls: v.record(v.string(), v.number()).optional().desc("How far each pane is scrolled, in pixels. Example: { tree: 320, inspector: 0 }"),
    panes: v.record(v.string(), v.boolean()).optional().desc("Which panes are shown. Example: { tree: true, stage: true, inspector: true }"),
    sizes: v.record(v.string(), v.number()).optional().desc("Each pane's size in pixels, as the seams left it. Example: { tree: 248, inspector: 312 }"),
  },
});

export const surfaces = [
  { slug: "assembly", mount: "buffer/Assembly.svelte", mime: mime.dom.svelte },
];
