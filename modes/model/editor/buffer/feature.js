const WELD = 1e5;
const FLAT = Math.cos((2 * Math.PI) / 180);
const ROUND = 0.12;
const REACH = 2.5;
const SLACK = 1e-3;

const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const times = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const between = (a, b) => length(minus(a, b));

const edgeKey = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);

export const survey = (positions, index) => {
  const ids = new Map();
  const points = [];
  const welded = new Int32Array(positions.length / 3);
  for (let vertex = 0; vertex < welded.length; vertex++) {
    const at = [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]];
    const key = `${Math.round(at[0] * WELD)},${Math.round(at[1] * WELD)},${Math.round(at[2] * WELD)}`;
    if (!ids.has(key)) {
      ids.set(key, points.length);
      points.push(at);
    }
    welded[vertex] = ids.get(key);
  }
  const count = (index ? index.length : welded.length) / 3;
  const corners = new Int32Array(count * 3);
  const normals = new Array(count);
  const edges = new Map();
  for (let triangle = 0; triangle < count; triangle++) {
    for (let corner = 0; corner < 3; corner++) {
      const vertex = index ? index[triangle * 3 + corner] : triangle * 3 + corner;
      corners[triangle * 3 + corner] = welded[vertex];
    }
    const [a, b, c] = [corners[triangle * 3], corners[triangle * 3 + 1], corners[triangle * 3 + 2]];
    const normal = cross(minus(points[b], points[a]), minus(points[c], points[a]));
    const size = length(normal);
    normals[triangle] = size > 0 ? times(normal, 1 / size) : null;
    for (const [from, to] of [[a, b], [b, c], [c, a]]) {
      if (from === to) continue;
      const key = edgeKey(from, to);
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push(triangle);
    }
  }
  return { points, corners, normals, edges, count };
};

const sides = (surveyed, triangle) => {
  const [a, b, c] = [surveyed.corners[triangle * 3], surveyed.corners[triangle * 3 + 1], surveyed.corners[triangle * 3 + 2]];
  return [[a, b], [b, c], [c, a]].filter(([from, to]) => from !== to);
};

export const flat = (surveyed, seed) => {
  const normal = surveyed.normals[seed];
  const region = new Set([seed]);
  const queue = [seed];
  while (queue.length) {
    const triangle = queue.pop();
    for (const [from, to] of sides(surveyed, triangle)) {
      for (const beside of surveyed.edges.get(edgeKey(from, to))) {
        if (region.has(beside)) continue;
        const facing = surveyed.normals[beside];
        if (facing && dot(facing, normal) < FLAT) continue;
        region.add(beside);
        queue.push(beside);
      }
    }
  }
  return region;
};

const holds = (surveyed, triangle, point) => {
  const normal = surveyed.normals[triangle];
  return sides(surveyed, triangle).every(([from, to]) => {
    const edge = minus(surveyed.points[to], surveyed.points[from]);
    return dot(cross(edge, minus(point, surveyed.points[from])), normal) >= -SLACK * dot(edge, edge);
  });
};

export const patch = (surveyed, point, axis) => {
  let seed = -1;
  let nearest = Infinity;
  for (let triangle = 0; triangle < surveyed.count; triangle++) {
    const normal = surveyed.normals[triangle];
    if (!normal || dot(normal, axis) < FLAT || !holds(surveyed, triangle, point)) continue;
    const off = Math.abs(dot(minus(point, surveyed.points[surveyed.corners[triangle * 3]]), normal));
    if (off >= nearest) continue;
    nearest = off;
    seed = triangle;
  }
  if (seed < 0) return null;
  const corners = [...flat(surveyed, seed)].flatMap((triangle) => [0, 1, 2].map((corner) => surveyed.corners[triangle * 3 + corner]));
  return { off: nearest, positions: corners.flatMap((vertex) => surveyed.points[vertex]) };
};

export const loops = (surveyed, region) => {
  const rim = new Map();
  for (const triangle of region) {
    for (const [from, to] of sides(surveyed, triangle)) {
      const inside = surveyed.edges.get(edgeKey(from, to)).filter((beside) => region.has(beside)).length;
      if (inside !== 1) continue;
      if (!rim.has(from)) rim.set(from, []);
      if (!rim.has(to)) rim.set(to, []);
      rim.get(from).push(to);
      rim.get(to).push(from);
    }
  }
  const walked = new Set();
  const out = [];
  for (const start of rim.keys()) {
    if (walked.has(start)) continue;
    const ring = [];
    let before = -1;
    let at = start;
    while (at !== undefined && !walked.has(at)) {
      walked.add(at);
      ring.push(at);
      const onward = rim.get(at).find((next) => next !== before && !walked.has(next));
      before = at;
      at = onward;
    }
    if (ring.length >= 3) out.push(measured(surveyed, ring));
  }
  return out.sort((a, b) => b.perimeter - a.perimeter);
};

const measured = (surveyed, ring) => {
  const at = ring.map((vertex) => surveyed.points[vertex]);
  let perimeter = 0;
  let centre = [0, 0, 0];
  for (let k = 0; k < at.length; k++) {
    const next = at[(k + 1) % at.length];
    const span = between(at[k], next);
    perimeter += span;
    centre = plus(centre, times(plus(at[k], next), span / 2));
  }
  centre = times(centre, 1 / perimeter);
  const reaches = at.map((point) => between(point, centre));
  const radius = reaches.reduce((sum, one) => sum + one, 0) / reaches.length;
  const spread = (Math.max(...reaches) - Math.min(...reaches)) / radius;
  return { centre, radius, perimeter, round: at.length >= 6 && spread < ROUND };
};

export const feature = (surveyed, triangle, hit) => {
  const axis = surveyed.normals[triangle];
  if (!axis) return null;
  const rings = loops(surveyed, flat(surveyed, triangle));
  const [outer, ...inner] = rings;
  const onto = (point) => minus(point, times(axis, dot(minus(point, hit), axis)));
  const hole = inner
    .filter((ring) => ring.round && between(hit, ring.centre) < ring.radius * REACH)
    .sort((a, b) => between(hit, a.centre) - between(hit, b.centre))[0];
  if (hole) return { kind: "hole", point: onto(hole.centre), axis, radius: hole.radius };
  if (outer?.round && !inner.length) return { kind: "disc", point: onto(outer.centre), axis, radius: outer.radius };
  return { kind: "face", point: hit, axis };
};
