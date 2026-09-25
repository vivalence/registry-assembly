import { App, v } from "@vivalence/typology";
import { BIN } from "./schematics.js";

export { aperture } from "./aperture/index.js";
export { tools } from "./tools/index.js";
export { harness } from "./harness.js";

export const manifest = {
  type: "editor",
  slug: "import",
  name: "Import",
  version: "0.0.1",
  description:
    "A blend file into the assembly domain, over a mountpoint: harvested headless into objects in metres, read as members — " +
    "one component, N placements — named, then minted through the domain's doors as component rows and an assembly whose own layer " +
    "places every instance; written back to a topography's dataset when the bin is done.",
  traits: ["MOUNTED", "APPLICATION", "STANDALONE", "EXPOSED", "TOOLING", "HARNESSED", "CONVERSATIONAL"],
};

export const statics = {
  ignore: [".DS_Store", "*.blend1", "*.tmp"],
};

export const application = new App(
  "buffer/Import.svelte",
  v.buffer({
    data: {
      bin: BIN.optional(),
      selected: v.array(v.string()).optional().desc('The members and objects selected — one on the inspector, many for a move. Example: ["Propeller1", "Propeller2"]'),
    },
  }),
);
