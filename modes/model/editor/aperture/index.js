import { v, Vector } from "@vivalence/typology";
import { INPUT, SCHEMATICS, VOCABULARY } from "../schematics.js";

const through = (nature) => (ctx) => ctx.call[nature]({ user: ctx.user, mode: ctx.mode, thread: ctx.thread, input: ctx.input });

const strip = (schema) => JSON.parse(JSON.stringify(schema));

export const family = (slug) => (slug.includes(".") ? slug.slice(0, slug.indexOf(".")) : null);

export const vocabulary = (symbols) => {
  const held = {};
  for (const symbol of symbols) {
    const name = family(symbol.slug);
    if (!name) continue;
    (held[name] ??= []).push(symbol.slug);
  }
  for (const list of Object.values(held)) list.sort();
  return Object.fromEntries(Object.entries(held).sort(([a], [b]) => (a < b ? -1 : 1)));
};

export const aperture = new Vector()
  .open(
    {
      nature: "/schematics",
      valence: "The domain's schematics as JSON schema — what a literal of each ontology may carry, every trait's payload, every verb's input. The inspector's form and the harness's ontology section are drawn from these. Example: {}",
      input: v.object({}),
      output: SCHEMATICS,
    },
    (ctx) => {
      const { ONTOLOGIES, TRAITS, VERBS } = ctx.domain.schematics;
      return { ONTOLOGIES: strip(ONTOLOGIES), TRAITS: strip(TRAITS), VERBS: Object.fromEntries(Object.entries(VERBS).map(([name, fields]) => [name, strip(v.object(fields))])) };
    },
  )
  .open(
    {
      nature: "/vocabulary",
      valence: "The installed symbols by family, the ontology roots left out — what a literal may be marked with. Example: {}",
      input: v.object({}),
      output: VOCABULARY,
    },
    async (ctx) => vocabulary(await ctx.entities.symbol.find({})),
  )
  .open({ nature: "/tree", valence: "The domain's /tree — every root in the daemon and what it reaches. Example: {}", input: INPUT }, through("/tree"))
  .open({ nature: "/resolve", valence: 'The domain\'s /resolve — the subject folded. Example: { slug: "frame" }', input: INPUT }, through("/resolve"))
  .open({ nature: "/bom", valence: 'The domain\'s /bom — what the build uses, part → count. Example: { slug: "frame" }', input: INPUT }, through("/bom"))
  .open({ nature: "/closure", valence: 'The domain\'s /closure — what a literal reaches, listed before a retract. Example: { slug: "frame" }', input: INPUT }, through("/closure"))
  .open({ nature: "/part", valence: 'The domain\'s /part — mint or over a part. Example: { slug: "bolt_m3_16", qty: 6 }', input: INPUT }, through("/part"))
  .open({ nature: "/placement", valence: 'The domain\'s /placement — place, or over a placement: the gizmo\'s release and the joint mode land here. Example: { layer: "frame", name: "arm.0", ref: "arm", translation: [0.1, 0, 0] }', input: INPUT }, through("/placement"))
  .open({ nature: "/move", valence: 'The domain\'s /move — a placement to another layer, parent or name. Example: { slug: "frame.arm.0", name: "arm.left" }', input: INPUT }, through("/move"))
  .open({ nature: "/rename", valence: 'The domain\'s /rename — a part to a new slug, everything naming it following. Example: { slug: "frame", to: "frame_carbon" }', input: INPUT }, through("/rename"))
  .open({ nature: "/duplicate", valence: 'The domain\'s /duplicate — a copy under the next free slug; a placement as the next free name. Example: { slug: "frame" }', input: INPUT }, through("/duplicate"))
  .open({ nature: "/retract", valence: 'The domain\'s /retract — literals gone, a root with its interior when closure is true. Example: { slugs: ["drone_rig"], closure: true }', input: INPUT }, through("/retract"))
  .open({ nature: "/geometry", valence: 'The domain\'s /geometry — a parametric part\'s three.js JSON for the stage. Example: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }', input: INPUT }, through("/geometry"));
