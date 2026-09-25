import { v, Vector } from "@vivalence/typology";

// the player's reads over the domain: the daemon's guides, and one guide whole — the literal, its
// steps in order with what each lays out, the subject's fold, the parts' cards, the symbols' names
const literal = (ctx) => ctx.entities.literal;

const marks = (row) => (row.symbols?.isInitialized?.() ? row.symbols.getItems().map((symbol) => symbol.slug) : []).filter((slug) => slug !== row.ontology);

const card = (row) => ({ slug: row.slug, ontology: row.ontology, trait: row.trait ?? {}, symbols: marks(row), name: row.trait?.LABELED?.name ?? row.slug });

export const GUIDE = v.string().desc('A guide\'s slug. Example: "drone"');

// the guide as a screen reads it
export const read = async (ctx, slug) => {
  const repository = literal(ctx);
  const guide = await repository.named(slug);
  if (guide.ontology !== "guide") throw new Error(`[assembly] "${slug}" is a ${guide.ontology}, not a guide`);
  if (!guide.symbols.isInitialized()) await guide.symbols.init();
  const fold = await repository.resolve(guide);
  const order = fold.steps.map((step) => step.slug);
  const rows = order.length ? await repository.find({ slug: { $in: order } }, { populate: ["symbols"] }) : [];
  const steps = fold.steps.map((step) => {
    const row = rows.find((one) => one.slug === step.slug);
    return { ...(row ? card(row) : { slug: step.slug, ontology: "step", trait: {}, symbols: [], name: step.slug }), index: step.index, section: step.section, prepared: step.prepared };
  });
  const slugs = Object.keys(fold.parts);
  const parts = {};
  for (const row of slugs.length ? await repository.find({ slug: { $in: slugs } }, { populate: ["symbols"] }) : []) {
    const symbols = marks(row);
    parts[row.slug] = {
      name: row.trait?.LABELED?.name ?? row.slug,
      symbols,
      fastener: symbols.includes("material.fastener"),
      material: symbols.find((one) => one.startsWith("material.")) ?? null,
      modeled: row.trait?.MODELED ?? null,
      qty: row.trait?.COUNTED?.qty ?? null,
    };
  }
  const symbols = Object.fromEntries((await ctx.entities.symbol.find({})).map((symbol) => [symbol.slug, symbol.trait?.LABELED?.name ?? symbol.slug]));
  return { guide: card(guide), steps, fold, parts, symbols };
};

export const aperture = new Vector()
  .open(
    {
      nature: "/guides",
      valence: "The daemon's guides as cards — what a fresh buffer lists. Example: {}",
      input: v.object({}),
    },
    async (ctx) => {
      const rows = await literal(ctx).find({ ontology: "guide" }, { orderBy: { slug: "asc" } });
      return rows.map((row) => ({
        slug: row.slug,
        name: row.trait?.LABELED?.name ?? row.slug,
        description: row.trait?.LABELED?.description ?? "",
        subject: row.trait?.SEQUENCED?.subject ?? null,
        steps: (row.trait?.SEQUENCED?.sections ?? []).reduce((n, section) => n + (section.steps?.length ?? 0), 0),
      }));
    },
  )
  .open(
    {
      nature: "/read",
      valence: 'One guide whole: the literal, its steps in order with what each lays out, the subject\'s fold with each placement\'s step, the parts\' cards, the symbols\' names. Example: { guide: "drone" }',
      input: v.object({ guide: GUIDE }),
    },
    (ctx) => read(ctx, ctx.input.guide),
  )
  .open(
    {
      nature: "/geometry",
      valence: 'The domain\'s /geometry — a parametric part\'s three.js JSON for the stage. Example: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }',
      input: v.record(v.string(), v.any()).desc("The generator and its params. Example: { generator: \"fastener.bolt\", params: {} }"),
    },
    (ctx) => ctx.call["/geometry"]({ user: ctx.user, mode: ctx.mode, thread: ctx.thread, input: ctx.input }),
  );
