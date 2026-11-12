// the guide, read for a screen — pure over what the mode's /read answers: the guide, its steps in
// order, the subject's fold. what is fresh, what is built, what is ghost; what a step lays out.

export const pad = (n) => String(n).padStart(2, "0");

// the steps' opinions replayed through `upto` steps — slug → active
export const through = (steps, upto) => {
  const state = new Map();
  for (const step of steps.slice(0, Math.max(0, upto))) {
    for (const one of step.trait?.ASSEMBLED?.placements ?? []) state.set(one.literal, one.active !== false);
  }
  return state;
};

// the slugs a step installs
export const installs = (step) => (step?.trait?.ASSEMBLED?.placements ?? []).filter((one) => one.active !== false).map((one) => one.literal);

// what a prerequisite id names, as placement slugs: a step → what it installs, a part → every
// placement of it, a placement → itself; a part or a placement brings everything under it
export const expand = (id, steps, fold) => {
  const named = steps.find((one) => one.slug === id);
  const placements = fold?.placements ?? [];
  const roots = named ? installs(named) : placements.some((one) => one.slug === id || one.ref === id) ? placements.filter((one) => one.slug === id || one.ref === id).map((one) => one.slug) : [id];
  if (named) return roots;
  const byPath = new Map(placements.map((one) => [one.path, one]));
  const out = [];
  const walk = (one) => {
    if (!one || out.includes(one.slug)) return;
    out.push(one.slug);
    for (const child of one.children ?? []) walk(byPath.get(child));
  };
  for (const slug of roots) walk(placements.find((one) => one.slug === slug) ?? { slug });
  return out;
};

// what counts as built before step `index` (0-based): every earlier step, or the step's own STAGED.built
export const built = (steps, index, fold = null) => {
  const step = steps[index];
  const custom = step?.trait?.STAGED?.built;
  if (!custom) return new Set([...through(steps, index)].filter(([, on]) => on).map(([slug]) => slug));
  const out = new Set();
  for (const id of [...(custom.steps ?? []), ...(custom.parts ?? []), ...(custom.placements ?? [])]) for (const slug of expand(id, steps, fold)) out.add(slug);
  return out;
};

// status per placement slug for the stage. step 0 = the overview: everything solid.
//   fresh   named by this step
//   solid   built before it
//   ghost   later, or never named, when ghost is on
//   hidden  otherwise
export const statuses = (fold, steps, step, { ghost = false, overview = false } = {}) => {
  const out = {};
  if (!fold) return out;
  if (overview || step === 0) {
    for (const one of fold.placements) out[one.slug] = "solid";
    return out;
  }
  const current = steps[step - 1];
  const fresh = new Set(installs(current));
  const done = built(steps, step - 1, fold);
  const said = staged(steps, step, fold);
  for (const one of fold.placements) out[one.slug] = said[one.slug]?.status ?? (fresh.has(one.slug) ? "fresh" : done.has(one.slug) ? "solid" : ghost ? "ghost" : "hidden");
  return out;
};

// what a step says about single pieces, this step only — slug → what it says; a later entry wins, key by key.
// a look reaches everything under the piece named (a step → what it installs, a part → every placement of it);
// a pose and a label stay on the piece named
export const LOOKS = ["status", "colour"];
export const staged = (steps, step, fold = null) => {
  const out = {};
  const placements = fold?.placements ?? [];
  for (const { literal, ...said } of step > 0 ? (steps[step - 1]?.trait?.STAGED?.placements ?? []) : []) {
    const named = new Set([literal, ...placements.filter((one) => one.ref === literal).map((one) => one.slug)]);
    const look = Object.fromEntries(LOOKS.filter((key) => key in said).map((key) => [key, said[key]]));
    for (const slug of expand(literal, steps, fold)) out[slug] = { ...out[slug], ...(named.has(slug) ? said : look) };
  }
  return out;
};

// the writer beside it: what `said` holds is set on the piece's one entry, a null in it leaves that key;
// an entry left saying nothing leaves the list
export const restaged = (placements = [], literal, said) => {
  const held = Object.assign({}, ...placements.filter((one) => one.literal === literal), said, { literal });
  const kept = Object.fromEntries(Object.entries(held).filter(([, value]) => value != null));
  const rest = placements.filter((one) => one.literal !== literal);
  return Object.keys(kept).length > 1 ? [...rest, kept] : rest;
};

// the colour a step gives a piece — a theme role or a hex, per slug
export const tints = (steps, step, fold = null) =>
  Object.fromEntries(Object.entries(staged(steps, step, fold)).filter(([, said]) => said.colour).map(([slug, said]) => [slug, said.colour]));

// the parts a fold's kit holds, part → count, with the part's card
export const kit = (fold) => {
  const counts = {};
  for (const one of fold?.placements ?? []) counts[one.ref] = (counts[one.ref] ?? 0) + 1;
  return counts;
};

// the chips a step shows: what it lays out (from the fold's prepared block), fasteners after parts
export const chips = (parts, counts, cards = {}) =>
  Object.entries(counts)
    .map(([slug, n]) => ({ slug, n, name: cards[slug]?.name ?? parts?.[slug]?.LABELED?.name ?? slug, fastener: !!cards[slug]?.fastener, material: cards[slug]?.material ?? null }))
    .sort((a, b) => Number(a.fastener) - Number(b.fastener));

// the sections of a guide as the screen lists them — each step with its 1-based number
export const sections = (guide, steps) => {
  const order = [];
  const bySlug = Object.fromEntries(steps.map((step) => [step.slug, step]));
  let n = 0;
  for (const section of guide?.trait?.SEQUENCED?.sections ?? []) {
    order.push({ name: section.name, steps: (section.steps ?? []).map((slug) => ({ slug, n: ++n, step: bySlug[slug] ?? null })) });
  }
  return order;
};

// the slugs a line or a note points at on the stage; absent, the step's fresh placements
export const anchored = (at, fallback = []) => (at?.literals?.length ? at.literals : fallback);

export const free = (taken, base) => {
  let n = 1;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
};

// the next step slug of a guide: <guide>.NN, one past the highest
export const nextStep = (guide, steps) => {
  const max = Math.max(0, ...steps.map((step) => +(step.slug.startsWith(`${guide}.`) ? step.slug.slice(guide.length + 1) : 0) || 0));
  return `${guide}.${pad(max + 1)}`;
};
