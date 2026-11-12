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

export const above = (key) => (key.includes("/") ? key.slice(0, key.lastIndexOf("/")) : null);

export const ancestry = (key) => {
  const out = [];
  let held = above(key);
  while (held) {
    out.push(held);
    held = above(held);
  }
  return out;
};

export const branching = (rows) => {
  const held = new Set();
  for (const row of rows ?? []) {
    const parent = above(row.key);
    if (parent) held.add(parent);
  }
  return held;
};

export const visible = (rows, opened) => {
  const forks = branching(rows);
  const out = [];
  for (const row of rows ?? []) {
    if (ancestry(row.key).some((key) => !opened.has(key))) continue;
    out.push({ ...row, kids: forks.has(row.key), opened: opened.has(row.key) });
  }
  return out;
};

export const reached = (rows, slug) => {
  const found = (rows ?? []).find((row) => row.slug === slug);
  return found ? ancestry(found.key) : [];
};

export const rooted = (rows, root) => (root ? (rows ?? []).filter((row) => row.key === root || row.key.startsWith(`${root}/`)) : []);

export const placer = (rows, slug) => (rows ?? []).find((row) => row.ontology === "placement" && row.ref === slug) ?? null;

export const order = (row) => (row?.trait?.SEQUENCED?.sections ?? []).flatMap((section) => section.steps ?? []);

// the guide that sequences a step
export const host = (rows, slug) => (rows ?? []).find((row) => row.ontology === "guide" && order(row).includes(slug)) ?? null;

export const parent = (rows, slug) => {
  const row = (rows ?? []).find((held) => held.slug === slug);
  if (row?.ontology === "placement") return row.layer ?? null;
  if (row?.ontology === "step") return host(rows, slug)?.slug ?? null;
  if (row?.ontology === "guide") return null;
  return placer(rows, slug)?.layer ?? null;
};

export const chain = (rows, slug) => {
  const out = [];
  for (let at = slug; at && !out.includes(at) && out.length < 24; at = parent(rows, at)) out.unshift(at);
  return out;
};

export const free = (taken, base) => {
  let n = 1;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
};

export const opening = (rows, slug) => {
  const found = (rows ?? []).find((row) => row.slug === slug) ?? (rows ?? []).find((row) => row.ontology === "placement" && row.ref === slug);
  return found ? [...ancestry(found.key), found.key] : [];
};

export const pathOf = (placed) => (placed?.parent ? `${placed.parent}/${placed.name}` : (placed?.name ?? ""));
