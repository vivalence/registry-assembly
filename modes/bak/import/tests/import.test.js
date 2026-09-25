// the importer over the assembly rig: a harvest of the droneaid blend (tests/fixtures/harvest —
// blend.json + thirty GLBs, what harvest.py writes) as the intake, read → interpreted → named →
// minted through the domain's doors → written to a topography directory. blender itself is not
// run here; the harvest on disk is the fixture, and the runner is measured live.
import { join } from "@std/path";
import { specimen, shard, steer, Vector } from "@vivalence/typology";
import { sets } from "@vivalence/runtime";
import { mount } from "../../../../tests/rig.js";
import { aperture } from "../aperture/index.js";
import { copies, fingerprint, interpret, merge, stem, unmerge } from "../interpret.js";
import { annotate, humanize, propose, slugify } from "../annotate.js";
import { counts, loose, phaseOf, settle } from "../bin.js";
import { blender, intakeOf, read, scan } from "../blend.js";
import { members, screen, vocabulary } from "../harness.js";
import * as mode from "../import.viva.js";

const { describe, it, expect, beforeAll, afterAll } = specimen;

const HARVEST = new URL("./fixtures/harvest/", import.meta.url).pathname;

const objects = () => JSON.parse(Deno.readTextFileSync(join(HARVEST, "blend.json"))).parts;

describe("interpret — objects into members, pure", () => {
  it("P-stem: trailing digits, .NN and (xN) come off; a stem never ends in a separator", () => {
    expect(stem("Motor_Arm0")).toBe("Motor_Arm");
    expect(stem("Antenna.02")).toBe("Antenna");
    expect(stem("FrameSpacers.00 (x4)")).toBe("FrameSpacers");
    expect(stem("FlightControlSeparators (x8)")).toBe("FlightControlSeparators");
    expect(stem("Camera")).toBe("Camera");
    expect(copies("FrameSpacers.00 (x4)")).toBe(4);
    expect(copies("Motor0")).toBe(null);
  });

  it("P-fingerprint: the stem, the triangles and the box to the millimetre", () => {
    expect(fingerprint({ object: "Motor_Arm0", tris: 80, bbox: [0.04134, 0.0075, 0.20863] })).toBe("Motor_Arm|80|0.041,0.008,0.209");
  });

  it("P-members: the droneaid harvest reads as 18 members; arms and motors fold to one each with four placements; a mirrored instance never gives the file or the id", () => {
    const held = interpret(objects());
    const byId = Object.fromEntries(held.map((member) => [member.id, member]));
    expect(held.length).toBe(18);
    expect(byId.Motor_Arm3.objects).toEqual(["Motor_Arm1", "Motor_Arm2", "Motor_Arm0", "Motor_Arm3"]);
    expect(byId.Motor_Arm3.file).toBe("Motor_Arm3.glb");
    expect(byId.Motor_Arm3.placements.length).toBe(4);
    expect(byId.Motor_Arm3.placements[0].mirrored).toEqual(["x", "y"]);
    expect(byId.CamHolder1.objects).toEqual(["CamHolder0", "CamHolder1"]);
    expect(byId.Motor0.objects).toEqual(["Motor0", "Motor1", "Motor2", "Motor3"]);
    expect(byId.Propeller0.objects.length).toBe(4);
    expect(byId["FrameSpacers.00 (x4)"].copies).toBe(4);
    expect(byId["FrameSpacers.01"].objects).toEqual(["FrameSpacers.01", "FrameSpacers.02"]);
    // two boards, one geometry: folded, and that is what unmerge is for
    expect(byId.FlightController00.objects).toEqual(["FlightController00", "FlightController01"]);
    expect(byId["Antenna.00"].objects).toEqual(["Antenna.00"]);
  });

  it("P-unmerge-merge: an object leaves with its placement into a member of its own; merge folds back", () => {
    const held = interpret(objects());
    const split = unmerge(held, "FlightController00", ["FlightController01"]);
    expect(split.length).toBe(19);
    const fc = split.find((member) => member.id === "FlightController01");
    expect(fc.file).toBe("FlightController01.glb");
    expect(fc.placements[0].translation).toEqual([0.00195, 0.0236, 0.0008]);
    expect(split.find((member) => member.id === "FlightController00").objects).toEqual(["FlightController00"]);
    const back = merge(split, ["FlightController00", "FlightController01"]);
    expect(back.length).toBe(18);
    expect(back.find((member) => member.id === "FlightController00").placements.length).toBe(2);
    expect(() => unmerge(held, "Camera")).toThrow(/nothing to unmerge/);
    expect(() => unmerge(held, "Motor0", ["Motor0", "Motor1", "Motor2", "Motor3"])).toThrow(/leaves nothing/);
    expect(() => merge(held, ["Camera", "ghost"])).toThrow(/no member "ghost"/);
  });
});

