// the parent frames of a fold — a nested placement composes its parent's transform. pure.
export const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export const compose = (translation, rotation, scale) => {
  const [x, y, z, w] = rotation ?? [0, 0, 0, 1];
  const held = scale ?? [1, 1, 1];
  const at = translation ?? [0, 0, 0];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * held[0], (xy + wz) * held[0], (xz - wy) * held[0], 0,
    (xy - wz) * held[1], (1 - (xx + zz)) * held[1], (yz + wx) * held[1], 0,
    (xz + wy) * held[2], (yz - wx) * held[2], (1 - (xx + yy)) * held[2], 0,
    at[0], at[1], at[2], 1,
  ];
};

export const multiply = (a, b) => {
  const out = new Array(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
};

export const frames = (placements) => {
  const byPath = new Map((placements ?? []).map((one) => [one.path, one]));
  const held = new Map();
  const worldOf = (path, seen) => {
    if (held.has(path)) return held.get(path);
    if (seen.has(path)) return IDENTITY;
    seen.add(path);
    const one = byPath.get(path);
    if (!one) return IDENTITY;
    const above = one.parent && byPath.has(one.parent) ? worldOf(one.parent, seen) : IDENTITY;
    const world = multiply(above, compose(one.translation, one.rotation, one.scale));
    held.set(path, world);
    return world;
  };
  const out = new Map();
  for (const one of placements ?? []) {
    out.set(one.path, one.parent && byPath.has(one.parent) ? worldOf(one.parent, new Set()) : IDENTITY);
  }
  return out;
};

// what the stage draws for a fold: one entry per part with its GLB (or generated json), one node
// per placement of it with the parent frame the node composes
export const entries = (fold, { asset = () => null, geometry = {} } = {}) => {
  if (!fold) return [];
  const parents = frames(fold.placements);
  const grouped = new Map();
  for (const one of fold.placements) {
    if (!grouped.has(one.ref)) grouped.set(one.ref, []);
    grouped.get(one.ref).push({
      path: one.path,
      slug: one.slug,
      parentMatrix: parents.get(one.path),
      ...(one.translation && { translation: one.translation }),
      ...(one.rotation && { rotation: one.rotation }),
      ...(one.scale && { scale: one.scale }),
    });
  }
  return [...grouped]
    .map(([slug, nodes]) => ({ id: slug, url: asset(fold.parts[slug]?.MODELED?.file), json: geometry[slug] ?? null, nodes }))
    .filter((entry) => entry.url || entry.json);
};
