import { shape, contexts, shard, specimen, steer, Vector } from "@vivalence/typology";
import { sets } from "@vivalence/runtime";
import { mount } from "../../../../tests/rig.js";
import { renderView } from "../../../../tests/render.js";
import { aperture } from "../aperture/index.js";
import { answered, assemble, call as call_, say, scripted, userTurn } from "../../../../tests/hal.js";
import { harness, head, index, LIMIT, ontology, ROLE, screen, status } from "../harness.js";
import { tools } from "../tools/index.js";
import { guideValues, noteKind, noteOptions, noteSymbols, payload, stepValues } from "../buffer/form.js";
import * as mode from "../guide.viva.js";

const { describe, it, expect, beforeAll, afterAll } = specimen;

const VIEW = new URL("../buffer/Guide.svelte", import.meta.url).pathname;

describe("the form — the verbs' whole payloads drawn from a literal, pure", () => {
  it("P-values-payload: a step's and a guide's values carry every list whole; the payload is the verb's input, a null staged left out", () => {
    const step = { slug: "g.01", trait: { LABELED: { name: "Plate" }, ASSEMBLED: { placements: [] }, INSTRUCTED: { lines: [{ text: "a" }], images: ["manual/x.webp"] }, ANNOTATED: { notes: [{ text: "n", symbols: ["note.tip"] }] } }, symbols: ["tool.hex_2_0"] };
    const held = stepValues(step);
    expect(held).toEqual({ slug: "g.01", name: "Plate", description: "", lines: [{ text: "a" }], images: ["manual/x.webp"], notes: [{ text: "n", symbols: ["note.tip"] }], staged: null, symbols: ["tool.hex_2_0"] });
    expect(payload({ of: "g.01", ontology: "step", ...held, name: "Plate!" })).toEqual({ slug: "g.01", name: "Plate!", lines: [{ text: "a" }], images: ["manual/x.webp"], notes: [{ text: "n", symbols: ["note.tip"] }], symbols: ["tool.hex_2_0"] });
    const guide = { slug: "g", trait: { LABELED: { name: "G", description: "d" }, SEQUENCED: { subject: "frame", sections: [] }, STAGED: { explode: 0.5 } }, symbols: [] };
    expect(guideValues(guide)).toMatchObject({ slug: "g", name: "G", description: "d", subject: "frame", staged: { explode: 0.5 } });
    expect(payload({ of: "g", ontology: "guide", ...guideValues(guide) })).toEqual({ slug: "g", name: "G", description: "d", lines: [], images: [], notes: [], symbols: [], staged: { explode: 0.5 }, subject: "frame" });
  });

  it("P-note-kind: a note's kind is its warn.* family, else its note.*, else a plain note; a kind writes its symbols; the options list the installed families", () => {
    expect(noteKind({ symbols: ["note.warning", "warn.loose"] })).toBe("warn.loose");
    expect(noteKind({ symbols: ["note.tip"] })).toBe("note.tip");
    expect(noteKind({})).toBe("note");
    expect(noteSymbols("note")).toEqual([]);
    expect(noteSymbols("note.tip")).toEqual(["note.tip"]);
    expect(noteSymbols("warn.loose")).toEqual(["note.warning", "warn.loose"]);
    expect(noteOptions({ "note.tip": "Tip", "note.warning": "Warning", "warn.loose": "Leave it loose", "tool.hex_2_0": "Hex" })).toEqual([["note", "note"], ["note.tip", "tip"], ["note.warning", "warning"], ["warn.loose", "warning · leave it loose"]]);
  });
});

