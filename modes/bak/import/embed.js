import { join } from "@std/path";
import paladin from "@vivalence/paladin";
import { count } from "./annotate.js";

// members → rows, through the domain's doors, so the row's owner is the import mode (ruling 13):
// one component per annotated member with its GLB copied to parts/<slug>.glb on the mountpoint,
// one assembly for the bin, and every placement a node of the assembly's own layer — the blend's
// arrangement as the base state the manual's steps later override.

const caller = (ctx) => ({ user: ctx.user, mode: ctx.mode, thread: ctx.thread });

const node = (slug, placement, index) => ({
  name: `${slug}.${index}`,
  component: slug,
  ...(placement.translation && { translation: placement.translation }),
  ...(placement.rotation && { rotation: placement.rotation }),
});

// one member: copy its geometry, mint the component
export const embedMember = async (ctx, bin, member, annotation) => {
  const root = ctx.mode.mountpoint.absolute;
  const from = join(root, bin.intake, member.file);
  const file = `parts/${annotation.slug}.glb`;
  await paladin.state.dir(join(root, "parts"));
  await Deno.copyFile(from, join(root, file));
  ctx.mode.freight?.admit(file);
  const object = bin.objects.find((held) => held.object === member.id);
  const row = await ctx.daemon.call["/component"]({
    ...caller(ctx),
    input: {
      slug: annotation.slug,
      name: annotation.name,
      ...(annotation.description && { description: annotation.description }),
      sourced: { file: bin.source, object: member.id, ...(bin.scale != null && { scale: bin.scale }) },
      modeled: { file, ...(object?.tris != null && { tris: object.tris }), ...(object?.bbox && { bbox: object.bbox }) },
      qty: annotation.qty ?? count(member),
      symbols: annotation.symbols ?? [],
    },
  });
  return { slug: row.slug, ontology: row.ontology, file };
};

// the assembly: minted once, every embedded member's placements placed as nodes of its own layer
export const embedAssembly = async (ctx, bin) => {
  if (!bin.assembly) return null;
  const row = await ctx.daemon.call["/assembly"]({ ...caller(ctx), input: { slug: bin.assembly.slug, name: bin.assembly.name } });
  for (const member of bin.members) {
    const held = bin.embedded[member.id];
    if (!held || member.dropped) continue;
    for (const [index, placement] of member.placements.entries()) {
      await ctx.daemon.call["/place"]({ ...caller(ctx), input: { layer: row.slug, node: node(held.slug, placement, index) } });
    }
  }
  return { slug: row.slug, ontology: row.ontology };
};

// every annotated, undropped, unembedded member — or only the ones named
export const embed = async (ctx, bin, ids = null) => {
  for (const id of ids ?? []) {
    const held = bin.members.find((member) => member.id === id);
    if (!held) throw new Error(`[import] no member "${id}" in the bin`);
    if (!bin.annotations[id] && !bin.embedded[id]) throw new Error(`[import] "${id}" is not annotated — annotate it first`);
  }
  const wanted = bin.members.filter((member) => (!ids || ids.includes(member.id)) && !member.dropped && bin.annotations[member.id] && !bin.embedded[member.id]);
  const embedded = { ...bin.embedded };
  for (const member of wanted) embedded[member.id] = await embedMember(ctx, bin, member, bin.annotations[member.id]);
  const next = { ...bin, embedded };
  const assembly = await embedAssembly(ctx, next);
  return { bin: next, minted: wanted.map((member) => embedded[member.id].slug), assembly };
};
