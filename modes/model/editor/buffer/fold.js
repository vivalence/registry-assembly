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
