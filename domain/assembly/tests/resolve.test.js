import { specimen } from "@vivalence/typology";
import { bom, fold, interior, layerOf, order, path, resolve } from "../resolve.js";

const { describe, it, expect } = specimen;

// an abstract fixture: a plate, a bolt, a leg set that is pure structure; a stool whose own layer
// places the plate, the legs and a bolt under the legs; a pair of stools placed twice; a guide
// that builds the stool in three steps — plate, then legs with the bolt, then the bolt out again
const part = (slug, trait) => ({ slug, ontology: "part", trait });
const at = (layer, placed, joined) => ({
  slug: `${layer}.${(placed.parent ? `${placed.parent}/${placed.name}` : placed.name).replaceAll("/", ".")}`,
  ontology: "placement",
  trait: { PLACED: { layer, ...placed }, ...(joined && { JOINED: joined }) },
});
const guide = (slug, subject, sections) => ({ slug, ontology: "guide", trait: { SEQUENCED: { subject, sections } } });
const step = (slug, placements, symbols = []) => ({ slug, ontology: "step", symbols, trait: { ASSEMBLED: { placements: placements.map(([literal, active = true]) => ({ literal, active })) } } });

const rows = new Map(
  [
    part("plate", { LABELED: { name: "Plate" }, MODELED: { file: "parts/plate.glb" }, COUNTED: { qty: 1 } }),
    part("bolt", { LABELED: { name: "Bolt" }, PARAMETRIC: { generator: "fastener.bolt", params: { thread: "M3", length: 8 } }, COUNTED: { qty: 4 } }),
    part("legs", { LABELED: { name: "Leg set" } }),
    part("stool", { LABELED: { name: "Stool" } }),
    part("pair", { LABELED: { name: "Pair" } }),
    part("ouroboros", { LABELED: { name: "Ouroboros" } }),
    part("lost", { LABELED: { name: "Lost" } }),

    at("stool", { name: "plate", ref: "plate" }),
    at("stool", { name: "legs", ref: "legs" }),
    at("stool", { name: "bolt.0", parent: "legs", ref: "bolt", translation: [0.1, 0, 0] }, { joins: ["plate"] }),
    at("pair", { name: "left", ref: "stool" }),
    at("pair", { name: "right", ref: "stool", translation: [1, 0, 0] }),
    at("ouroboros", { name: "me", ref: "ouroboros" }),
    at("lost", { name: "x", ref: "nowhere" }),

    guide("build", "stool", [{ name: "Base", steps: ["build.01"] }, { name: "Legs", steps: ["build.02", "build.03"] }]),
    step("build.01", [["stool.plate"]]),
    step("build.02", [["stool.legs"], ["stool.legs.bolt.0"]], ["step", "tool.hex_2_0", "warn.loose"]),
    step("build.03", [["stool.legs.bolt.0", false]]),
    guide("twice", "pair", [{ name: "Both", steps: ["twice.01"] }]),
    step("twice.01", [["stool.legs"]]),
    guide("lost_guide", "stool", [{ name: "x", steps: ["never"] }]),
    guide("stray", "stool", [{ name: "x", steps: ["stray.01"] }]),
    step("stray.01", [["stool.nothing"]]),
    guide("bare", undefined, []),
  ].map((held) => [held.slug, held]),
);

