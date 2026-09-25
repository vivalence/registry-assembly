import { v, mime } from "@vivalence/typology";

export { aperture } from "./aperture/index.js";
export { harness } from "./harness.js";
export { tools } from "./tools/index.js";

export const manifest = {
  type: "player",
  slug: "guide",
  name: "Guide",
  version: "0.1.0",
  description:
    "The assembly guide as the builder walks it: the subject on a full-bleed stage, the guide's sections in a floating panel with the step " +
    "on screen expanded — the parts it lays out, its numbered lines that point on the stage, its notes, its pictures, its tools — " +
    "Back and Next, a step marked done. Everything the screen holds lives in the buffer.",
  traits: ["VIEWABLE", "EXPOSED", "HARNESSED", "TOOLING", "CONVERSATIONAL"],
};

export const buffer = v.buffer({
  data: {
    guide: v.string().optional().desc('The guide on screen, by slug; absent lists the daemon\'s guides. Example: "drone"'),
    step: v.integer({ minimum: 0 }).optional().desc("The step on screen, 1-based; 0 is the overview. Example: 4"),
    done: v.array(v.string()).optional().desc('The steps marked completed, by slug. Example: ["drone.01"]'),
    explode: v.number({ minimum: 0, maximum: 1 }).optional().desc("How far the parts fly apart. Example: 0.4"),
    ghost: v.boolean().optional().desc("true draws later steps and kit parts as ghosts. Example: false"),
    view: v.string().optional().desc('A named view chosen over the step\'s own; absent is the step\'s. Example: "top"'),
    focus: v.record(v.string(), v.any()).optional().desc('What the stage is framed on — the lines and chips picked on this step. Example: { step: 4, ids: ["t0"], slugs: ["drone_rig.arm.0"] }'),
    lightbox: v.record(v.string(), v.any()).optional().desc('The picture open large — the step\'s pictures and which. Example: { list: ["manual/a.webp"], k: 0 }'),
  },
});

export const views = [
  { slug: "guide", mount: "buffer/Guide.svelte", mime: mime.dom.svelte },
];
