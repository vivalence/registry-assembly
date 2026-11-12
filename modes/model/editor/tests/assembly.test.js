import { shape, contexts, shard, specimen, steer, Vector } from "@vivalence/typology";
import { sets } from "@vivalence/runtime";
import { mount } from "../../../../tests/rig.js";
import { renderView } from "../../../../tests/render.js";
import { aperture, vocabulary } from "../aperture/index.js";
import { harness, ontology, screen, vocabulary as spoken } from "../harness.js";
import { tools } from "../tools/index.js";
import { IDENTITY, at, exampleOf, fields, into, payload, read, show, values } from "../buffer/form.js";
import { IDENTITY as ORIGIN, chain, free, frames, opening, parent, rooted, visible } from "../buffer/fold.js";
import { lines, parse } from "../buffer/cli.js";
import * as mode from "../editor.viva.js";

const { describe, it, expect, beforeAll, afterAll } = specimen;

const VIEW = new URL("../buffer/Assembly.svelte", import.meta.url).pathname;

describe("the form — drawn from the domain's schematic, pure", () => {
  it("P-fields: one field per key of the verb's schema, its kind from the JSON schema, its example from the description", () => {
    const schema = {
      type: "object",
      required: ["slug"],
      properties: {
        slug: { type: "string", description: 'A slug. Example: "frame"' },
        qty: { type: "integer", description: "How many. Example: 6" },
        active: { type: "boolean", description: "Example: false" },
        torque: { type: "string", enum: ["loose", "snug", "tight"], description: 'Example: "loose"' },
        translation: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3, description: "Metres. Example: [0, 0.02, 0]" },
        text: { type: "array", items: { type: "string" }, description: 'Lines. Example: ["a"]' },
        parametric: { type: "object", description: "Example: { generator: \"fastener.bolt\" }" },
      },
    };
    expect(fields(schema).map((field) => [field.key, field.kind, field.required])).toEqual([
      ["slug", "text", true], ["qty", "number", false], ["active", "flag", false], ["torque", "enum", false], ["translation", "vector", false], ["text", "lines", false], ["parametric", "json", false],
    ]);
    expect(fields(schema)[4].length).toBe(3);
    expect(fields(schema)[3].options).toEqual(["loose", "snug", "tight"]);
    expect(exampleOf('Metres. Example: [0, 0.02, 0]')).toBe("[0, 0.02, 0]");
    expect(fields(schema)[1].description).toBe("How many.");
  });

  it("P-values-payload: a card's traits become the verb's values; the payload carries the identity and only what changed; an emptied field is not sent", () => {
    const card = { slug: "arm", ontology: "part", symbols: ["material.carbon"], trait: { LABELED: { name: "Arm" }, MODELED: { file: "parts/arm.glb" }, COUNTED: { qty: 4 }, SEQUENCED: { steps: [] } } };
    const was = values("part", card);
    expect(was).toEqual({ slug: "arm", name: "Arm", description: "", sourced: null, modeled: { file: "parts/arm.glb" }, parametric: null, qty: 4, symbols: ["material.carbon"] });
    expect(payload("part", { ...was, qty: 5, description: "" }, was)).toEqual({ slug: "arm", qty: 5 });
    expect(payload("part", { ...was, symbols: ["material.carbon", "source.vendor_cad"] }, was)).toEqual({ slug: "arm", symbols: ["material.carbon", "source.vendor_cad"] });
    expect(payload("part", was, was)).toEqual({ slug: "arm" });
    const placed = { slug: "frame.arm.0", ontology: "placement", symbols: [], trait: { LABELED: { name: "arm.0" }, PLACED: { layer: "frame", name: "arm.0", ref: "arm", translation: [0.1, 0, 0] }, JOINED: { joins: ["plate"] } } };
    const held = values("placement", placed);
    expect(IDENTITY.placement).toEqual(["layer", "parent", "name", "ref"]);
    expect("torque" in held).toBe(false);
    expect(payload("placement", { ...held, translation: [0.2, 0, 0], joins: ["plate", "arm.1"] }, held)).toEqual({ layer: "frame", name: "arm.0", ref: "arm", translation: [0.2, 0, 0], joins: ["plate", "arm.1"] });
    expect(values("guide", { slug: "build", ontology: "guide", symbols: [], trait: { LABELED: { name: "Build" }, SEQUENCED: { sections: [] } } })).toEqual({ slug: "build", name: "Build", description: "", symbols: [] });
    expect(show("vector", [0.1, 0, 0])).toBe("0.1, 0, 0");
    expect(read("vector", "0.2, 0, 0", 3)).toEqual([0.2, 0, 0]);
    expect(() => read("vector", "1 2", 3)).toThrow(/3 numbers/);
    expect(read("lines", "a\n\nb ")).toEqual(["a", "b"]);
    expect(read("json", '{"thread":"M3"}')).toEqual({ thread: "M3" });
    expect(read("number", "6")).toBe(6);
    expect(read("text", "  ")).toBe(null);
  });
});

