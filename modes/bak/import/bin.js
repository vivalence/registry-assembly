import { PHASES } from "./schematics.js";

// the phases are read off the bin, never stored: an object in no member is intake; a member with
// no annotation is interpret; annotated but not minted is annotate; minted is embed. a dropped
// member stays where it is and counts nowhere.

export const phaseOf = (bin, member) => {
  if (member.dropped) return null;
  if (bin.embedded?.[member.id]) return "embed";
  if (bin.annotations?.[member.id]) return "annotate";
  return "interpret";
};

export const loose = (bin) => {
  const held = new Set((bin.members ?? []).flatMap((member) => member.objects));
  return (bin.objects ?? []).filter((object) => !held.has(object.object));
};

export const counts = (bin) => {
  const held = Object.fromEntries(PHASES.map((phase) => [phase, 0]));
  held.intake = loose(bin).length;
  for (const member of bin.members ?? []) {
    const phase = phaseOf(bin, member);
    if (phase) held[phase]++;
  }
  return held;
};

export const member = (bin, id) => {
  const found = (bin.members ?? []).find((held) => held.id === id);
  if (!found) throw new Error(`[import] no member "${id}" in the bin`);
  return found;
};

// the bin as the buffer holds it — every key present, so a view never reads undefined
export const settle = (bin = {}) => ({
  ...bin,
  objects: bin.objects ?? [],
  members: bin.members ?? [],
  annotations: bin.annotations ?? {},
  embedded: bin.embedded ?? {},
});