describe("the fold — pure, over plain rows", () => {
  it("P-path: a placement's path is its parent's path and its name", () => {
    expect(path({ name: "a" })).toBe("a");
    expect(path({ name: "b", parent: "a" })).toBe("a/b");
  });

  it("P-interior: a layer's contents are the placements that name it — a part with none is a leaf", () => {
    expect(layerOf(rows, "stool").map((one) => one.name)).toEqual(["plate", "legs", "bolt.0"]);
    expect(interior(rows, "stool")).toBe(true);
    expect(interior(rows, "plate")).toBe(false);
    expect(interior(rows, "legs")).toBe(false);
  });

  it("P-order: a guide's steps are its sections flattened; a later layer over the same path carries only what changes", () => {
    expect(order(rows.get("build"))).toEqual(["build.01", "build.02", "build.03"]);
    expect(order(rows.get("bare"))).toEqual([]);
    const held = fold([[{ name: "a", ref: "x", translation: [1, 0, 0] }], [{ name: "a", active: false }]]);
    expect(held.get("a")).toEqual({ name: "a", ref: "x", translation: [1, 0, 0], active: false });
  });

  it("P-composition: a part folds to its placements with paths, children, slugs and joints — no steps anywhere", () => {
    const stool = resolve(rows, "stool");
    expect(stool.placements.map((one) => one.path)).toEqual(["plate", "legs", "legs/bolt.0"]);
    expect(stool.placements.map((one) => one.slug)).toEqual(["stool.plate", "stool.legs", "stool.legs.bolt.0"]);
    expect(stool.placements.find((one) => one.path === "legs").children).toEqual(["legs/bolt.0"]);
    expect(stool.joints).toEqual([{ fastener: "legs/bolt.0", joins: ["plate"], symbols: [] }]);
    expect("steps" in stool).toBe(false);
    expect(stool.parts.plate.MODELED.file).toBe("parts/plate.glb");
  });

  it("P-graft: a part with an interior is grafted under its own placement, joins prefixed, slugs kept; the placement keeps its transform", () => {
    const pair = resolve(rows, "pair");
    expect(pair.placements.map((one) => one.path)).toEqual(["left", "right", "left/plate", "left/legs", "left/legs/bolt.0", "right/plate", "right/legs", "right/legs/bolt.0"]);
    expect(pair.placements.find((one) => one.path === "right").translation).toEqual([1, 0, 0]);
    expect(pair.placements.find((one) => one.path === "left/legs").parent).toBe("left");
    expect(pair.placements.find((one) => one.path === "right/legs").slug).toBe("stool.legs");
    expect(pair.joints.map((joint) => [joint.fastener, joint.joins])).toEqual([["left/legs/bolt.0", ["left/plate"]], ["right/legs/bolt.0", ["right/plate"]]]);
  });

  it("P-guide: the subject's composition, each placement with the first step naming it and the steps' last opinion through upto", () => {
    const whole = resolve(rows, "build");
    expect(whole.subject).toBe("stool");
    expect(whole.sections).toEqual([{ name: "Base", steps: ["build.01"] }, { name: "Legs", steps: ["build.02", "build.03"] }]);
    expect(whole.placements.map((one) => [one.slug, one.at, one.active])).toEqual([["stool.plate", 0, true], ["stool.legs", 1, true], ["stool.legs.bolt.0", 1, false]]);
    expect(whole.joints.length).toBe(1);
    expect(resolve(rows, "build", { upto: 0 }).placements.map((one) => one.active)).toEqual([false, false, false]);
    expect(resolve(rows, "build", { upto: 1 }).placements.map((one) => one.active)).toEqual([true, false, false]);
    expect(resolve(rows, "build", { upto: 2 }).placements.map((one) => one.active)).toEqual([true, true, true]);
    expect(resolve(rows, "build", { upto: 9 }).placements.map((one) => one.active)).toEqual([true, true, false]);
    expect(resolve(rows, "bare")).toMatchObject({ subject: null, placements: [], steps: [], sections: [] });
  });

  it("P-prepared: per step, the parts the bill gains and the step's tool.* symbols — derived, never stored", () => {
    expect(resolve(rows, "build").steps).toEqual([
      { slug: "build.01", index: 0, section: "Base", prepared: { parts: { plate: 1 }, tools: [] } },
      { slug: "build.02", index: 1, section: "Legs", prepared: { parts: { bolt: 1 }, tools: ["tool.hex_2_0"] } },
      { slug: "build.03", index: 2, section: "Legs", prepared: { parts: {}, tools: [] } },
    ]);
  });

  it("P-once-named-twice-installed: a grafted sub-assembly's placement is one slug — a step naming it installs every occurrence", () => {
    const twice = resolve(rows, "twice");
    expect(twice.placements.filter((one) => one.active).map((one) => one.path)).toEqual(["left/legs", "right/legs"]);
    expect(twice.placements.filter((one) => one.at === 0).length).toBe(2);
  });

  it("P-bom: a part's whole composition; a guide's what is active after upto; every placement of a part the kit ships, and nothing beneath one", () => {
    expect([...bom(rows, "stool")]).toEqual([["plate", 1], ["bolt", 1]]);
    expect([...bom(rows, "build", { upto: 1 })]).toEqual([["plate", 1]]);
    expect([...bom(rows, "build", { upto: 2 })]).toEqual([["plate", 1], ["bolt", 1]]);
    expect([...bom(rows, "build")]).toEqual([["plate", 1]]);
    expect([...bom(rows, "pair")]).toEqual([["plate", 2], ["bolt", 2]]);
    const bought = new Map([...rows, ["stool", { ...rows.get("stool"), trait: { ...rows.get("stool").trait, COUNTED: { qty: 2 } } }]]);
    expect([...bom(bought, "pair")]).toEqual([["stool", 2]]);
  });

  it("P-missing: a ref not in the rows is named, a placement a step names outside the composition is named, a step not in the rows throws, a step alone throws, a part that contains itself throws", () => {
    const partial = new Map([["lost", { slug: "lost", ontology: "part", trait: {} }], ["lost.x", rows.get("lost.x")]]);
    expect(resolve(partial, "lost").missing).toEqual(["nowhere"]);
    expect(resolve(rows, "stray").missing).toEqual(["stool.nothing"]);
    expect(() => resolve(rows, "lost_guide")).toThrow(/no row named "never"/);
    expect(() => resolve(rows, "build.01")).toThrow(/is a step — fold its guide/);
    expect(() => resolve(rows, "ouroboros")).toThrow(/contains itself/);
    expect(() => resolve(rows, "ghost")).toThrow(/no row named "ghost"/);
  });
});
