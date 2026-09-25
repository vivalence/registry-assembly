import { join } from "@std/path";
import { contexts, shard, specimen, steer, Vector } from "@vivalence/typology";
import { mount } from "../../../../tests/rig.js";
import { aperture } from "../aperture/index.js";
import { extensionOf, formatOf, magic, sniff } from "../sniff.js";
import { commit } from "../commit.js";
import { copies, count, extent, fingerprint, fold, humanize, named, preview, scaled, slugify, stem } from "../fold.js";
import { blender, freecad, intakeOf, stemOf } from "../decode.js";
import { EXTENSIONS, FORMATS, STAGES } from "../schematics.js";
import * as mode from "../import.viva.js";

const { describe, it, expect, beforeAll, afterAll } = specimen;

const HARVEST = new URL("./fixtures/harvest/", import.meta.url).pathname;
const harvested = () => JSON.parse(Deno.readTextFileSync(join(HARVEST, "blend.json")));
const objects = () => harvested().parts;
const bytes = (text) => new TextEncoder().encode(text);

describe("sniff — magic bytes first, the extension when there are none", () => {
  it("P-magic: every format the drop zone lists has a signature, and a signature beats the extension", () => {
    expect(magic(bytes("BLENDER-v502RENDH"))).toBe("blend");
    expect(magic(bytes("glTF\u0002\u0000\u0000\u0000"))).toBe("glb");
    expect(magic(bytes("Kaydara FBX Binary  \u0000"))).toBe("fbx");
    expect(magic(bytes("; FBX 7.4.0 project file"))).toBe("fbx");
    expect(magic(bytes("PXR-USDC\u0000"))).toBe("usdc");
    expect(magic(bytes("#usda 1.0\n"))).toBe("usd");
    expect(magic(bytes("ISO-10303-21;\nHEADER;"))).toBe("step");
    expect(magic(new Uint8Array([0x4d, 0x4d, 0x10, 0x00]))).toBe("3ds");
    expect(magic(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe("usdz");
    expect(magic(bytes(`${"probe".padEnd(72)}S      1\n`))).toBe("iges");
    expect(magic(bytes("solid probe\n facet normal 0 0 1"))).toBe("stl");
    const binary = new Uint8Array(84 + 50 * 2);
    new DataView(binary.buffer).setUint32(80, 2, true);
    expect(magic(binary)).toBe("stl");
    expect(magic(bytes('{ "asset": { "version": "2.0" } }'))).toBe("gltf");
    expect(magic(bytes("# blender\nmtllib probe.mtl\no housing\nv 0 0 0"))).toBe("obj");
    expect(magic(bytes("hello world"))).toBe(null);
    expect(EXTENSIONS).toContain("stp");
    expect(EXTENSIONS).toContain("igs");
    expect(EXTENSIONS).toContain("usda");
  });

  it("P-sniff: bytes win over the name; a nameless text file with a known extension is trusted; nothing known refuses", () => {
    expect(sniff(bytes("BLENDER-v502"), "model.blend")).toMatchObject({ format: "blend", claimed: "blend", found: "blend", matched: true });
    expect(sniff(bytes("BLENDER-v502"), "model.obj")).toMatchObject({ format: "blend", claimed: "obj", found: "blend", matched: false });
    expect(sniff(bytes("v 0 0 0\nv 1 0 0\nf 1 2 3"), "part.obj")).toMatchObject({ format: "obj", matched: true });
    expect(sniff(bytes("\u0000\u0001\u0002"), "part.stl")).toMatchObject({ format: "stl", found: null, matched: false });
    expect(sniff(bytes("plain"), "notes.txt")).toMatchObject({ format: null, claimed: null, found: null, matched: false });
    expect(extensionOf("a.b.STEP")).toBe("step");
    expect(extensionOf("noext")).toBe("");
    expect(formatOf("igs")).toBe("iges");
    expect(formatOf("usda")).toBe("usd");
    expect(formatOf("txt")).toBe(null);
  });
});

describe("commit — objects fold to parts, parts take names", () => {
  it("P-stem: trailing digits, .NN and (xN) come off; a stem never ends in a separator", () => {
    expect(stem("Motor_Arm0")).toBe("Motor_Arm");
    expect(stem("Antenna.02")).toBe("Antenna");
    expect(stem("FrameSpacers.00 (x4)")).toBe("FrameSpacers");
    expect(stem("Camera")).toBe("Camera");
    expect(copies("FrameSpacers.00 (x4)")).toBe(4);
    expect(copies("Motor0")).toBe(null);
    expect(fingerprint({ object: "Motor_Arm0", tris: 80, bbox: [0.04134, 0.0075, 0.20863] })).toBe("Motor_Arm|80|0.041,0.008,0.209");
  });

  it("P-fold: the droneaid harvest folds to 18 parts; arms and motors to one each with four placements; a mirrored instance never gives the file", () => {
    const parts = fold(objects());
    const byId = Object.fromEntries(parts.map((part) => [part.id, part]));
    expect(parts.length).toBe(18);
    expect(byId.Motor_Arm3.objects).toEqual(["Motor_Arm1", "Motor_Arm2", "Motor_Arm0", "Motor_Arm3"]);
    expect(byId.Motor_Arm3.file).toBe("Motor_Arm3.glb");
    expect(byId.Motor_Arm3.placements.length).toBe(4);
    expect(byId.Motor_Arm3.placements[0].mirrored).toEqual(["x", "y"]);
    expect(byId.Motor0.objects).toEqual(["Motor0", "Motor1", "Motor2", "Motor3"]);
    expect(byId["FrameSpacers.00 (x4)"].copies).toBe(4);
    expect(count(byId["FrameSpacers.00 (x4)"])).toBe(4);
    expect(count(byId.Motor0)).toBe(4);
    expect(byId.FlightController00.objects).toEqual(["FlightController00", "FlightController01"]);
    expect(fold(objects(), "name").length).toBe(14);
    expect(fold(objects(), "none").length).toBe(30);
  });

  it("P-preview: the review's numbers are pure over the reading — extent scales with the unit, the fold rule counts parts, groups follow collections", () => {
    const reading = { objects: objects(), declared: { unit: 1, up: "Z" } };
    const at1 = preview(reading, { unit: 1, up: "Z", fold: "fingerprint", groups: true, hidden: false });
    expect(at1).toMatchObject({ objects: 30, components: 18, nodes: 30, groups: 6 });
    const at20 = preview(reading, { unit: 20, up: "Z", fold: "none", groups: false, hidden: false });
    expect(at20.components).toBe(30);
    expect(at20.groups).toBe(0);
    expect(at20.extent.map((value, axis) => value / at1.extent[axis]).every((ratio) => Math.abs(ratio - 20) < 1e-6)).toBe(true);
    expect(extent(scaled([{ bbox: [2, 2, 2], translation: [0, 0, 0] }, { bbox: [2, 2, 2], translation: [10, 0, 0] }], 0.5))).toEqual([6, 1, 1]);
  });

  it("P-named: snake_case slugs from the stem, unique by suffix; a name for eyes; never a word the file did not carry", () => {
    expect(slugify("Motor_Arm0")).toBe("motor_arm");
    expect(slugify("FrameSpacers.00 (x4)")).toBe("frame_spacers");
    expect(slugify("CamHolder1")).toBe("cam_holder");
    expect(slugify("007")).toBe("007");
    expect(humanize("Motor_Arm0")).toBe("Motor Arm");
    expect(humanize("FlightController00")).toBe("Flight Controller");
    const parts = named([{ id: "Arm0", objects: [], file: "", placements: [] }, { id: "Arm.1", objects: [], file: "", placements: [] }, { id: "arm", objects: [], file: "", placements: [] }]);
    expect(parts.map((part) => part.slug)).toEqual(["arm", "arm_2", "arm_3"]);
    expect(stemOf("DRONEAID_model_latest.blend")).toBe("DRONEAID_model_latest");
    expect(intakeOf("my model (v2).blend")).toBe("intake/my_model_v2_");
  });
});

describe("the importer over the assembly rig", () => {
  let rig;
  let root;
  let importer;
  let bound;
  let call;
  let ctx;

  beforeAll(async () => {
    rig = await mount();
    root = await Deno.makeTempDir({ prefix: "import-mount-" });
    await Deno.mkdir(join(root, "intake/model"), { recursive: true });
    for await (const entry of Deno.readDir(HARVEST)) if (entry.isFile) await Deno.copyFile(join(HARVEST, entry.name), join(root, "intake/model", entry.name));
    importer = rig.entities.mode.create({ type: "editor", slug: "import", name: "Import", traits: [], installed: "", version: "0.1.0" });
    await rig.em.flush();
    const held = { id: importer.id, entity: importer, mountpoint: { absolute: root }, freight: null };
    bound = new Vector().use(shard.context.spread(contexts.host, rig.daemon)).use(shard.context.bind("mode", held)).graft(aperture);
    call = (path, input, request) => steer.dispatch.invoke(bound, path, steer.strategy.direct)({ input: input ?? {}, ...(request && { request }) });
    ctx = { ...shard.context.lift(contexts.host, rig.daemon), mode: held, user: null, thread: null };
  });
  afterAll(async () => {
    await rig?.close();
    await Deno.remove(root, { recursive: true }).catch(() => {});
  });

  it("P-manifest: a FILESINK · VIEWABLE · EXPOSED editor named import; the buffer carries the queue; four natures", () => {
    expect(mode.manifest.type).toBe("editor");
    expect(mode.manifest.slug).toBe("import");
    expect([...mode.manifest.traits].sort()).toEqual(["EXPOSED", "FILESINK", "VIEWABLE"]);
    expect(mode.buffer.fill({ data: {} }).data).toEqual({});
    expect(STAGES).toEqual(["sniff", "validate", "decode", "review", "commit"]);
    expect(Object.keys(FORMATS).length).toBe(12);
  });

  it("P-tree-empty: no slugs reads nothing, whatever the domain holds; a missing list is refused", async () => {
    expect(await call("/tree", { slugs: [] })).toEqual({ rows: [], counts: { part: 0, placement: 0, step: 0, guide: 0 }, parts: [] });
    await expect(call("/tree", {})).rejects.toThrow(/slugs/);
  });

  it("P-commit: the fixture harvest mints 18 parts with their GLBs, the file and its six collections as parts too, and 36 placements under the import mode", async () => {
    const read = { ...harvested(), unit: 0.05, intake: "intake/model", objects: objects() };
    const said = [];
    const minted = await commit(ctx, read, { into: "DRONEAID model latest", unit: 0.05, up: "Z", fold: "fingerprint", groups: true, hidden: false }, (lvl, msg) => said.push(`${lvl} ${msg}`));
    expect(minted.model).toBe("droneaid_model_latest");
    expect(minted.parts.length).toBe(25);
    expect(minted.parts).toContain("motor_arm");
    expect(minted.parts).toContain("drone");
    expect(minted.placed).toBe(36);
    expect(minted.placements.length).toBe(36);
    expect(minted.collections).toBe(6);
    expect(said[0]).toMatch(/^ONTO 30 object\(s\) read as 18 part\(s\) — fold by fingerprint/);
    expect((await Deno.stat(join(root, "parts/motor_arm.glb"))).isFile).toBe(true);

    const arm = await rig.literal.findOne({ slug: "motor_arm", mode: importer.id });
    expect(arm.ontology).toBe("part");
    expect(arm.trait.SOURCED).toMatchObject({ file: "DRONEAID_model_latest.blend", scale: 0.05 });
    expect(arm.trait.SOURCED.object).toMatch(/^Motor_Arm\d$/);
    expect(arm.trait.MODELED.file).toBe("parts/motor_arm.glb");
    expect(arm.trait.COUNTED.qty).toBe(4);

    // a collection is a part of its own, placed in the part above it — no group anywhere
    const drone = await rig.literal.findOne({ slug: "drone", mode: importer.id });
    expect(drone.ontology).toBe("part");
    expect(drone.trait.MODELED).toBeUndefined();
    const into = await rig.literal.findOne({ slug: "droneaid_model_latest.drone", mode: importer.id });
    expect(into.ontology).toBe("placement");
    expect(into.trait.PLACED).toMatchObject({ layer: "droneaid_model_latest", name: "drone", ref: "drone" });

    const placed = await rig.literal.findOne({ slug: "drone.motor_arm.0", mode: importer.id });
    expect(placed.trait.PLACED).toMatchObject({ layer: "drone", ref: "motor_arm" });
    expect(placed.trait.PLACED.translation.length).toBe(3);

    const model = await rig.literal.findOne({ slug: "droneaid_model_latest", mode: importer.id });
    const tree = await rig.literal.resolve(model);
    expect(tree.placements.length).toBe(36);
    expect(tree.placements.filter((one) => one.path.startsWith("drone/")).length).toBe(10);
    expect(tree.placements.find((one) => one.path === "motor_2/propeller.0").ref).toBe("propeller");

    // a second import of the same file is its OWN: nothing already in the mode is written into
    const again = await commit(ctx, read, { into: "DRONEAID model latest", unit: 0.05, up: "Z", fold: "fingerprint", groups: true, hidden: false }, () => {});
    expect(again.model).toBe("droneaid_model_latest_2");
    expect(again.parts).toContain("motor_arm_2");
    expect(again.parts.some((slug) => minted.parts.includes(slug))).toBe(false);
    expect((await rig.literal.findOne({ slug: "motor_arm", mode: importer.id })).trait.MODELED.file).toBe("parts/motor_arm.glb");
    await rig.literal.retract([...again.placements, ...again.parts], { id: importer.id });
  });

  it("P-tree: only the slugs named — a part nothing places sits at the root, its placements under it, a placed part's interior under that; another buffer's rows never walk in", async () => {
    const alone = await call("/tree", { slugs: ["motor_arm"] });
    expect(alone.counts).toEqual({ part: 1, placement: 0, step: 0, guide: 0 });
    expect(alone.rows[0]).toMatchObject({ key: "motor_arm", depth: 0, ontology: "part", tail: "qty 4" });

    const tree = await call("/tree", { slugs: ["droneaid_model_latest"] });
    expect(tree.counts).toEqual({ part: 25, placement: 36, step: 0, guide: 0 });
    expect(tree.rows[0]).toMatchObject({ key: "droneaid_model_latest", depth: 0, ontology: "part", tail: "6 placements" });
    expect(tree.rows[0].scene.length).toBe(36);

    const drone = tree.rows.find((row) => row.key === "droneaid_model_latest/droneaid_model_latest.drone");
    expect(drone).toMatchObject({ depth: 1, ontology: "placement", ref: "drone", layer: "droneaid_model_latest", tail: "10 placements" });
    expect(drone.scene.length).toBe(10);

    const arm = tree.rows.find((row) => row.slug === "drone.motor_arm.0");
    expect(arm).toMatchObject({ depth: 2, ontology: "placement", ref: "motor_arm", tail: "← motor_arm" });
    expect(tree.rows.indexOf(arm)).toBeGreaterThan(tree.rows.indexOf(drone));
    expect(arm.traits).toEqual(["LABELED", "PLACED"]);
    expect(arm.symbols).toEqual([]);
    expect(tree.rows.filter((row) => row.depth === 1).length).toBe(6);
    expect(tree.rows.filter((row) => row.ontology === "placement").length).toBe(36);
    expect(tree.parts.length).toBe(25);
    const kit = Object.fromEntries(tree.parts.map((row) => [row.slug, row]));
    expect(kit.motor_arm).toMatchObject({ ontology: "part", name: "Motor Arm", tail: "qty 4", depth: 0 });
    expect(kit.motor_arm.modeled.file).toBe("parts/motor_arm.glb");
    expect(kit.drone).toMatchObject({ tail: "10 placements" });
    expect(kit.drone.modeled).toBeUndefined();
    expect(kit.drone.scene.length).toBe(10);
  });

  it("P-revert: a commit taken back leaves no row and no geometry file, and is refused while something not named still references it", async () => {
    const caller = { mode: { id: importer.id } };
    const slugs = (await rig.literal.find({ mode: importer.id })).map((row) => row.slug).filter((slug) => !slug.startsWith("outsider"));
    await rig.daemon.call["/part"]({ ...caller, input: { slug: "outsider", name: "Outsider" } });
    await rig.daemon.call["/placement"]({ ...caller, input: { layer: "outsider", name: "motor_arm.0", ref: "motor_arm" } });
    await expect(call("/revert", { slugs })).rejects.toThrow(/still references motor_arm/);
    await rig.daemon.call["/retract"]({ ...caller, input: { slugs: ["outsider.motor_arm.0", "outsider"] } });
    const gone = await call("/revert", { slugs });
    expect(gone.retracted).toContain("droneaid_model_latest");
    expect(gone.retracted).toContain("motor_arm");
    expect(gone.files).toContain("parts/motor_arm.glb");
    expect(await rig.literal.findOne({ slug: "motor_arm", mode: importer.id })).toBe(null);
    expect(await Deno.stat(join(root, "parts/motor_arm.glb")).catch(() => null)).toBe(null);
    expect((await call("/tree", { slugs })).rows).toEqual([]);
  });

  it("P-parse-refusals: no body and no name throw before anything lands; an unknown format streams one FAIL line and touches no disk", async () => {
    const stream = (text) => new Blob([text]).stream();
    const request = (body, name, query = "") => ({ raw: body ? { body } : {}, url: new URL(`http://x/parse${query}`), headers: new Map(name ? [["x-viva-name", name]] : []) });
    const drain = async (held) => {
      const lines = [];
      for await (const line of await call("/parse", {}, held)) lines.push(line);
      return lines;
    };
    await expect(drain(request(null, "model.blend"))).rejects.toThrow(/no file/);
    await expect(drain(request(stream("x"), null))).rejects.toThrow(/no file name/);
    const lines = await drain(request(stream("hello"), "notes.txt"));
    expect(lines.length).toBe(1);
    expect(lines[0]).toMatchObject({ stage: "sniff", lvl: "FAIL", done: true, failed: true, progress: 0 });
    expect(lines[0].msg).toMatch(/not a format the importer reads/);
    expect(lines[0].t).toMatch(/^\d\d:\d\d\.\d\d$/);
    await expect(Deno.stat(join(root, "intake/notes"))).rejects.toThrow();
  });

  it("P-commit-refusals: a commit takes every setting made and a file already on the intake; nothing is assumed", async () => {
    const drain = async (input) => {
      const lines = [];
      for await (const line of await call("/commit", input)) lines.push(line);
      return lines;
    };
    const made = { into: "Model", unit: 0.05, up: "Z", fold: "fingerprint", groups: true, hidden: false };
    await expect(drain({ name: "model.blend" })).rejects.toThrow(/settings\.into is missing/);
    await expect(drain({ name: "model.blend", settings: { ...made, hidden: undefined } })).rejects.toThrow(/settings\.hidden is missing/);
    await expect(drain({ name: "model.blend", settings: { ...made, unit: -1 } })).rejects.toThrow(/positive/);
    await expect(drain({ name: "model.blend", settings: { ...made, into: "   " } })).rejects.toThrow(/cannot be blank/);
    const lines = await drain({ name: "nothing.blend", settings: made });
    expect(lines.at(-1)).toMatchObject({ stage: "validate", lvl: "FAIL", done: true, failed: true });
    expect(lines.at(-1).msg).toMatch(/parse it first/);
  });

  it("P-hosts: blender and FreeCAD are found or not; a decode is a live measurement, not a suite step", () => {
    expect(typeof blender() === "string" || blender() === null).toBe(true);
    expect(typeof freecad() === "string" || freecad() === null).toBe(true);
  });
});
