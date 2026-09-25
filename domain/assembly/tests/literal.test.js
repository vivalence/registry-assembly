import { specimen } from "@vivalence/typology";
import { mount } from "../../../tests/rig.js";
import { order, resolve as pure } from "../resolve.js";

const { describe, it, expect, beforeAll, afterAll } = specimen;

describe("the repository — the only writer, over a real datamap", { sanitizeResources: false, sanitizeOps: false }, () => {
  let rig;
  beforeAll(async () => {
    rig = await mount();
  });
  afterAll(async () => {
    await rig.close();
  });

  it("P-part: minted with the ontology's root symbol; ontology stamped; the minting mode kept as an annotation", async () => {
    const bolt = await rig.literal.part(
      { slug: "bolt_m3_16", name: "Bolt, short", description: "M3x16", parametric: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }, qty: 6, symbols: ["material.fastener", "source.parametric"] },
      rig.mode,
    );
    expect(bolt.ontology).toBe("part");
    expect(bolt.traits).toEqual(["LABELED", "PARAMETRIC", "COUNTED"]);
    expect(bolt.symbols.getItems().map((symbol) => symbol.slug).sort()).toEqual(["material.fastener", "part", "source.parametric"]);
    expect(bolt.mode.id).toBe(rig.mode.id);
    const unannotated = await rig.literal.part({ slug: "washer", name: "Washer" });
    expect(unannotated.mode.id).toBe(rig.modes.part.id);
  });

  it("P-slug-unique: a slug is one literal — the same slug again is an over of it, a different ontology is refused, another mode changes nothing", async () => {
    const again = await rig.literal.part({ slug: "bolt_m3_16", description: "M3 x 16 mm" }, rig.modes.part);
    const bolt = await rig.literal.named("bolt_m3_16");
    expect(again.id).toBe(bolt.id);
    expect(bolt.mode.id).toBe(rig.mode.id);
    await expect(rig.literal.step({ slug: "bolt_m3_16", name: "no" })).rejects.toThrow(/"bolt_m3_16" is a part, not a step/);
    await expect(rig.literal.mint("part", "bolt_m3_16", { traits: [], trait: {} }, [])).rejects.toThrow(/already a part — a slug is unique/);
    await expect(rig.literal.named("nothing")).rejects.toThrow(/no literal named "nothing"/);
  });

  it("P-over-part: what the payload carries replaces that trait, what it leaves out stays; symbols present are the family set again", async () => {
    const bolt = await rig.literal.part({ slug: "bolt_m3_16", qty: 8 });
    expect(bolt.trait.COUNTED).toEqual({ qty: 8 });
    expect(bolt.trait.LABELED).toEqual({ name: "Bolt, short", description: "M3 x 16 mm" });
    expect(bolt.trait.PARAMETRIC.params.length).toBe(16);
    expect(bolt.traits).toEqual(["LABELED", "PARAMETRIC", "COUNTED"]);
    const marked = await rig.literal.part({ slug: "bolt_m3_16", symbols: ["material.fastener"] });
    expect(marked.symbols.getItems().map((symbol) => symbol.slug).sort()).toEqual(["material.fastener", "part"]);
    await expect(rig.literal.part({ slug: "bolt_m3_16", symbols: ["material.unobtainium"] })).rejects.toThrow(/no symbol "material.unobtainium"/);
    await expect(rig.literal.part({ slug: "bolt_m3_16", qty: "six" })).rejects.toThrow(/not a COUNTED payload/);
  });

  it("P-ontology-traits: a trait an ontology may not carry is refused; a malformed payload is refused", async () => {
    await expect(rig.literal.mint("part", "x", { traits: ["PLACED"], trait: { PLACED: {} } }, [])).rejects.toThrow(/carries no PLACED/);
    await expect(rig.literal.mint("step", "x", { traits: ["INSTRUCTED"], trait: { INSTRUCTED: { lines: "not a list" } } }, [])).rejects.toThrow(/not a INSTRUCTED payload/);
    await expect(rig.literal.mint("part", "x", { traits: ["SEQUENCED"], trait: { SEQUENCED: { sections: [] } } }, [])).rejects.toThrow(/carries no SEQUENCED/);
    await expect(rig.literal.mint("step", "x", { traits: ["ASSEMBLED"], trait: { ASSEMBLED: { placements: [{ literal: "a" }] } } }, [])).rejects.toThrow(/not a ASSEMBLED payload/);
    await expect(rig.literal.mint("widget", "x", {}, [])).rejects.toThrow(/no ontology "widget"/);
  });

  it("P-placement: a placement is its own literal, slugged by layer and path; the same path again is an over; it always names a ref", async () => {
    await rig.literal.part({ slug: "plate", name: "Plate", modeled: { file: "parts/plate.glb" }, qty: 1 }, rig.mode);
    await rig.literal.part({ slug: "arm", name: "Arm", modeled: { file: "parts/arm.glb" }, qty: 4 }, rig.mode);
    await rig.literal.part({ slug: "frame", name: "Frame" }, rig.mode);
    const one = await rig.literal.placement({ layer: "frame", name: "plate", ref: "plate" }, rig.mode);
    expect(one.ontology).toBe("placement");
    expect(one.slug).toBe("frame.plate");
    expect(one.traits).toEqual(["LABELED", "PLACED"]);
    expect(one.uses.getItems().map((row) => row.slug).sort()).toEqual(["frame", "plate"]);
    await rig.literal.placement({ layer: "frame", name: "arm.0", ref: "arm", translation: [0.1, 0, 0] }, rig.mode);
    const over = await rig.literal.placement({ layer: "frame", name: "arm.0", ref: "arm", rotation: [0, 0, 0, 1] }, rig.mode);
    expect(over.slug).toBe("frame.arm.0");
    expect(over.trait.PLACED).toEqual({ layer: "frame", name: "arm.0", ref: "arm", translation: [0.1, 0, 0], rotation: [0, 0, 0, 1] });
    const labeled = await rig.literal.placement({ layer: "frame", name: "arm.0", ref: "arm", label: "Front arm", symbols: ["joint.bolted"] });
    expect(labeled.trait.LABELED).toEqual({ name: "Front arm" });
    expect(labeled.symbols.getItems().map((symbol) => symbol.slug).sort()).toEqual(["joint.bolted", "placement"]);

    await rig.literal.part({ slug: "arms", name: "Arm set" }, rig.mode);
    await rig.literal.part({ slug: "rack", name: "Rack" }, rig.mode);
    await rig.literal.placement({ layer: "rack", name: "arms", ref: "arms" }, rig.mode);
    const nested = await rig.literal.placement({ layer: "rack", name: "arm.1", parent: "arms", ref: "arm" }, rig.mode);
    expect(nested.slug).toBe("rack.arms.arm.1");
    const rack = await rig.literal.named("rack");
    expect((await rig.literal.resolve(rack)).placements.map((held) => held.path)).toEqual(["arms", "arms/arm.1"]);

    await expect(rig.literal.placement({ layer: "rack", name: "x" })).rejects.toThrow(/not a PLACED/);
    await expect(rig.literal.placement({ layer: "frame.plate", name: "x", ref: "arm" })).rejects.toThrow(/cannot place into "frame.plate" — a placement is not a layer/);
    await expect(rig.literal.placement({ layer: "rack", name: "x", ref: "frame.plate" })).rejects.toThrow(/is a placement — a placement places a part/);
    await expect(rig.literal.placement({ layer: "arms", name: "eats", ref: "rack" })).rejects.toThrow(/already contains "arms" — placing it here would eat itself/);
  });

  it("P-move-carries-children: a placement moves to another parent, layer or name — its slug follows, the placements under it go with it, joins naming its path are rewritten, one flush", async () => {
    await rig.literal.placement({ layer: "rack", name: "bolt.0", parent: "arms/arm.1", ref: "bolt_m3_16", joins: ["arms", "arms/arm.1"] });
    await rig.literal.part({ slug: "post", name: "Post" });
    await rig.literal.placement({ layer: "rack", name: "post.0", ref: "post" });
    const moved = await rig.literal.move("rack.arms.arm.1", { parent: "post.0", name: "arm.left" });
    expect(moved.slug).toBe("rack.post.0.arm.left");
    expect(moved.trait.PLACED).toEqual({ layer: "rack", name: "arm.left", parent: "post.0", ref: "arm" });
    expect(moved.trait.LABELED.name).toBe("arm.left");
    const bolt = await rig.literal.named("rack.post.0.arm.left.bolt.0");
    expect(bolt.trait.PLACED.parent).toBe("post.0/arm.left");
    expect(bolt.trait.JOINED.joins).toEqual(["arms", "post.0/arm.left"]);
    expect(bolt.uses.getItems().map((row) => row.slug).sort()).toEqual(["bolt_m3_16", "rack"]);
    const rack = await rig.literal.named("rack");
    expect((await rig.literal.resolve(rack)).placements.map((held) => held.path).sort()).toEqual(["arms", "post.0", "post.0/arm.left", "post.0/arm.left/bolt.0"]);

    const rooted = await rig.literal.move("rack.post.0.arm.left", { parent: "" });
    expect(rooted.slug).toBe("rack.arm.left");
    expect("parent" in rooted.trait.PLACED).toBe(false);
    expect((await rig.literal.named("rack.arm.left.bolt.0")).trait.PLACED.parent).toBe("arm.left");

    const elsewhere = await rig.literal.move("rack.arm.left", { layer: "frame", name: "arm.2" });
    expect(elsewhere.slug).toBe("frame.arm.2");
    expect((await rig.literal.named("frame.arm.2.bolt.0")).trait.PLACED.layer).toBe("frame");
    expect(elsewhere.uses.getItems().map((row) => row.slug).sort()).toEqual(["arm", "frame"]);

    await expect(rig.literal.move("frame", { name: "x" })).rejects.toThrow(/is a part — only a placement moves/);
    await expect(rig.literal.move("frame.arm.2", { name: "arm.0" })).rejects.toThrow(/"frame.arm.0" is already there/);
    await expect(rig.literal.move("frame.arm.2", { parent: "nowhere" })).rejects.toThrow(/no placement "nowhere" in "frame"/);
    await expect(rig.literal.move("frame.arm.2", { parent: "arm.2/bolt.0" })).rejects.toThrow(/cannot move under itself/);
    await expect(rig.literal.move("frame.arm.2", { layer: "frame.plate" })).rejects.toThrow(/cannot move into "frame.plate"/);
    await rig.literal.move("frame.arm.2", { layer: "rack", parent: "arms", name: "arm.1" });
    expect((await rig.literal.named("rack.arms.arm.1.bolt.0")).trait.JOINED.joins).toEqual(["arms", "arms/arm.1"]);
  });

  it("P-step-guide-sequence: a step names placements by slug and carries lines, notes and staging; a guide names a part and sections of steps; each list given is carried whole", async () => {
    const s1 = await rig.literal.step(
      {
        slug: "build.01",
        name: "Plate",
        placements: [{ literal: "frame.plate", active: true }],
        lines: [{ text: "Lay the plate flat." }],
        notes: [{ text: "Leave it loose.", symbols: ["note.warning", "warn.loose"] }],
        staged: { explode: 0.2 },
        symbols: ["tool.hex_2_0"],
      },
      rig.mode,
    );
    expect(s1.ontology).toBe("step");
    expect(s1.traits).toEqual(["LABELED", "ASSEMBLED", "INSTRUCTED", "ANNOTATED", "STAGED"]);
    expect(s1.uses.getItems().map((row) => row.slug)).toEqual(["frame.plate"]);
    expect(s1.symbols.getItems().map((symbol) => symbol.slug).sort()).toEqual(["step", "tool.hex_2_0"]);
    await expect(rig.literal.step({ slug: "build.x", placements: [{ literal: "plate", active: true }] })).rejects.toThrow(/"plate" is a part — a step installs placements/);
    await expect(rig.literal.step({ slug: "build.x", placements: [{ literal: "frame.nothing", active: true }] })).rejects.toThrow(/no literal named "frame.nothing"/);
    await expect(rig.literal.step({ slug: "build.x", notes: [{ text: "?", symbols: ["note.bogus"] }] })).rejects.toThrow(/no symbol "note.bogus"/);
    await expect(rig.literal.step({ slug: "plate", name: "no" })).rejects.toThrow(/"plate" is a part, not a step/);
    expect(await rig.literal.findOne({ slug: "build.x" })).toBe(null);

    await rig.literal.step({ slug: "build.02", name: "Arm", placements: [{ literal: "frame.arm.0", active: true }], lines: [{ text: "Seat the arm.", at: { literals: ["frame.arm.0"] } }] }, rig.mode);
    const over = await rig.literal.step({ slug: "build.02", notes: [{ text: "Not past snug." }] });
    expect(over.trait.INSTRUCTED).toEqual({ lines: [{ text: "Seat the arm.", at: { literals: ["frame.arm.0"] } }], images: [] });
    expect(over.trait.ANNOTATED).toEqual({ notes: [{ text: "Not past snug." }] });
    expect(over.trait.LABELED.name).toBe("Arm");
    expect(over.traits).toEqual(["LABELED", "ASSEMBLED", "INSTRUCTED", "ANNOTATED"]);

    const build = await rig.literal.guide({ slug: "build", name: "Build the frame", subject: "frame", sections: [{ name: "Frame", steps: ["build.01", "build.02"] }], lines: [{ text: "Welcome." }] }, rig.mode);
    expect(build.ontology).toBe("guide");
    expect(build.traits).toEqual(["LABELED", "SEQUENCED", "INSTRUCTED", "ANNOTATED"]);
    expect(order(build)).toEqual(["build.01", "build.02"]);
    expect(build.trait.SEQUENCED.subject).toBe("frame");
    expect(build.uses.getItems().map((row) => row.slug).sort()).toEqual(["build.01", "build.02", "frame"]);
    await expect(rig.literal.guide({ slug: "bad", subject: "frame.plate" })).rejects.toThrow(/"frame.plate" is a placement — a guide builds a part/);
    await expect(rig.literal.guide({ slug: "bad", sections: [{ name: "x", steps: ["plate"] }] })).rejects.toThrow(/"plate" is a part, not a step/);
    await expect(rig.literal.guide({ slug: "build.01", name: "no" })).rejects.toThrow(/"build.01" is a step, not a guide/);

    await expect(rig.literal.sequence(build, [{ name: "Frame", steps: ["build.01", "build.09"] }])).rejects.toThrow(/no step "build.09"/);
    await expect(rig.literal.sequence(build, [{ name: "Frame", steps: ["build.01", "plate"] }])).rejects.toThrow(/is a part, not a step/);
    await expect(rig.literal.sequence(build, [{ name: "Frame", steps: ["build.01", "build.01"] }])).rejects.toThrow(/sequenced once/);
    await expect(rig.literal.sequence(build, [{ steps: ["build.01"] }])).rejects.toThrow(/not a SEQUENCED sections/);
    await expect(rig.literal.sequence(s1, [{ name: "x", steps: ["build.02"] }])).rejects.toThrow(/only a guide sequences/);
    await rig.literal.sequence(build, [{ name: "Base", steps: ["build.01"] }, { name: "Arms", steps: ["build.02"] }]);
    expect(build.trait.SEQUENCED).toEqual({ subject: "frame", sections: [{ name: "Base", steps: ["build.01"] }, { name: "Arms", steps: ["build.02"] }] });
    expect(build.uses.getItems().map((row) => row.slug).sort()).toEqual(["build.01", "build.02", "frame"]);
  });

  it("P-closure-resolve-bom: the closure pulls a layer's placements off the reverse edge and a guide's steps off its edges; the repository's fold is the pure one", async () => {
    rig.em.clear();
    const frame = await rig.literal.named("frame");
    const rows = await rig.literal.closure(frame);
    expect([...rows.keys()].sort()).toEqual(["arm", "frame", "frame.arm.0", "frame.plate", "plate"]);
    const tree = await rig.literal.resolve(frame);
    expect(tree).toEqual(pure(rows, "frame"));
    expect(tree.placements.map((one) => one.path)).toEqual(["plate", "arm.0"]);
    const build = await rig.literal.named("build");
    expect([...(await rig.literal.closure(build)).keys()].sort()).toEqual(["arm", "build", "build.01", "build.02", "frame", "frame.arm.0", "frame.plate", "plate"]);
    const guided = await rig.literal.resolve(build);
    expect(guided.placements.map((one) => [one.slug, one.at, one.active])).toEqual([["frame.plate", 0, true], ["frame.arm.0", 1, true]]);
    expect(guided.steps.map((step) => step.prepared)).toEqual([{ parts: { plate: 1 }, tools: ["tool.hex_2_0"] }, { parts: { arm: 1 }, tools: [] }]);
    expect([...(await rig.literal.bom(build, { upto: 1 }))]).toEqual([["plate", 1]]);
    expect([...(await rig.literal.bom(build))]).toEqual([["plate", 1], ["arm", 1]]);
    expect((await rig.literal.resolve(build, { upto: 0 })).placements.map((one) => one.active)).toEqual([false, false]);
  });

  it("P-tree-roots: the tree lists every root unnamed, the named ones and what they reach otherwise; a part says how often it is placed; the minting mode is an annotation", async () => {
    rig.em.clear();
    const whole = await rig.literal.tree();
    expect(whole.rows.filter((row) => row.depth === 0).map((row) => row.slug)).toEqual(["frame", "rack", "washer", "build"]);
    expect(whole.counts).toEqual({ part: 8, placement: 6, step: 2, guide: 1 });
    expect(whole.parts.find((row) => row.slug === "arm")).toMatchObject({ used: 2, mode: "model", tail: "qty 4" });
    expect(whole.parts.find((row) => row.slug === "washer").mode).toBe("part");
    const frame = await rig.literal.tree(["frame"]);
    expect(frame.rows.map((row) => row.key)).toEqual(["frame", "frame/frame.plate", "frame/frame.arm.0"]);
    expect(frame.rows[0].scene.map((one) => one.path)).toEqual(["plate", "arm.0"]);
    expect(frame.rows[1]).toMatchObject({ ontology: "placement", ref: "plate", layer: "frame", tail: "← plate", depth: 1 });
    expect(frame.parts.map((row) => row.slug)).toEqual(["arm", "frame", "plate"]);
    const build = await rig.literal.tree(["build"]);
    expect(build.rows.map((row) => [row.key, row.depth])).toEqual([
      ["frame", 0], ["frame/frame.plate", 1], ["frame/frame.arm.0", 1],
      ["build", 0], ["build/build.01", 1], ["build/build.01/frame.plate", 2], ["build/build.02", 1], ["build/build.02/frame.arm.0", 2],
    ]);
    expect(build.rows[3]).toMatchObject({ ontology: "guide", tail: "2 steps", mode: "model" });
    expect(build.rows[3].scene.map((one) => one.path)).toEqual(["plate", "arm.0"]);
    expect(build.rows[4]).toMatchObject({ ontology: "step", tail: "1 placement", symbols: ["tool.hex_2_0"] });
    expect(await rig.literal.tree([])).toEqual({ rows: [], counts: { part: 0, placement: 0, step: 0, guide: 0 }, parts: [] });
  });

  it("P-retract-closure: retract refuses while something else references a literal — a placement a step names, a step a guide names; a guide's closure takes its steps, never the build; a part's closure takes a root and everything only it reaches, keeping what another root still uses", async () => {
    rig.em.clear();
    await expect(rig.literal.retract(["arm"])).rejects.toThrow(/still references arm/);
    await expect(rig.literal.retract(["frame.plate"])).rejects.toThrow(/"build.01" still references frame.plate/);
    await expect(rig.literal.retract(["build.01"])).rejects.toThrow(/"build" still references build.01/);
    expect((await rig.literal.retract(["build"], { closure: true, dry: true })).retracted.sort()).toEqual(["build", "build.01", "build.02"]);
    expect((await rig.literal.retract(["build"], { closure: true })).retracted.sort()).toEqual(["build", "build.01", "build.02"]);
    expect(await rig.literal.findOne({ slug: "frame" })).not.toBe(null);
    expect(await rig.literal.findOne({ slug: "frame.plate" })).not.toBe(null);
    const gone = await rig.literal.retract(["rack"], { closure: true });
    expect(gone.retracted.sort()).toEqual(["arms", "bolt_m3_16", "post", "rack", "rack.arms", "rack.arms.arm.1", "rack.arms.arm.1.bolt.0", "rack.post.0"]);
    expect(await rig.literal.findOne({ slug: "arm" })).not.toBe(null);
    expect(await rig.literal.findOne({ slug: "bolt_m3_16" })).toBe(null);
    expect(await rig.literal.findOne({ slug: "rack" })).toBe(null);
    const tree = await rig.literal.tree();
    expect(tree.rows.filter((row) => row.depth === 0).map((row) => row.slug)).toEqual(["frame", "washer"]);
  });

  it("P-symbol-missing: without the topology mounted, the error names it", async () => {
    const bare = await mount({ symbols: false });
    try {
      await expect(bare.literal.part({ slug: "x", name: "x" })).rejects.toThrow(/mount @assembly\/topology\/part/);
    } finally {
      await bare.close();
    }
  });
});

