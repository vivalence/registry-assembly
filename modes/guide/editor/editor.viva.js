import { v, mime } from "@vivalence/typology";
import { FILTERS, TABS } from "./schematics.js";

export { aperture } from "./aperture/index.js";
export { harness } from "./harness.js";
export { tools } from "./tools/index.js";

export const manifest = {
  type: "guide",
  slug: "editor",
  name: "Guide editor",
  version: "0.1.0",
  description:
    "The assembly guide as its author writes it: the steps in sections on the left, dragged into order; the subject on the stage with " +
    "what a step installs lit; an inspector with the guide's own tab — subject, name, intro, notes, camera, inventory — and the step's: " +
    "prerequisites, the parts it pulls in, its lines, its notes, its camera, its pictures, its tools. Every edit lands in the literal " +
    "it came from, saved as you type; the whole screen lives in the buffer.",
  traits: ["VIEWABLE", "EXPOSED", "HARNESSED", "TOOLING", "CONVERSATIONAL"],
};

export const buffer = v.buffer({
  data: {
    guide: v.string().optional().desc('The guide open, by slug; absent lists the daemon\'s guides. Example: "drone"'),
    step: v.integer({ minimum: 0 }).optional().desc("The step on screen, 1-based; 0 is none. Example: 4"),
    tab: v.enum(TABS).optional().desc('Which inspector tab shows. Example: "step"'),
    insp: v.boolean().optional().desc("false collapses the inspector to its tabs. Example: true"),
    sel: v.array(v.string()).optional().desc('The placements selected on the stage and in the parts list, by slug. Example: ["drone_rig.arm.0"]'),
    scopeF: v.enum(FILTERS).optional().desc('Which parts the parts list shows — this step, the kit, or all. Example: "step"'),
    scopeQ: v.string().optional().desc('The parts list\'s search. Example: "bolt"'),
    open: v.record(v.string(), v.boolean()).optional().desc('Which parts are expanded in the parts list, by part slug. Example: { arm: true }'),
    subjOpen: v.boolean().optional().desc("true shows the subject picker. Example: false"),
    subjQ: v.string().optional().desc('The subject picker\'s search. Example: "frame"'),
    picker: v.boolean().optional().desc("true shows the media picker over the stage. Example: false"),
    lb: v.string().optional().desc('The picture open large, by freight path. Example: "manual/a.webp"'),
    ghost: v.boolean().optional().desc("true draws what is not built as ghosts. Example: true"),
    explode: v.number({ minimum: 0, maximum: 1 }).optional().desc("How far the parts fly apart. Example: 0"),
    view: v.string().optional().desc('A named view chosen over the step\'s own. Example: "top"'),
    draft: v.record(v.string(), v.any()).optional().desc('The unsaved edit — the literal it belongs to and the verb\'s whole payload. Example: { of: "drone.04", ontology: "step", name: "First motor" }'),
    editing: v.string().optional().desc('The step whose name is being typed in the column. Example: "drone.04"'),
    slugDraft: v.string().optional().desc('A new slug typed for the step on screen, unrun. Example: "drone.04b"'),
    tints: v.string().optional().desc('The prerequisite whose tint palette is open. Example: "drone_rig.arm.0"'),
  },
});

export const views = [
  { slug: "guide", mount: "buffer/Guide.svelte", mime: mime.dom.svelte },
];