describe("the editor over the assembly rig", { sanitizeResources: false, sanitizeOps: false }, () => {
  let rig;
  let editor;
  let held;
  let call;
  let armed;
  let thread;

  beforeAll(async () => {
    rig = await mount();
    editor = rig.entities.mode.create({ type: "model", slug: "editor", name: "Model editor", traits: [], installed: "", version: "0.1.0" });
    const user = rig.user;
    await rig.em.flush();
    rig.em.setFilterParams("user", { user: user.id });
    thread = rig.em.create(sets.userspace.thread.entity, { user: user.id, mode: editor.id, phase: "manual", traits: [], trait: {} });
    await rig.em.flush();
    held = { id: editor.id, entity: editor, mountpoint: null, freight: null };
    const bound = new Vector().use(shard.context.spread(contexts.daemonDie, rig.daemon)).use(shard.context.bind("mode", held)).graft(aperture);
    call = (path, input) => steer.dispatch.invoke(bound, path, steer.strategy.direct)({ input: input ?? {} });
    const hands = new Vector().use(shard.context.spread(contexts.daemonDie, rig.daemon)).use(shard.context.bind("mode", held)).use(shard.context.bind("thread", thread)).graft(tools);
    armed = (path, input) => steer.dispatch.invoke(hands, path, steer.strategy.direct)({ input: input ?? {} });
  });
  afterAll(async () => rig?.close());

  it("P-manifest: an VIEWABLE · EXPOSED · HARNESSED · TOOLING · CONVERSATIONAL model named editor; a buffer that opens nothing", () => {
    expect(mode.manifest.type).toBe("model");
    expect(mode.manifest.slug).toBe("editor");
    expect([...mode.manifest.traits].sort()).toEqual(["CONVERSATIONAL", "EXPOSED", "HARNESSED", "TOOLING", "VIEWABLE"]);
    expect(mode.buffer.fill({ data: {} }).data).toEqual({});
    expect(Object.keys(mode)).toEqual(expect.arrayContaining(["aperture", "harness", "tools", "manifest", "buffer", "views"]));
  });

  it("P-schematics: the domain's shapes come over the wire as JSON schema — every ontology, every trait, every verb", async () => {
    const shapes = await call("/schematics");
    expect(Object.keys(shapes.ONTOLOGIES)).toEqual(["part", "placement", "step", "guide"]);
    expect(shapes.ONTOLOGIES.part.traits).toEqual(["LABELED", "SOURCED", "MODELED", "PARAMETRIC", "COUNTED"]);
    expect(Object.keys(shapes.TRAITS).sort()).toEqual(["ANNOTATED", "ASSEMBLED", "COUNTED", "INSTRUCTED", "JOINED", "LABELED", "MODELED", "PARAMETRIC", "PLACED", "PREPARED", "SEQUENCED", "SOURCED", "STAGED"]);
    expect(Object.keys(shapes.VERBS).sort()).toEqual(["duplicate", "fold", "guide", "move", "part", "placement", "rename", "retract", "sequence", "step", "tree"]);
    expect(shapes.VERBS.placement.type).toBe("object");
    expect(fields(shapes.VERBS.placement).map((field) => field.key)).toEqual(["layer", "name", "parent", "ref", "translation", "rotation", "scale", "active", "params", "label", "description", "joins", "symbols"]);
    expect(fields(shapes.VERBS.placement).find((field) => field.key === "translation")).toMatchObject({ kind: "vector", length: 3 });
    expect(JSON.stringify(shapes).length).toBeGreaterThan(1000);
  });

  it("P-vocabulary: the installed symbols by family, the roots left out", async () => {
    const held = await call("/vocabulary");
    expect(Object.keys(held).sort()).toEqual(["joint", "material", "note", "source", "tool", "warn"]);
    expect(held.joint).toContain("joint.bolted");
    expect(Object.values(held).flat()).not.toContain("part");
    expect(vocabulary([{ slug: "part" }, { slug: "b.two" }, { slug: "a.one" }, { slug: "a.zero" }])).toEqual({ a: ["a.one", "a.zero"], b: ["b.two"] });
  });

  it("P-verbs: the screen's verbs ride the domain's — tree · part · placement · move · resolve · closure · retract · geometry; step and sequence are the guide editor's", async () => {
    expect((await call("/tree")).rows).toEqual([]);
    const arm = await call("/part", { slug: "arm", name: "Arm", qty: 4, modeled: { file: "parts/arm.glb" } });
    expect(arm.mode.id).toBe(editor.id);
    await call("/part", { slug: "frame", name: "Frame" });
    await call("/part", { slug: "bolt", name: "Bolt", parametric: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }, qty: 8 });
    const placed = await call("/placement", { layer: "frame", name: "arm.0", ref: "arm", translation: [0.1, 0, 0] });
    expect(placed.slug).toBe("frame.arm.0");
    await call("/placement", { layer: "frame", name: "bolt.0", parent: "arm.0", ref: "bolt", joins: ["arm.0"] });
    const moved = await call("/move", { slug: "frame.arm.0", name: "arm.front" });
    expect(moved.slug).toBe("frame.arm.front");
    const whole = await call("/resolve", { slug: "frame" });
    expect(whole.placements.map((held) => held.path)).toEqual(["arm.front", "arm.front/bolt.0"]);
    expect(whole.joints[0].joins).toEqual(["arm.front"]);
    expect(() => call("/step", { slug: "build.01" })).toThrow(/Not found/);
    expect(() => call("/sequence", { guide: "build", sections: [] })).toThrow(/Not found/);
    // a guide minted by the domain shows in the tree as a root that opens its subject
    await rig.call("/guide", { slug: "build", name: "Build", subject: "frame" });
    await rig.call("/step", { slug: "build.01", name: "Arms on", placements: [{ literal: "frame.arm.front", active: true }] });
    await rig.call("/sequence", { guide: "build", sections: [{ name: "Arms", steps: ["build.01"] }] });
    const tree = await call("/tree");
    expect(tree.rows.filter((row) => row.depth === 0).map((row) => row.slug)).toEqual(["frame", "build"]);
    expect(tree.parts.find((row) => row.slug === "arm")).toMatchObject({ used: 1, mode: "assembly" });
    const geometry = await call("/geometry", { generator: "fastener.bolt", params: { thread: "M3", length: 16 } });
    expect(geometry.object.children.map((child) => child.name)).toEqual(["shaft", "head"]);
    expect((await call("/closure", { slug: "frame" })).map((row) => row.slug).sort()).toEqual(["arm", "bolt", "frame", "frame.arm.front", "frame.arm.front.bolt.0"]);
    await expect(call("/placement", { layer: "frame", name: "x" })).rejects.toThrow(/PLACED/);
  });

  it("P-tools: open puts a part on the screen folded and turns the tree to it — a guide opens its subject; select lights literals, focus frames one — each writes the thread's newest buffer; a placement and a step do not open; an unknown slug is refused", async () => {
    const row = await rig.entities.buffer.create({ mode: editor.id, thread: thread.id, data: {}, bundle: null });
    await rig.em.flush();
    const opened = await armed("/open", { slug: "frame" });
    expect(opened.message).toBe("On the operator's screen: frame · selected nothing.\nframe: 2 placements · 1 joints\n  arm.front ← arm (frame.arm.front)\n  arm.front/bolt.0 ← bolt (frame.arm.front.bolt.0)\n  arm.front/bolt.0 holds arm.front");
    expect(opened.buffer[0].id).toBe(row.id);
    expect(opened.buffer[0].data).toEqual({ subject: "frame", selected: [], scope: "buffer" });
    const chosen = await armed("/select", { slugs: ["frame.arm.front"] });
    expect(chosen.buffer[0].data).toEqual({ subject: "frame", selected: ["frame.arm.front"], scope: "buffer" });
    await expect(armed("/open", { slug: "frame.arm.front" })).rejects.toThrow(/is a placement/);
    await expect(armed("/open", { slug: "build.01" })).rejects.toThrow(/is a step — open it in the guide editor/);
    await expect(armed("/select", { slugs: ["nothing"] })).rejects.toThrow(/no literal named "nothing"/);
    await expect(armed("/open", { slug: "nothing" })).rejects.toThrow(/no literal named "nothing"/);
    const guided = await armed("/open", { slug: "build" });
    expect(guided.buffer[0].data).toMatchObject({ subject: "frame", selected: [] });
    const framed = await armed("/focus", { slug: "frame.arm.front" });
    expect(framed.message.split("\n")[0]).toBe("On the operator's screen: frame · selected frame.arm.front · framed on frame.arm.front.");
    expect(framed.message.split("\n")).toHaveLength(5);
    expect(framed.buffer[0].data).toMatchObject({ subject: "frame", selected: ["frame.arm.front"], focus: "frame.arm.front" });
    const whole = await armed("/focus", { slug: "arm" });
    expect(whole.buffer[0].data).toMatchObject({ subject: "arm", selected: ["arm"], focus: null });
    const stepped = await armed("/focus", { slug: "build" });
    expect(stepped.buffer[0].data).toMatchObject({ subject: "frame", selected: ["build"] });
    await armed("/open", { slug: "frame" });
    await armed("/select", { slugs: ["frame.arm.front"] });
  });

  it("P-harness: the ontology from the schematics, the vocabulary by family, the screen as an index — plainly empty when nothing is open", async () => {
    const shapes = rig.daemon.domain.schematics;
    const said = ontology(shapes);
    expect(said).toContain("part — placements may name it as their layer · LABELED, SOURCED, MODELED, PARAMETRIC, COUNTED");
    expect(said).toContain("guide — never a layer · LABELED, SEQUENCED, INSTRUCTED, ANNOTATED, STAGED");
    expect(said).toContain("\nPLACED — One occurrence of a part");
    expect(said).toContain("\nASSEMBLED — ");
    expect(said).not.toContain("ref: string");
    expect(said).not.toContain("torque");
    expect(spoken([{ slug: "joint.bolted" }, { slug: "part" }, { slug: "material.carbon" }])).toBe("joint: joint.bolted\nmaterial: material.carbon");
    expect(screen({}, null)).toBe("Nothing is on the operator's screen — no literal opened.");
    const folded = await rig.literal.resolve(await rig.literal.named("frame"));
    const lines = screen({ subject: "frame", selected: ["frame.arm.front"] }, folded).split("\n");
    expect(lines[0]).toBe("On the operator's screen: frame · selected frame.arm.front.");
    expect(lines[1]).toBe("frame: 2 placements · 1 joints");
    expect(lines[2]).toBe("  arm.front ← arm (frame.arm.front)");
    expect(lines[4]).toBe("  arm.front/bolt.0 holds arm.front");

    const probe = new Vector().graft(harness);
    probe.branch("/dialogue").open("/probe", (ctx) => shape.primer.load(ctx.hallucination.primer, ctx));
    const told = await steer.dispatch.invoke(probe, "/dialogue/probe", steer.strategy.direct)({ ...shard.context.lift(contexts.daemonDie, rig.daemon), mode: { id: editor.id, entity: editor }, thread, hallucination: { policy: {}, primer: new Vector() }, input: {} });
    expect(Object.keys(told)).toEqual(["role", "ontology", "vocabulary", "format", "screen"]);
    expect(told.ontology).toContain("[Ontology] kind — layer rule · its traits; then each trait, whose fields the assembly_* tools take\npart — ");
    expect(told.vocabulary).toContain("[Vocabulary] family: the symbols a symbols field takes\njoint: joint.");
    expect(told.screen).toBe("[Screen]\nOn the operator's screen: frame · selected frame.arm.front.\nframe: 2 placements · 1 joints\n  arm.front ← arm (frame.arm.front)\n  arm.front/bolt.0 ← bolt (frame.arm.front.bolt.0)\n  arm.front/bolt.0 holds arm.front");
  });

  it("P-bom: the screen's bom rides the domain's — what the build uses, part → count", async () => {
    expect(await call("/bom", { slug: "frame" })).toEqual({ arm: 1, bolt: 1 });
    expect(await call("/bom", { slug: "build", upto: 0 })).toEqual({});
    // the step names arm.front alone — the bolt under it is a placement of its own, not installed until a step names it
    expect(await call("/bom", { slug: "build" })).toEqual({ arm: 1 });
  });

  it("P-crud: rename and duplicate ride the domain's — a part renamed carries its layer, a duplicate lands under the next free slug", async () => {
    await call("/part", { slug: "rack", name: "Rack" });
    await call("/placement", { layer: "rack", name: "arm.0", ref: "arm" });
    const renamed = await call("/rename", { slug: "rack", to: "rack_b" });
    expect(renamed.slug).toBe("rack_b");
    expect((await call("/tree")).rows.map((row) => row.slug)).toContain("rack_b.arm.0");
    const copy = await call("/duplicate", { slug: "rack_b" });
    expect(copy.slug).toBe("rack_b_copy");
    const twin = await call("/duplicate", { slug: "rack_b.arm.0" });
    expect(twin.slug).toBe("rack_b.arm.1");
    await call("/retract", { slugs: ["rack_b", "rack_b_copy"], closure: true });
  });

  it("P-retract: the screen's retract takes a root with its interior through the domain — refused while a step names a placement, so the guide goes first", async () => {
    await expect(call("/retract", { slugs: ["frame"], closure: true })).rejects.toThrow(/still references/);
    expect((await call("/retract", { slugs: ["build"], closure: true })).retracted.sort()).toEqual(["build", "build.01"]);
    const gone = await call("/retract", { slugs: ["frame"], closure: true });
    expect(gone.retracted.sort()).toEqual(["arm", "bolt", "frame", "frame.arm.front", "frame.arm.front.bolt.0"]);
    expect((await call("/tree")).rows).toEqual([]);
  });

  it("T-editor-empty-open: a fresh buffer prints every pane's head, opens nothing, selects nothing, and its context is empty", async () => {
    const { text } = await renderView(VIEW, { data: {} });
    expect(text).toContain("daemon");
    expect(text).toContain("nothing selected");
    expect(text).toContain("stage dark · nothing folded");
    expect(text).toContain("the daemon holds no literals");
    expect(text).toContain("— · nothing open");
    expect(text).toContain("context");
    expect(text).toContain("empty");
    expect(text).toContain("idle");
    expect(text).not.toContain("droneaid");
  });
});

