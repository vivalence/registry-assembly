import { Dataset } from "@vivalence/typology";

export const manifest = {
  type: "topology",
  slug: "placement",
  name: "Placements",
  description: "One occurrence of a part under a layer, as a literal — what it places, where, and what it holds together. This mount ships the ontology's root symbol and the joint.* vocabulary.",
  version: "0.0.1",
  traits: ["DATASET"],
};

export const dataset = new Dataset({ symbol: "dataset/symbols" });
