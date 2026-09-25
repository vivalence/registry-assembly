import { v, mime } from "@vivalence/typology";
import { ISOLATES, JOB } from "./schematics.js";

export { aperture } from "./aperture/index.js";

export const manifest = {
  type: "editor",
  slug: "import",
  name: "Import",
  version: "0.1.0",
  description:
    "Model files into the assembly domain: drop glb · gltf · blend · usd · usdz · usdc · fbx · obj · stl · 3ds · step · iges, and each walks " +
    "sniff → validate → decode → remap → commit — blender headless (FreeCAD first for a b-rep) to one GLB per object in metres, Y-up, " +
    "then parts and placements minted through the domain's verbs — every import its own, under its own root. The queue and every decode log are the buffer's; the scene tree is a reading of what the domain holds.",
  traits: ["FILESINK", "VIEWABLE", "EXPOSED"],
};

export const statics = {
  ignore: [".DS_Store", "*.blend1", "*.tmp"],
};

export const buffer = v.buffer({
  data: {
    jobs: v.array(JOB).optional().desc("The queue, in drop order. Example: []"),
    active: v.string().optional().desc('The job whose log and meta show. Example: "k3j9x"'),
    node: v.string().optional().desc('The scene tree row selected, by key. Example: "drone_rig/arm"'),
    isolate: v.enum(ISOLATES).optional().desc('Which kinds the tree shows. Example: "COMPONENT"'),
  },
});

export const views = [
  { slug: "import", mount: "buffer/Import.svelte", mime: mime.dom.svelte },
];