describe("the fold the screen draws — pure, no three", () => {
  const applied = (matrix, point) => [0, 1, 2].map((row) => matrix[row] * point[0] + matrix[4 + row] * point[1] + matrix[8 + row] * point[2] + matrix[12 + row]);

  it("P-frames: a nested placement composes its parent's frame — the grafted interior is no longer drawn flat", () => {
    const turned = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
    const placements = [
      { path: "motor.0", parent: null, translation: [1, 0, 0], rotation: turned, scale: [1, 1, 1] },
      { path: "motor.0/bolt.0", parent: "motor.0", translation: [0, 0, 1] },
      { path: "plate.0", parent: null, translation: [0, 0.5, 0] },
    ];
    const held = frames(placements);
    expect(held.get("motor.0")).toEqual(ORIGIN);
    expect(held.get("plate.0")).toEqual(ORIGIN);
    const parent = held.get("motor.0/bolt.0");
    expect(applied(parent, [0, 0, 0]).map((one) => Number(one.toFixed(4)))).toEqual([1, 0, 0]);
    expect(applied(parent, [0, 0, 1]).map((one) => Number(one.toFixed(4)))).toEqual([2, 0, 0]);
  });

  it("P-frames-loop: a placement whose parent is missing, or whose parent is itself, still lands at the origin", () => {
    expect(frames([{ path: "a", parent: "gone" }]).get("a")).toEqual(ORIGIN);
    expect(frames([{ path: "a", parent: "a", translation: [1, 1, 1] }]).get("a")).not.toBe(undefined);
    expect(frames([]).size).toBe(0);
  });

  it("P-visible: the tree is a reading of /tree — a row shows when every key above it is open, and a branch knows it has children", () => {
    const rows = [
      { key: "frame", slug: "frame", ontology: "part" },
      { key: "frame/frame.arm.0", slug: "frame.arm.0", ontology: "placement" },
      { key: "frame/frame.arm.0/arm.bolt.0", slug: "arm.bolt.0", ontology: "placement" },
      { key: "other", slug: "other", ontology: "part" },
    ];
    expect(visible(rows, new Set()).map((row) => row.slug)).toEqual(["frame", "other"]);
    expect(visible(rows, new Set()).find((row) => row.slug === "frame")).toMatchObject({ kids: true, opened: false });
    expect(visible(rows, new Set()).find((row) => row.slug === "other")).toMatchObject({ kids: false });
    expect(visible(rows, new Set(["frame"])).map((row) => row.slug)).toEqual(["frame", "frame.arm.0", "other"]);
    expect(visible(rows, new Set(["frame", "frame/frame.arm.0"])).map((row) => row.slug)).toEqual(["frame", "frame.arm.0", "arm.bolt.0", "other"]);
  });

  it("P-chain: a literal's way up is the placement that places it, the guide that sequences a step — crumbs from the root, the rows under it, the keys that show it", () => {
    const rows = [
      { key: "rig", slug: "rig", ontology: "part", depth: 0, trait: {} },
      { key: "rig/rig.frame.0", slug: "rig.frame.0", ontology: "placement", depth: 1, layer: "rig", ref: "frame" },
      { key: "rig/rig.frame.0/frame.arm.0", slug: "frame.arm.0", ontology: "placement", depth: 2, layer: "frame", ref: "arm" },
      { key: "other", slug: "other", ontology: "part", depth: 0, trait: {} },
      { slug: "frame", ontology: "part", trait: {} },
      { key: "build", slug: "build", ontology: "guide", depth: 0, trait: { SEQUENCED: { subject: "frame", sections: [{ name: "a", steps: ["build.01"] }] } } },
      { key: "build/build.01", slug: "build.01", ontology: "step", depth: 1, trait: {} },
    ];
    expect(chain(rows, "arm")).toEqual(["rig", "frame", "arm"]);
    expect(chain(rows, "frame.arm.0")).toEqual(["rig", "frame", "frame.arm.0"]);
    expect(chain(rows, "build.01")).toEqual(["build", "build.01"]);
    expect(parent(rows, "rig")).toBe(null);
    expect(parent(rows, "build")).toBe(null);
    const keyed = rows.filter((row) => row.key);
    expect(rooted(keyed, "rig").map((row) => row.slug)).toEqual(["rig", "rig.frame.0", "frame.arm.0"]);
    expect(opening(keyed, "frame")).toEqual(["rig", "rig/rig.frame.0"]);
    expect(opening(keyed, "nothing")).toEqual([]);
    expect(free(new Set(["model_1", "model_2"]), "model")).toBe("model_3");
  });
});

