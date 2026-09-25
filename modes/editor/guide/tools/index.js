import { v, Vector } from "@vivalence/typology";
import { head, open, page, status } from "../harness.js";
import { read } from "../aperture/index.js";
import { payload } from "../buffer/form.js";

const shown = async (ctx) => {
  const row = await open(ctx);
  if (!row) throw new Error("[assembly] no guide editor buffer is open on this thread — ask the operator to open the guide editor first");
  return row;
};

const opened = async (ctx) => {
  const row = await shown(ctx);
  if (!row.data?.guide) throw new Error("[assembly] no guide is open on the operator's screen — open one with open first");
  return { row, held: await read(ctx, row.data.guide) };
};

// the screen moves as the operator's own click does: an unsaved edit is saved first, never dropped
const committed = async (ctx, row) => {
  const draft = row.data?.draft;
  if (!draft?.of) return;
  try {
    await ctx.call[`/${draft.ontology}`]({ user: ctx.user, mode: ctx.mode, thread: ctx.thread, input: payload(draft) });
  } catch (error) {
    throw new Error(`[assembly] the operator's unsaved edit of ${draft.of} did not save: ${error.message} — ask them to fix it before the screen moves`);
  }
};

const written = async (ctx, row, patch) => {
  row.data = { ...(row.data ?? {}), ...patch };
  await ctx.entities.em.flush();
  return row;
};

const STEP = v.string().desc('A step\'s slug from the [Guide] index. Example: "drone.04"');

// the author's hands: read a step or the guide whole, open a guide (at a step), select placements
export const tools = new Vector()
  .open(
    {
      nature: "/step/read",
      valence: 'Read one step of the open guide in full — what it installs and lays out, its tools, its numbered lines, its notes, its pictures, its staging. The [Guide] index only names steps; read before you quote a step, and before assembly_step on it, since every list you give replaces the whole. Example: { step: "drone.04" }',
      input: v.object({ step: STEP }),
    },
    async (ctx) => {
      const { held } = await opened(ctx);
      return { message: page(held, ctx.input.step) };
    },
  )
  .open(
    {
      nature: "/guide/read",
      valence: "Read the open guide's own page in full — its description, subject, intro lines, notes, pictures, overview staging and sections. Read before assembly_guide or assembly_sequence on it, since every list you give replaces the whole. Example: {}",
      input: v.object({}),
    },
    async (ctx) => {
      const { held } = await opened(ctx);
      return { message: head(held) };
    },
  )
  .open(
    {
      nature: "/open",
      valence: 'Put a guide on the operator\'s screen — and a step of it, by slug; absent, the guide tab. Use it when the operator asks to see a guide or a step, and after you write a step, so they see it. An edit they are typing is saved first. Returns where the screen now is. Example: { guide: "drone", step: "drone.04" }',
      input: v.object({
        guide: v.string().desc('The guide to open. Example: "drone"'),
        step: STEP.optional().desc('A step of it to show. Example: "drone.04"'),
      }),
    },
    async (ctx) => {
      const row = await shown(ctx);
      await committed(ctx, row);
      const held = await read(ctx, ctx.input.guide);
      const index = ctx.input.step ? held.steps.findIndex((one) => one.slug === ctx.input.step) + 1 : 0;
      if (ctx.input.step && !index) throw new Error(`[assembly] no step "${ctx.input.step}" in "${ctx.input.guide}" — the [Guide] index lists its steps by slug`);
      await written(ctx, row, { guide: ctx.input.guide, step: index, tab: index ? "step" : "guide", insp: true, sel: [], draft: null, picker: false, lb: null });
      return { message: status(row.data, held), buffer: [row], object: { guide: ctx.input.guide, step: index } };
    },
  )
  .open(
    {
      nature: "/select",
      valence: 'Light placements on the operator\'s stage and in the parts list, by slug — to point them at what a step installs or at what you are about to write into one. [] clears. Only placements light; a part or a step is refused. Returns where the screen now is. Example: { slugs: ["drone_rig.arm.0"] }',
      input: v.object({ slugs: v.array(v.string()).desc('The placement slugs to select, from the [Guide] index or assembly_resolve. Example: ["drone_rig.arm.0"]') }),
    },
    async (ctx) => {
      const { row, held } = await opened(ctx);
      const found = await ctx.entities.literal.find({ slug: { $in: ctx.input.slugs }, ontology: "placement" });
      const missing = ctx.input.slugs.filter((slug) => !found.some((one) => one.slug === slug));
      if (missing.length) throw new Error(`[assembly] no placement named ${missing.map((slug) => `"${slug}"`).join(", ")} — read the fold with assembly_resolve for real slugs`);
      await written(ctx, row, { sel: [...ctx.input.slugs] });
      return { message: status(row.data, held), buffer: [row], object: { sel: row.data.sel } };
    },
  );
