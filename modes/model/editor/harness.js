import { Vector } from "@vivalence/typology";
import { located, stood } from "./buffer/mate.js";

export const LIMIT = 40;

export const FOLD = 400;

export const ROLE = [
  "You are the editor's hand over the assembly domain's composition — parts (what a thing IS) and placements (one occurrence of a part under a part's layer) — for the operator, who has it open as a tree, a stage and an inspector. Guides and steps are read here and authored in the guide editor.",
  "A slug is unique and is how everything is named; a placement is also reached by its path in the fold. Read the [Screen] before acting and use the slugs and paths it shows — never invent one: a slug that does not exist is refused. What the [Screen] does not list is not in the fold; a part elsewhere in the daemon is found with entity_find { entity: \"literal\", where: { slug: { $like: \"%name%\" } } } — the entity is always literal, never part or placement.",
  "Metres, Y-up, quaternion xyzw. A placement's translation is in its layer's frame.",
  `In order: 1. Read the [Screen] — every placement of the fold with where it stands in the WORLD frame (at: its origin in metres · rot: quaternion xyzw), cut at ${FOLD} rows; assembly_resolve gives the layer-frame values and the rest — real paths and slugs, never remembered ones. 2. Change what the operator sees with open, select and focus. 3. Change the rows with the assembly_* tools — assembly_part, assembly_placement, assembly_move, assembly_rename, assembly_duplicate — each lands on the screen by itself; a symbols field takes slugs from the [Vocabulary]. 4. Say in one or two plain sentences what you did.`,
  "The operator points with cursors — holes, discs and faces picked on the stage, numbered on the [Screen] with their point and axis in the world frame (an axis points out of the surface), kept until removed. pose moves one placement to a world translation and rotation: to align a piece, work out from the cursors where its origin must land — a point p on a piece whose origin is at o lands on a target t when the origin moves to o + (t − p), once the rotation is right — then pose it, read the [Screen] again and check with measure. measure reads the distance and the angle between the first cursor and the last; cursors removes them.",
  "assembly_guide, assembly_step and assembly_sequence write guides — the guide editor's, not this one's; read a guide here with assembly_resolve. fs_*, shell_run and buffer_update are the machine's: the screen is changed with open, select and focus only.",
].join("\n");

const FORMAT = "The dock renders markdown: a slug or a path in `code`, a list only when the answer is one, never a heading.";

// an index: one line per kind naming its traits, then each trait glossed once — the fields are in the tool schemas
export const ontology = ({ ONTOLOGIES, TRAITS }) => {
  const kinds = Object.entries(ONTOLOGIES).map(([name, held]) => `${name} — ${held.layer ? "placements may name it as their layer" : "never a layer"} · ${held.traits.join(", ")}`);
  const traits = [...new Set(Object.values(ONTOLOGIES).flatMap((held) => held.traits))].map((trait) => `${trait} — ${TRAITS[trait]?.description ?? ""}`);
  return [...kinds, ...traits].join("\n");
};

export const vocabulary = (symbols) => {
  const families = {};
  for (const symbol of symbols) {
    const slug = symbol.slug ?? symbol;
    if (!slug.includes(".")) continue;
    (families[slug.slice(0, slug.indexOf("."))] ??= []).push(slug);
  }
  return Object.entries(families)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([family, held]) => `${family}: ${held.sort().slice(0, LIMIT).join(", ")}${held.length > LIMIT ? `, … ${held.length - LIMIT} more` : ""}`)
    .join("\n");
};

const listed = (slugs) => `${slugs.slice(0, LIMIT).join(", ")}${slugs.length > LIMIT ? ` … ${slugs.length - LIMIT} more` : ""}`;

const pointed = (cursor, index) => `${index + 1} ${cursor.kind}${cursor.radius ? ` r${(cursor.radius * 1000).toFixed(2)}mm` : ""} on ${cursor.path}`;

