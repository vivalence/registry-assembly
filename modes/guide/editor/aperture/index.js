import { v, Vector } from "@vivalence/typology";

// the editor's doors: reads of its own — the daemon's guides, one guide whole, the subjects a
// guide may build — and the domain's writers ridden through daemon.call
const INPUT = v.record(v.string(), v.any()).desc('The domain verb\'s input, verbatim — its fields are in the domain\'s schematics under VERBS. Example: { slug: "drone" }');

const literal = (ctx) => ctx.entities.literal;

const through = (nature) => (ctx) => ctx.call[nature]({ user: ctx.user, mode: ctx.mode, thread: ctx.thread, input: ctx.input });

const marks = (row) => (row.symbols?.isInitialized?.() ? row.symbols.getItems().map((symbol) => symbol.slug) : []).filter((slug) => slug !== row.ontology);

const card = (row) => ({ slug: row.slug, ontology: row.ontology, trait: row.trait ?? {}, symbols: marks(row), name: row.trait?.LABELED?.name ?? row.slug });

export const GUIDE = v.string().desc('A guide\'s slug. Example: "drone"');

// the guide as a screen reads it — the literal, its steps in order with what each lays out, the
// subject's fold with each placement's step, the parts' cards, the symbols' names
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
      nature: "/subjects",
      valence: "The parts a guide may build: every root — a part nothing places — with the parts inside it that have an interior of their own. Example: {}",
      input: v.object({}),
    },
    async (ctx) => {
      const { rows, parts } = await literal(ctx).tree();
      const inside = (slug) => rows.filter((row) => row.ontology === "placement" && row.key.startsWith(`${slug}/`) && parts.find((part) => part.slug === row.ref && part.scene?.length)).map((row) => row.ref);
      return rows
        .filter((row) => row.depth === 0 && row.ontology === "part")
        .map((row) => ({
          slug: row.slug,
          name: row.name,
          placements: row.scene?.length ?? 0,
          inside: [...new Set(inside(row.slug))].map((slug) => {
            const part = parts.find((one) => one.slug === slug);
            return { slug, name: part?.name ?? slug, placements: part?.scene?.length ?? 0 };
          }),
        }));
    },
  )
  .open({ nature: "/guide", valence: 'The domain\'s /guide — mint or over a guide; each list given is carried whole. Example: { slug: "drone", name: "DroneAid build" }', input: INPUT }, through("/guide"))
  .open({ nature: "/step", valence: 'The domain\'s /step — mint or over a step; each list given is carried whole. Example: { slug: "drone.01", placements: [] }', input: INPUT }, through("/step"))
  .open({ nature: "/sequence", valence: 'The domain\'s /sequence — a guide\'s sections, whole. Example: { guide: "drone", sections: [] }', input: INPUT }, through("/sequence"))
  .open({ nature: "/rename", valence: 'The domain\'s /rename — a step or a guide to a new slug, everything naming it following. Example: { slug: "drone.01", to: "drone.first" }', input: INPUT }, through("/rename"))
  .open({ nature: "/duplicate", valence: 'The domain\'s /duplicate — a step lands after the original; a guide takes its steps. Example: { slug: "drone.01" }', input: INPUT }, through("/duplicate"))
  .open({ nature: "/retract", valence: 'The domain\'s /retract — a step no guide names any more, or a guide with its steps. Example: { slugs: ["drone.01"] }', input: INPUT }, through("/retract"))
  .open({ nature: "/geometry", valence: 'The domain\'s /geometry — a parametric part\'s three.js JSON for the stage. Example: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }', input: INPUT }, through("/geometry"));
