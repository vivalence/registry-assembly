import { Dataset } from "@vivalence/typology";

export const manifest = {
  type: "topology",
  slug: "part",
  name: "Parts",
  description: "What a thing is, as a literal — geometry of its own, an interior of placements, or both. This mount ships the ontology's root symbol and the material.* and source.* vocabulary; a product's families come with its topography.",
  version: "0.0.1",
  traits: ["DATASET"],
};

export const dataset = new Dataset({ symbol: "dataset/symbols" });
