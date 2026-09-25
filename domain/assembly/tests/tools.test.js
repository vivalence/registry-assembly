import { contexts, shard, specimen } from "@vivalence/typology";
import { mount } from "../../../tests/rig.js";
import { line } from "../tools/line.js";

const { describe, it, expect, beforeAll, afterAll } = specimen;

describe("the tools — an agent's hands, each calling its verb with the slugs it names", { sanitizeResources: false, sanitizeOps: false }, () => {
  let rig;
  beforeAll(async () => {
    rig = await mount();
  });
  afterAll(async () => rig?.close());

  it("P-line: ontology slug · name · what the row holds", () => {
    expect(line({ ontology: "part", slug: "arm", traits: [], trait: { LABELED: { name: "Arm" }, COUNTED: { qty: 4 } } })).toBe("part arm · Arm · qty 4");
    expect(line({ ontology: "placement", slug: "frame.arm.0", traits: [], trait: { LABELED: { name: "arm.0" }, PLACED: { layer: "frame", name: "arm.0", ref: "arm" }, JOINED: { joins: ["plate"] } } }))
      .toBe("placement frame.arm.0 · arm.0 · in frame ← arm · holds 1");
    expect(line({ ontology: "guide", slug: "build", traits: [], trait: { LABELED: { name: "Build" }, SEQUENCED: { subject: "frame", sections: [{ name: "a", steps: ["build.01", "build.02"] }] } } })).toBe("guide build · Build · 2 steps of frame");
    expect(line({ ontology: "step", slug: "build.01", traits: [], trait: { LABELED: { name: "Arms" }, ASSEMBLED: { placements: [{ literal: "frame.arm.0", active: true }] }, INSTRUCTED: { lines: [{ text: "x" }], images: [] } } })).toBe("step build.01 · Arms · 1 placements · 1 lines");
  });

  it("P-mint-tools: part · step answer a line, the literal as an entity, slug + ontology as the object; the caller's mode is the annotation", async () => {
    const plate = await rig.invoke("/part", { slug: "plate", name: "Plate", modeled: { file: "parts/plate.glb" }, qty: 1 });
    expect(plate.message).toBe("part plate · Plate · qty 1");
    expect(plate.entities.literal[0].mode.id).toBe(rig.mode.id);
    expect(plate.object).toEqual({ slug: "plate", ontology: "part" });
    await rig.invoke("/part", { slug: "arm", name: "Arm", modeled: { file: "parts/arm.glb" }, qty: 4 });
    const frame = await rig.invoke("/part", { slug: "frame", name: "Frame" });
    expect(frame.message).toBe("part frame · Frame");
    const step = await rig.invoke("/step", { slug: "build.01", name: "Arms", lines: [{ text: "Place the arms." }] });
    expect(step.object.ontology).toBe("step");
    expect(step.message).toBe("step build.01 · Arms · 0 placements · 1 lines");
    const guide = await rig.invoke("/guide", { slug: "build", name: "Build", subject: "frame" });
    expect(guide.message).toBe("guide build · Build · 0 steps of frame");
  });

  it("P-layer-tools: placements and moves edit the layer, a step names what it installs, sequence orders a guide; resolve and bom read what an agent must know before placing", async () => {
    await rig.invoke("/placement", { layer: "frame", name: "plate", ref: "plate" });
    const placed = await rig.invoke("/placement", { layer: "frame", name: "arm.0", ref: "arm", translation: [0.1, 0, 0], joins: ["plate"], symbols: ["joint.bolted"] });
    expect(placed.message).toBe("placement frame.arm.0 · arm.0 · in frame ← arm · holds 1");
    const installs = await rig.invoke("/step", { slug: "build.01", placements: [{ literal: "frame.plate", active: true }] });
    expect(installs.message).toBe("step build.01 · Arms · 1 placements · 1 lines");
    const sequenced = await rig.invoke("/sequence", { guide: "build", sections: [{ name: "Frame", steps: ["build.01"] }] });
    expect(sequenced.message).toBe("guide build · Build · 1 steps of frame");
    const tree = await rig.invoke("/resolve", { slug: "frame" });
    expect(tree.message.split("\n")).toEqual(["frame: 2 placements · 1 joints", "plate (frame.plate) ← plate", "arm.0 (frame.arm.0) ← arm @ [0.1, 0, 0]", "arm.0 holds plate"]);
    expect(tree.object.placements.length).toBe(2);
    const guided = await rig.invoke("/resolve", { slug: "build" });
    expect(guided.message.split("\n")).toEqual([
      "build: 2 placements · 1 joints",
      "plate (frame.plate) ← plate · step 1",
      "arm.0 (frame.arm.0) ← arm @ [0.1, 0, 0] (not built)",
      "arm.0 holds plate",
      "build.01: lays out plate × 1",
    ]);
    const bill = await rig.invoke("/bom", { slug: "frame" });
    expect(bill.message.split("\n")).toEqual(["plate × 1 of 1", "arm × 1 of 4"]);
    const base = await rig.invoke("/bom", { slug: "build" });
    expect(base.message).toBe("plate × 1 of 1");
    const moved = await rig.invoke("/move", { slug: "frame.arm.0", name: "arm.left" });
    expect(moved.message).toBe("placement frame.arm.left · arm.left · in frame ← arm · holds 1");
  });

  it("P-no-mode: without a mode on the caller a mint still lands — under the topology that ships its ontology's root symbol", async () => {
    const orphan = await rig.tools["/part"]({ ...shard.context.lift(contexts.host, rig.daemon), input: { slug: "loose", name: "Loose" } });
    const mode = orphan.entities.literal[0].mode;
    expect(mode?.id ?? mode).toBe(rig.modes.part.id);
  });
});
