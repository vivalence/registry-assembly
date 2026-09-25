import { stem } from "./interpret.js";

// a member's first naming: slug from the stem, a name for eyes, the count the model shows. no
// symbol is guessed — material and source are the hand's or the agent's to say, and a wrong
// symbol is worse than none. the kit's count, when there is a kit, overrides `qty`. a name whose
// stem is nothing but digits keeps the name itself — never a word the file did not carry.

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

export const count = (member) => member.placements.length * (member.copies ?? 1);

export const propose = (member, taken = new Set()) => {
  let slug = slugify(member.id);
  for (let i = 2; taken.has(slug); i++) slug = `${slugify(member.id)}_${i}`;
  return { slug, name: humanize(member.id), symbols: [], qty: count(member) };
};

// every member without an annotation gets one; existing annotations are never touched
export const annotate = (members, annotations = {}) => {
  const next = { ...annotations };
  const taken = new Set(Object.values(next).map((held) => held.slug));
  for (const member of members) {
    if (next[member.id] || member.dropped) continue;
    next[member.id] = propose(member, taken);
    taken.add(next[member.id].slug);
  }
  return next;
};
