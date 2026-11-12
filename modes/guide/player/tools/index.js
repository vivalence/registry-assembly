import { v, Vector } from "@vivalence/typology";
import { open, page } from "../harness.js";
import { read } from "../aperture/index.js";

const shown = async (ctx) => {
  const row = await open(ctx);
  if (!row) throw new Error("[assembly] no guide buffer is open on this thread — ask the builder to open the guide first");
  if (!row.data?.guide) throw new Error("[assembly] the builder has no guide open — ask them to pick one from the screen");
  return row;
};

// the mentor's hands: read a step whole, turn the builder to a step
export const tools = new Vector()
  .open(
    {
      nature: "/step/read",
      valence: 'Read one step of the open guide in full — what it lays out, its tools, its notes with their kind, its numbered lines. The [Guide] index only names steps; read before you quote or instruct from one. Example: { step: "drone.04" }',
      input: v.object({ step: v.string().desc('The step\'s slug from the [Guide] index. Example: "drone.04"') }),
    },
    async (ctx) => {
      const row = await shown(ctx);
      return { message: page(await read(ctx, row.data.guide), ctx.input.step) };
    },
  )
  .open(
    {
      nature: "/step",
      valence: 'Turn the builder\'s screen to a step of the open guide — by slug, or by its number; 0 is the overview. Returns where the screen now is. Example: { step: "drone.04" }',
      input: v.object({ step: v.union([v.string(), v.integer({ minimum: 0 })]).desc('The step\'s slug, or its 1-based number; 0 is the overview. Example: "drone.04"') }),
    },
    async (ctx) => {
      const row = await shown(ctx);
      const held = await read(ctx, row.data.guide);
      const wanted = ctx.input.step;
      const index = typeof wanted === "number" ? wanted : held.steps.findIndex((one) => one.slug === wanted) + 1;
      if (typeof wanted === "string" && index === 0) throw new Error(`[assembly] no step "${wanted}" in "${row.data.guide}"`);
      if (index > held.steps.length) throw new Error(`[assembly] "${row.data.guide}" has ${held.steps.length} steps`);
      row.data = { ...(row.data ?? {}), step: index, view: null, focus: null, lightbox: null };
      await ctx.entities.em.flush();
      const step = index ? held.steps[index - 1] : null;
      return { message: step ? `on step ${String(index).padStart(2, "0")} ${step.name}` : "on the overview", buffer: [row], object: { step: index, slug: step?.slug ?? null } };
    },
  );
