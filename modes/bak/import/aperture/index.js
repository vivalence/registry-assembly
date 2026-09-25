import { join } from "@std/path";
import { v, Vector } from "@vivalence/typology";
import { ANNOTATION, HARVEST, PROGRESS } from "../schematics.js";
import { harvest, read, scan } from "../blend.js";
import { interpret, merge, unmerge } from "../interpret.js";
import { annotate, humanize, slugify } from "../annotate.js";
import { counts, member, settle } from "../bin.js";
import { embed } from "../embed.js";
import { write } from "../write.js";

// the doors over one bin — the buffer's data. every editing door reads the buffer by id, folds the
// bin, writes it back and answers the bin with its phase counts; the view subscribes to its own
// buffer and follows. the buffer's user filter is off here: the caller holds the buffer's id from
// its own screen, and a standalone buffer carries no thread to filter by. every phase edge has a
// door and its inverse — interpret ⇄ dissolve, annotate ⇄ forget — but embed: the domain mints
// rows and never unmints them. /upload is the whole walk in one: a .blend in the request body
// lands on the mountpoint and runs harvest → interpret → annotate → embed, streaming the bin back
// after every step.

const BUFFER = v.string().desc('The buffer whose bin this is. Example: "01JQ…"');
const ID = v.string().desc('A member\'s id in the bin. Example: "Motor_Arm0"');
const IDS = v.array(v.string(), { minItems: 1 }).desc('Members of the bin, by id. Example: ["Motor_Arm0", "Computer"]');

const opened = async (ctx, id) => {
  const row = await ctx.daemon.entities.buffer.findOne({ id }, { filters: { user: false } });
  if (!row) throw new Error(`[import] no buffer ${id}`);
  return row;
};

const answer = (bin) => ({ bin, counts: counts(bin) });

const keep = async (ctx, row, bin) => {
  const next = settle(bin);
  row.data = { ...row.data, bin: next };
  await ctx.daemon.entities.em.flush();
  return next;
};

// read → fold → write: the one move every editing door makes
const fold = (edit) => async (ctx) => {
  const row = await opened(ctx, ctx.input.buffer);
  const bin = settle(row.data?.bin);
  return answer(await keep(ctx, row, await edit(ctx, bin, row)));
};

const unminted = (bin, ids) => {
  for (const id of ids) {
    member(bin, id);
    if (bin.embedded[id]) throw new Error(`[import] "${id}" is minted as ${bin.embedded[id].slug} — a row has no way back`);
  }
  return new Set(ids);
};

const without = (record, leaving) => Object.fromEntries(Object.entries(record).filter(([id]) => !leaving.has(id)));

// the steps, each a pure fold over the bin — the doors below and /upload share them

const harvested = async (ctx, bin, input) => {
  const { log: _, ...held } = await harvest(ctx.mode.mountpoint.absolute, input);
  for (const object of held.objects) ctx.mode.freight?.admit(`${held.intake}/${object.file}`);
  ctx.mode.freight?.admit(`${held.intake}/blend.json`);
  return { ...bin, ...held, members: [], annotations: {}, embedded: {} };
};

const interpreted = (bin, objects = null) => {
  const held = new Set(bin.members.flatMap((held) => held.objects));
  const wanted = bin.objects.filter((object) => !held.has(object.object) && (!objects || objects.includes(object.object)));
  return { ...bin, members: [...bin.members, ...interpret(wanted)] };
};

const annotated = (bin, ids = null) => {
  for (const id of ids ?? []) member(bin, id);
  return { ...bin, annotations: annotate(ids ? bin.members.filter((held) => ids.includes(held.id)) : bin.members, bin.annotations) };
};

const embedded = async (ctx, bin, ids = null) => (await embed(ctx, bin, ids)).bin;