describe("the line — one line, one verb, pure", () => {
  it("P-line-mint: part takes a slug, a quoted name and a generator with its real params; step is not a verb here", () => {
    expect(parse('part frame_bottom "Frame bottom"')).toEqual({ nature: "/part", input: { slug: "frame_bottom", name: "Frame bottom" }, select: "frame_bottom" });
    expect(parse('part bolt_m3_16 "Bolt, short" bolt m3 16')).toEqual({
      nature: "/part",
      input: { slug: "bolt_m3_16", name: "Bolt, short", parametric: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }, qty: 1 },
      select: "bolt_m3_16",
    });
    expect(parse("part nut_m3 nut m3").input.parametric).toEqual({ generator: "fastener.nut", params: { thread: "M3" } });
    expect(parse('step frame.01 "Bottom plate"')).toMatchObject({ fault: /no verb step/ });
    expect(parse("part")).toMatchObject({ fault: /takes a slug/ });
    expect(parse("part x screw m3 16")).toMatchObject({ fault: /no generator "screw"/ });
    expect(parse("part x bolt m9 16")).toMatchObject({ fault: /no thread "M9"/ });
    expect(parse("part x bolt m3")).toMatchObject({ fault: /length in millimetres/ });
  });

  it("P-line-layer: place · move read the open subject when the line leaves it out; seq is the guide editor's", () => {
    expect(parse("place arm", { subject: "frame" })).toEqual({ nature: "/placement", input: { layer: "frame", ref: "arm" }, place: true });
    expect(parse("place arm into chassis")).toMatchObject({ input: { layer: "chassis", ref: "arm" } });
    expect(parse("place arm at 0.1,0,0", { subject: "frame" })).toMatchObject({ input: { translation: [0.1, 0, 0] } });
    expect(parse("place arm at nonsense", { subject: "frame" })).toMatchObject({ fault: /three metres/ });
    expect(parse("place arm")).toMatchObject({ fault: /open a part first/ });
    expect(parse("move frame.arm.0 into chassis")).toEqual({ nature: "/move", input: { slug: "frame.arm.0", layer: "chassis" }, select: true });
    expect(parse("move frame.arm.0 under housing.0")).toMatchObject({ input: { parent: "housing.0" } });
    expect(parse("move frame.arm.0 as arm.front")).toMatchObject({ input: { name: "arm.front" } });
    expect(parse("move frame.arm.0 sideways x")).toMatchObject({ fault: /no move "sideways"/ });
    expect(parse("seq frame frame.01 frame.02")).toMatchObject({ fault: /no verb seq/ });
  });

  it("P-line-screen: open · select · retract change the screen or ask, never the domain", () => {
    expect(parse("open frame")).toEqual({ screen: { subject: "frame", selected: [], scope: "buffer" } });
    expect(parse("open")).toMatchObject({ fault: /open takes a part/ });
    expect(parse("select a b")).toEqual({ screen: { selected: ["a", "b"] } });
    expect(parse("select")).toEqual({ screen: { selected: [] } });
    expect(parse("retract drone_rig")).toEqual({ ask: "drone_rig" });
    expect(parse("  ")).toBe(null);
    expect(parse("dance")).toMatchObject({ fault: /no verb dance/ });
  });

  it("P-line-crud-read: rename · duplicate · focus name what they touch, the reads default to the subject or the selection, a message is its lines", () => {
    expect(parse("rename frame frame_carbon")).toEqual({ nature: "/rename", input: { slug: "frame", to: "frame_carbon" }, select: true, renamed: "frame" });
    expect(parse("rename frame")).toMatchObject({ fault: /takes a slug and its new one/ });
    expect(parse("duplicate", { selected: ["arm"] })).toEqual({ nature: "/duplicate", input: { slug: "arm" }, select: true });
    expect(parse("duplicate frame frame_b")).toMatchObject({ input: { slug: "frame", to: "frame_b" } });
    expect(parse("duplicate")).toMatchObject({ fault: /takes a slug/ });
    expect(parse("focus", { selected: ["frame.arm.0"] })).toEqual({ focus: "frame.arm.0" });
    expect(parse("resolve", { subject: "frame" })).toEqual({ read: "/resolve", input: { slug: "frame" } });
    expect(parse("bom frame")).toEqual({ read: "/bom", input: { slug: "frame" } });
    expect(parse("bom")).toMatchObject({ fault: /open one first/ });
    expect(parse("closure", { selected: ["arm"] })).toEqual({ read: "/closure", input: { slug: "arm" } });
    expect(parse("geometry bolt")).toEqual({ read: "/geometry", input: { slug: "bolt" } });
    expect(parse("tree")).toEqual({ read: "/tree", input: {} });
    expect(parse("retract", { selected: ["arm"] })).toEqual({ ask: "arm" });
    expect(lines("  part a\n\n  place a into b  \n")).toEqual(["part a", "place a into b"]);
  });
});

