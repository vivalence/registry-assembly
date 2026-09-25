export const stem = (name) =>
  name
    .replace(/\s*\(x\d+\)\s*$/, "")
    .replace(/\.\d+$/, "")
    .replace(/\d+$/, "")
    .replace(/[._-]+$/, "");

export const copies = (name) => {
  const found = /\(x(\d+)\)/.exec(name);
  return found ? Number(found[1]) : null;
};

const round = (value, places = 3) => Math.round((value ?? 0) * 10 ** places) / 10 ** places;

export const fingerprint = (object) => `${stem(object.object)}|${object.tris ?? 0}|${(object.bbox ?? []).map((x) => round(x)).join(",")}`;

export const RULES = ["fingerprint", "name", "none"];

const keyOf = (rule, object) => (rule === "fingerprint" ? fingerprint(object) : rule === "name" ? stem(object.object) : object.object);

const placement = (object) => ({
  object: object.object,
  ...(object.collection && { collection: object.collection }),
  ...(object.translation && { translation: object.translation }),
  ...(object.rotation && { rotation: object.rotation }),
  ...(object.mirrored?.length && { mirrored: object.mirrored }),
});

export const fold = (objects, rule = "fingerprint") => {
  const held = new Map();
  for (const object of objects) {
    const key = keyOf(rule, object);
    const part = held.get(key);
    if (part) {
      part.objects.push(object.object);
      part.placements.push(placement(object));
      if (part.mirrored && !object.mirrored?.length) {
        part.file = object.file;
        part.id = object.object;
        part.mirrored = false;
      }
      continue;
    }
    const welded = copies(object.object);
    held.set(key, { id: object.object, objects: [object.object], file: object.file, ...(welded && { copies: welded }), placements: [placement(object)], mirrored: Boolean(object.mirrored?.length) });
  }
  return [...held.values()].map(({ mirrored: _, ...part }) => part);
};

const base = (name) => stem(name) || name;

export const slugify = (name) =>
  base(name)
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

export const humanize = (name) =>
  base(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/^./, (first) => first.toUpperCase());

export const count = (part) => part.placements.length * (part.copies ?? 1);

// a slug nothing else has spoken for — `taken` carries the rows already in the mode, so an
// import never writes into what is there: each one is its own, collisions suffixed
export const spare = (name, taken, fallback = "part") => {
  const stem = slugify(name) || fallback;
  let slug = stem;
  for (let n = 2; taken.has(slug); n++) slug = `${stem}_${n}`;
  taken.add(slug);
  return slug;
};

export const named = (parts, taken = new Set()) => parts.map((part) => ({ ...part, slug: spare(part.id, taken), name: humanize(part.id) }));

// the file's collections, parent first — each becomes a part of its own, with a placement of it
// in the collection above. a collection is a named composition; that is what a part is.
export const groups = (parts) => {
  const paths = new Set();
  for (const part of parts) for (const at of part.placements) if (at.collection) {
    const segments = at.collection.split("/");
    for (let depth = 1; depth <= segments.length; depth++) paths.add(segments.slice(0, depth).join("/"));
  }
  return [...paths].sort((a, b) => a.split("/").length - b.split("/").length || (a < b ? -1 : 1)).map((path) => {
    const segments = path.split("/");
    return { path, name: humanize(segments.at(-1)), ...(segments.length > 1 && { parent: segments.slice(0, -1).join("/") }) };
  });
};


export const extent = (objects) => {
  let low = null;
  let high = null;
  for (const object of objects) {
    const at = object.translation ?? [0, 0, 0];
    const half = (object.bbox ?? [0, 0, 0]).map((size) => size / 2);
    const a = at.map((value, axis) => value - half[axis]);
    const b = at.map((value, axis) => value + half[axis]);
    low = low ? low.map((value, axis) => Math.min(value, a[axis])) : a;
    high = high ? high.map((value, axis) => Math.max(value, b[axis])) : b;
  }
  return low ? high.map((value, axis) => value - low[axis]) : [0, 0, 0];
};

export const scaled = (objects, unit) =>
  objects.map((object) => ({
    ...object,
    ...(object.bbox && { bbox: object.bbox.map((value) => value * unit) }),
    ...(object.translation && { translation: object.translation.map((value) => value * unit) }),
  }));

export const preview = (reading, settings) => {
  const kept = (reading.objects ?? []).filter((object) => settings.hidden || !object.hidden);
  const parts = fold(kept, settings.fold);
  return {
    objects: kept.length,
    components: parts.length,
    groups: settings.groups ? groups(parts).length : 0,
    nodes: parts.reduce((sum, part) => sum + part.placements.length, 0),
    extent: extent(scaled(kept, settings.unit)),
  };
};
