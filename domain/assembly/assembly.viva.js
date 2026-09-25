export * as traits from "./traits/index.js";
export * as schematics from "./schematics.js";
export { aperture } from "./aperture/index.js";
export { tools } from "./tools/index.js";

export const manifest = {
  type: "domain",
  slug: "assembly",
  name: "Assembly",
  description:
    "Parts, placements, steps and guides as literals — the one TOPOGRAPHICAL symbol says which. " +
    "A part is what a thing IS; a placement is one occurrence of it under a part's layer and always places something; a step names the placements it installs by slug; a guide orders steps in sections over a subject part. " +
    "Composition is part + placement, process is guide + step, and they meet only by slug; the repository is the only writer and folds a part into a glTF-shaped tree, a guide into that tree with each placement's step. " +
    "Doors over the repository for the App; the tools every assembly mode's agent shares, minting under the caller's mode.",
  version: "0.0.1",
  traits: ["EXPOSED", "TOOLING"],
};