describe("the inspector's nested fields", () => {
  it("P-fields-nested: a trait payload with its own properties becomes dotted fields, and a dotted write lands in the whole trait", () => {
    const schema = {
      type: "object",
      required: ["slug"],
      properties: {
        slug: { type: "string", description: 'Example: "arm"' },
        sourced: {
          type: "object",
          required: ["file"],
          properties: { file: { type: "string", description: 'Example: "model.blend"' }, scale: { type: "number", description: "Example: 0.05" } },
        },
        params: { type: "object", additionalProperties: {}, description: "Example: {}" },
      },
    };
    expect(fields(schema).map((field) => [field.key, field.kind, field.group])).toEqual([
      ["slug", "text", null],
      ["sourced.file", "text", "sourced"],
      ["sourced.scale", "number", "sourced"],
      ["params", "json", null],
    ]);
    const was = { slug: "arm", sourced: { file: "model.blend", object: "Arm" }, params: null };
    expect(at(was, "sourced.object")).toBe("Arm");
    expect(at(was, "params")).toBe(null);
    const next = into(was, "sourced.scale", 0.05);
    expect(next.sourced).toEqual({ file: "model.blend", object: "Arm", scale: 0.05 });
    expect(payload("part", next, was)).toEqual({ slug: "arm", sourced: { file: "model.blend", object: "Arm", scale: 0.05 } });
    expect(into(was, "sourced.file", null).sourced).toEqual({ object: "Arm" });
    expect(into({ sourced: { file: "x" } }, "sourced.file", null).sourced).toBe(null);
  });
});