describe("annotate and the bin — pure", () => {
  it("P-naming: snake_case slugs from the stem, a name for eyes, the model's count; no symbol is guessed; a digits-only name keeps itself", () => {
    expect(slugify("001")).toBe("001");
    expect(humanize("001")).toBe("001");
    expect(slugify("Motor_Arm0")).toBe("motor_arm");
    expect(slugify("FrameSpacers.00 (x4)")).toBe("frame_spacers");
    expect(slugify("CamHolder0")).toBe("cam_holder");
    expect(humanize("FlightController00")).toBe("Flight Controller");
    const held = propose({ id: "Motor0", objects: [], file: "", placements: [{}, {}, {}, {}] });
    expect(held).toEqual({ slug: "motor", name: "Motor", symbols: [], qty: 4 });
    expect(propose({ id: "FrameSpacers.00 (x4)", objects: [], file: "", copies: 4, placements: [{}] }).qty).toBe(4);
  });

  it("P-annotate-all: every unnamed member gets a naming, slugs unique, existing namings kept, dropped skipped", () => {
    const held = interpret(objects());
    const named = annotate(held, { Camera: { slug: "cam", name: "FPV camera" } });
    expect(named.Camera.slug).toBe("cam");
    expect(Object.keys(named).length).toBe(18);
    expect(new Set(Object.values(named).map((row) => row.slug)).size).toBe(18);
    const dropped = annotate(held.map((member) => (member.id === "Computer" ? { ...member, dropped: true } : member)));
    expect(dropped.Computer).toBeUndefined();
  });

  it("P-phases: intake counts loose objects; a member is interpret, annotate or embed by what the bin holds; dropped counts nowhere", () => {
    const bin = settle({ objects: objects(), members: interpret(objects()).slice(0, 3) });
    expect(loose(bin).length).toBe(objects().length - bin.members.flatMap((member) => member.objects).length);
    expect(counts(bin)).toEqual({ intake: loose(bin).length, interpret: 3, annotate: 0, embed: 0 });
    const named = { ...bin, annotations: { [bin.members[0].id]: { slug: "a", name: "A" } }, embedded: { [bin.members[1].id]: { slug: "b", ontology: "component" } } };
    expect(phaseOf(named, bin.members[0])).toBe("annotate");
    expect(phaseOf(named, bin.members[1])).toBe("embed");
    expect(phaseOf(named, bin.members[2])).toBe("interpret");
    expect(phaseOf(named, { ...bin.members[2], dropped: true })).toBe(null);
  });

  it("P-harness: the system section lists members with their phase and naming, and only the vocabulary prefixes", () => {
    const bin = settle({ source: "x.blend", objects: objects(), members: interpret(objects()).slice(0, 2), annotations: { Frame_Star: { slug: "sandwich_plate", name: "Sandwich plate", qty: 1, symbols: ["material.carbon"] } } });
    const text = screen({ data: { bin } });
    expect(text).toContain("[Bin] x.blend ·");
    expect(text).toContain("Frame_Star · annotate · 1 placed · Frame_Star.glb\n  → sandwich_plate · Sandwich plate · qty 1 · material.carbon");
    expect(members(bin).split("\n").length).toBe(3);
    expect(vocabulary([{ slug: "material.carbon", trait: { LABELED: { name: "Carbon" } } }, { slug: "component", trait: {} }])).toBe("material.carbon · Carbon");
    expect(screen(null)).toBe(null);
  });
});