// the one sentence the model's picture and the operator's screen share — the head of [Screen], and what every screen tool answers
export const status = (data) => {
  if (!data?.subject) return "Nothing is on the operator's screen — no literal opened.";
  return [
    `On the operator's screen: ${data.subject}`,
    `selected ${data.selected?.length ? listed(data.selected) : "nothing"}`,
    ...(data.focus ? [`framed on ${data.focus}`] : []),
    ...(data.cursors?.length ? [`cursors ${data.cursors.map(pointed).join(", ")}`] : []),
    ...(data.desk ? [`last written ${data.desk}`] : []),
  ].join(" · ") + ".";
};

const cut = (rows, line, more, limit = LIMIT) => [...rows.slice(0, limit).map(line), ...(rows.length > limit ? [more(rows.length - limit)] : [])];

const triple = (list) => `[${list.map((one) => Number(one.toFixed(4)) + 0).join(", ")}]`;

const aimed = (placements) => (cursor, index) => {
  try {
    const held = located(placements, cursor);
    return `  ${pointed(cursor, index)} at ${triple(held.point)} axis ${triple(held.axis)}`;
  } catch {
    return `  ${pointed(cursor, index)} — not in this fold`;
  }
};

const rootline = (roots) => (roots?.length ? `The daemon holds ${roots.length} roots, each a part nothing places: ${listed(roots)}. Open one with open.` : null);

export const screen = (data, folded, roots = null) => {
  const head = status(data);
  if (!data?.subject) return [head, rootline(roots)].filter(Boolean).join("\n");
  if (!folded) return [head, `"${data.subject}" is not in the daemon any more — the stage is empty until another part is opened.`, rootline(roots)].filter(Boolean).join("\n");
  const stands = stood(folded.placements);
  const standing = (one) => {
    const world = stands(one.path);
    return `  ${one.path} ← ${one.ref} (${one.slug}) at ${triple(world.translation)} rot ${triple(world.rotation)}`;
  };
  return [
    head,
    `${folded.slug}: ${folded.placements.length} placements · ${folded.joints.length} joints${folded.missing.length ? ` · missing ${listed(folded.missing)}` : ""} — world frame, metres`,
    ...cut(folded.placements, standing, (left) => `  … ${left} more — assembly_resolve { slug: "${folded.slug}" } lists every placement.`, FOLD),
    ...(data.cursors?.length ? ["cursors — world frame:", ...data.cursors.map(aimed(folded.placements))] : []),
    ...cut(folded.joints, (joint) => `  ${joint.fastener} holds ${joint.joins.join(" + ")}`, (left) => `  … ${left} more joints — assembly_resolve { slug: "${folded.slug}" } lists them.`),
  ].join("\n");
};

export const open = (ctx) => {
  const thread = ctx.thread?.id ?? ctx.thread ?? null;
  if (!thread) return null;
  return ctx.entities.buffer.findOne({ thread, mode: ctx.mode.id }, { orderBy: { index: "desc" }, filters: false });
};

const rooted = async (literal) => {
  const { rows } = await literal.tree();
  return rows.filter((row) => row.depth === 0).map((row) => row.slug);
};

// the one picture harness and tools share: the head of [Screen], and what open and focus answer — the fold is in the result, no read round after
export const shown = async (ctx) => {
  const literal = ctx.entities.literal;
  const data = (await open(ctx))?.data ?? {};
  const folded = data.subject ? await literal.named(data.subject).then((row) => literal.resolve(row)).catch(() => null) : null;
  return screen(data, folded, folded ? null : await rooted(literal).catch(() => null));
};

export const harness = new Vector()
  .use(async (ctx, next) => {
    ctx.hallucination.primer.open("role", ROLE);
    ctx.hallucination.primer.open("ontology", `[Ontology] kind — layer rule · its traits; then each trait, whose fields the assembly_* tools take\n${ontology(ctx.domain.schematics)}`);
    ctx.hallucination.primer.open("vocabulary", `[Vocabulary] family: the symbols a symbols field takes\n${vocabulary(await ctx.entities.symbol.find({}, { fields: ["slug"] }))}`);
    await next();
  });

harness.branch("/dialogue").use(async (ctx, next) => {
  ctx.hallucination.primer.open("format", FORMAT);
  ctx.hallucination.primer.open("screen", `[Screen]\n${await shown(ctx)}`);
  await next();
});
