import { Dataset } from "@vivalence/typology";

export const manifest = {
  type: "topology",
  slug: "step",
  name: "Steps",
  description: "One unit of a build guide as a literal — the placements it installs, its lines and its callouts. This mount ships the kind's root symbol and the note.*, warn.* and tool.* vocabulary.",
  version: "0.0.1",
  traits: ["DATASET"],
};

export const dataset = new Dataset({ symbol: "dataset/symbols" });
