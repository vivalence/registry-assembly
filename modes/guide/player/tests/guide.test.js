import { shape, contexts, shard, specimen, steer, Vector } from "@vivalence/typology";
import { sets } from "@vivalence/runtime";
import { mount } from "../../../../tests/rig.js";
import { renderView } from "../../../../tests/render.js";
import { aperture } from "../aperture/index.js";
import { answered, assemble, call as call_, say, scripted, userTurn } from "../../../../tests/hal.js";
import { harness, index, ROLE, screen } from "../harness.js";
import { tools } from "../tools/index.js";
import { built, chips, kindOf, nextStep, sections, statuses, through, tints } from "../buffer/kit/guide.js";
import { entries, frames, IDENTITY } from "../buffer/kit/frames.js";
import * as mode from "../player.viva.js";

const { describe, it, expect, beforeAll, afterAll } = specimen;

const VIEW = new URL("../buffer/Guide.svelte", import.meta.url).pathname;

describe("the guide, read for a screen — pure", () => {
  const step = (slug, placements, staged) => ({ slug, trait: { ASSEMBLED: { placements: placements.map(([literal, active = true]) => ({ literal, active })) }, ...(staged && { STAGED: staged }) } });
  const steps = [step("g.01", [["a"]]), step("g.02", [["b"], ["c"]]), step("g.03", [["c", false]], { built: { steps: ["g.01"], placements: ["c"] }, tints: { a: "warning" } })];
  const fold = { placements: [{ slug: "a", ref: "x" }, { slug: "b", ref: "x" }, { slug: "c", ref: "y" }, { slug: "d", ref: "y" }], parts: { x: { LABELED: { name: "X" } }, y: {} } };

  it("P-through-built: the steps' opinions replayed; built is every earlier step, or the step's own STAGED.built", () => {
    expect([...through(steps, 2)]).toEqual([["a", true], ["b", true], ["c", true]]);
    expect([...through(steps, 3)]).toEqual([["a", true], ["b", true], ["c", false]]);
    expect([...built(steps, 1)]).toEqual(["a"]);
    expect([...built(steps, 2)].sort()).toEqual(["a", "c"]);
  });

  it("P-built-any-layer: a part is every placement of it, a placement brings what sits under it, its parent stays out; tints expand the same way", () => {
    const tree = { placements: [{ slug: "r", ref: "rig", path: "r", children: ["r/m"] }, { slug: "m", ref: "motor", path: "r/m", children: ["r/m/s"] }, { slug: "s", ref: "screw", path: "r/m/s", children: [] }, { slug: "n", ref: "motor", path: "n", children: [] }] };
    const one = [step("h.01", [["r"]]), step("h.02", [["s"]], { built: { steps: [], placements: ["m"], parts: ["motor"] }, tints: { motor: "warning", "h.01": "tip" } })];
    expect([...built(one, 1, tree)].sort()).toEqual(["m", "n", "s"]);
    expect(tints(one, 2, tree)).toEqual({ m: "warning", s: "warning", n: "warning", r: "tip" });
  });

  it("P-status: overview is all solid; fresh is named by the step; solid is built; ghost is later or never named when ghost is on; else hidden", () => {
    expect(statuses(fold, steps, 0)).toEqual({ a: "solid", b: "solid", c: "solid", d: "solid" });
    expect(statuses(fold, steps, 2)).toEqual({ a: "solid", b: "fresh", c: "fresh", d: "hidden" });
    expect(statuses(fold, steps, 2, { ghost: true })).toEqual({ a: "solid", b: "fresh", c: "fresh", d: "ghost" });
    expect(statuses(fold, steps, 3)).toEqual({ a: "solid", b: "hidden", c: "solid", d: "hidden" });
    expect(statuses(null, steps, 1)).toEqual({});
  });

  it("P-chips-kinds-sections: fasteners after parts, a note's kind from its symbols, sections numbered through, the next step slug", () => {
    expect(chips(fold.parts, { y: 2, x: 1 }, { y: { name: "Bolt", fastener: true } }).map((one) => one.name)).toEqual(["X", "Bolt"]);
    expect(kindOf({ symbols: ["warn.loose"] })).toBe("note.warning");
    expect(kindOf({ symbols: ["note.tip", "warn.loose"] })).toBe("note.tip");
    expect(kindOf({})).toBe("note");
    const guide = { trait: { SEQUENCED: { sections: [{ name: "A", steps: ["g.01"] }, { name: "B", steps: ["g.02", "g.03"] }] } } };
    expect(sections(guide, steps).map((section) => [section.name, section.steps.map((one) => one.n)])).toEqual([["A", [1]], ["B", [2, 3]]]);
    expect(nextStep("g", steps)).toBe("g.04");
    expect(nextStep("h", [])).toBe("h.01");
  });

  it("P-entries: one entry per part with its nodes and parent frames; a part without geometry is left out", () => {
    const held = { placements: [{ path: "a", slug: "s.a", ref: "x", translation: [1, 0, 0] }, { path: "a/b", slug: "s.a.b", parent: "a", ref: "y" }], parts: { x: { MODELED: { file: "parts/x.glb" } }, y: {} } };
    const out = entries(held, { asset: (path) => (path ? `http://cargo/${path}` : null) });
    expect(out.map((one) => one.id)).toEqual(["x"]);
    expect(out[0].nodes[0]).toMatchObject({ slug: "s.a", path: "a", parentMatrix: IDENTITY, translation: [1, 0, 0] });
    expect(frames(held.placements).get("a/b")[12]).toBe(1);
  });
});

