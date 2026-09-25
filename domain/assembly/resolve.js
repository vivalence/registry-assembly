// the fold — pure functions over plain rows, no em, no flush. the repository's resolve is
// closure → this; the App imports this file and folds the dataspace's rows in the browser.
//
// a row is { slug, ontology, trait: { PLACED?, JOINED?, SEQUENCED?, ASSEMBLED?, COUNTED? } };
// `rows` is a Map by slug or a plain object. a part folds to its composition: its own layer's
// placements, a placed part's interior grafted under its placement. a guide folds to its
// subject's composition with every placement marked `at` (the first step naming it) and
// `active` (the steps' last opinion through `upto`), and a prepared block per step. a step is
// folded through its guide.

export const path = (placed) => (placed.parent ? `${placed.parent}/${placed.name}` : placed.name);

const get = (rows) => (rows instanceof Map ? (slug) => rows.get(slug) : (slug) => rows?.[slug]);
const all = (rows) => (rows instanceof Map ? [...rows.values()] : Object.values(rows ?? {}));

const need = (rows, slug, what) => {
  const row = get(rows)(slug);
  if (!row) throw new Error(`[assembly] no row named "${slug}" — ${what}`);
  return row;
};

// symbols may arrive as slugs (the App's rows) or as an ORM collection (the repository's); an
// uninitialized collection is no symbols, never a half-read one
export const marks = (row) =>
  (Array.isArray(row.symbols) ? row.symbols : row.symbols?.isInitialized?.() ? row.symbols.getItems().map((symbol) => symbol.slug ?? symbol) : []).filter((slug) => slug !== row.ontology);

const placed = (row) => ({
  ...row.trait.PLACED,
  ...(row.trait.JOINED?.joins && { joins: row.trait.JOINED.joins }),
  slug: row.slug,
  symbols: marks(row),
});

// every placement that names this layer — the layer's contents live in the placements, never in
// the layer's own trait. a part with none is a leaf: geometry and nothing under it.
export const layerOf = (rows, slug) => all(rows).filter((row) => row?.trait?.PLACED?.layer === slug).map(placed);

export const interior = (rows, slug) => layerOf(rows, slug).length > 0;

// merge layers weakest first: the same path again is an over, carrying only what changes
export const fold = (layers) => {
  const held = new Map();
  for (const layer of layers) for (const one of layer) held.set(path(one), { ...held.get(path(one)), ...one });
  return held;
};

// a guide's steps in order — its sections' steps, flattened
export const order = (guide) => (guide.trait?.SEQUENCED?.sections ?? []).flatMap((section) => section.steps ?? []);

const prefix = (at, inner) => (inner ? `${at}/${inner}` : at);

// the glTF-shaped tree of a part: flat placements with paths and children, a part with an
// interior grafted under its own placement, the parts they reference beside them. every
// placement keeps the slug of its literal — a grafted interior's placements keep theirs, so a
// sub-assembly placed twice is named once by a step and installs twice.
const composition = (rows, slug, seen = []) => {
  if (seen.includes(slug)) throw new Error(`[assembly] "${slug}" contains itself through ${seen.join(" → ")}`);
  need(rows, slug, "cannot fold it");
  const held = fold([layerOf(rows, slug)]);
  for (const [at, one] of [...held]) {
    if (!one.ref || !interior(rows, one.ref)) continue;
    const sub = composition(rows, one.ref, [...seen, slug]);
    for (const inner of sub.placements) {
      held.set(prefix(at, inner.path), {
        ...inner,
        parent: inner.parent ? prefix(at, inner.parent) : at,
        ...(inner.joins && { joins: inner.joins.map((join) => prefix(at, join)) }),
        path: undefined,
        children: undefined,
      });
    }
  }
  const live = [...held.values()].filter((one) => one.active !== false);
  const parts = {};
  const missing = new Set();
  for (const one of live) {
    const row = one.ref ? get(rows)(one.ref) : null;
    if (row) parts[one.ref] = row.trait ?? {};
    else missing.add(one.ref ?? path(one));
  }
  const placements = live.map((one) => ({ ...one, path: path(one), children: live.filter((child) => child.parent === path(one)).map(path) }));
  return {
    slug,
    placements,
    parts,
    joints: placements.filter((one) => one.joins?.length).map((one) => ({ fastener: one.path, joins: one.joins, symbols: one.symbols })),
    missing: [...missing],
  };
};

