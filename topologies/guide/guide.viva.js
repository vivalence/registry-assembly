import { Dataset } from "@vivalence/typology";

export const manifest = {
  type: "topology",
  slug: "guide",
  name: "Guides",
  description: "A build guide as a literal — the part it builds, its steps in sections, an intro and its callouts. This mount ships the kind's root symbol; a step's vocabulary comes with @assembly/topology/step.",
  version: "0.0.1",
  traits: ["DATASET"],
};

export const dataset = new Dataset({ symbol: "dataset/symbols" });