export const aperture = new Vector()
  .open(
    {
      nature: "/scan",
      valence: "What the mountpoint holds: .blend files to harvest, intakes already harvested, and whether blender is on this host. Example: {}",
      input: v.object({}),
    },
    (ctx) => scan(ctx.mode.mountpoint.absolute),
  )
  .open(
    {
      nature: "/upload",
      valence: 'A .blend in the request body, its name in the x-viva-name header, the scale and the buffer as query parameters — landed on the mountpoint and walked harvest → interpret → annotate → embed; the assembly is named after the file. Streams the bin after every step. Example: POST /upload?buffer=01JQ…&scale=0.05&origin=Frame_Star',
      yields: PROGRESS,
    },
    async function* (_, ctx) {
      const body = ctx.request?.raw?.body;
      if (!body) throw new Error("[import] no file in the request body");
      const query = ctx.request.url?.searchParams ?? new URL(ctx.request.url).searchParams;
      const header = ctx.request.headers?.get?.("x-viva-name");
      const name = ((header && decodeURIComponent(header)) || query.get("name") || "").split("/").pop();
      if (!/\.blend$/i.test(name)) throw new Error(`[import] a .blend is what the importer takes — got "${name || "no name"}"`);
      const scale = Number(query.get("scale"));
      if (!(scale > 0)) throw new Error("[import] an upload takes scale — metres per blender unit — as a query parameter; the file cannot say");
      const origin = query.get("origin") || undefined;
      const row = await opened(ctx, query.get("buffer"));
      const root = ctx.mode.mountpoint.absolute;
      await Deno.writeFile(join(root, name), body);
      yield { stage: "upload", fraction: 0.1 };
      const stem = name.replace(/\.blend$/i, "");
      let bin = await keep(ctx, row, { ...(await harvested(ctx, settle(row.data?.bin), { file: name, scale, origin })), assembly: { slug: slugify(stem), name: humanize(stem) } });
      yield { stage: "harvest", fraction: 0.4, ...answer(bin) };
      bin = await keep(ctx, row, interpreted(bin));
      yield { stage: "interpret", fraction: 0.6, ...answer(bin) };
      bin = await keep(ctx, row, annotated(bin));
      yield { stage: "annotate", fraction: 0.7, ...answer(bin) };
      bin = await keep(ctx, row, await embedded(ctx, bin));
      yield { stage: "embed", fraction: 1, done: true, ...answer(bin) };
    },
  )
  .open(
    {
      nature: "/harvest",
      valence: 'Run blender headless over a .blend already on the mountpoint — every mesh object to a GLB in metres plus blend.json — and load the objects into the bin. The scale is the operator\'s: nothing about the file\'s units is assumed. Example: { buffer: "01JQ…", file: "model.blend", scale: 0.05, origin: "Frame_Star" }',
      input: v.object({ buffer: BUFFER, ...HARVEST.properties }),
    },
    fold((ctx, bin) => harvested(ctx, bin, ctx.input)),
  )
  .open(
    {
      nature: "/load",
      valence: 'Load an intake already on the mountpoint into the bin — its blend.json and objects; the members, annotations and embeds start over. Example: { buffer: "01JQ…", intake: "intake/model" }',
      input: v.object({ buffer: BUFFER, intake: v.string().desc('The intake directory under the mountpoint. Example: "intake/model"') }),
    },
    fold(async (ctx, bin) => ({ ...bin, ...(await read(ctx.mode.mountpoint.absolute, ctx.input.intake)), members: [], annotations: {}, embedded: {} })),
  )
  .open(
    {
      nature: "/clear",
      valence: 'Empty the bin — no file, no objects, no members; the intake on disk stays. Example: { buffer: "01JQ…" }',
      input: v.object({ buffer: BUFFER }),
    },
    fold(() => ({})),
  )
  .open(
    {
      nature: "/interpret",
      valence: 'Read loose objects as members: one component per name stem and geometry, N placements. Members already read stay; every loose object is read, or only the ones named. Example: { buffer: "01JQ…", objects: ["Motor_Arm0", "Motor_Arm1"] }',
      input: v.object({ buffer: BUFFER, objects: v.array(v.string(), { minItems: 1 }).optional().desc('Only these loose objects. Example: ["Frame_Star"]') }),
    },
    fold((ctx, bin) => interpreted(bin, ctx.input.objects ?? null)),
  )
  .open(
    {
      nature: "/dissolve",
      valence: 'Take members back to loose objects — the inverse of interpret; their namings go with them. A minted member stays. Example: { buffer: "01JQ…", ids: ["Motor_Arm0"] }',
      input: v.object({ buffer: BUFFER, ids: IDS }),
    },
    fold((ctx, bin) => {
      const leaving = unminted(bin, ctx.input.ids);
      return { ...bin, members: bin.members.filter((held) => !leaving.has(held.id)), annotations: without(bin.annotations, leaving) };
    }),
  )
  .open(
    {
      nature: "/unmerge",
      valence: 'Take objects out of a member into members of their own — two boards the interpreter folded into one. Without `objects`, every object but the first leaves. Example: { buffer: "01JQ…", id: "FlightController00", objects: ["FlightController01"] }',
      input: v.object({ buffer: BUFFER, id: ID, objects: v.array(v.string()).optional().desc('The objects leaving. Example: ["FlightController01"]') }),
    },
    fold((ctx, bin) => ({ ...bin, members: unmerge(bin.members, ctx.input.id, ctx.input.objects) })),
  )
  .open(
    {
      nature: "/merge",
      valence: 'Fold members together — the first keeps its id and file. Example: { buffer: "01JQ…", ids: ["Propeller0", "Propeller1"] }',
      input: v.object({ buffer: BUFFER, ids: v.array(v.string(), { minItems: 2 }).desc('The members, first first. Example: ["Propeller0", "Propeller1"]') }),
    },
    fold((ctx, bin) => ({ ...bin, members: merge(bin.members, ctx.input.ids) })),
  )
  .open(
    {
      nature: "/drop",
      valence: 'Keep members in the bin but out of the embed — or take them back in. Example: { buffer: "01JQ…", ids: ["Computer"], dropped: true }',
      input: v.object({ buffer: BUFFER, ids: IDS, dropped: v.boolean().desc("true keeps them out, false takes them back. Example: true") }),
    },
    fold((ctx, bin) => {
      // no default: the direct strategy fills none, and a drop that means nothing is a fault, not a drop
      if (typeof ctx.input.dropped !== "boolean") throw new Error("[import] /drop takes dropped: true to keep members out, false to take them back");
      const chosen = unminted(bin, ctx.input.ids);
      return { ...bin, members: bin.members.map((held) => (chosen.has(held.id) ? { ...held, dropped: ctx.input.dropped } : held)) };
    }),
  )
  .open(
    {
      nature: "/annotate",
      valence: 'Name a member — slug, name, symbols, kit count — or, with no annotation, propose a naming for every member that has none, or only for the ones named. Example: { buffer: "01JQ…", id: "Motor_Arm0", annotation: { slug: "arm", name: "Motor arm", symbols: ["material.carbon"], qty: 4 } }',
      input: v.object({ buffer: BUFFER, id: ID.optional(), ids: IDS.optional(), annotation: ANNOTATION.optional() }),
    },
    fold((ctx, bin) => {
      if (ctx.input.annotation) {
        if (!ctx.input.id) throw new Error("[import] an annotation names one member — pass its id");
        member(bin, ctx.input.id);
        return { ...bin, annotations: { ...bin.annotations, [ctx.input.id]: ctx.input.annotation } };
      }
      return annotated(bin, ctx.input.ids ?? (ctx.input.id ? [ctx.input.id] : null));
    }),
  )
  .open(
    {
      nature: "/forget",
      valence: 'Take the namings off members — the inverse of annotate; they are interpret again. A minted member keeps its name. Example: { buffer: "01JQ…", ids: ["Motor_Arm0"] }',
      input: v.object({ buffer: BUFFER, ids: IDS }),
    },
    fold((ctx, bin) => ({ ...bin, annotations: without(bin.annotations, unminted(bin, ctx.input.ids)) })),
  )
  .open(
    {
      nature: "/assembly",
      valence: 'Name the assembly the bin composes and the topography `write` lands in. Example: { buffer: "01JQ…", slug: "frame", name: "The frame", target: "@package/topography/model" }',
      input: v.object({
        buffer: BUFFER,
        slug: v.string().desc('The assembly\'s slug. Example: "frame"'),
        name: v.string().desc('A name for eyes. Example: "The frame"'),
        target: v.string().optional().desc('The topography to write into. Example: "@package/topography/model"'),
      }),
    },
    fold((ctx, bin) => ({ ...bin, assembly: { slug: ctx.input.slug, name: ctx.input.name }, ...(ctx.input.target && { target: ctx.input.target }) })),
  )
  .open(
    {
      nature: "/embed",
      valence: 'Mint rows under this mode through the domain: a component per annotated member with its GLB on the freight, the assembly with every placement as a node of its own layer. Every annotated member, or only the ones named. Example: { buffer: "01JQ…", ids: ["Motor_Arm0"] }',
      input: v.object({ buffer: BUFFER, ids: IDS.optional() }),
    },
    fold((ctx, bin) => embedded(ctx, bin, ctx.input.ids ?? null)),
  )
  .open(
    {
      nature: "/write",
      valence: 'Serialize the embedded rows into the target topography on disk — dataset/literals/<assembly>.json and freight/parts — so a fresh daemon installs them. Example: { buffer: "01JQ…" }',
      input: v.object({ buffer: BUFFER, target: v.string().optional().desc('Overrides the bin\'s target. Example: "@package/topography/model"') }),
    },
    async (ctx) => {
      const row = await opened(ctx, ctx.input.buffer);
      const bin = settle(row.data?.bin);
      return write(ctx, ctx.input.target ? { ...bin, target: ctx.input.target } : bin);
    },
  );