describe("identity — rename, move and duplicate give a literal a new slug, and what names it follows", { sanitizeResources: false, sanitizeOps: false }, () => {
  let rig;
  beforeAll(async () => {
    rig = await mount();
    const literal = rig.literal;
    await literal.part({ slug: "arm", name: "Arm", qty: 4, modeled: { file: "parts/arm.glb" }, symbols: ["material.carbon"] }, rig.mode);
    await literal.part({ slug: "bolt", name: "Bolt", parametric: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }, qty: 8 }, rig.mode);
    await literal.part({ slug: "frame", name: "Frame" }, rig.mode);
    await literal.placement({ layer: "frame", name: "arm.0", ref: "arm", translation: [0.1, 0, 0] });
    await literal.placement({ layer: "frame", name: "bolt.0", parent: "arm.0", ref: "bolt", joins: ["arm.0"] });
    await literal.placement({ layer: "frame", name: "arm.1", ref: "arm", translation: [-0.1, 0, 0] });
    await literal.step({ slug: "build.01", name: "First arm", placements: [{ literal: "frame.arm.0", active: true }, { literal: "frame.arm.0.bolt.0", active: true }], lines: [{ text: "Seat the arm.", at: { literals: ["frame.arm.0"] } }] }, rig.mode);
    await literal.step({ slug: "build.02", name: "Second arm", placements: [{ literal: "frame.arm.1", active: true }], staged: { built: { steps: ["build.01"], placements: [] }, tints: { "frame.arm.0": "warning" } } }, rig.mode);
    await literal.guide({ slug: "build", name: "Build", subject: "frame", sections: [{ name: "Arms", steps: ["build.01", "build.02"] }] }, rig.mode);
    await literal.part({ slug: "rig", name: "Rig" }, rig.mode);
    await literal.placement({ layer: "rig", name: "frame.0", ref: "frame" });
  });
  afterAll(async () => rig?.close());

  const held = async (slug) => (await rig.literal.named(slug)).trait;

  it("P-rename-rewrites-assembled: a part's slug moves and everything that names it follows — its placements re-slugged, what places it, the guide's subject, every step's placements, anchors and tints; the fold unchanged", async () => {
    const before = await rig.literal.resolve(await rig.literal.named("rig"));
    const renamed = await rig.literal.rename("frame", "chassis");
    expect(renamed.slug).toBe("chassis");
    expect(renamed.trait.LABELED.name).toBe("Frame");
    expect(await rig.literal.findOne({ slug: "frame" })).toBe(null);
    expect((await held("chassis.arm.0")).PLACED.layer).toBe("chassis");
    expect((await rig.literal.named("chassis.arm.0.bolt.0")).trait.JOINED.joins).toEqual(["arm.0"]);
    expect((await held("rig.frame.0")).PLACED.ref).toBe("chassis");
    expect((await held("build")).SEQUENCED.subject).toBe("chassis");
    const first = await held("build.01");
    expect(first.ASSEMBLED.placements.map((one) => one.literal)).toEqual(["chassis.arm.0", "chassis.arm.0.bolt.0"]);
    expect(first.INSTRUCTED.lines[0].at.literals).toEqual(["chassis.arm.0"]);
    expect((await held("build.02")).STAGED.tints).toEqual({ "chassis.arm.0": "warning" });
    expect((await rig.literal.named("build.01")).uses.getItems().map((row) => row.slug).sort()).toEqual(["chassis.arm.0", "chassis.arm.0.bolt.0"]);
    rig.em.clear();
    const after = await rig.literal.resolve(await rig.literal.named("rig"));
    expect(after.placements.map((one) => [one.path, one.ref, one.translation ?? null])).toEqual(before.placements.map((one) => [one.path, one.ref === "frame" ? "chassis" : one.ref, one.translation ?? null]));
    expect(Object.keys(after.parts).sort()).toEqual(["arm", "bolt", "chassis"]);
  });

  it("P-rename-step: a step's new slug is what its guide sequences and what a later step's built names; a guide renames alone; a placement is refused — its name is its path; a taken slug is refused; the same slug is nothing", async () => {
    const step = await rig.literal.rename("build.01", "build.first");
    expect(step.slug).toBe("build.first");
    expect(order(await rig.literal.named("build"))).toEqual(["build.first", "build.02"]);
    expect((await held("build.02")).STAGED.built.steps).toEqual(["build.first"]);
    const guide = await rig.literal.rename("build", "assemble");
    expect(order(guide)).toEqual(["build.first", "build.02"]);
    await rig.literal.rename("assemble", "build");
    await expect(rig.literal.rename("chassis.arm.0", "x")).rejects.toThrow(/is a placement — its name is its path/);
    await expect(rig.literal.rename("chassis", "arm")).rejects.toThrow(/"arm" is already there/);
    expect((await rig.literal.rename("arm", "arm")).slug).toBe("arm");
  });

  it("P-move-follows: a placement moved to another parent, layer or name is re-slugged with what sits under it, and every step naming either follows", async () => {
    const moved = await rig.literal.move("chassis.arm.1", { name: "arm.left" });
    expect(moved.slug).toBe("chassis.arm.left");
    expect((await held("build.02")).ASSEMBLED.placements).toEqual([{ literal: "chassis.arm.left", active: true }]);
    const front = await rig.literal.move("chassis.arm.0", { name: "arm.front" });
    expect(front.slug).toBe("chassis.arm.front");
    expect((await held("chassis.arm.front.bolt.0")).PLACED.parent).toBe("arm.front");
    const first = await held("build.first");
    expect(first.ASSEMBLED.placements.map((one) => one.literal)).toEqual(["chassis.arm.front", "chassis.arm.front.bolt.0"]);
    expect(first.INSTRUCTED.lines[0].at.literals).toEqual(["chassis.arm.front"]);
    expect((await held("build.02")).STAGED.tints).toEqual({ "chassis.arm.front": "warning" });
    rig.em.clear();
    const folded = await rig.literal.resolve(await rig.literal.named("build"));
    expect(folded.placements.map((one) => [one.path, one.at])).toEqual([["arm.front", 0], ["arm.front/bolt.0", 0], ["arm.left", 1]]);
  });

  it("P-duplicate-part: a copy under the next free slug carries its traits and its own layer, places the same parts, is a root and is in no guide", async () => {
    const copy = await rig.literal.duplicate("chassis", {}, rig.mode);
    expect(copy.slug).toBe("chassis_copy");
    expect(copy.trait.LABELED.name).toBe("Frame copy");
    expect(copy.traits).not.toContain("SEQUENCED");
    rig.em.clear();
    const folded = await rig.literal.resolve(await rig.literal.named("chassis_copy"));
    expect(folded.placements.map((one) => one.path).sort()).toEqual(["arm.front", "arm.front/bolt.0", "arm.left"]);
    expect(folded.joints.map((one) => one.joins)).toEqual([["arm.front"]]);
    expect((await held("chassis_copy.arm.front")).PLACED).toMatchObject({ layer: "chassis_copy", ref: "arm", translation: [0.1, 0, 0] });
    expect((await held("build.first")).ASSEMBLED.placements.map((one) => one.literal)).toEqual(["chassis.arm.front", "chassis.arm.front.bolt.0"]);
    expect((await rig.literal.duplicate("chassis")).slug).toBe("chassis_copy_2");
    const tree = await rig.literal.tree();
    expect(tree.rows.filter((row) => row.depth === 0).map((row) => row.slug)).toEqual(["chassis_copy", "chassis_copy_2", "rig", "build"]);
    expect((await rig.literal.duplicate("arm", { to: "arm_long" })).trait.COUNTED).toEqual({ qty: 4 });
    await expect(rig.literal.duplicate("arm", { to: "bolt" })).rejects.toThrow(/"bolt" is already there/);
  });

  it("P-duplicate-guide: a copy takes its steps with it — <guide>.NN becomes <copy>.NN — and what the copies hold among themselves follows; the placements they install stay the same", async () => {
    const copy = await rig.literal.duplicate("build", {}, rig.mode);
    expect(copy.slug).toBe("build_copy");
    expect(copy.trait.LABELED.name).toBe("Build copy");
    expect(copy.trait.SEQUENCED).toEqual({ subject: "chassis", sections: [{ name: "Arms", steps: ["build_copy.first", "build_copy.02"] }] });
    expect((await held("build_copy.02")).STAGED.built.steps).toEqual(["build_copy.first"]);
    expect((await held("build_copy.first")).ASSEMBLED.placements.map((one) => one.literal)).toEqual(["chassis.arm.front", "chassis.arm.front.bolt.0"]);
    expect((await rig.literal.named("build_copy.first")).mode.id).toBe(rig.mode.id);
    expect(order(await rig.literal.named("build"))).toEqual(["build.first", "build.02"]);
    rig.em.clear();
    expect((await rig.literal.resolve(await rig.literal.named("build_copy"))).placements.map((one) => one.at)).toEqual([0, 0, 1]);
  });

  it("P-duplicate-placement: a sibling under the next free name, what sits under it with it, holding nothing; a step lands right after the original in every section naming it", async () => {
    const twin = await rig.literal.duplicate("chassis.arm.front");
    expect(twin.slug).toBe("chassis.arm.0");
    expect(twin.trait.PLACED).toMatchObject({ layer: "chassis", name: "arm.0", ref: "arm", translation: [0.1, 0, 0] });
    expect(twin.trait.LABELED.name).toBe("arm.0");
    const bolt = await rig.literal.named("chassis.arm.0.bolt.0");
    expect(bolt.trait.PLACED.parent).toBe("arm.0");
    expect(bolt.traits).not.toContain("JOINED");
    expect((await rig.literal.named("chassis.arm.front.bolt.0")).trait.JOINED.joins).toEqual(["arm.front"]);
    expect((await rig.literal.duplicate("chassis.arm.front", { to: "arm.spare" })).slug).toBe("chassis.arm.spare");
    await expect(rig.literal.duplicate("chassis.arm.front", { to: "arm.spare" })).rejects.toThrow(/already there/);
    const step = await rig.literal.duplicate("build.02");
    expect(step.slug).toBe("build.02_copy");
    expect(step.trait.ASSEMBLED.placements).toEqual([{ literal: "chassis.arm.left", active: true }]);
    expect(order(await rig.literal.named("build"))).toEqual(["build.first", "build.02", "build.02_copy"]);
    expect(order(await rig.literal.named("build_copy"))).toEqual(["build_copy.first", "build_copy.02"]);
  });
});

