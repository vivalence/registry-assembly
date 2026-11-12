import { v, Vector } from "@vivalence/typology";
import { open, shown, status } from "../harness.js";
import { measure, posed } from "../buffer/mate.js";

const KEPT = 40;

const written = async (ctx, patch) => {
  const row = await open(ctx);
  if (!row) throw new Error("[assembly] no editor buffer is open on this thread — ask the operator to open the assembly editor");
  row.data = { ...(row.data ?? {}), ...patch };
  await ctx.entities.em.flush();
  return row;
};

// what the screen can fold: a part, or a guide through its subject; a step is the guide editor's
const foldable = (literal) => {
  if (literal.ontology === "part") return literal.slug;
  if (literal.ontology === "guide") {
    const subject = literal.trait?.SEQUENCED?.subject;
    if (!subject) throw new Error(`[assembly] "${literal.slug}" is a guide with no subject yet — set one in the guide editor`);
    return subject;
  }
  if (literal.ontology === "step") throw new Error(`[assembly] "${literal.slug}" is a step — open it in the guide editor`);
  throw new Error(`[assembly] "${literal.slug}" is a placement — open the part it is in`);
};

const pointed = async (ctx) => {
  const row = await open(ctx);
  if (!row) throw new Error("[assembly] no editor buffer is open on this thread — ask the operator to open the assembly editor");
  const data = row.data ?? {};
  if (!data.subject) throw new Error("[assembly] nothing is on the operator's screen — open a part first");
  const caller = { user: ctx.user, mode: ctx.mode, thread: ctx.thread };
  const fold = await ctx.call["/resolve"]({ ...caller, input: { slug: data.subject } });
  return { data, caller, placements: fold.placements, cursors: data.cursors ?? [] };
};

const folded = async (repository, subject, slug) => {
  if (!subject) return false;
  try {
    return (await repository.resolve(await repository.named(subject))).placements.some((one) => one.slug === slug);
  } catch {
    return false;
  }
};

