import { contexts, shard, specimen, steer } from "@vivalence/typology";
import { mount } from "../../../tests/rig.js";

const { describe, it, expect, beforeAll, afterAll } = specimen;

describe("the aperture — the repository's verbs over the daemon, direct and over the wire", { sanitizeResources: false, sanitizeOps: false }, () => {
  let rig;
  beforeAll(async () => {
    rig = await mount();
  });
  afterAll(async () => rig?.close());

  it("P-mount: the resolve hook is not exported — the runtime's call at resolution is a no-op, not a fold over the die", () => {
    expect(rig.daemon.domain.resolve).toBeUndefined();
    expect(typeof rig.daemon.call["/resolve"]).toBe("function");
  });

  it("P-mint: part · step mint with the caller's mode as their annotation; the same slug again is an over", async () => {
    const plate = await rig.call("/part", { slug: "plate", name: "Plate", modeled: { file: "parts/plate.glb" }, qty: 1 });
    expect(plate.ontology).toBe("part");
    expect(plate.mode.id).toBe(rig.mode.id);
    const arm = await rig.call("/part", { slug: "arm", name: "Arm", modeled: { file: "parts/arm.glb" }, qty: 4 });
    const bolt = await rig.call("/part", { slug: "bolt_m3_16", name: "Bolt, short", parametric: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }, qty: 6, symbols: ["material.fastener", "source.parametric"] });
    expect(bolt.symbols.getItems().map((symbol) => symbol.slug).sort()).toEqual(["material.fastener", "part", "source.parametric"]);
    const frame = await rig.call("/part", { slug: "frame", name: "Frame" });
    expect(frame.ontology).toBe("part");
    const again = await rig.call("/part", { slug: "frame", description: "the 10 inch frame" });
    expect(again.id).toBe(frame.id);
    expect(again.trait.LABELED).toEqual({ name: "Frame", description: "the 10 inch frame" });
    const one = await rig.call("/step", { slug: "build.01", name: "Plate", lines: [{ text: "Lay the plate flat." }] });
    const two = await rig.call("/step", { slug: "build.02", name: "Arm", lines: [{ text: "Place one arm." }], notes: [{ text: "Leave the bolt loose.", symbols: ["note.warning", "warn.loose"] }] });
    expect([one.ontology, two.ontology]).toEqual(["step", "step"]);
    expect(one.trait).toEqual({ LABELED: { name: "Plate" }, ASSEMBLED: { placements: [] }, INSTRUCTED: { lines: [{ text: "Lay the plate flat." }], images: [] }, ANNOTATED: { notes: [] } });
    const guide = await rig.call("/guide", { slug: "build", name: "Build", subject: "frame" });
    expect(guide.ontology).toBe("guide");
    expect(guide.trait.SEQUENCED).toEqual({ subject: "frame", sections: [] });
    expect(arm.slug).toBe("arm");
  });

  it("P-slug-unique: the same slug from another caller is the same literal, its annotation unchanged; an unknown slug is refused by name", async () => {
    const same = await steer.dispatch.invoke(rig.daemon.domain.aperture, "/part", steer.strategy.direct)({ ...shard.context.lift(contexts.daemonDie, rig.daemon), mode: { id: rig.modes.part.id }, input: { slug: "plate", qty: 2 } });
    expect(same.mode.id).toBe(rig.mode.id);
    expect(same.trait.COUNTED.qty).toBe(2);
    await expect(rig.call("/placement", { layer: "nowhere", name: "plate", ref: "plate" })).rejects.toThrow(/no literal named "nowhere"/);
  });

  it("P-guide: placements into the part, steps naming them, sections into the guide; the fold reads a part and a guide; a move re-slugs and the step follows", async () => {
    await rig.call("/placement", { layer: "frame", name: "plate", ref: "plate" });
    await rig.call("/placement", { layer: "frame", name: "arm.0", ref: "arm", translation: [0.1, 0, 0] });
    await rig.call("/placement", { layer: "frame", name: "bolt_m3_16.0", parent: "arm.0", ref: "bolt_m3_16", joins: ["plate", "arm.0"], symbols: ["joint.bolted"] });
    await rig.call("/step", { slug: "build.01", placements: [{ literal: "frame.plate", active: true }] });
    await rig.call("/step", { slug: "build.02", placements: [{ literal: "frame.arm.0", active: true }, { literal: "frame.arm.0.bolt_m3_16.0", active: true }] });
    const guide = await rig.call("/sequence", { guide: "build", sections: [{ name: "Frame", steps: ["build.01", "build.02"] }] });
    expect(guide.trait.SEQUENCED).toEqual({ subject: "frame", sections: [{ name: "Frame", steps: ["build.01", "build.02"] }] });
    const base = await rig.call("/resolve", { slug: "build", upto: 1 });
    expect(base.placements.filter((one) => one.active).map((one) => one.path)).toEqual(["plate"]);
    const whole = await rig.call("/resolve", { slug: "build" });
    expect(whole.placements.map((one) => [one.path, one.at, one.active])).toEqual([["plate", 0, true], ["arm.0", 1, true], ["arm.0/bolt_m3_16.0", 1, true]]);
    expect(whole.steps[1].prepared).toEqual({ parts: { arm: 1, bolt_m3_16: 1 }, tools: [] });
    const frame = await rig.call("/resolve", { slug: "frame" });
    expect(frame.placements.map((one) => one.path)).toEqual(["plate", "arm.0", "arm.0/bolt_m3_16.0"]);
    expect(frame.joints).toEqual([{ fastener: "arm.0/bolt_m3_16.0", joins: ["plate", "arm.0"], symbols: ["joint.bolted"] }]);
    expect(frame.parts.arm.COUNTED.qty).toBe(4);
    expect(await rig.call("/bom", { slug: "build" })).toEqual({ plate: 1, arm: 1, bolt_m3_16: 1 });
    expect(await rig.call("/bom", { slug: "build", upto: 1 })).toEqual({ plate: 1 });
    const moved = await rig.call("/move", { slug: "frame.arm.0.bolt_m3_16.0", parent: "", name: "bolt.0" });
    expect(moved.slug).toBe("frame.bolt.0");
    expect((await rig.call("/literals", { ontology: "step" })).find((card) => card.slug === "build.02").placements).toBe(2);
    expect((await rig.call("/resolve", { slug: "build" })).placements.map((one) => [one.slug, one.at])).toEqual([["frame.plate", 0], ["frame.arm.0", 1], ["frame.bolt.0", 1]]);
    await rig.call("/move", { slug: "frame.bolt.0", parent: "arm.0", name: "bolt_m3_16.0" });
    const closure = await rig.call("/closure", { slug: "build" });
    expect(closure.map((row) => row.slug).sort()).toEqual([
      "arm", "bolt_m3_16", "build", "build.01", "build.02", "frame", "frame.arm.0", "frame.arm.0.bolt_m3_16.0", "frame.plate", "plate",
    ]);
  });

  it("P-literals-tree: the literals as cards — one ontology, a search, the minting mode as an annotation; the tree lists the roots", async () => {
    const all = await rig.call("/literals", {});
    expect(all.length).toBe(10);
    const parts = await rig.call("/literals", { ontology: "part" });
    expect(parts.map((card) => card.slug).sort()).toEqual(["arm", "bolt_m3_16", "frame", "plate"]);
    for (const card of parts) expect(card.mode).toBe("model");
    expect((await rig.call("/literals", { search: "Bolt" })).map((card) => card.slug).sort()).toEqual(["bolt_m3_16", "frame.arm.0.bolt_m3_16.0"]);
    expect((await rig.call("/literals", { ontology: "guide" }))[0]).toMatchObject({ slug: "build", ontology: "guide", steps: 2, subject: "frame" });
    const placements = await rig.call("/literals", { ontology: "placement" });
    expect(placements.map((card) => card.slug)).toEqual(["frame.arm.0", "frame.arm.0.bolt_m3_16.0", "frame.plate"]);
    expect(placements[0]).toMatchObject({ layer: "frame", ref: "arm" });
    const tree = await rig.call("/tree", {});
    expect(tree.rows.filter((row) => row.depth === 0).map((row) => row.slug)).toEqual(["frame", "build"]);
    expect(tree.rows.map((row) => row.key)).toEqual(["frame", "frame/frame.plate", "frame/frame.arm.0", "frame/frame.arm.0.bolt_m3_16.0", "build", "build/build.01", "build/build.01/frame.plate", "build/build.02", "build/build.02/frame.arm.0", "build/build.02/frame.arm.0.bolt_m3_16.0"]);
    expect(tree.counts).toEqual({ part: 4, placement: 3, step: 2, guide: 1 });
    expect((await rig.call("/tree", { slugs: [] })).rows).toEqual([]);
  });

  it("P-retract: refused while referenced — a placement a step names, a step a guide names; a guide's closure takes its steps and never the build; a part's closure takes the root and its interior", async () => {
    await expect(rig.call("/retract", { slugs: ["plate"] })).rejects.toThrow(/still references plate/);
    await expect(rig.call("/retract", { slugs: ["frame.plate"] })).rejects.toThrow(/"build.01" still references frame.plate/);
    await expect(rig.call("/retract", { slugs: ["build.01"] })).rejects.toThrow(/"build" still references build.01/);
    const steps = await rig.call("/retract", { slugs: ["build"], closure: true });
    expect(steps.retracted.sort()).toEqual(["build", "build.01", "build.02"]);
    const gone = await rig.call("/retract", { slugs: ["frame"], closure: true });
    expect(gone.retracted.sort()).toEqual(["arm", "bolt_m3_16", "frame", "frame.arm.0", "frame.arm.0.bolt_m3_16.0", "frame.plate", "plate"]);
    expect((await rig.call("/literals", {})).map((card) => card.slug)).toEqual([]);
  });

  it("P-wire: the same natures answer over an inline http connection, the tree and the bill as JSON", async () => {
    await rig.call("/part", { slug: "frame", name: "Frame" });
    await rig.call("/part", { slug: "plate", name: "Plate", qty: 1 });
    await rig.call("/placement", { layer: "frame", name: "plate", ref: "plate" });
    const tree = await rig.conn.call("/resolve", { slug: "frame" });
    expect(tree.placements.map((one) => one.path)).toEqual(["plate"]);
    expect(await rig.conn.call("/bom", { slug: "frame" })).toEqual({ plate: 1 });
    const geometry = await rig.conn.call("/geometry", { generator: "fastener.bolt", params: { thread: "M3", length: 16 } });
    expect(geometry.object.children.map((child) => child.name)).toEqual(["shaft", "head"]);
  });
});
