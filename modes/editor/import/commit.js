import { join } from "@std/path";
import paladin from "@vivalence/paladin";
import { stemOf } from "./decode.js";
import { count, fold, groups, humanize, named, spare } from "./fold.js";
import { recorded } from "./files.js";

export const commit = async (ctx, read, settings, say) => {
  const root = ctx.mode.mountpoint.absolute;
  const caller = { user: ctx.user, mode: ctx.mode, thread: ctx.thread };
  const kept = read.objects.filter((object) => settings.hidden || !object.hidden);
  // every slug in the daemon: a slug is unique, and an import is standalone — it never writes
  // into what is there, it names its own beside it
  const held = await ctx.entities.literal.find({}, { fields: ["slug"] });
  const taken = new Set(held.map((row) => row.slug));
  const parts = named(fold(kept, settings.fold), taken);
  say("ONTO", `${kept.length} object(s) read as ${parts.length} part(s) — fold by ${settings.fold}`);
  await paladin.state.dir(join(root, "parts"));
  for (const part of parts) {
    const file = `parts/${part.slug}.glb`;
    await Deno.copyFile(join(root, read.intake, part.file), join(root, file));
    await recorded(ctx, file);
    const object = read.objects.find((held) => held.object === part.id);
    await ctx.call["/part"]({
      ...caller,
      input: {
        slug: part.slug,
        name: part.name,
        sourced: { file: read.source, object: part.id, scale: settings.unit },
        modeled: { file, ...(object?.tris != null && { tris: object.tris }), ...(object?.bbox && { bbox: object.bbox }) },
        qty: count(part),
        symbols: [],
      },
    });
  }

  // the import's root is a part, and so is every collection in it — a named composition is a part
  const name = settings.into?.trim() || humanize(stemOf(read.source)) || read.source;
  const model = { slug: spare(name, taken, "model"), name };
  await ctx.call["/part"]({ ...caller, input: model });
  const placements = [];
  const collections = settings.groups ? groups(parts) : [];
  const layerOf = new Map();
  for (const collection of collections) {
    const slug = spare(collection.path.split("/").at(-1), taken);
    layerOf.set(collection.path, slug);
    await ctx.call["/part"]({ ...caller, input: { slug, name: collection.name } });
    const into = await ctx.call["/placement"]({
      ...caller,
      input: { layer: collection.parent ? layerOf.get(collection.parent) : model.slug, name: slug, ref: slug, label: collection.name },
    });
    placements.push(into.slug);
  }

  for (const part of parts) {
    for (const [index, at] of part.placements.entries()) {
      const one = await ctx.call["/placement"]({
        ...caller,
        input: {
          layer: (settings.groups && at.collection && layerOf.get(at.collection)) || model.slug,
          name: `${part.slug}.${index}`,
          ref: part.slug,
          ...(at.translation && { translation: at.translation }),
          ...(at.rotation && { rotation: at.rotation }),
        },
      });
      placements.push(one.slug);
    }
  }
  const made = [model.slug, ...layerOf.values()];
  say("ONTO", `geometry bound to ${parts.length} part row(s); ${placements.length} placement(s) into ${made.length} layer(s) — ${model.slug}${collections.length ? ` and ${collections.length} collection(s), each a part of its own` : ""}`);
  return { model: model.slug, parts: [...made, ...parts.map((part) => part.slug)], placements, placed: placements.length, collections: collections.length };
};
