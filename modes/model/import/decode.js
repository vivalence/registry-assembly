import { join } from "@std/path";
import paladin from "@vivalence/paladin";
import { FORMATS } from "./schematics.js";

export const HARVEST = new URL("./harvest.py", import.meta.url).pathname;
export const CAD = new URL("./cad.py", import.meta.url).pathname;

const BLENDERS = ["blender", "/opt/homebrew/bin/blender", "/usr/local/bin/blender", "/Applications/Blender.app/Contents/MacOS/Blender"];
const FREECADS = ["freecadcmd", "FreeCADCmd", "/Applications/FreeCAD.app/Contents/Resources/bin/FreeCADCmd", "/Applications/FreeCAD.app/Contents/MacOS/FreeCADCmd"];

const runnable = (candidate) => {
  const paths = candidate.includes("/") ? [candidate] : (Deno.env.get("PATH") ?? "").split(":").map((dir) => `${dir}/${candidate}`);
  return paths.some((path) => {
    try {
      return Deno.statSync(path).isFile;
    } catch {
      return false;
    }
  });
};

export const blender = () => BLENDERS.find(runnable) ?? null;
export const freecad = () => FREECADS.find(runnable) ?? null;

export const stemOf = (name) => name.replace(/\.[^.]+$/, "");
export const intakeOf = (name) => `intake/${stemOf(name).replace(/[^A-Za-z0-9._-]+/g, "_")}`;

const tail = (log, lines = 6) => log.trim().split("\n").filter(Boolean).slice(-lines).join("\n");

const run = async (exe, args, timeout) => {
  const spawned = new Deno.Command(exe, { args, env: { PYTHONDONTWRITEBYTECODE: "1" }, stdout: "piped", stderr: "piped", signal: AbortSignal.timeout(timeout) });
  const { code, stdout, stderr } = await spawned.output();
  return { code, log: [new TextDecoder().decode(stdout), new TextDecoder().decode(stderr)].join("\n") };
};

export const tessellate = async (source, out, { chord = 0.05, timeout = 600000 } = {}) => {
  const exe = freecad();
  if (!exe) throw new Error(`no FreeCAD on this host — a b-rep needs one; looked for ${FREECADS.join(", ")}`);
  const { code, log } = await run(exe, [CAD, "--", "--file", source, "--out", out, "--chord", String(chord)], timeout);
  const found = /^CAD (\d+)/m.exec(log);
  if (code !== 0 || !found) throw new Error(`FreeCAD exited ${code}: ${tail(log)}`);
  return { solids: Number(found[1]), out };
};

export const harvest = async (source, format, out, { unit = null, up = null, recentre = null, timeout = 600000 } = {}) => {
  const exe = blender();
  if (!exe) throw new Error(`no blender on this host — looked for ${BLENDERS.join(", ")}`);
  const args = ["-b", "--factory-startup", ...(format === "blend" ? [source] : []), "-P", HARVEST, "--", "--file", source, "--format", format, "--out", out, ...(unit ? ["--unit", String(unit)] : []), ...(up ? ["--up", up] : []), ...(recentre ? ["--recentre", recentre] : [])];
  const { code, log } = await run(exe, args, timeout);
  if (code !== 0 || !/^HARVESTED/m.test(log)) throw new Error(`blender exited ${code}: ${tail(log)}`);
  return paladin.read.json(join(out, "harvest.json"));
};

export const decode = async ({ root, name, format, settings = {}, into = null }, say, options = {}) => {
  const spec = FORMATS[format];
  const landed = intakeOf(name);
  const intake = into ? `${landed}/${into}` : landed;
  const out = join(root, intake);
  await paladin.state.dir(out);
  let source = join(root, landed, name);
  let importer = format;
  if (spec.cad) {
    const chord = settings.chord ?? 0.05;
    say("WORK", `tessellating the b-rep with FreeCAD — chord tolerance ${chord} mm`);
    const held = await tessellate(source, join(out, `${stemOf(name)}.obj`), { ...options, chord });
    say("OK", `${held.solids} solid(s) → obj, millimetres to metres, Z-up to Y-up`);
    source = held.out;
    importer = "obj";
  }
  say("WORK", `decoding with blender headless — ${spec.route}`);
  const read = await harvest(source, importer, out, { ...options, unit: settings.unit ?? null, up: settings.up ?? null, recentre: settings.recentre ?? null });
  say("OK", `${read.decoder} · ${read.meshes} mesh(es) · ${read.materials} material(s) · ${read.triangles.toLocaleString("en")} triangles`);
  return { ...read, intake };
};
