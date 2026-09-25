import { join } from "@std/path";
import paladin from "@vivalence/paladin";

// the mode's rows → a topography's dataset on disk: dataset/literals/<assembly>.json with every
// component and the assembly, their GLBs under freight/parts. a fresh daemon then installs them
// through DATASET; this daemon already holds them under the import mode. the target is a mounted
// module reference — the package on disk is where the rows are written, the way harvest.js wrote them.

const strip = (row) => ({
  slug: row.slug,
  traits: [...row.traits],
  trait: row.trait,
  symbols: row.symbols.getItems().map((symbol) => ({ slug: symbol.slug })),
  ...(row.uses?.isInitialized?.() && row.uses.getItems().length ? { uses: row.uses.getItems().map((held) => ({ slug: held.slug })) } : {}),
});

export const resolveTarget = async (reference) => {
  // an absolute path is a topography's directory named outright — a test's temp dir, a package not yet tapped
  if (reference.startsWith("/")) return { reference, root: reference, manifest: null };
  await paladin.vip.supply();
  const module = await paladin.vip.accio(reference);
  if (!module?.mount) throw new Error(`[import] no module ${reference} is tapped`);
  if (!["topography", "topology"].includes(module.manifest?.type)) throw new Error(`[import] ${reference} is a ${module.manifest?.type}, not a topography`);
  return { reference, root: module.mount.dirname, manifest: module.manifest };
};

export const write = async (ctx, bin) => {
  if (!bin.target) throw new Error("[import] the bin names no target topography");
  const target = await resolveTarget(bin.target);
  const slugs = Object.values(bin.embedded).map((held) => held.slug);
  if (bin.assembly) slugs.push(bin.assembly.slug);
  const rows = await ctx.daemon.entities.literal.find({ slug: { $in: slugs }, mode: ctx.mode.id }, { populate: ["symbols", "uses"] });
  const name = bin.assembly?.slug ?? bin.source?.replace(/\.blend$/i, "");
  if (!name) throw new Error("[import] the bin names no assembly and no source — nothing names the dataset file");
  const literals = join(target.root, "dataset/literals", `${name}.json`);
  await paladin.state.dir(join(target.root, "dataset/literals"));
  await paladin.state.dir(join(target.root, "freight/parts"));
  await Deno.writeTextFile(literals, JSON.stringify(rows.map(strip), null, 1) + "\n");
  const copied = [];
  for (const row of rows) {
    const file = row.trait?.MODELED?.file;
    if (!file) continue;
    await Deno.copyFile(join(ctx.mode.mountpoint.absolute, file), join(target.root, "freight", file));
    copied.push(file);
  }
  return { target: target.reference, root: target.root, literals, rows: rows.length, files: copied };
};
