import { v, Vector } from "@vivalence/typology";
import { ANNOTATION } from "../schematics.js";
import { counts } from "../bin.js";

// the agent's hands over the newest import buffer of its thread — the sketch's harness line:
// interpret all · annotate all · embed all · write. each rides its door through mode.call.

const open = async (ctx) => {
  if (!ctx.thread) return null;
  return ctx.daemon.entities.buffer.findOne({ thread: ctx.thread.id ?? ctx.thread, mode: ctx.mode.id }, { orderBy: { index: "desc" }, filters: { user: false } });
};

const line = ({ bin, counts: held }) =>
  `${bin.source ?? "no blend"} · ${Object.entries(held).map(([phase, n]) => `${n} ${phase}`).join(" · ")}` +
  (bin.assembly ? ` · assembly ${bin.assembly.slug}` : "");

const through = (door, shape = (input) => input) => async (ctx) => {
  const row = await open(ctx);
  if (!row) return { condition: "ERROR", output: { message: "no import buffer is open on this thread." } };
  const answered = await ctx.mode.call[door.slice(1)]({ buffer: row.id, ...shape(ctx.input) });
  return { output: { message: door === "/write" ? `wrote ${answered.rows} rows to ${answered.literals}` : line(answered), buffer: [row], object: door === "/write" ? answered : counts(answered.bin) } };
};

export const tools = new Vector()
  .open(
    {
      nature: "/interpret",
      valence: "Read every loose object of the open bin as members — one component per name stem and geometry, N placements. Example: {}",
      input: v.object({}),
    },
    through("/interpret"),
  )
  .open(
    {
      nature: "/annotate",
      valence: 'Name one member of the open bin — slug, name, symbols from the vocabulary in your instructions, kit count — or, with no member named, propose a naming for every unnamed member. Example: { id: "Motor_Arm0", annotation: { slug: "arm", name: "Motor arm", symbols: ["material.carbon", "source.3d_scan"], qty: 4 } }',
      input: v.object({ id: v.string().optional().desc('The member. Example: "Motor_Arm0"'), annotation: ANNOTATION.optional() }),
    },
    through("/annotate"),
  )
  .open(
    {
      nature: "/drop",
      valence: 'Keep members out of the embed — a jig, a helper, a duplicate — or take them back. Example: { ids: ["Computer"], dropped: true }',
      input: v.object({ ids: v.array(v.string(), { minItems: 1 }).desc('The members. Example: ["Computer"]'), dropped: v.boolean().desc("true keeps them out, false takes them back. Example: true") }),
    },
    through("/drop"),
  )
  .open(
    {
      nature: "/embed",
      valence: "Mint every annotated member of the open bin as a component row, and the assembly with every placement as a node. Example: {}",
      input: v.object({ ids: v.array(v.string(), { minItems: 1 }).optional().desc('Only these members. Example: ["Motor_Arm0"]') }),
    },
    through("/embed"),
  )
  .open(
    {
      nature: "/write",
      valence: "Serialize the embedded rows into the bin's target topography on disk. Example: {}",
      input: v.object({}),
    },
    through("/write"),
  );