describe("the mode — manifest, the doors over a real datamap, the write to disk", { sanitizeResources: false, sanitizeOps: false }, () => {
  let rig;
  let root;
  let target;
  let importer;
  let buffer;
  let call;
  let bound;

  beforeAll(async () => {
    rig = await mount();
    root = await Deno.makeTempDir({ prefix: "import-mount-" });
    target = await Deno.makeTempDir({ prefix: "import-target-" });
    await Deno.mkdir(join(root, "intake/model"), { recursive: true });
    for await (const entry of Deno.readDir(HARVEST)) if (entry.isFile) await Deno.copyFile(join(HARVEST, entry.name), join(root, "intake/model", entry.name));
    importer = rig.em.create(sets.daemon.mode.entity, { type: "editor", slug: "import", name: "Import", traits: [], installed: "", version: "0.0.1" });
    await rig.em.flush();
    buffer = await rig.entities.buffer.create({ mode: importer.id, data: {} });
    await rig.em.flush();
    const held = { id: importer.id, entity: importer, mountpoint: { absolute: root }, freight: null };
    bound = new Vector().use(shard.context.bind("daemon", rig.daemon)).use(shard.context.bind("mode", held)).slurp(aperture);
    call = (path, input) => steer.dispatch.invoke(bound, path, steer.strategy.direct)({ input });
  });
  afterAll(async () => {
    await rig?.close();
    await Deno.remove(root, { recursive: true }).catch(() => {});
    await Deno.remove(target, { recursive: true }).catch(() => {});
  });

  it("P-manifest: a MOUNTED · APPLICATION · STANDALONE · EXPOSED · TOOLING · HARNESSED · CONVERSATIONAL editor named import; the buffer carries a bin", () => {
    expect(mode.manifest.type).toBe("editor");
    expect(mode.manifest.slug).toBe("import");
    expect([...mode.manifest.traits].sort()).toEqual(["APPLICATION", "CONVERSATIONAL", "EXPOSED", "HARNESSED", "MOUNTED", "STANDALONE", "TOOLING"]);
    expect(mode.application.fill({})).toEqual({});
    expect(typeof mode.harness).toBe("object");
    expect(intakeOf("DRONEAID_model_latest.blend")).toBe("intake/DRONEAID_model_latest");
  });

  it("P-scan-load: the mountpoint reports its intakes; load fills the bin's objects and resets the walk", async () => {
    const seen = await call("/scan", {});
    expect(seen.intakes.map((held) => held.intake)).toEqual(["intake/model"]);
    expect(seen.intakes[0].objects).toBe(30);
    expect(seen.blends).toEqual([]);
    expect(typeof seen.blender === "string" || seen.blender === null).toBe(true);
    const { bin, counts: held } = await call("/load", { buffer: buffer.id, intake: "intake/model" });
    expect(bin.source).toBe("DRONEAID_model_latest.blend");
    expect(bin.scale).toBe(0.05);
    expect(bin.objects.length).toBe(30);
    expect(held).toEqual({ intake: 30, interpret: 0, annotate: 0, embed: 0 });
    await expect(call("/load", { buffer: buffer.id, intake: "intake/nothing" })).rejects.toThrow(/no blend.json/);
    await expect(call("/load", { buffer: "nope", intake: "intake/model" })).rejects.toThrow(/no buffer/);
  });

  it("P-walk: interpret → unmerge the boards → drop the computer → annotate all → the buffer holds it", async () => {
    let held = await call("/interpret", { buffer: buffer.id });
    expect(held.counts).toEqual({ intake: 0, interpret: 18, annotate: 0, embed: 0 });
    held = await call("/unmerge", { buffer: buffer.id, id: "FlightController00", objects: ["FlightController01"] });
    expect(held.counts.interpret).toBe(19);
    await expect(call("/drop", { buffer: buffer.id, ids: ["Computer"] })).rejects.toThrow();
    held = await call("/drop", { buffer: buffer.id, ids: ["Computer"], dropped: true });
    expect(held.counts.interpret).toBe(18);
    held = await call("/annotate", { buffer: buffer.id });
    expect(held.counts).toEqual({ intake: 0, interpret: 0, annotate: 18, embed: 0 });
    held = await call("/annotate", { buffer: buffer.id, id: "FlightController00", annotation: { slug: "esc", name: "Electronic speed controller", symbols: ["material.electronics"], qty: 1 } });
    expect(held.bin.annotations.FlightController00.slug).toBe("esc");
    held = await call("/annotate", { buffer: buffer.id, id: "FlightController01", annotation: { slug: "fc", name: "Flight controller", symbols: ["material.electronics"], qty: 1 } });
    held = await call("/annotate", { buffer: buffer.id, id: "Motor_Arm3", annotation: { slug: "arm", name: "Motor arm", symbols: ["material.carbon"], qty: 4 } });
    rig.em.clear();
    const row = await rig.entities.buffer.findOne({ id: buffer.id }, { filters: { user: false } });
    expect(row.data.bin.members.length).toBe(19);
    expect(row.data.bin.annotations.Motor_Arm3.slug).toBe("arm");
  });

  it("P-moves: dissolve is interpret's inverse and forget is annotate's, each scoped by ids; interpret takes only the objects named; a harvest without a scale is refused", async () => {
    let held = await call("/dissolve", { buffer: buffer.id, ids: ["Motor_Arm3"] });
    expect(held.counts).toEqual({ intake: 4, interpret: 0, annotate: 17, embed: 0 });
    expect(held.bin.annotations.Motor_Arm3).toBeUndefined();
    held = await call("/interpret", { buffer: buffer.id, objects: ["Motor_Arm1"] });
    expect(held.counts).toEqual({ intake: 3, interpret: 1, annotate: 17, embed: 0 });
    expect(held.bin.members.find((member) => member.id === "Motor_Arm1").objects).toEqual(["Motor_Arm1"]);
    held = await call("/dissolve", { buffer: buffer.id, ids: ["Motor_Arm1"] });
    held = await call("/interpret", { buffer: buffer.id, objects: ["Motor_Arm0", "Motor_Arm1", "Motor_Arm2", "Motor_Arm3"] });
    expect(held.counts).toEqual({ intake: 0, interpret: 1, annotate: 17, embed: 0 });
    const arm = held.bin.members.find((member) => member.objects.includes("Motor_Arm3"));
    expect(arm.objects.length).toBe(4);
    held = await call("/annotate", { buffer: buffer.id, ids: [arm.id] });
    expect(held.counts.annotate).toBe(18);
    held = await call("/forget", { buffer: buffer.id, ids: [arm.id] });
    expect(held.counts).toEqual({ intake: 0, interpret: 1, annotate: 17, embed: 0 });
    held = await call("/annotate", { buffer: buffer.id, id: arm.id, annotation: { slug: "arm", name: "Motor arm", symbols: ["material.carbon"], qty: 4 } });
    expect(held.counts.annotate).toBe(18);
    await expect(call("/dissolve", { buffer: buffer.id, ids: ["nope"] })).rejects.toThrow(/no member/);
    await expect(call("/harvest", { buffer: buffer.id, file: "model.blend" })).rejects.toThrow();
  });

  it("P-embed: every annotated member mints a component under the import mode with its GLB on the mountpoint; the assembly places every instance; the daemon lists them", async () => {
    await call("/assembly", { buffer: buffer.id, slug: "pt10", name: "PT10 V3", target });
    const { bin, counts: held } = await call("/embed", { buffer: buffer.id });
    expect(held).toEqual({ intake: 0, interpret: 0, annotate: 0, embed: 18 });
    expect(Object.values(bin.embedded).find((held) => held.slug === "arm")).toEqual({ slug: "arm", ontology: "component", file: "parts/arm.glb" });
    expect((await Deno.stat(join(root, "parts/arm.glb"))).isFile).toBe(true);
    const arm = await rig.literal.owned("arm", importer.id);
    expect(arm.trait.SOURCED).toMatchObject({ file: "DRONEAID_model_latest.blend", scale: 0.05 });
    expect(arm.trait.SOURCED.object).toMatch(/^Motor_Arm\d$/);
    expect(arm.trait.MODELED).toEqual({ file: "parts/arm.glb", tris: 80, bbox: [0.04134, 0.0075, 0.20863] });
    expect(arm.trait.COUNTED.qty).toBe(4);
    expect(arm.symbols.getItems().map((symbol) => symbol.slug).sort()).toEqual(["component", "material.carbon"]);
    const esc = await rig.literal.owned("esc", importer.id);
    expect(esc.trait.MODELED.file).toBe("parts/esc.glb");
    const tree = await rig.call("/resolve", { slug: "pt10", owner: importer.id });
    expect(tree.nodes.length).toBe(30 - 1);
    expect(tree.nodes.filter((node) => node.component === "arm").map((node) => node.path)).toEqual(["arm.0", "arm.1", "arm.2", "arm.3"]);
    expect(tree.nodes.find((node) => node.path === "arm.2").translation).toEqual([-0.0887, 0.00214, 0.08234]);
    expect(tree.missing).toEqual([]);
    const bom = await rig.call("/bom", { slug: "pt10", owner: importer.id });
    expect(bom.arm).toBe(4);
    expect(bom.computer).toBeUndefined();
    const cards = await rig.call("/literals", { owner: importer.id });
    expect(cards.length).toBe(19);
    expect(cards.find((card) => card.slug === "pt10")).toMatchObject({ ontology: "assembly", nodes: 29, owner: importer.id });
    // again is idempotent: nothing to mint, the same rows
    const again = await call("/embed", { buffer: buffer.id });
    expect(again.counts.embed).toBe(18);
    expect((await rig.call("/literals", { owner: importer.id })).length).toBe(19);
    // a minted member has no way back: neither dissolve nor forget nor drop takes it
    const minted = Object.keys(again.bin.embedded)[0];
    await expect(call("/dissolve", { buffer: buffer.id, ids: [minted] })).rejects.toThrow(/no way back/);
    await expect(call("/forget", { buffer: buffer.id, ids: [minted] })).rejects.toThrow(/no way back/);
    await expect(call("/drop", { buffer: buffer.id, ids: [minted], dropped: true })).rejects.toThrow(/no way back/);
  });

  it("P-write: the rows land in the target as dataset/literals/pt10.json with their GLBs under freight/parts", async () => {
    const written = await call("/write", { buffer: buffer.id });
    expect(written.rows).toBe(19);
    expect(written.files.length).toBe(18);
    const rows = JSON.parse(await Deno.readTextFile(join(target, "dataset/literals/pt10.json")));
    expect(rows.length).toBe(19);
    const arm = rows.find((row) => row.slug === "arm");
    expect(arm.traits).toEqual(["LABELED", "SOURCED", "MODELED", "COUNTED"]);
    expect(arm.symbols).toEqual([{ slug: "component" }, { slug: "material.carbon" }]);
    const pt10 = rows.find((row) => row.slug === "pt10");
    expect(pt10.trait.COMPOSED.nodes.length).toBe(29);
    expect(pt10.uses.map((held) => held.slug).sort()).toEqual([...new Set(rows.filter((row) => row.slug !== "pt10").map((row) => row.slug))].sort());
    expect((await Deno.stat(join(target, "freight/parts/arm.glb"))).isFile).toBe(true);
  });

  it("P-upload: the door refuses no body, a file that is not a .blend, and a missing scale — before anything touches the disk", async () => {
    const ctx = (request) => ({ input: {}, request });
    const stream = () => new Blob(["not really a blend"]).stream();
    const drain = async (request) => {
      const held = await steer.dispatch.invoke(bound, "/upload", steer.strategy.direct)(ctx(request));
      for await (const _ of held) void _;
    };
    await expect(drain({ raw: {}, url: new URL(`http://x/upload?buffer=${buffer.id}&scale=0.05`), headers: new Map() })).rejects.toThrow(/no file/);
    await expect(drain({ raw: { body: stream() }, url: new URL(`http://x/upload?buffer=${buffer.id}&scale=0.05`), headers: new Map([["x-viva-name", "notes.txt"]]) })).rejects.toThrow(/\.blend/);
    await expect(drain({ raw: { body: stream() }, url: new URL(`http://x/upload?buffer=${buffer.id}`), headers: new Map([["x-viva-name", "model.blend"]]) })).rejects.toThrow(/scale/);
    expect(await Deno.stat(join(root, "model.blend")).catch(() => null)).toBeNull();
    expect(await Deno.stat(join(root, "notes.txt")).catch(() => null)).toBeNull();
  });

  it("P-clear: a second buffer loads the intake and clears to nothing — no file, no objects, no members", async () => {
    const other = await rig.entities.buffer.create({ mode: importer.id, data: {} });
    await rig.em.flush();
    let held = await call("/load", { buffer: other.id, intake: "intake/model" });
    expect(held.counts.intake).toBe(30);
    held = await call("/clear", { buffer: other.id });
    expect(held.bin).toEqual({ objects: [], members: [], annotations: {}, embedded: {} });
    expect(held.counts).toEqual({ intake: 0, interpret: 0, annotate: 0, embed: 0 });
  });
});

describe("blender on this host", () => {
  it("P-blender: says where it is or that it is not; a harvest is a live measurement, not a suite step", () => {
    const found = blender();
    console.log(`[import] blender: ${found ?? "none"}`);
    expect(found === null || found.length > 0).toBe(true);
  });
});
