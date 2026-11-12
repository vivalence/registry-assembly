export const IDENTITY = { part: ["slug"], step: ["slug"], guide: ["slug"], placement: ["layer", "parent", "name", "ref"] };

export const exampleOf = (description = "") => (description.match(/Example:\s*([^]*)$/)?.[1] ?? "").trim();

export const optionsOf = (held) => held.enum ?? (Array.isArray(held.anyOf) && held.anyOf.length && held.anyOf.every((one) => "const" in one) ? held.anyOf.map((one) => one.const) : null);

const kindOf = (held) => {
  if (optionsOf(held)) return "enum";
  if (held.type === "boolean") return "flag";
  if (held.type === "integer" || held.type === "number") return "number";
  if (held.type === "string") return "text";
  if (held.type === "array") return held.items?.type === "number" ? "vector" : held.items?.type === "string" ? "lines" : "json";
  return "json";
};

const nested = (held) => held.type === "object" && held.properties && Object.keys(held.properties).length > 0;

const field = (key, held, required, group) => ({
  key,
  group,
  kind: kindOf(held),
  required,
  description: (held.description ?? "").replace(/\s*Example:[^]*$/, ""),
  example: exampleOf(held.description),
  options: optionsOf(held),
  length: held.maxItems ?? null,
});

export const fields = (schema) => {
  const out = [];
  for (const [key, held] of Object.entries(schema?.properties ?? {})) {
    const required = (schema.required ?? []).includes(key);
    if (!nested(held)) {
      out.push(field(key, held, required, null));
      continue;
    }
    for (const [inner, shape] of Object.entries(held.properties)) {
      out.push(field(`${key}.${inner}`, shape, required && (held.required ?? []).includes(inner), key));
    }
  }
  return out;
};

export const at = (held, key) => key.split(".").reduce((value, part) => (value == null ? value : value[part]), held);

const blank = (value) => value == null || value === "" || (Array.isArray(value) && !value.length);

export const into = (held, key, next) => {
  if (!key.includes(".")) return { ...held, [key]: next };
  const [root, inner] = [key.slice(0, key.indexOf(".")), key.slice(key.indexOf(".") + 1)];
  const carried = { ...(held[root] ?? {}), [inner]: next };
  for (const [one, value] of Object.entries(carried)) if (blank(value)) delete carried[one];
  return { ...held, [root]: Object.keys(carried).length ? carried : null };
};

export const values = (ontology, card) => {
  const trait = card?.trait ?? {};
  const label = { name: trait.LABELED?.name ?? "", description: trait.LABELED?.description ?? "" };
  switch (ontology) {
    case "part":
      return { slug: card.slug, ...label, sourced: trait.SOURCED ?? null, modeled: trait.MODELED ?? null, parametric: trait.PARAMETRIC ?? null, qty: trait.COUNTED?.qty ?? null, symbols: [...(card.symbols ?? [])] };
    // a step's and a guide's bodies are the guide editor's; here only the label and the marks
    case "step":
    case "guide":
      return { slug: card.slug, ...label, symbols: [...(card.symbols ?? [])] };
    case "placement": {
      const placed = trait.PLACED ?? {};
      return {
        layer: placed.layer ?? "",
        name: placed.name ?? "",
        parent: placed.parent ?? "",
        ref: placed.ref ?? "",
        translation: placed.translation ?? null,
        rotation: placed.rotation ?? null,
        scale: placed.scale ?? null,
        active: placed.active ?? null,
        params: placed.params ?? null,
        label: label.name,
        description: label.description,
        joins: [...(trait.JOINED?.joins ?? [])],
        symbols: [...(card.symbols ?? [])],
      };
    }
    default:
      return {};
  }
};

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const payload = (ontology, draft, was) => {
  const out = {};
  for (const key of IDENTITY[ontology] ?? []) if (!blank(draft[key])) out[key] = draft[key];
  for (const [key, value] of Object.entries(draft)) {
    if ((IDENTITY[ontology] ?? []).includes(key)) continue;
    if (same(value, was?.[key]) || blank(value)) continue;
    out[key] = value;
  }
  return out;
};

export const show = (kind, value) => {
  if (value == null) return "";
  if (kind === "lines") return value.join("\n");
  if (kind === "json") return JSON.stringify(value, null, 1).replace(/\n\s*/g, " ");
  if (kind === "vector") return value.join(", ");
  return String(value);
};

export const read = (kind, text, length = null) => {
  const held = String(text ?? "").trim();
  if (held === "") return null;
  if (kind === "number") return Number(held);
  if (kind === "flag") return held === "true";
  if (kind === "lines") return held.split("\n").map((line) => line.trim()).filter(Boolean);
  if (kind === "vector") {
    const list = held.split(/[\s,]+/).filter(Boolean).map(Number);
    if (list.some(Number.isNaN) || (length && list.length !== length)) throw new Error(`${length ?? "some"} numbers, comma separated`);
    return list;
  }
  if (kind === "json") return JSON.parse(held);
  return held;
};
