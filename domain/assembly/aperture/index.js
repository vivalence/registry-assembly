import { v, Vector } from "@vivalence/typology";
import { GENERATOR, ONTOLOGIES, TREE, VERBS } from "../schematics.js";
import { generate } from "../generators/index.js";

// the repository's verbs on the wire — one repository call each, the way education's /pick and
// /review are. the runtime slurps this into the daemon's root aperture and builds daemon.call
// from it: a tool calls a verb through daemon.call, the App calls it over the wire. every verb
// names its subject by slug in the input; nothing is resolved from the caller. the caller's mode
// rides along as the annotation a minted literal keeps.

const literal = (ctx) => ctx.entities.literal;
const named = (ctx, slug) => literal(ctx).named(slug);
const verb = (name) => v.object(VERBS[name]);

export const aperture = new Vector()
  .open(
    {
      nature: "/part",
      valence: 'Mint a part — what a thing IS: geometry from a file or a generator, a count from the kit when it is a thing you order, an interior when placements name it as their layer. The same slug again is an over: what the payload carries replaces that trait, what it leaves out stays. Example: { slug: "bolt_m3_16", name: "Bolt, short", parametric: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }, qty: 6 }',
      input: verb("part"),
    },
    (ctx) => literal(ctx).part(ctx.input, ctx.mode),
  )
  .open(
    {
      nature: "/step",
      valence: 'Mint a step — what it installs by placement slug, its numbered lines, its notes, its staging; its tool.* symbols are what it lays out. The same slug again is an over: each list given is carried whole. Example: { slug: "drone.01", name: "Bottom plate", placements: [{ literal: "drone_rig.plate.0", active: true }], lines: [{ text: "Lay the bottom plate flat." }] }',
      input: verb("step"),
    },
    (ctx) => literal(ctx).step(ctx.input, ctx.mode),
  )
  .open(
    {
      nature: "/guide",
      valence: 'Mint a guide — the part it builds, its sections of steps, an intro, notes, the overview\'s staging. The same slug again is an over: each list given is carried whole. Example: { slug: "drone", name: "DroneAid build", subject: "drone_rig", sections: [{ name: "Frame", steps: ["drone.01"] }] }',
      input: verb("guide"),
    },
    (ctx) => literal(ctx).guide(ctx.input, ctx.mode),
  )
  .open(
    {
      nature: "/placement",
      valence: 'Place a part under a part\'s layer — one occurrence: which layer, its name among its siblings, what it places, where. The same layer, parent and name again is an over, carrying only what changes. A fastener\'s placement says what it joins; which kind of joint it is, is a joint.* symbol on it. Example: { layer: "frame", name: "arm.0", ref: "arm", translation: [-0.0887, 0.0021, 0.0823] }',
      input: verb("placement"),
    },
    (ctx) => literal(ctx).placement(ctx.input, ctx.mode),
  )
  .open(
    {
      nature: "/sequence",
      valence: 'Set a guide\'s sections, whole — the steps in order under their headings. Every step must exist, once. Example: { guide: "drone", sections: [{ name: "Frame", steps: ["drone.01", "drone.02"] }] }',
      input: verb("sequence"),
    },
    async (ctx) => literal(ctx).sequence(await named(ctx, ctx.input.guide), ctx.input.sections),
  )
  .open(
    {
      nature: "/move",
      valence: 'Move a placement to another part\'s layer, under another parent, or to another name — its slug follows, the placements under it go with it, every join naming its path and every step naming its slug is rewritten. Example: { slug: "frame.arm.0", layer: "chassis", name: "arm.front" }',
      input: verb("move"),
    },
    (ctx) => {
      const { slug, ...to } = ctx.input;
      return literal(ctx).move(slug, to);
    },
  )
  .open(
    {
      nature: "/rename",
      valence: 'Rename a part, a step or a guide — its slug is its identity, so a part\'s placements are re-slugged and every step, guide and placement naming it follows. A placement is renamed with /move: its name is its path. Example: { slug: "frame", to: "frame_carbon" }',
      input: verb("rename"),
    },
    (ctx) => literal(ctx).rename(ctx.input.slug, ctx.input.to),
  )
  .open(
    {
      nature: "/duplicate",
      valence: 'Duplicate a literal under a free slug — a part with its own layer, a guide with its steps (`drone.01` → `drone_copy.01`), a step sequenced right after the original, a placement with the placements under it as the next free name among its siblings. The copy places the same parts; a duplicated placement holds nothing. Example: { slug: "drone" }',
      input: verb("duplicate"),
    },
    (ctx) => literal(ctx).duplicate(ctx.input.slug, { to: ctx.input.to }, ctx.mode),
  )
  .open(
    {
      nature: "/resolve",
      valence: 'The glTF-shaped tree of a part — its composition, a placed part\'s interior grafted under its placement, the parts beside them, the joints — or of a guide: its subject\'s composition with each placement\'s `at` (the first step naming it) and `active` after `upto` steps, and per step what it lays out. Example: { slug: "drone", upto: 4 }',
      input: verb("fold"),
    },
    async (ctx) => literal(ctx).resolve(await named(ctx, ctx.input.slug), { upto: ctx.input.upto }),
  )
  .open(
    {
      nature: "/bom",
      valence: 'What the build uses, part → count — a part\'s whole composition, or a guide\'s after `upto` steps — every placement of a part the kit ships, and nothing beneath one. Example: { slug: "drone", upto: 5 }',
      input: verb("fold"),
    },
    async (ctx) => Object.fromEntries(await literal(ctx).bom(await named(ctx, ctx.input.slug), { upto: ctx.input.upto })),
  )
  .open(
    {
      nature: "/closure",
      valence: 'A literal and everything it references, transitively — the literals a fold needs. Example: { slug: "frame" }',
      input: v.object({ slug: VERBS.fold.slug }),
    },
    async (ctx) => [...(await literal(ctx).closure(await named(ctx, ctx.input.slug))).values()],
  )
  .open(
    {
      nature: "/tree",
      valence: 'The tree a screen lists: the literals named and what they reach — absent, every root in the daemon; [] nothing. A part nothing places sits at the root, its own layer\'s placements under it, a placed part\'s interior under that placement; every guide at the root after, its steps under it, what each installs under the step; every part flat beside it with how often it is placed. Example: { slugs: ["drone_rig"] }',
      input: verb("tree"),
      output: TREE,
    },
    (ctx) => literal(ctx).tree(ctx.input.slugs),
  )
  .open(
    {
      nature: "/retract",
      valence: 'Unmint literals — the slugs named, gone: their traits, their placements, their joints. Refused while a literal not named still references one of them. `closure: true` takes everything only the named ones reach with them — a root and its whole interior in one call, never the inside of a part something else still places; `dry: true` answers what would go and takes nothing. Example: { slugs: ["drone_rig"], closure: true }',
      input: verb("retract"),
    },
    (ctx) => literal(ctx).retract(ctx.input.slugs, { closure: ctx.input.closure === true, dry: ctx.input.dry === true }),
  )
  .open(
    {
      nature: "/literals",
      valence: 'The literals of the domain as cards — every ontology, or one; a search over slug and name. What an App lists before it resolves. Example: { ontology: "part", search: "bolt" }',
      input: v.object({
        ontology: v.enum(Object.keys(ONTOLOGIES)).optional().desc('One ontology only. Example: "part"'),
        search: v.string().optional().desc('Matches slug or name. Example: "bolt"'),
        limit: v.integer({ minimum: 1, maximum: 2000 }).default(500).desc("At most. Example: 200"),
      }),
    },
    async (ctx) => {
      const { ontology, search, limit } = ctx.input;
      const where = { ...(ontology && { ontology }), ...(search && { search }) };
      const rows = await literal(ctx).find(where, { populate: ["mode"], limit, orderBy: { ontology: "asc", slug: "asc" } });
      return rows.map((row) => ({ ...literal(ctx).card.project(row), mode: row.mode?.slug ?? null }));
    },
  )
  .open(
    {
      nature: "/geometry",
      valence: 'Geometry generated from a generator and its params — three.js\'s JSON, metres, Y-up, origin where the part meets what it holds. Example: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }',
      input: GENERATOR,
    },
    (ctx) => generate(ctx.input).toJSON(),
  );