describe("the guide editor over the assembly rig", { sanitizeResources: false, sanitizeOps: false }, () => {
  let rig;
  let editor;
  let thread;
  let call;
  let armed;

  beforeAll(async () => {
    rig = await mount();
    editor = rig.entities.mode.create({ type: "editor", slug: "guide", name: "Guide editor", traits: [], installed: "", version: "0.1.0" });
    const user = rig.user;
    await rig.em.flush();
    rig.em.setFilterParams("user", { user: user.id });
    thread = rig.em.create(sets.userspace.thread.entity, { user: user.id, mode: editor.id, phase: "manual", traits: [], trait: {} });
    await rig.em.flush();
    const held = { id: editor.id, entity: editor, mountpoint: null, freight: null };
    const bound = new Vector().use(shard.context.spread(contexts.daemonDie, rig.daemon)).use(shard.context.bind("mode", held)).graft(aperture);
    call = (path, input) => steer.dispatch.invoke(bound, path, steer.strategy.direct)({ input: input ?? {} });
    const hands = new Vector().use(shard.context.spread(contexts.daemonDie, rig.daemon)).use(shard.context.bind("mode", held)).use(shard.context.bind("thread", thread)).graft(tools);
    armed = (path, input) => steer.dispatch.invoke(hands, path, steer.strategy.direct)({ input: input ?? {} });

    await rig.call("/part", { slug: "plate", name: "Plate", modeled: { file: "parts/plate.glb" }, qty: 1 });
    await rig.call("/part", { slug: "arm", name: "Arm", modeled: { file: "parts/arm.glb" }, qty: 2 });
    await rig.call("/part", { slug: "legs", name: "Leg set" });
    await rig.call("/placement", { layer: "legs", name: "arm.0", ref: "arm" });
    await rig.call("/part", { slug: "frame", name: "Frame" });
    await rig.call("/placement", { layer: "frame", name: "plate", ref: "plate" });
    await rig.call("/placement", { layer: "frame", name: "legs", ref: "legs" });
  });
  afterAll(async () => rig?.close());

  it("P-manifest: an VIEWABLE · EXPOSED · HARNESSED · TOOLING · CONVERSATIONAL editor named guide; a buffer that opens nothing", () => {
    expect(mode.manifest.type).toBe("editor");
    expect(mode.manifest.slug).toBe("guide");
    expect([...mode.manifest.traits].sort()).toEqual(["CONVERSATIONAL", "EXPOSED", "HARNESSED", "TOOLING", "VIEWABLE"]);
    expect(mode.buffer.fill({ data: {} }).data).toEqual({});
  });

  it("P-verbs: the editor's doors ride the domain's — guide · step · sequence · rename · duplicate · retract — and read guides, one guide whole, the subjects", async () => {
    expect(await call("/guides")).toEqual([]);
    const subjects = await call("/subjects");
    expect(subjects.map((one) => [one.slug, one.placements, one.inside.map((inner) => inner.slug)])).toEqual([["frame", 3, ["legs"]]]);
    const guide = await call("/guide", { slug: "build", name: "Build", subject: "frame" });
    expect(guide.mode.id).toBe(editor.id);
    await call("/step", { slug: "build.01", name: "Plate", placements: [{ literal: "frame.plate", active: true }] });
    await call("/step", { slug: "build.02", name: "Legs", placements: [{ literal: "legs.arm.0", active: true }], symbols: ["tool.hex_2_0"] });
    const sequenced = await call("/sequence", { guide: "build", sections: [{ name: "Frame", steps: ["build.01", "build.02"] }] });
    expect(sequenced.trait.SEQUENCED.sections[0].steps).toEqual(["build.01", "build.02"]);
    const held = await call("/read", { guide: "build" });
    expect(held.steps.map((step) => [step.slug, step.prepared.parts])).toEqual([["build.01", { plate: 1 }], ["build.02", { arm: 1 }]]);
    expect(held.fold.placements.map((one) => [one.path, one.slug, one.at])).toEqual([["plate", "frame.plate", 0], ["legs", "frame.legs", null], ["legs/arm.0", "legs.arm.0", 1]]);
    expect((await call("/rename", { slug: "build.02", to: "build.legs" })).slug).toBe("build.legs");
    expect((await call("/duplicate", { slug: "build.01" })).slug).toBe("build.01_copy");
    expect((await call("/read", { guide: "build" })).steps.map((step) => step.slug)).toEqual(["build.01", "build.01_copy", "build.legs"]);
    await call("/sequence", { guide: "build", sections: [{ name: "Frame", steps: ["build.01", "build.legs"] }] });
    expect((await call("/retract", { slugs: ["build.01_copy"] })).retracted).toEqual(["build.01_copy"]);
    expect((await call("/guides"))[0]).toMatchObject({ slug: "build", steps: 2, subject: "frame" });
  });

  it("P-tools: step_read and guide_read page a step and the guide whole; open saves the operator's unsaved edit, then puts a guide on the screen at a step; select lights placements only — each answers the screen sentence and yields the row in lexicon form", async () => {
    await call("/step", { slug: "build.legs", lines: [{ text: "Slide the arm in.", at: { literals: ["legs.arm.0"] } }, { text: "Bolt it." }], notes: [{ text: "Leave it loose.", symbols: ["note.warning"] }], images: ["manual/legs.webp"], staged: { built: { steps: ["build.01"], placements: [] }, tints: { "legs.arm.0": "warning" }, explode: 0.2 } });
    await expect(armed("/step/read", { step: "build.legs" })).rejects.toThrow(/no guide editor buffer is open/);
    const row = await rig.entities.buffer.create({ mode: editor.id, thread: thread.id, data: {}, bundle: null });
    await rig.em.flush();
    await expect(armed("/step/read", { step: "build.legs" })).rejects.toThrow(/open one with open first/);
    const legs = (await call("/read", { guide: "build" })).steps[1];
    row.data = { guide: "build", step: 2, draft: { of: "build.legs", ontology: "step", ...stepValues(legs), description: "Arms on." } };
    await rig.em.flush();
    const opened = await armed("/open", { guide: "build", step: "build.legs" });
    expect(opened.message).toBe("On the operator's screen: Build (build) · step 02 of 2, Legs (build.legs) · selected nothing.");
    expect(opened.buffer[0].id).toBe(row.id);
    expect(opened.buffer[0].data).toEqual({ guide: "build", step: 2, tab: "step", insp: true, sel: [], draft: null, picker: false, lb: null });
    expect((await call("/read", { guide: "build" })).steps[1].trait.LABELED.description).toBe("Arms on.");
    await expect(armed("/open", { guide: "build", step: "build.09" })).rejects.toThrow(/no step "build.09" in "build" — the \[Guide\] index/);
    await expect(armed("/open", { guide: "frame" })).rejects.toThrow(/is a part, not a guide/);
    const chosen = await armed("/select", { slugs: ["frame.plate"] });
    expect(chosen.message).toBe("On the operator's screen: Build (build) · step 02 of 2, Legs (build.legs) · selected frame.plate.");
    expect(chosen.buffer[0].data.sel).toEqual(["frame.plate"]);
    await expect(armed("/select", { slugs: ["nothing"] })).rejects.toThrow(/no placement named "nothing" — read the fold/);
    await expect(armed("/select", { slugs: ["frame"] })).rejects.toThrow(/no placement named "frame"/);
    expect((await armed("/guide/read")).message.split("\n")).toEqual(["Build (build)", "  builds: frame", "  sections: Frame [build.01, build.legs]"]);
    expect((await armed("/step/read", { step: "build.legs" })).message.split("\n")).toEqual([
      "02 Legs (build.legs) · section Frame — Arms on.",
      "  installs: legs.arm.0",
      "  lays out: Arm × 1",
      "  tools: Hex 2.0",
      "  1. Slide the arm in. → legs.arm.0",
      "  2. Bolt it.",
      "  ! Leave it loose. [Warning]",
      "  picture manual/legs.webp",
      "  staging · built before it: build.01",
      "  staging · tints: legs.arm.0 warning",
      "  staging · explode 0.2",
    ]);
    await expect(armed("/step/read", { step: "build.09" })).rejects.toThrow(/no step "build.09" in "build" — the \[Guide\] index lists its steps by slug/);
  });

  it("P-harness: stable sections first on their own keys — role, ontology, index — the screen and the format on the dialogue avenue only; no tune, rounds or effort of its own — the thread dials them (m105 Q14); every tool the role names is armed", async () => {
    const said = ontology(rig.daemon.domain.schematics);
    expect(said).toContain("guide\n  LABELED");
    expect(said).toContain("  ASSEMBLED — ");
    expect(said).not.toContain("PLACED");
    const held = await call("/read", { guide: "build" });
    expect(index(held).split("\n")).toEqual([
      "Build (build) · builds frame",
      "rows: number · name (slug) · installs, − removes · tools · lines · notes — step_read pages one",
      "[Frame]",
      "01 Plate (build.01) · installs frame.plate · 0 lines",
      "02 Legs (build.legs) · installs legs.arm.0 · tools Hex 2.0 · 2 lines · 1 note",
      "Not yet in any step: frame.legs",
    ]);
    expect(index(null)).toBe("No guide is open.");
    expect(screen({}, null, ["build"])).toBe("Nothing is on the operator's screen — no guide open. The daemon holds: build. Open one with open.");
    expect(screen({}, null, [])).toContain("holds no guide yet");
    expect(screen({ guide: "build" }, null)).toBe('On the operator\'s screen: "build", which cannot be read.');
    expect(status({ guide: "build", step: 0 }, held)).toBe("On the operator's screen: Build (build) · the guide tab · selected nothing.");
    expect(screen({ guide: "build", step: 2, sel: ["frame.plate"], draft: { of: "build.legs" } }, held)).toBe("On the operator's screen: Build (build) · step 02 of 2, Legs (build.legs) · selected frame.plate · an edit of build.legs typed, unsaved.");
    expect(head(held).split("\n")[0]).toBe("Build (build)");

    const { cortex, seen } = scripted((request) => (answered(request.turns).length ? say("Read.") : call_("t1", "step_read", { step: "build.legs" })));
    const daemon = Object.create(rig.daemon, { cortex: { value: cortex } });
    const hand = assemble({ daemon, mode: { id: editor.id, entity: editor }, thread, harness, tools });
    const folded = await hand.dialogue.render({ turns: [userTurn("what does the legs step say?")] });
    expect(folded.meta.state).toBe("complete");
    expect(Object.keys(seen[0].system)).toEqual(["role", "ontology", "guide", "format", "screen"]);
    expect(seen[0].system.role).toBe(ROLE);
    expect(seen[0].system.ontology).toContain("[Ontology]\nstep\n");
    expect(seen[0].system.guide).toContain("[Guide]\nBuild (build)");
    expect(seen[0].system.screen).toBe("[Screen]\nOn the operator's screen: Build (build) · step 02 of 2, Legs (build.legs) · selected frame.plate.");
    expect(seen[0].settings).toBeUndefined();
    const probe = new Vector().graft(harness).open("/probe", (ctx) => ({ policy: ctx.hallucination.policy, settings: ctx.hallucination.settings, keys: shape.primer.keys(ctx.hallucination.primer) }));
    const bench = (hallucination) => steer.dispatch.invoke(probe, "/probe", steer.strategy.direct)({ ...shard.context.lift(contexts.daemonDie, rig.daemon), mode: { id: editor.id, entity: editor }, thread, hallucination, input: {} });
    expect(await bench({ primer: new Vector(), policy: {} })).toEqual({ policy: {}, settings: undefined, keys: ["role", "ontology", "guide"] });
    expect((await bench({ primer: new Vector(), policy: { tier: "fast", rounds: 1 }, settings: { effort: "high" } })).policy).toEqual({ tier: "fast", rounds: 1 });
    expect(seen[0].tools).toEqual(expect.arrayContaining(["step_read", "guide_read", "open", "select", "assembly_resolve", "assembly_step", "assembly_guide", "assembly_sequence", "assembly_rename", "assembly_duplicate"]));
    for (const name of ROLE.match(/\b(?:assembly_\w+|step_read|guide_read|open|select)\b/g)) expect(seen[0].tools).toContain(name);
    for (const name of ROLE.match(/\b[a-z]+_[a-z]+\b/g).filter((name) => !["shell_run", "buffer_update"].includes(name))) expect(seen[0].tools).toContain(name);
    for (const name of ["step_read", "guide_read", "open", "select", "assembly_resolve", "assembly_step", "assembly_guide", "assembly_sequence", "buffer_update"]) expect(ROLE).toContain(name);
    const [result] = answered(seen[1].turns);
    expect(result.output.message).toContain("1. Slide the arm in.");

    seen.length = 0;
    await hand.object.render({ turns: [userTurn("classify")], output: { type: "object" } }).catch(() => null);
    expect(Object.keys(seen[0].system)).toEqual(["role", "ontology", "guide"]);
  });

  it("P-bounded: the kit line, the selection and the daemon's guides are cut at LIMIT with the tool that pages the rest named; the step rows are the index and never cut", async () => {
    const held = await call("/read", { guide: "build" });
    const many = Array.from({ length: LIMIT + 5 }, (_, n) => `frame.arm.${n}`);
    expect(index({ ...held, fold: { ...held.fold, placements: many.map((slug) => ({ slug, at: null })) } }).split("\n").at(-1)).toBe(`Not yet in any step: ${many.slice(0, LIMIT).join(", ")} … 5 more — assembly_resolve { slug: "frame" } lists every placement`);
    expect(status({ guide: "build", step: 0, sel: many }, held)).toBe(`On the operator's screen: Build (build) · the guide tab · selected ${many.slice(0, LIMIT).join(", ")} … 5 more.`);
    expect(screen({}, null, many)).toContain(` … 5 more. Open one with open.`);
  });

  it("P-snapshot: the assembled prompt and armory, frozen — SNAPSHOT_HOT=1 regenerates; a drift in wording is red before a live call", async () => {
    const { cortex, seen } = scripted(() => say("."));
    const daemon = Object.create(rig.daemon, { cortex: { value: cortex } });
    const hand = assemble({ daemon, mode: { id: editor.id, entity: editor }, thread, harness, tools });
    await hand.dialogue.render({ turns: [userTurn("hi")] });
    const { system, tools: armory, settings, cache } = seen[0];
    const pojo = { system, tools: armory, settings, cache: cache ?? null };
    const path = new URL("./snapshots/harness.snapshot.json", import.meta.url).pathname;
    const frozen = await Deno.readTextFile(path).then(JSON.parse).catch(() => null);
    if (Deno.env.get("SNAPSHOT_HOT") === "1" || !frozen) {
      await Deno.mkdir(new URL("./snapshots", import.meta.url).pathname, { recursive: true });
      await Deno.writeTextFile(path, JSON.stringify(pojo, null, 2) + "\n");
      return;
    }
    expect(pojo).toEqual(frozen);
  });

  it("T-fresh-buffer: a fresh buffer lists the daemon's guides and + new guide, holds no default — no guide, no step, nothing on the stage", async () => {
    const { text } = await renderView(VIEW, { data: {} });
    expect(text).toContain("Guides");
    expect(text).toContain("+ new guide");
    expect(text).toContain("no guide open");
    expect(text).toContain("No guide open.");
    expect(text).not.toContain("Untitled step");
    expect(text).not.toContain("droneaid");
  });

  it("S-one-round-many-writers: droneaid's round 2 replayed — steps, a sequence and an open in ONE assistant turn run in the model's order on one em; a refused note fails its own call only, and the round closes", async () => {
    await call("/guide", { slug: "rush", name: "Rush", subject: "frame" });
    await call("/step", { slug: "rush.01", name: "Plate", placements: [{ literal: "frame.plate", active: true }] });
    await call("/sequence", { guide: "rush", sections: [{ name: "Frame", steps: ["rush.01"] }] });
    const warned = [{ text: "Mind the edge.", symbols: ["note.warning"] }];
    const writes = [
      call_("t2", "assembly_step", { slug: "rush.02", name: "Legs", placements: [{ literal: "frame.legs", active: true }], lines: [{ text: "Seat the legs." }], notes: warned }),
      call_("t3", "assembly_step", { slug: "rush.03", name: "Arm", placements: [{ literal: "legs.arm.0", active: true }], lines: [{ text: "Slide the arm in." }], notes: [{ text: "Use a soft surface.", symbols: ["note.info"] }] }),
      call_("t4", "assembly_step", { slug: "rush.04", name: "Plate again", placements: [{ literal: "frame.plate", active: true }], lines: [{ text: "Check the plate." }], notes: warned }),
      call_("t5", "assembly_step", { slug: "rush.05", name: "Legs again", placements: [{ literal: "frame.legs", active: true }], lines: [{ text: "Check the legs." }], notes: warned }),
      call_("t6", "assembly_sequence", { guide: "rush", sections: [{ name: "Frame", steps: ["rush.01", "rush.02", "rush.03", "rush.04", "rush.05"] }] }),
      call_("t7", "open", { guide: "rush", step: "rush.01" }),
    ];
    const round = { ...writes[0], parts: writes.flatMap((turn) => turn.parts) };
    const { cortex, seen } = scripted((request) => (answered(request.turns).length ? say("Written.") : round));
    const daemon = Object.create(rig.daemon, { cortex: { value: cortex } });
    const hand = assemble({ daemon, mode: { id: editor.id, entity: editor }, thread, harness, tools });
    const folded = await hand.dialogue.render({ turns: [userTurn("write steps two to five")] });
    expect(folded.meta.state).toBe("complete");
    const results = answered(seen[1].turns);
    expect(results.map((result) => [result.id, result.output.message])).toEqual([
      ["t2", "step rush.02 · Legs · 1 placements · 1 lines"],
      ["t3", '[assembly] no symbol "note.info" — the vocabulary is what the topologies ship'],
      ["t4", "step rush.04 · Plate again · 1 placements · 1 lines"],
      ["t5", "step rush.05 · Legs again · 1 placements · 1 lines"],
      ["t6", '[assembly] no step "rush.03"'],
      ["t7", "On the operator's screen: Rush (rush) · step 01 of 1, Plate (rush.01) · selected nothing."],
    ]);
    expect((await call("/read", { guide: "rush" })).steps.map((step) => step.slug)).toEqual(["rush.01"]);
    expect((await rig.literal.find({ slug: { $like: "rush.0%" } })).map((row) => row.slug).sort()).toEqual(["rush.01", "rush.02", "rush.04", "rush.05"]);
  });
});