describe("the player over the assembly rig", { sanitizeResources: false, sanitizeOps: false }, () => {
  let rig;
  let player;
  let thread;
  let call;
  let armed;

  beforeAll(async () => {
    rig = await mount();
    player = rig.entities.mode.create({ type: "guide", slug: "player", name: "Guide", traits: [], installed: "", version: "0.1.0" });
    const user = rig.user;
    await rig.em.flush();
    rig.em.setFilterParams("user", { user: user.id });
    thread = rig.em.create(sets.userspace.thread.entity, { user: user.id, mode: player.id, phase: "manual", traits: [], trait: {} });
    await rig.em.flush();
    const held = { id: player.id, entity: player, mountpoint: null, freight: null };
    const bound = new Vector().use(shard.context.spread(contexts.daemonDie, rig.daemon)).use(shard.context.bind("mode", held)).graft(aperture);
    call = (path, input) => steer.dispatch.invoke(bound, path, steer.strategy.direct)({ input: input ?? {} });
    const hands = new Vector().use(shard.context.spread(contexts.daemonDie, rig.daemon)).use(shard.context.bind("mode", held)).use(shard.context.bind("thread", thread)).graft(tools);
    armed = (path, input) => steer.dispatch.invoke(hands, path, steer.strategy.direct)({ input: input ?? {} });

    await rig.call("/part", { slug: "plate", name: "Plate", modeled: { file: "parts/plate.glb" }, qty: 1, symbols: ["material.carbon"] });
    await rig.call("/part", { slug: "bolt", name: "Bolt M3×16", parametric: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }, qty: 4, symbols: ["material.fastener"] });
    await rig.call("/part", { slug: "frame", name: "Frame" });
    await rig.call("/placement", { layer: "frame", name: "plate", ref: "plate" });
    await rig.call("/placement", { layer: "frame", name: "bolt.0", ref: "bolt", translation: [0.1, 0, 0], joins: ["plate"] });
    await rig.call("/step", { slug: "build.01", name: "Plate", placements: [{ literal: "frame.plate", active: true }], lines: [{ text: "Lay the plate flat." }], notes: [{ text: "Top side up.", symbols: ["note.tip"] }], images: ["manual/a.webp"] });
    await rig.call("/step", { slug: "build.02", name: "Bolt", placements: [{ literal: "frame.bolt.0", active: true }], lines: [{ text: "Thread the bolt.", at: { literals: ["frame.bolt.0"] } }], symbols: ["tool.hex_2_0"] });
    await rig.call("/guide", { slug: "build", name: "Build the frame", description: "Two steps.", subject: "frame", sections: [{ name: "Frame", steps: ["build.01", "build.02"] }], lines: [{ text: "Welcome." }] });
  });
  afterAll(async () => rig?.close());

  it("P-manifest: an VIEWABLE · EXPOSED · HARNESSED · TOOLING · CONVERSATIONAL guide named player; a buffer that opens nothing", () => {
    expect(mode.manifest.type).toBe("guide");
    expect(mode.manifest.slug).toBe("player");
    expect([...mode.manifest.traits].sort()).toEqual(["CONVERSATIONAL", "EXPOSED", "HARNESSED", "TOOLING", "VIEWABLE"]);
    expect(mode.buffer.fill({ data: {} }).data).toEqual({});
    expect(Object.keys(mode)).toEqual(expect.arrayContaining(["aperture", "harness", "tools", "manifest", "buffer", "views"]));
  });

  it("P-read: the daemon's guides as cards; one guide whole — steps in order with what each lays out, the fold with each placement's step, the parts' cards, the symbols' names", async () => {
    expect(await call("/guides")).toEqual([{ slug: "build", name: "Build the frame", description: "Two steps.", subject: "frame", steps: 2 }]);
    const held = await call("/read", { guide: "build" });
    expect(held.guide).toMatchObject({ slug: "build", ontology: "guide", name: "Build the frame" });
    expect(held.steps.map((step) => [step.slug, step.index, step.section, step.prepared])).toEqual([
      ["build.01", 0, "Frame", { parts: { plate: 1 }, tools: [] }],
      ["build.02", 1, "Frame", { parts: { bolt: 1 }, tools: ["tool.hex_2_0"] }],
    ]);
    expect(held.steps[0].trait.ANNOTATED.notes[0].symbols).toEqual(["note.tip"]);
    expect(held.fold.placements.map((one) => [one.slug, one.at, one.active])).toEqual([["frame.plate", 0, true], ["frame.bolt.0", 1, true]]);
    expect(held.parts.bolt).toMatchObject({ name: "Bolt M3×16", fastener: true, material: "material.fastener", qty: 4 });
    expect(held.parts.plate).toMatchObject({ fastener: false, material: "material.carbon", modeled: { file: "parts/plate.glb" } });
    expect(held.symbols["tool.hex_2_0"]).toBe("Hex 2.0");
    expect(held.symbols["note.tip"]).toBe("Tip");
    await expect(call("/read", { guide: "frame" })).rejects.toThrow(/is a part, not a guide/);
  });

  it("P-tools: step_read pages one step in the builder's words; the step tool turns the thread's buffer and yields it in lexicon form; both refuse with the fix when nothing is open", async () => {
    await expect(armed("/step", { step: 1 })).rejects.toThrow(/ask the builder to open the guide first/);
    const row = await rig.entities.buffer.create({ mode: player.id, thread: thread.id, data: {}, view: null });
    await rig.em.flush();
    await expect(armed("/step/read", { step: "build.01" })).rejects.toThrow(/has no guide open/);
    row.data = { guide: "build", step: 0 };
    await rig.em.flush();
    const turned = await armed("/step", { step: "build.02" });
    expect(turned.message).toBe("on step 02 Bolt");
    expect(turned.buffer[0].id).toBe(row.id);
    expect(turned.buffer[0].data).toEqual({ guide: "build", step: 2, view: null, focus: null, lightbox: null });
    expect((await armed("/step", { step: 0 })).message).toBe("on the overview");
    await expect(armed("/step", { step: "build.09" })).rejects.toThrow(/no step "build.09"/);
    await expect(armed("/step", { step: 5 })).rejects.toThrow(/has 2 steps/);
    await armed("/step", { step: 1 });
    expect((await armed("/step/read", { step: "build.01" })).message.split("\n")).toEqual([
      "01 Plate (build.01) · Frame",
      "  lays out: Plate × 1",
      "  ! Tip: Top side up.",
      "  1. Lay the plate flat.",
      "  1 picture on the builder's screen",
    ]);
    expect((await armed("/step/read", { step: "build.02" })).message.split("\n")).toEqual([
      "02 Bolt (build.02) · Frame",
      "  lays out: Bolt M3×16 × 1",
      "  tools: Hex 2.0",
      "  1. Thread the bolt. → Bolt M3×16",
    ]);
    await expect(armed("/step/read", { step: "build.09" })).rejects.toThrow(/no step "build.09" in "build"/);
  });

  it("P-harness: the role and the index on their own keys, the screen and the format on the dialogue avenue only; no tune, rounds or effort of its own — the thread dials them (m105 Q14); every tool the role names is armed and the writers are named as not its own", async () => {
    const held = await call("/read", { guide: "build" });
    expect(index(held).split("\n")).toEqual([
      "Build the frame (build) — Two steps. · builds frame",
      "  Welcome.",
      "[Frame]",
      "01 Plate (build.01) · lays out Plate × 1 · 1 line",
      "02 Bolt (build.02) · lays out Bolt M3×16 × 1 · tools Hex 2.0 · 1 line",
    ]);
    expect(index(null)).toBe("No guide is open.");
    expect(screen({}, null)).toBe("The builder has no guide open.");
    expect(screen({ guide: "build", step: 1, done: [] }, held)).toBe("On step 01 of 2: Plate (build.01).\nDone: nothing yet.");
    expect(screen({ guide: "build", step: 0, done: ["build.01"], ghost: true }, held)).toBe("On the overview of Build the frame.\nDone: build.01.\nGhosts are on.");

    const { cortex, seen } = scripted((request) => (answered(request.turns).length ? say("Lay the plate flat.") : call_("t1", "step_read", { step: "build.01" })));
    const daemon = Object.create(rig.daemon, { cortex: { value: cortex } });
    const mentor = assemble({ daemon, mode: { id: player.id, entity: player }, thread, harness, tools });
    const folded = await mentor.dialogue.render({ turns: [userTurn("which way up?")] });
    expect(folded.meta.state).toBe("complete");
    expect(Object.keys(seen[0].system)).toEqual(["role", "guide", "format", "screen"]);
    expect(seen[0].system.role).toBe(ROLE);
    expect(seen[0].system.guide).toContain("[Guide]\nBuild the frame (build)");
    expect(seen[0].system.screen).toBe("[Screen]\nOn step 01 of 2: Plate (build.01).\nDone: nothing yet.");
    expect(seen[0].settings).toBeUndefined();
    expect(seen[0].tools).toEqual(expect.arrayContaining(["step_read", "step", "assembly_step", "assembly_guide", "assembly_rename", "assembly_duplicate"]));
    for (const name of ROLE.match(/\b(?:assembly_\w+|step_read|step)\b/g)) expect(seen[0].tools).toContain(name);
    expect(answered(seen[1].turns)[0].output.message).toContain("! Tip: Top side up.");

    const probe = new Vector().graft(harness).open("/probe", (ctx) => ({ policy: ctx.hallucination.policy, settings: ctx.hallucination.settings, keys: shape.primer.keys(ctx.hallucination.primer) }));
    const bench = (hallucination) => steer.dispatch.invoke(probe, "/probe", steer.strategy.direct)({ ...shard.context.lift(contexts.daemonDie, rig.daemon), mode: { id: player.id, entity: player }, thread, hallucination, input: {} });
    expect(await bench({ primer: new Vector(), policy: {} })).toEqual({ policy: {}, settings: undefined, keys: ["role", "guide"] });
    expect((await bench({ primer: new Vector(), policy: { tier: "fast", rounds: 1 } })).policy).toEqual({ tier: "fast", rounds: 1 });

    seen.length = 0;
    await mentor.object.render({ turns: [userTurn("classify")], output: { type: "object" } }).catch(() => null);
    expect(Object.keys(seen[0].system)).toEqual(["role", "guide"]);
  });

  it("T-fresh-buffer: a fresh buffer lists the daemon's guides and holds no default — no step, no guide", async () => {
    const { text } = await renderView(VIEW, { data: {} });
    expect(text).toContain("Guides");
    expect(text).toContain("reading the daemon");
    expect(text).toContain("no guide open");
    expect(text).not.toContain("Start building");
    expect(text).not.toContain("droneaid");
  });
});
