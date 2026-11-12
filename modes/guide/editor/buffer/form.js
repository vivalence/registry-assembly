// the verbs' whole payloads drawn from a literal — what the inspector edits and what auto-save
// sends back: the lists carried whole, the identity first. pure.
export const clone = (held) => JSON.parse(JSON.stringify(held ?? null));

export const stepValues = (row) => {
  const trait = row?.trait ?? {};
  return {
    slug: row.slug,
    name: trait.LABELED?.name ?? "",
    description: trait.LABELED?.description ?? "",
    lines: clone(trait.INSTRUCTED?.lines ?? []),
    images: clone(trait.INSTRUCTED?.images ?? []),
    notes: clone(trait.ANNOTATED?.notes ?? []),
    staged: clone(trait.STAGED ?? null),
    symbols: [...(row.symbols ?? [])],
  };
};

export const guideValues = (row) => {
  const trait = row?.trait ?? {};
  return {
    slug: row.slug,
    name: trait.LABELED?.name ?? "",
    description: trait.LABELED?.description ?? "",
    subject: trait.SEQUENCED?.subject ?? null,
    lines: clone(trait.INSTRUCTED?.lines ?? []),
    images: clone(trait.INSTRUCTED?.images ?? []),
    notes: clone(trait.ANNOTATED?.notes ?? []),
    staged: clone(trait.STAGED ?? null),
    symbols: [...(row.symbols ?? [])],
  };
};

// the verb's input from a draft: the lists whole, the empties as empties, a null staged as none
export const payload = (draft) => {
  const { of: _of, ontology: _ontology, ...held } = draft;
  const out = { slug: held.slug, name: held.name ?? "", lines: held.lines ?? [], images: held.images ?? [], notes: held.notes ?? [], symbols: held.symbols ?? [] };
  if (held.description) out.description = held.description;
  if (held.staged && Object.keys(held.staged).length) out.staged = held.staged;
  if (_ontology === "guide" && held.subject) out.subject = held.subject;
  return out;
};

// a note's kind for the select, and the symbols a kind writes
export const noteKind = (note) => (note?.symbols ?? []).find((one) => one.startsWith("warn.")) ?? (note?.symbols ?? []).find((one) => one.startsWith("note.")) ?? "note";

export const noteSymbols = (kind) => (kind === "note" ? [] : kind.startsWith("warn.") ? ["note.warning", kind] : [kind]);

export const noteOptions = (names) => [
  ["note", "note"],
  ["note.tip", names["note.tip"] ? names["note.tip"].toLowerCase() : "tip"],
  ["note.warning", names["note.warning"] ? names["note.warning"].toLowerCase() : "warning"],
  ...Object.keys(names)
    .filter((slug) => slug.startsWith("warn."))
    .sort()
    .map((slug) => [slug, `warning · ${names[slug].toLowerCase()}`]),
];
