import { v, Vector } from "@vivalence/typology";
import { VERBS } from "../schematics.js";
import { line } from "./line.js";

// the writers as tools: each calls its verb through daemon.call with the caller — user, mode and
// thread ride along, the mode as the annotation a minted literal keeps — the way education's
// review rides /review/literal.
export const through = (nature) => async (ctx) => {
  const row = await ctx.call[nature]({ user: ctx.user, mode: ctx.mode, thread: ctx.thread, input: ctx.input });
  return { message: line(row), entities: { literal: [row] }, object: { slug: row.slug, ontology: row.ontology } };
};

export const mint = new Vector()
  .open(
    {
      nature: "/part",
      valence: 'Create a part — what a thing IS: geometry from a file on the freight or from a generator, and, when it is a thing you order, how many the kit ships. Give it an interior by placing other parts under it with assembly_placement. The same slug again is an over: what you carry replaces that trait, the rest stays. Example: { slug: "bolt_m3_16", name: "Bolt, short", parametric: { generator: "fastener.bolt", params: { thread: "M3", length: 16 } }, qty: 6 }',
      input: v.object(VERBS.part),
    },
    through("/part"),
  )
  .open(
    {
      nature: "/step",
      valence: 'Create a step of a guide: the placements it installs by slug (read assembly_resolve on the subject first — real slugs, never remembered ones), its numbered lines, its notes, its staging; its tool.* symbols are what it lays out. Then sequence it with assembly_sequence. The same slug again is an over; each list given is carried whole. Example: { slug: "drone.01", name: "Bottom plate", placements: [{ literal: "drone_rig.plate.0", active: true }], lines: [{ text: "Lay the bottom plate flat." }] }',
      input: v.object(VERBS.step),
    },
    through("/step"),
  )
  .open(
    {
      nature: "/guide",
      valence: 'Create a guide: the part it builds, its sections of steps, an intro, notes, the overview\'s staging. The same slug again is an over; each list given is carried whole. Example: { slug: "drone", name: "DroneAid build", subject: "drone_rig" }',
      input: v.object(VERBS.guide),
    },
    through("/guide"),
  )
  .open(
    {
      nature: "/rename",
      valence: 'Rename a part, a step or a guide: everything that names it follows — a part\'s placements are re-slugged, every step, guide and placement naming it names the new slug. Rename a placement with assembly_move and a new name instead. Example: { slug: "frame", to: "frame_carbon" }',
      input: v.object(VERBS.rename),
    },
    through("/rename"),
  )
  .open(
    {
      nature: "/duplicate",
      valence: 'Duplicate a literal: a part with its layer, a guide with its steps, a step (sequenced after the original), a placement with what sits under it as the next free name. Absent `to` takes the next free slug. Example: { slug: "motor_arm.0" }',
      input: v.object(VERBS.duplicate),
    },
    through("/duplicate"),
  );
