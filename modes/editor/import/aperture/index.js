import { join } from "@std/path";
import { v, Vector } from "@vivalence/typology";
import paladin from "@vivalence/paladin";
import { EVENT, FORMATS, SETTINGS, STAGES, TREE } from "../schematics.js";
import { sniff } from "../sniff.js";
import { blender, decode, freecad, intakeOf } from "../decode.js";
import { commit } from "../commit.js";
import { recorded } from "../files.js";

const pad = (n) => String(n).padStart(2, "0");

const clock = () => {
  const started = performance.now();
  return () => {
    const ms = performance.now() - started;
    return `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${pad(Math.floor((ms % 1000) / 10))}`;
  };
};

const percent = (stage) => STAGES.indexOf(stage) * 20;

const megabytes = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

const log = () => {
  const t = clock();
  const lines = [];
  const say = (lvl, msg) => lines.push({ t: t(), lvl, msg });
  const drain = (stage, extra = {}) => lines.splice(0, lines.length).map((line, index, all) => ({ stage, progress: percent(stage), ...line, ...(index === all.length - 1 ? extra : {}) }));
  const fail = (stage, message) => {
    say("FAIL", message);
    return drain(stage, { done: true, failed: true });
  };
  return { say, drain, fail };
};

const named = (ctx) => {
  const header = ctx.request?.headers?.get?.("x-viva-name");
  const name = (header ? decodeURIComponent(header) : "").split("/").pop();
  if (!name) throw new Error("[import] no file name — send it in the x-viva-name header");
  return name;
};

const query = (ctx) => ctx.request?.url?.searchParams ?? new URL(ctx.request?.url ?? "http://x/").searchParams;

const meta = (name, spec, bytes, read) => ({
  source: name,
  route: spec.route,
  bytes,
  triangles: read.triangles,
  meshes: read.meshes,
  materials: read.materials,
  animations: read.animations,
  axis: read.up === "Y" ? "Y-up" : "Z-up → Y-up",
  unit: read.unit,
  ...(read.declared != null && { declared: read.declared }),
  decoder: read.decoder,
});

const reading = (name, spec, bytes, read) => ({
  source: name,
  format: read.format,
  route: spec.route,
  decoder: read.decoder,
  intake: read.intake,
  bytes,
  declared: { ...(read.declared != null && { unit: read.declared }), up: read.up },
  meshes: read.meshes,
  hidden: read.hidden ?? 0,
  empties: read.empties ?? [],
  strays: read.strays ?? [],
  others: read.others ?? [],
  materials: read.materials,
  animations: read.animations,
  triangles: read.triangles,
  objects: read.objects,
});

const settled = (input) => {
  const held = input ?? {};
  for (const key of ["into", "unit", "up", "fold", "groups", "hidden"]) if (held[key] == null) throw new Error(`[import] settings.${key} is missing — a commit takes every choice, made; nothing is assumed`);
  if (!(held.unit > 0)) throw new Error("[import] settings.unit is metres per source unit — a positive number");
  if (!String(held.into).trim()) throw new Error("[import] settings.into names the part this import mints as its root — it cannot be blank");
  return held;
};

