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
    "renames and retracts; the subject folded on a three.js stage with a gizmo that moves a placement and a joint mode that says what " +
    "a fastener holds; an inspector whose form is the domain's own schematic; and a harness underneath — the context the agent is given, " +
    "a composer that runs lines as verbs, the activity of every call. Guides and steps are authored in @assembly/guide/editor.",
  traits: ["VIEWABLE", "EXPOSED", "HARNESSED", "TOOLING", "CONVERSATIONAL"],
};

export const buffer = v.buffer({
  data: {
    subject: v.string().optional().desc('The part folded on the stage, by slug. Example: "frame"'),
    selected: v.array(v.string()).optional().desc('The literals selected, by slug. Example: ["frame.arm.0"]'),
    scope: v.enum(SCOPES).optional().desc('What the tree lists — every model in the daemon, or the one in the buffer. Example: "buffer"'),
    filter: v.enum(FILTERS).optional().desc('Which ontology the daemon listing narrows to. Example: "PART"'),
    query: v.string().optional().desc('The daemon listing\'s search over slug and name. Example: "bolt"'),
    opened: v.array(v.string()).optional().desc('The tree keys expanded, each the path of slugs above a row. Example: ["drone_rig"]'),
    cursor: v.string().optional().desc('The tree key the keyboard sits on. Example: "drone_rig/drone_rig.arm.0"'),
    focus: v.string().optional().desc('The literal the stage is framed on — a view, never a change to the rows. Example: "frame.arm.0"'),
    desk: v.string().optional().desc('What the last line wrote — the thing the next one iterates. Example: "bolt_m3_12"'),
    gizmo: v.enum(GIZMOS).optional().desc('What the stage does to a placement. Example: "translate"'),
    joins: v.array(v.string()).optional().desc('The placements a joint draft holds, by their path in the fold. Example: ["arm.0"]'),
    draft: v.record(v.string(), v.any()).optional().desc('The inspector\'s edited values, unsaved — the verb\'s own shape. Example: { slug: "arm", qty: 5 }'),
    draftOf: v.string().optional().desc('The slug the draft belongs to. Example: "arm"'),
    move: v.record(v.string(), v.string()).optional().desc('What is typed in the move panel, unrun. Example: { layer: "chassis", parent: "" }'),
    renaming: v.record(v.string(), v.string()).optional().desc('A rename typed in the tree, unrun. Example: { slug: "frame", value: "frame_carbon" }'),
    compose: v.string().optional().desc('What is typed in the composer, unsent — one verb per line. Example: "part bolt_m3_12 bolt m3 12"'),
    turns: v.array(v.record(v.string(), v.any())).optional().desc('What was sent and what the verbs answered, oldest first. Example: [{ who: "you", state: "sent", text: "tree" }]'),
    turn: v.integer({ minimum: 0 }).optional().desc("The turn on screen; absent is the composer. Example: 1"),
    log: v.array(v.record(v.string(), v.any())).optional().desc('Every call the screen made, newest first. Example: [{ nature: "/tree", words: "2 roots", write: false }]'),
    ghost: v.boolean().optional().desc("Whether what is not picked shows as a ghost on the stage. Example: true"),
    explode: v.number({ minimum: 0, maximum: 1 }).optional().desc("How far the stage flies the placements apart, 0 to 1 — a view, never a change to the rows. Example: 0.4"),
    camera: v.record(v.string(), v.any()).optional().desc('Where the stage camera rests, per subject — a view, never a change to the rows. Example: { subject: "drone", target: [0, 0.02, 0], position: [0.3, 0.25, 0.3] }'),
    view: v.string().optional().desc('The named view the stage sits in, absent after a free orbit. Example: "top"'),
    scrolls: v.record(v.string(), v.number()).optional().desc("How far each pane is scrolled, in pixels. Example: { tree: 320, inspector: 0 }"),
    panes: v.record(v.string(), v.boolean()).optional().desc("Which panes are shown. Example: { tree: true, stage: true, inspector: true, harness: true }"),
    sizes: v.record(v.string(), v.number()).optional().desc("Each pane's size in pixels, as the seams left it. Example: { tree: 248, context: 260 }"),
  },
});

export const views = [
  { slug: "assembly", mount: "buffer/Assembly.svelte", mime: mime.dom.svelte },
];