describe("retract — a closure takes what only the named reach, never the inside of a part that stays", { sanitizeResources: false, sanitizeOps: false }, () => {
  let rig;
  beforeAll(async () => {
    rig = await mount();
    const literal = rig.literal;
    await literal.part({ slug: "arm", name: "Arm" }, rig.mode);
    await literal.part({ slug: "shared", name: "Shared" }, rig.mode);
    await literal.placement({ layer: "shared", name: "arm.0", ref: "arm" });
    await literal.placement({ layer: "shared", name: "arm.1", parent: "arm.0", ref: "arm" });
    await literal.part({ slug: "one", name: "One" }, rig.mode);
    await literal.placement({ layer: "one", name: "shared.0", ref: "shared" });
    await literal.part({ slug: "two", name: "Two" }, rig.mode);
    await literal.placement({ layer: "two", name: "shared.0", ref: "shared" });
  });
  afterAll(async () => rig?.close());

  it("P-retract-shared-interior: a root retracted with its closure keeps a part another root still places — and everything inside it", async () => {
    const dry = await rig.literal.retract(["one"], { closure: true, dry: true });
    expect(dry.retracted.sort()).toEqual(["one", "one.shared.0"]);
    expect(await rig.literal.findOne({ slug: "one" })).not.toBe(null);
    const gone = await rig.literal.retract(["one"], { closure: true });
    expect(gone.retracted.sort()).toEqual(["one", "one.shared.0"]);
    for (const slug of ["shared", "shared.arm.0", "shared.arm.0.arm.1", "two", "two.shared.0", "arm"]) expect(await rig.literal.findOne({ slug }), slug).not.toBe(null);
    rig.em.clear();
    expect((await rig.literal.resolve(await rig.literal.named("two"))).placements.map((one) => one.path)).toEqual(["shared.0", "shared.0/arm.0", "shared.0/arm.0/arm.1"]);
  });

  it("P-retract-placement: a placement goes with what sits under its path, and the part it places stays", async () => {
    const gone = await rig.literal.retract(["shared.arm.0", "shared.arm.0.arm.1"]);
    expect(gone.retracted.sort()).toEqual(["shared.arm.0", "shared.arm.0.arm.1"]);
    expect(await rig.literal.findOne({ slug: "arm" })).not.toBe(null);
    const last = await rig.literal.retract(["two"], { closure: true });
    expect(last.retracted.sort()).toEqual(["shared", "two", "two.shared.0"]);
    expect(await rig.literal.findOne({ slug: "arm" })).not.toBe(null);
  });
});
