import * as shapes from "../../schematics.js";

export const ONTOLOGIES = shapes.ONTOLOGIES;

export const placedOf = (row) => row.trait?.PLACED ?? null;
export const joinsOf = (row) => row.trait?.JOINED?.joins ?? [];
export const subjectOf = (row) => row.trait?.SEQUENCED?.subject ?? null;

const anchored = (held) => (held ?? []).flatMap((one) => one?.at?.literals ?? []);

export const mentions = (row) => {
  const trait = row.trait ?? {};
  const slugs = [];
  if (row.ontology === "guide") slugs.push(...(trait.SEQUENCED?.subject ? [trait.SEQUENCED.subject] : []), ...(trait.SEQUENCED?.sections ?? []).flatMap((section) => section.steps ?? []));
  if (row.ontology === "step") slugs.push(...(trait.ASSEMBLED?.placements ?? []).map((one) => one.literal));
  if (row.ontology === "step" || row.ontology === "guide") {
    slugs.push(...(trait.STAGED?.built?.steps ?? []), ...(trait.STAGED?.built?.placements ?? []), ...(trait.STAGED?.built?.parts ?? []), ...Object.keys(trait.STAGED?.tints ?? {}));
    slugs.push(...anchored(trait.INSTRUCTED?.lines), ...anchored(trait.ANNOTATED?.notes));
  }
  return [...new Set(slugs.filter(Boolean))];
};

export const reslugged = (row, to) => {
  const trait = JSON.parse(JSON.stringify(row.trait ?? {}));
  const anchor = (one) => (one?.at?.literals ? { ...one, at: { ...one.at, literals: one.at.literals.map(to) } } : one);
  if (trait.SEQUENCED) {
    if (trait.SEQUENCED.subject) trait.SEQUENCED.subject = to(trait.SEQUENCED.subject);
    trait.SEQUENCED.sections = (trait.SEQUENCED.sections ?? []).map((section) => ({ ...section, steps: (section.steps ?? []).map(to) }));
  }
  if (trait.ASSEMBLED) trait.ASSEMBLED.placements = (trait.ASSEMBLED.placements ?? []).map((one) => ({ ...one, literal: to(one.literal) }));
  if (trait.STAGED?.built) trait.STAGED.built = { steps: (trait.STAGED.built.steps ?? []).map(to), placements: (trait.STAGED.built.placements ?? []).map(to), ...(trait.STAGED.built.parts ? { parts: trait.STAGED.built.parts.map(to) } : {}) };
  if (trait.STAGED?.tints) trait.STAGED.tints = Object.fromEntries(Object.entries(trait.STAGED.tints).map(([slug, tint]) => [to(slug), tint]));
  if (trait.INSTRUCTED?.lines) trait.INSTRUCTED.lines = trait.INSTRUCTED.lines.map(anchor);
  if (trait.ANNOTATED?.notes) trait.ANNOTATED.notes = trait.ANNOTATED.notes.map(anchor);
  return trait;
};

export const checked = (shape, value, what) => {
  if (shape.check(value)) return value;
  const errors = [...shape.errors(value)].map((error) => `${error.path || "/"} ${error.message}`).join("; ");
  throw new Error(`[assembly] not a ${what}: ${errors}`);
};

export const modeId = (mode) => mode?.id ?? (typeof mode === "string" ? mode : null);

export const under = (path, above) => path === above || path.startsWith(`${above}/`);
export const rebase = (path, from, to) => (path === from ? to : `${to}${path.slice(from.length)}`);

export const slugOf = (placed) => `${placed.layer}.${(placed.parent ? `${placed.parent}/${placed.name}` : placed.name).replaceAll("/", ".")}`;
