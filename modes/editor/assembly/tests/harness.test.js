import { shape, contexts, shard, specimen, steer, Vector } from "@vivalence/typology";
import { sets } from "@vivalence/runtime";
import { mount } from "../../../../tests/rig.js";
import { LIMIT, ROLE, harness, screen, status } from "../harness.js";
import { tools } from "../tools/index.js";
import { answered, assemble, call, say, scripted, userTurn } from "./scripted.js";

const { describe, it, expect, beforeAll, afterAll } = specimen;

const NAMED = ["open", "select", "focus", "assembly_resolve", "assembly_part", "assembly_placement", "assembly_move", "assembly_rename", "assembly_duplicate"];

describe("the harness over the assembly rig — what the model is handed", { sanitizeResources: false, sanitizeOps: false }, () => {
  let rig;
  let editor;
  let held;
  let thread;
  let row;

  beforeAll(async () => {
    rig = await mount();
    editor = rig.entities.mode.create({ type: "editor", slug: "assembly", name: "Assembly", traits: [], installed: "", version: "0.1.0" });
    const user = rig.user;
    await rig.em.flush();
    rig.em.setFilterParams("user", { user: user.id });
    thread = rig.em.create(sets.userspace.thread.entity, { user: user.id, mode: editor.id, phase: "manual", traits: [], trait: {} });
    await rig.em.flush();
    held = { id: editor.id, entity: editor, mountpoint: null, freight: null };
    await rig.call("/part", { slug: "arm", name: "Arm", qty: 4, modeled: { file: "parts/arm.glb" } });
    await rig.call("/part", { slug: "frame", name: "Frame" });
    await rig.call("/placement", { layer: "frame", name: "arm.front", ref: "arm", translation: [0.1, 0, 0] });
    row = await rig.entities.buffer.create({ mode: editor.id, thread: thread.id, data: { subject: "frame", selected: [] }, bundle: null });
    await rig.em.flush();
  });
  afterAll(async () => rig?.close());

  const probe = (avenue) => {
    const vector = new Vector().graft(harness);
    vector.branch(avenue).open("/probe", async (ctx) => ({ ...ctx.hallucination, system: await shape.primer.load(ctx.hallucination.primer, ctx) }));
    return steer.dispatch.invoke(vector, `${avenue}/probe`, steer.strategy.direct)({ ...shard.context.lift(contexts.daemonDie, rig.daemon), mode: held, thread, hallucination: { policy: {}, primer: new Vector() }, input: {} });
  };

  it("P-sections: the stable sections at the root, the screen last and on the dialogue only — an object render never sees it", async () => {
    const dialogue = await probe("/dialogue");
    expect(Object.keys(dialogue.system)).toEqual(["role", "ontology", "vocabulary", "format", "screen"]);
    expect(dialogue.system.role).toBe(ROLE);
    const lines = dialogue.system.ontology.split("\n");
    expect(lines[0]).toBe("[Ontology] kind — layer rule · its traits; then each trait, whose fields the assembly_* tools take");
    expect(lines[1]).toBe("part — placements may name it as their layer · LABELED, SOURCED, MODELED, PARAMETRIC, COUNTED");
    expect(lines.filter((line) => line.startsWith("LABELED — "))).toHaveLength(1);
    expect(dialogue.system.ontology).not.toContain("    name: string");
    expect(dialogue.system.ontology.length).toBeLessThan(2500);
    expect(dialogue.system.vocabulary).toContain("[Vocabulary] family: the symbols a symbols field takes\njoint: joint.");
    expect(dialogue.system.screen).toBe("[Screen]\nOn the operator's screen: frame · selected nothing.\nframe: 1 placements · 0 joints\n  arm.front ← arm (frame.arm.front)");
    const object = await probe("/object");
    expect(Object.keys(object.system)).toEqual(["role", "ontology", "vocabulary"]);
  });

  it("P-snapshot: the assembled prompt and armory, frozen — SNAPSHOT_HOT=1 regenerates; a drift in wording is red before a live call", async () => {
    const { cortex, seen } = scripted(() => say("."));
    rig.daemon.cortex = cortex;
    const hand = assemble({ daemon: rig.daemon, mode: held, thread, harness, tools });
    await hand.dialogue.render({ turns: [userTurn("hi")] });
    const { system, tools: armory, policy, settings, cache } = seen[0];
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

  it("P-dial: the mode sets no tune, rounds or effort — the thread's dial and the caller's policy pass through (m105 Q14)", async () => {
    const { policy, settings } = await probe("/object");
    expect(policy).toEqual({});
    expect(settings).toBeUndefined();
    const vector = new Vector().graft(harness).open("/probe", (ctx) => ctx.hallucination.policy);
    const dialed = await steer.dispatch.invoke(vector, "/probe", steer.strategy.direct)({ ...shard.context.lift(contexts.daemonDie, rig.daemon), mode: held, thread, hallucination: { policy: { tier: "capable", rounds: 2 }, primer: new Vector() }, input: {} });
    expect(dialed).toEqual({ tier: "capable", rounds: 2 });
  });

  it("P-named: every tool the role names is armed under that name, and the role names no assembly_* tool that is not", async () => {
    const { cortex, seen } = scripted(() => say("."));
    rig.daemon.cortex = cortex;
    const hand = assemble({ daemon: rig.daemon, mode: held, thread, harness, tools });
    await hand.dialogue.render({ turns: [userTurn("hi")] });
    for (const name of NAMED) {
      expect(ROLE).toContain(name);
      expect(seen[0].tools).toContain(name);
    }
    for (const name of ROLE.match(/assembly_[a-z]+/g)) expect(seen[0].tools).toContain(name);
    expect(seen[0].tools).toEqual(expect.arrayContaining(["assembly_bom", "assembly_step", "assembly_guide", "assembly_sequence"]));
  });

  it("P-loop: the model reads the screen, selects by slug, the row is written and comes back at the top level with the screen line as the message, then it answers", async () => {
    const { cortex, seen } = scripted((request) => (answered(request.turns).length ? say("The front arm is selected.") : call("t1", "select", { slugs: ["frame.arm.front"] })));
    rig.daemon.cortex = cortex;
    const hand = assemble({ daemon: rig.daemon, mode: held, thread, harness, tools });
    const folded = await hand.dialogue.render({ turns: [userTurn("select the front arm")] });
    expect(seen).toHaveLength(2);
    expect(seen[0].settings).toBeUndefined();
    const [result] = answered(seen[1].turns);
    expect(result.output.message).toBe("On the operator's screen: frame · selected frame.arm.front.");
    expect(result.output.buffer[0].id).toBe(row.id);
    expect(result.output.buffer[0].data).toMatchObject({ subject: "frame", selected: ["frame.arm.front"] });
    expect(result.output.entities).toBeUndefined();
    expect(folded.meta.state).toBe("complete");
    expect((await rig.entities.buffer.findOne({ id: row.id })).data.selected).toEqual(["frame.arm.front"]);
  });

  it("P-refused: a slug that does not exist is refused with the fix in the message, and the loop goes on", async () => {
    const { cortex, seen } = scripted((request) => (answered(request.turns).length ? say("There is no such placement.") : call("t1", "select", { slugs: ["frame.arm.back"] })));
    rig.daemon.cortex = cortex;
    const hand = assemble({ daemon: rig.daemon, mode: held, thread, harness, tools });
    const folded = await hand.dialogue.render({ turns: [userTurn("select the back arm")] });
    const [result] = answered(seen[1].turns);
    expect(result.output.message).toBe('[assembly] no literal named "frame.arm.back" — slugs are on the [Screen]; assembly_resolve lists every one');
    expect(folded.meta.state).toBe("complete");
  });

  it("P-bounded: the screen is an index — no translations, cut at LIMIT rows with the tool that pages the rest named", () => {
    const placements = Array.from({ length: LIMIT + 5 }, (_, index) => ({ path: `arm.${index}`, ref: "arm", slug: `frame.arm.${index}`, translation: [index, 0, 0] }));
    const lines = screen({ subject: "frame", selected: ["frame.arm.1"], focus: "frame.arm.1" }, { slug: "frame", placements, joints: [], missing: [] }).split("\n");
    expect(lines[0]).toBe("On the operator's screen: frame · selected frame.arm.1 · framed on frame.arm.1.");
    expect(lines[1]).toBe(`frame: ${LIMIT + 5} placements · 0 joints`);
    expect(lines).toHaveLength(LIMIT + 3);
    expect(lines[2]).toBe("  arm.0 ← arm (frame.arm.0)");
    expect(lines.at(-1)).toBe(`  … 5 more — assembly_resolve { slug: "frame" } lists every placement with its translation.`);
    expect(lines.join("\n")).not.toContain("@ [");
    expect(status({})).toBe("Nothing is on the operator's screen — no literal opened.");
    expect(screen({}, null, ["frame", "rig"])).toBe("Nothing is on the operator's screen — no literal opened.\nThe daemon holds 2 roots, each a part nothing places: frame, rig. Open one with open.");
    const many = placements.map((one) => one.slug);
    expect(status({ subject: "frame", selected: many })).toBe(`On the operator's screen: frame · selected ${many.slice(0, LIMIT).join(", ")} … 5 more.`);
  });

  it("P-gone: a subject the daemon no longer holds is said so on the screen, with the roots to open instead", async () => {
    await rig.entities.buffer.create({ mode: editor.id, thread: thread.id, data: { subject: "ghost", selected: ["ghost.x"] }, bundle: null });
    await rig.em.flush();
    const { system } = await probe("/dialogue");
    expect(system.screen).toBe("[Screen]\nOn the operator's screen: ghost · selected ghost.x.\n\"ghost\" is not in the daemon any more — the stage is empty until another part is opened.\nThe daemon holds 1 roots, each a part nothing places: frame. Open one with open.");
  });
});
