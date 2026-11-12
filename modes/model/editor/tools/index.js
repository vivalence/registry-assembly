import { v, Vector } from "@vivalence/typology";
import { open, shown, status } from "../harness.js";

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
  );