export const aperture = new Vector()
  .open(
    {
      nature: "/parse",
      valence: "The dry parse: a model file in the request body, its name in the x-viva-name header, optional ?up= ?chord= to steer the decoder — sniffed, validated, decoded on the mountpoint, and READ: every object in the file's own units, what the file declares, what the decoder skipped. Nothing is minted; the last line carries the READING for the operator's choices. Example: POST /parse with x-viva-name: drone.blend",
      yields: EVENT,
    },
    async function* (_, ctx) {
      const { say, drain, fail } = log();
      const body = ctx.request?.raw?.body;
      if (!body) throw new Error("[import] no file in the request body");
      const name = named(ctx);
      const asked = query(ctx);
      const steer = { ...(asked.get("up") && { up: asked.get("up") }), ...(asked.get("chord") && { chord: Number(asked.get("chord")) }) };

      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      const seen = sniff(bytes, name);
      if (!seen.format) {
        yield* fail("sniff", `no known magic and .${seen.extension || "?"} is not a format the importer reads — ${Object.keys(FORMATS).join(" · ")}`);
        return;
      }
      const spec = FORMATS[seen.format];
      if (seen.matched) say("SNIFF", `magic bytes matched ${spec.label} — extension trusted`);
      else if (seen.found) say("WARN", `magic bytes say ${spec.label}; the extension .${seen.extension} said ${seen.claimed ? FORMATS[seen.claimed].label : "nothing"} — bytes win`);
      else say("WARN", `no magic to read — .${seen.extension} says ${spec.label}, extension trusted`);
      yield* drain("sniff");

      if (!blender()) {
        yield* fail("validate", "no blender on this host — every route ends in blender headless");
        return;
      }
      if (spec.cad && !freecad()) {
        yield* fail("validate", `${spec.label} is a b-rep — no FreeCAD on this host to tessellate it`);
        return;
      }
      const root = ctx.mode.mountpoint.absolute;
      const intake = intakeOf(name);
      await paladin.state.dir(join(root, intake));
      await Deno.writeFile(join(root, intake, name), bytes);
      say("OK", `route: ${spec.route}`);
      say("OK", `${megabytes(bytes.length)} landed on the intake`);
      yield* drain("validate");

      let read;
      try {
        read = await decode({ root, name, format: seen.format, settings: { ...steer, unit: 1 } }, say);
      } catch (error) {
        yield* fail("decode", error.message);
        return;
      }
      for (const object of read.objects) await recorded(ctx, join(intake, object.file));
      if (read.declared != null) say("OK", `the file declares ${read.declared} m per unit`);
      else say("WARN", `${spec.label} declares no unit — the numbers below are in the file's own units`);
      say("OK", `up axis read as ${read.up}${spec.axis === "Y-up" ? " — as the format says" : " — the format's convention"}`);
      if (read.hidden) say("WARN", `${read.hidden} object(s) hidden in the source — kept out unless asked`);
      if (read.empties?.length) say("OK", `${read.empties.length} empty object(s) skipped — not parts: ${read.empties.join(", ")}`);
      if (read.strays?.length) say("FIX", `${read.strays.length} object(s) have no node in the scene and so no position of their own — they will sit on the root's origin: ${read.strays.join(", ")}`);
      if (read.others?.length) say("OK", `skipped ${read.others.join(", ")} — not parts`);
      say("DONE", `read ${read.meshes} mesh(es) · ${read.materials} material(s) · ${read.triangles.toLocaleString("en")} triangles — choose, then commit`);
      yield* drain("decode", { meta: meta(name, spec, bytes.length, read), reading: reading(name, spec, bytes.length, read), done: true });
    },
  )
  .open(
    {
      nature: "/commit",
      valence: 'The live parse: the file already on the intake, decoded again under the operator\'s settings — unit, up axis, recentre, fold rule, groups, hidden, chord — then parts and their placements minted through the domain\'s verbs. Streams every line; the DONE line carries what was minted. Example: { name: "drone.blend", settings: { unit: 0.05, up: "Z", fold: "fingerprint", groups: true, hidden: false } }',
      input: v.object({ name: v.string().desc('The file\'s name on the intake. Example: "drone.blend"'), settings: SETTINGS }),
      yields: EVENT,
    },
    async function* (_, ctx) {
      const { say, drain, fail } = log();
      const name = (ctx.input?.name ?? "").split("/").pop();
      if (!name) throw new Error("[import] /commit takes the file's name on the intake");
      const settings = settled(ctx.input?.settings);
      const root = ctx.mode.mountpoint.absolute;
      const intake = intakeOf(name);
      const bytes = await Deno.stat(join(root, intake, name)).then((stat) => stat.size).catch(() => null);
      if (bytes == null) {
        yield* fail("validate", `${name} is not on the intake — parse it first`);
        return;
      }
      const seen = sniff(new Uint8Array(await Deno.readFile(join(root, intake, name))).subarray(0, 4096), name);
      const spec = FORMATS[seen.format];
      say("OK", `settings: into "${settings.into}" · ${settings.unit} m per unit · ${settings.up}-up · fold by ${settings.fold} · groups ${settings.groups ? "kept" : "flattened"} · hidden ${settings.hidden ? "included" : "left out"}${settings.recentre ? ` · recentred on ${settings.recentre}` : ""}${settings.chord ? ` · chord ${settings.chord} mm` : ""}`);
      yield* drain("review");

      let read;
      try {
        read = await decode({ root, name, format: seen.format, settings, into: "commit" }, say);
      } catch (error) {
        yield* fail("decode", error.message);
        return;
      }
      if (read.declared != null && read.unit !== read.declared) say("FIX", `unit: ${read.unit} m per unit, the file declared ${read.declared}`);
      else say("OK", `unit ${read.unit} m per unit`);
      say(spec.axis === "Y-up" ? "OK" : "FIX", spec.axis === "Y-up" ? "axis already Y-up, no root transform" : "applied Z-up → Y-up root rotation (−90° X)");
      if (read.strays?.length) say("FIX", `${read.strays.length} object(s) carry no position of their own and land on the root's origin: ${read.strays.join(", ")}`);
      yield* drain("decode", { meta: meta(name, spec, bytes, read) });

      let minted;
      try {
        minted = await commit(ctx, read, settings, say);
      } catch (error) {
        yield* fail("commit", error.message);
        return;
      }
      say("DONE", `committed ${minted.model} — ${minted.parts.length} part(s) · ${minted.placed} placement(s) · glTF 2.0 on the freight`);
      for (const line of drain("commit", { minted, done: true })) yield { ...line, progress: line.done ? 100 : line.progress };
    },
  )
  .open(
    {
      nature: "/revert",
      valence: 'Take a commit back: the rows it minted are retracted through the domain and their geometry files leave the mountpoint, so the file stands parsed again with nothing of it in the database. Refused while a row this buffer did not mint still references one of them. Example: { slugs: ["drone_rig", "arm", "motor"] }',
      input: v.object({ slugs: v.array(v.string()).desc('The slugs this job minted — its parts and their placements. Example: ["drone_rig", "arm"]') }),
      output: v.object({
        retracted: v.array(v.string()).desc('The rows gone. Example: ["drone_rig", "arm"]'),
        files: v.array(v.string()).desc('The geometry files removed from the mountpoint. Example: ["parts/arm.glb"]'),
      }),
    },
    async (ctx) => {
      if (!Array.isArray(ctx.input?.slugs)) throw new Error("[import] /revert takes slugs — what the job minted");
      const caller = { user: ctx.user, mode: ctx.mode, thread: ctx.thread };
      const { retracted } = await ctx.call["/retract"]({ ...caller, input: { slugs: ctx.input.slugs } });
      const root = ctx.mode.mountpoint.absolute;
      const files = [];
      for (const slug of retracted) {
        const file = `parts/${slug}.glb`;
        const gone = await Deno.remove(join(root, file)).then(() => true).catch(() => false);
        if (gone) files.push(file);
      }
      return { retracted, files };
    },
  )
  .open(
    {
      nature: "/tree",
      valence: 'The tree of the literals this buffer committed — the slugs its jobs minted and what they reach, nothing else; [] reads nothing. The domain\'s /tree, scoped: a part that nothing places sits at the root, its own layer\'s placements under it, a placed part\'s interior under that placement, its steps after. Example: { slugs: ["drone_rig", "arm", "motor"] }',
      input: v.object({ slugs: v.array(v.string()).desc('The literals to read — what this buffer\'s jobs minted. Example: ["drone_rig", "arm"]') }),
      output: TREE,
    },
    async (ctx) => {
      if (!Array.isArray(ctx.input?.slugs)) throw new Error("[import] /tree takes slugs — the literals this buffer committed; [] reads nothing");
      return ctx.call["/tree"]({ user: ctx.user, mode: ctx.mode, thread: ctx.thread, input: { slugs: ctx.input.slugs } });
    },
  );
