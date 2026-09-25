// objects → members. pure, over the bin's rows. one member is ONE component with N placements:
// objects that share a name stem and a geometry fingerprint fold together — Motor_Arm0..3 are one
// arm placed four times, FrameSpacers.01/.02 one standoff placed twice. a "(xN)" name is N copies
// the source welded into one object; it stays one member with `copies`, the intake cuts nothing.
// what folds wrongly — FlightController00/01, two boards with one geometry — unmerges by hand.

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

// what makes two objects the same part: the stem, the triangle count and the bounding box to the mm
export const fingerprint = (object) => `${stem(object.object)}|${object.tris ?? 0}|${(object.bbox ?? []).map((x) => round(x)).join(",")}`;

export const placement = (object) => ({
  object: object.object,
  ...(object.translation && { translation: object.translation }),
  ...(object.rotation && { rotation: object.rotation }),
  ...(object.mirrored?.length && { mirrored: object.mirrored }),
});

// every object into a member, in the harvest's order; a mirrored instance never gives the file
export const interpret = (objects) => {
  const held = new Map();
  for (const object of objects) {
    const key = fingerprint(object);
    const member = held.get(key);
    if (member) {
      member.objects.push(object.object);
      member.placements.push(placement(object));
      if (member.mirrored && !object.mirrored?.length) {
        member.file = object.file;
        member.id = object.object;
        member.mirrored = false;
      }
      continue;
    }
    const welded = copies(object.object);
    held.set(key, {
      id: object.object,
      objects: [object.object],
      file: object.file,
      ...(welded && { copies: welded }),
      placements: [placement(object)],
      mirrored: Boolean(object.mirrored?.length),
    });
  }
  return [...held.values()].map(({ mirrored: _, ...member }) => member);
};

// take objects out of a member into members of their own — the hand's correction
export const unmerge = (members, id, objects) => {
  const member = members.find((held) => held.id === id);
  if (!member) throw new Error(`[import] no member "${id}"`);
  const leaving = new Set(objects?.length ? objects : member.objects.slice(1));
  if (!leaving.size) throw new Error(`[import] "${id}" holds one object — nothing to unmerge`);
  const staying = member.objects.filter((name) => !leaving.has(name));
  if (!staying.length) throw new Error(`[import] unmerging every object of "${id}" leaves nothing — drop it instead`);
  const own = (name) => {
    const at = member.placements.find((held) => held.object === name);
    return { id: name, objects: [name], file: name === member.id ? member.file : `${name.replace(/[ ()]/g, "_").replace(/\./g, "_").replace(/_+/g, "_")}.glb`, ...(member.copies && { copies: member.copies }), placements: at ? [at] : [] };
  };
  const kept = { ...member, objects: staying, placements: member.placements.filter((held) => !leaving.has(held.object)) };
  const index = members.indexOf(member);
  return [...members.slice(0, index), kept, ...[...leaving].map(own), ...members.slice(index + 1)];
};

// fold members together — the hand's other correction; the first keeps its id and file
export const merge = (members, ids) => {
  const chosen = ids.map((id) => members.find((held) => held.id === id) ?? (() => { throw new Error(`[import] no member "${id}"`); })());
  const [first, ...rest] = chosen;
  const folded = { ...first, objects: chosen.flatMap((held) => held.objects), placements: chosen.flatMap((held) => held.placements) };
  return members.filter((held) => !rest.includes(held)).map((held) => (held === first ? folded : held));
};