// what the build uses over these placements, part → count: every placement of a part the kit
// ships, and nothing inside one — a motor bought assembled is one line, not a line per piece of
// its own interior. a placement merely parented under another still counts: that is
// arrangement, not containment.
const kit = (rows, placements) => {
  const counts = new Map();
  const ordered = (one) => one.ref && get(rows)(one.ref)?.trait?.COUNTED;
  const sealed = placements.filter((one) => ordered(one) && interior(rows, one.ref)).map((one) => one.path);
  for (const one of placements) {
    if (!ordered(one)) continue;
    if (sealed.some((above) => one.path.startsWith(`${above}/`))) continue;
    counts.set(one.ref, (counts.get(one.ref) ?? 0) + 1);
  }
  return counts;
};

// a guide over its subject: the composition, each placement with `at` and `active`, and per
// step what it lays out — its tool.* symbols, and the parts the bill gains at that step
const guided = (rows, guide, upto) => {
  const sequenced = guide.trait?.SEQUENCED ?? {};
  const sections = (sequenced.sections ?? []).map((section) => ({ name: section.name, steps: [...(section.steps ?? [])] }));
  const steps = order(guide).map((slug, index) => ({ slug, index, row: need(rows, slug, `step of "${guide.slug}"`) }));
  const subject = sequenced.subject ?? null;
  const base = subject ? composition(rows, subject) : { placements: [], parts: {}, joints: [], missing: [] };
  const known = new Set(base.placements.map((one) => one.slug));
  const taken = upto === undefined || upto === null ? steps.length : Math.max(0, Math.min(upto, steps.length));
  const at = new Map();
  const missing = new Set(base.missing);
  const opinions = (step) => step.row.trait?.ASSEMBLED?.placements ?? [];
  for (const step of steps) {
    for (const one of opinions(step)) {
      if (!known.has(one.literal)) missing.add(one.literal);
      if (!at.has(one.literal)) at.set(one.literal, step.index);
    }
  }
  const state = new Map();
  let through = new Map();
  const live = () => base.placements.filter((one) => state.get(one.slug) === true);
  let before = kit(rows, live());
  const prepared = [];
  const sectionOf = (slug) => sections.find((section) => section.steps.includes(slug))?.name ?? null;
  for (const step of steps) {
    for (const one of opinions(step)) state.set(one.literal, one.active !== false);
    const after = kit(rows, live());
    const parts = {};
    for (const [slug, count] of after) if (count > (before.get(slug) ?? 0)) parts[slug] = count - (before.get(slug) ?? 0);
    before = after;
    prepared.push({ slug: step.slug, index: step.index, section: sectionOf(step.slug), prepared: { parts, tools: marks(step.row).filter((symbol) => symbol.startsWith("tool.")) } });
    if (step.index + 1 === taken) through = new Map(state);
  }
  const placements = base.placements.map((one) => ({ ...one, at: at.get(one.slug) ?? null, active: through.get(one.slug) === true }));
  return { slug: guide.slug, subject, placements, parts: base.parts, joints: base.joints, missing: [...missing], sections, steps: prepared };
};

export const resolve = (rows, slug, { upto } = {}) => {
  const row = need(rows, slug, "cannot fold it");
  if (row.ontology === "guide") return guided(rows, row, upto);
  if (row.ontology === "step") throw new Error(`[assembly] "${slug}" is a step — fold its guide`);
  return composition(rows, slug);
};

// what the build uses, part → count: a part's whole composition; a guide's what is active
// after `upto` steps
export const bom = (rows, slug, opts) => kit(rows, resolve(rows, slug, opts).placements.filter((one) => one.active !== false));
