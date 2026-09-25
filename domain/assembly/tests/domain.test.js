import { specimen, shape } from "@vivalence/typology";
import * as domain from "../assembly.viva.js";
import * as schematics from "../schematics.js";
import { generate, generators } from "../generators/index.js";
import { SYMBOLS } from "../../../tests/rig.js";

const { describe, it, expect } = specimen;

describe("domain module — what the runtime mounts", () => {
  it("P-manifest: an EXPOSED, TOOLING domain named assembly", () => {
    expect(domain.manifest.type).toBe("domain");
    expect(domain.manifest.slug).toBe("assembly");
    expect([...domain.manifest.traits].sort()).toEqual(["EXPOSED", "TOOLING"]);
  });

  it("P-traits: the domain brings literal traits, never an entity — each a {name, schematic, repository, entity}", () => {
    expect(Object.keys(domain.traits).sort()).toEqual(["literal", "note", "symbol"]);
    expect(domain.traits.literal.map((trait) => trait.name).sort()).toEqual(["ANNOTATED", "ASSEMBLED", "COUNTED", "INSTRUCTED", "JOINED", "MODELED", "PARAMETRIC", "PLACED", "SEQUENCED", "SOURCED", "STAGED"]);
    for (const trait of domain.traits.literal) expect(trait.schematic, trait.name).toBe(schematics.TRAITS[trait.name]);
    expect([...domain.traits.symbol, ...domain.traits.note]).toEqual([]);
    expect("entities" in domain).toBe(false);
  });

  it("P-verbs: the aperture opens fifteen natures and the tools arm ten, every input a schema on the wire, the subject a slug in the input — no owner anywhere", () => {
    const natures = shape.strip(domain.aperture).branches ?? {};
    expect(Object.keys(natures).sort()).toEqual(["bom", "closure", "duplicate", "geometry", "guide", "literals", "move", "part", "placement", "rename", "resolve", "retract", "sequence", "step", "tree"]);
    const armed = shape.strip(domain.tools).branches ?? {};
    expect(Object.keys(armed).sort()).toEqual(["bom", "duplicate", "guide", "move", "part", "placement", "rename", "resolve", "sequence", "step"]);
    for (const [name, branch] of [...Object.entries(natures), ...Object.entries(armed)]) {
      expect(branch.effect?.input?.type, name).toBe("object");
      expect(Object.keys(branch.effect.input.properties), name).not.toContain("owner");
    }
    // a tool's input is its nature's input — one description, shared
    for (const name of Object.keys(armed)) expect(Object.keys(armed[name].effect.input.properties), name).toEqual(Object.keys(natures[name].effect.input.properties));
  });

  it("P-barrel: the shapes ride the barrel under one key — a mode never imports outside its directory and reaches them as daemon.domain.schematics.X; what nothing reads is not there: no kinds, no fold, no generators, no resolve hook, nothing flat", () => {
    expect(Object.keys(domain).sort()).toEqual(["aperture", "manifest", "schematics", "tools", "traits"]);
    for (const name of ["ONTOLOGIES", "PLACED", "JOINED", "ASSEMBLED", "SEQUENCED", "STAGED", "GENERATOR", "TRAITS", "VERBS", "TREE", "ROW", "TINTS"]) expect(domain.schematics[name], name).toBe(schematics[name]);
    for (const name of ["kinds", "KINDS", "kindOf", "fold", "stack", "bom", "path", "layerOf", "generators", "generate", "resolve", "TORQUES"]) expect(name in domain, name).toBe(false);
    expect("TORQUES" in schematics).toBe(false);
  });

  it("P-one-root: every topology declares exactly ONE TOPOGRAPHICAL symbol, named after itself", () => {
    for (const [name, rows] of Object.entries(SYMBOLS)) {
      const roots = rows.filter((row) => row.traits.includes("TOPOGRAPHICAL"));
      expect(roots.map((row) => row.slug)).toEqual([name]);
    }
  });

  it("P-symbols-unique: no topology declares a slug twice, and the four vocabularies do not overlap", () => {
    const all = Object.values(SYMBOLS).flat().map((row) => row.slug);
    expect(new Set(all).size).toBe(all.length);
  });

  it("P-every-trait-typed: every trait the domain declares has a payload shape in TRAITS, and every trait an ontology may carry is declared (LABELED is the kernel's)", () => {
    const declared = new Set(["LABELED", ...domain.traits.literal.map((trait) => trait.name)]);
    for (const trait of declared) expect(schematics.TRAITS[trait], trait).toBeDefined();
    expect(Object.keys(schematics.ONTOLOGIES)).toEqual(["part", "placement", "step", "guide"]);
    expect(schematics.ONTOLOGIES.part.traits).not.toContain("SEQUENCED");
    expect(schematics.ONTOLOGIES.step.traits).not.toContain("PREPARED");
    for (const [ontology, carried] of Object.entries(schematics.ONTOLOGIES)) {
      for (const trait of carried.traits) expect(declared.has(trait), `${ontology}.${trait}`).toBe(true);
    }
  });

  it("P-example-in-desc: every description in schematics.js and on every nature's and tool's input ends with an Example", () => {
    const walk = (schema, path, seen = new Set()) => {
      if (!schema || typeof schema !== "object" || seen.has(schema)) return;
      seen.add(schema);
      if (typeof schema.description === "string" && schema.description.length > 40) {
        expect(schema.description, `${path}: ${schema.description}`).toMatch(/Example:/);
      }
      for (const [key, child] of Object.entries(schema.properties ?? {})) walk(child, `${path}.${key}`, seen);
      for (const [index, child] of (schema.anyOf ?? []).entries()) walk(child, `${path}[${index}]`, seen);
      if (schema.items) walk(schema.items, `${path}[]`, seen);
      if (schema.patternProperties) for (const child of Object.values(schema.patternProperties)) walk(child, `${path}{}`, seen);
    };
    for (const name of ["PLACED", "JOINED", "GENERATOR", "PATH", "ROW", "TREE", "SCENE", "SECTION", "ANCHOR", "LINE", "NOTE"]) walk(schematics[name], name);
    for (const [name, shape] of Object.entries(schematics.TRAITS)) walk(shape, name);
    for (const [name, held] of Object.entries(generators)) walk(held.params, name);
    for (const vector of [domain.aperture, domain.tools]) {
      for (const [name, branch] of Object.entries(shape.strip(vector).branches)) walk(branch.effect.input, name);
    }
  });

  it("P-generators: a bolt is a shaft and a head in metres; unknown generators and bad params say so", () => {
    const bolt = generate({ generator: "fastener.bolt", params: { thread: "M3", length: 16 } });
    expect(bolt.children.map((child) => child.name)).toEqual(["shaft", "head"]);
    const shaft = bolt.children[0];
    shaft.geometry.computeBoundingBox();
    expect(shaft.geometry.boundingBox.max.y - shaft.geometry.boundingBox.min.y).toBeCloseTo(0.016, 5);
    expect(() => generate({ generator: "fastener.rivet", params: {} })).toThrow(/no generator/);
    expect(() => generate({ generator: "fastener.bolt", params: { thread: "M7", length: 16 } })).toThrow(/params/);
  });
});