export const tools = new Vector()
  .open(
    {
      nature: "/open",
      valence: 'Put a part on the operator\'s screen, folded; a guide opens the part it builds. The tree turns to it. Clears the selection. Returns the screen as it now is, the fold indexed. Example: { slug: "frame" }',
      input: v.object({
        slug: v.string().desc('The part or guide to open. Example: "frame"'),
      }),
    },
    async (ctx) => {
      const literal = await ctx.entities.literal.named(ctx.input.slug);
      const subject = foldable(literal);
      const row = await written(ctx, { subject, selected: [], scope: "buffer" });
      return { message: await shown(ctx), buffer: [row], object: { subject } };
    },
  )
  .open(
    {
      nature: "/select",
      valence: 'Select literals on the operator\'s screen by slug — the inspector shows one, the stage lights them, the context lists them. [] clears. Example: { slugs: ["frame.arm.0"] }',
      input: v.object({ slugs: v.array(v.string()).desc('The slugs to select. Example: ["frame.arm.0"]') }),
    },
    async (ctx) => {
      const found = await ctx.entities.literal.find({ slug: { $in: ctx.input.slugs } });
      const missing = ctx.input.slugs.filter((slug) => !found.some((row) => row.slug === slug));
      if (missing.length) throw new Error(`[assembly] no literal named ${missing.map((slug) => `"${slug}"`).join(", ")} — slugs are on the [Screen]; assembly_resolve lists every one`);
      const row = await written(ctx, { selected: [...ctx.input.slugs] });
      return { message: status(row.data), buffer: [row], object: { selected: row.data.selected } };
    },
  )
  .open(
    {
      nature: "/focus",
      valence: 'Frame the operator\'s stage on one literal — a view, never a change to the rows. A part is opened; a guide opens the part it builds; a placement outside the fold opens the part its layer belongs to. Example: { slug: "frame.arm.0" }',
      input: v.object({ slug: v.string().desc('The literal to frame. Example: "frame.arm.0"') }),
    },
    async (ctx) => {
      const repository = ctx.entities.literal;
      const literal = await repository.named(ctx.input.slug);
      const data = (await open(ctx))?.data ?? {};
      let patch;
      if (literal.ontology !== "placement") patch = { subject: foldable(literal), selected: [literal.slug], focus: null, scope: "buffer" };
      else if (await folded(repository, data.subject, literal.slug)) patch = { selected: [literal.slug], focus: literal.slug };
      else patch = { subject: literal.trait.PLACED.layer, selected: [literal.slug], focus: literal.slug };
      const row = await written(ctx, patch);
      return { message: await shown(ctx), buffer: [row], object: { subject: row.data.subject, focus: row.data.focus ?? null } };
    },
  )
  .open(
    {
      nature: "/pose",
      valence: 'Move one placement on the operator\'s stage: where its origin lands and how it is turned, in the WORLD frame the [Screen] reports — the layer\'s frame is worked out here. What is left out stays. A placement with an interior carries it whole. Writes one placement; the operator\'s undo list takes it. Example: { path: "tail.0/tail_half_a.0", translation: [0.03, 0.01, 0] }',
      input: v.object({
        path: v.string().desc('The placement to move, by its path on the [Screen]. Example: "tail.0/tail_half_a.0"'),
        translation: v.array(v.number(), { minItems: 3, maxItems: 3 }).optional().desc("Where its origin lands, metres, world frame. Example: [0.03, 0.01, 0]"),
        rotation: v.array(v.number(), { minItems: 4, maxItems: 4 }).optional().desc("How it is turned, quaternion xyzw, world frame. Example: [0, 0, 0, 1]"),
      }),
    },
    async (ctx) => {
      const { data, caller, placements } = await pointed(ctx);
      const { slug, path, ...seat } = posed(placements, ctx.input.path, ctx.input);
      const was = (await ctx.entities.literal.named(slug)).trait.PLACED;
      const named = { layer: was.layer, name: was.name, ...(was.parent && { parent: was.parent }), ref: was.ref };
      const back = { ...named, translation: [...(was.translation ?? [0, 0, 0])], rotation: [...(was.rotation ?? [0, 0, 0, 1])], scale: [...(was.scale ?? [1, 1, 1])] };
      await ctx.call["/placement"]({ ...caller, input: { ...named, ...seat } });
      const undo = [{ words: `posed ${slug}`, writes: [back], stamp: Date.now() }, ...(data.undo ?? [])].slice(0, KEPT);
      const row = await written(ctx, { desk: slug, undo, redo: [] });
      return { message: await shown(ctx), buffer: [row], object: { slug, path, ...seat } };
    },
  )
  .open(
    {
      nature: "/measure",
      valence: "Read what lies between the first cursor and the last, in metres and degrees: the distance, how much of it runs along the first axis and how much across, and the angle between the two axes. Writes nothing. Example: {}",
      input: v.object({}),
    },
    async (ctx) => {
      const { placements, cursors } = await pointed(ctx);
      if (cursors.length < 2) throw new Error("[assembly] a measure takes two cursors — the operator sets them on the stage in cursor mode");
      const held = measure(placements, [cursors[0], cursors.at(-1)]);
      return { message: `Between cursor 1 and cursor ${cursors.length}: ${held.distance} m · along ${held.along} · across ${held.across} · ${held.angle}°.`, object: held };
    },
  )
  .open(
    {
      nature: "/cursors",
      valence: "Remove cursors from the operator's stage by their number on the [Screen]; with no numbers, every one. Example: { drop: [2] }",
      input: v.object({ drop: v.array(v.integer({ minimum: 1 })).optional().desc("The numbers to remove. Example: [2]") }),
    },
    async (ctx) => {
      const held = (await open(ctx))?.data?.cursors ?? [];
      const drop = ctx.input.drop;
      const row = await written(ctx, { cursors: drop ? held.filter((_, index) => !drop.includes(index + 1)) : [] });
      return { message: status(row.data), buffer: [row], object: { cursors: row.data.cursors } };
    },
  );
