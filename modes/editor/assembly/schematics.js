import { v } from "@vivalence/typology";

export const FILTERS = ["ALL", "PART", "PLACEMENT", "GUIDE"];

export const SCOPES = ["daemon", "buffer"];

export const GIZMOS = ["translate", "rotate", "scale", "joint"];

export const PANES = ["tree", "stage", "inspector", "harness"];

export const INPUT = v.record(v.string(), v.any()).desc('The domain verb\'s input, verbatim — its fields are in /schematics under VERBS. Example: { slug: "frame" }');

export const SCHEMATICS = v.object({
  ONTOLOGIES: v.record(v.string(), v.any()).desc('What a literal of each ontology may carry. Example: { part: { traits: ["LABELED"], layer: true } }'),
  TRAITS: v.record(v.string(), v.any()).desc("The payload shape of every trait, as JSON schema. Example: { LABELED: { type: \"object\" } }"),
  VERBS: v.record(v.string(), v.any()).desc("The input shape of every verb, as JSON schema. Example: { part: { type: \"object\" } }"),
}).desc("The domain's schematics, as the screen and the harness read them. Example: { ONTOLOGIES: {}, TRAITS: {}, VERBS: {} }");

export const VOCABULARY = v.record(v.string(), v.array(v.string())).desc('The installed symbols by family — the part before the first dot; the ontology roots left out. Example: { material: ["material.carbon"], joint: ["joint.bolted"] }');
