import { join } from "@std/path";
import paladin from "@vivalence/paladin";

// the blender side: a .blend on the mountpoint goes through harvest.py headless and lands as
// intake/<name>/{blend.json, <object>.glb…} — every mesh object in its local frame, metres, Y-up,
// and blend.json with every placement. `read` opens an intake already on disk without blender.

export const HARVEST = new URL("./harvest.py", import.meta.url).pathname;
const BLENDER = ["blender", "/opt/homebrew/bin/blender", "/usr/local/bin/blender", "/Applications/Blender.app/Contents/MacOS/Blender"];

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

export const blender = () => BLENDER.find(runnable) ?? null;

export const intakeOf = (file) => `intake/${file.split("/").pop().replace(/\.blend$/i, "")}`;

// what the mountpoint holds: blends to harvest, intakes already harvested
export const scan = async (root) => {
  await paladin.state.dir(join(root, "intake"));
  const blends = [];
  for await (const entry of Deno.readDir(root)) if (entry.isFile && /\.blend$/i.test(entry.name)) blends.push(entry.name);
  const intakes = [];
  for await (const entry of Deno.readDir(join(root, "intake"))) {
    if (!entry.isDirectory) continue;
    const held = await paladin.read.json(join(root, "intake", entry.name, "blend.json"), null).catch(() => null);
    if (held) intakes.push({ intake: `intake/${entry.name}`, source: held.source, blender: held.blender, scale: held.scale, origin: held.origin, objects: held.parts?.length ?? 0 });
  }
  return { blender: blender(), blends: blends.sort(), intakes: intakes.sort((a, b) => (a.intake < b.intake ? -1 : 1)) };
};

export const read = async (root, intake) => {
  const held = await paladin.read.json(join(root, intake, "blend.json"), null).catch(() => null);
  if (!held) throw new Error(`[import] no blend.json under ${intake} — harvest first`);
  return { source: held.source, blender: held.blender, scale: held.scale, origin: held.origin, intake, objects: held.parts ?? [] };
};

// run blender headless over the file; the intake dir is the file's name
export const harvest = async (root, { file, scale, origin }, { timeout = 600000 } = {}) => {
  if (!(scale > 0)) throw new Error("[import] a harvest takes a scale — metres per blender unit — and assumes none");
  const exe = blender();
  if (!exe) throw new Error(`[import] no blender on this host — looked for ${BLENDER.join(", ")}`);
  const source = join(root, file);
  await Deno.stat(source).catch(() => {
    throw new Error(`[import] no file ${file} on the mountpoint`);
  });
  const intake = intakeOf(file);
  const out = join(root, intake);
  await paladin.state.dir(out);
  const args = ["-b", source, "-P", HARVEST, "--", "--scale", String(scale), "--out", out, ...(origin ? ["--origin", origin] : [])];
  const spawned = new Deno.Command(exe, { args, stdout: "piped", stderr: "piped", signal: AbortSignal.timeout(timeout) });
  const { code, stdout, stderr } = await spawned.output();
  const log = [new TextDecoder().decode(stdout), new TextDecoder().decode(stderr)].join("\n");
  if (code !== 0 || !/HARVESTED/.test(log)) throw new Error(`[import] blender exited ${code}: ${log.trim().split("\n").slice(-8).join("\n")}`);
  return { ...(await read(root, intake)), log: log.trim().split("\n").slice(-3).join("\n") };
};
