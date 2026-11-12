import { compose, frames, multiply } from "./kit/frames.js";

const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const times = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => times(a, 1 / length(a));
const rounded = (list, places) => list.map((one) => Number(one.toFixed(places)) + 0);

export const point = (matrix, at) => [
  matrix[0] * at[0] + matrix[4] * at[1] + matrix[8] * at[2] + matrix[12],
  matrix[1] * at[0] + matrix[5] * at[1] + matrix[9] * at[2] + matrix[13],
  matrix[2] * at[0] + matrix[6] * at[1] + matrix[10] * at[2] + matrix[14],
];

export const heading = (matrix, along) =>
  unit([
    matrix[0] * along[0] + matrix[4] * along[1] + matrix[8] * along[2],
    matrix[1] * along[0] + matrix[5] * along[1] + matrix[9] * along[2],
    matrix[2] * along[0] + matrix[6] * along[1] + matrix[10] * along[2],
  ]);

export const inverse = (m) => {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!det) throw new Error("[assembly] a placement with a zero scale has no frame to mate in");
  const r = [
    (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
  const t = [m[12], m[13], m[14]];
  return [
    r[0], r[3], r[6], 0,
    r[1], r[4], r[7], 0,
    r[2], r[5], r[8], 0,
    -(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]), -(r[3] * t[0] + r[4] * t[1] + r[5] * t[2]), -(r[6] * t[0] + r[7] * t[1] + r[8] * t[2]), 1,
  ];
};

export const decompose = (m) => {
  const columns = [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]];
  const scale = columns.map(length);
  if (dot(cross(columns[0], columns[1]), columns[2]) < 0) scale[0] = -scale[0];
  const [x, y, z] = columns.map((column, k) => times(column, 1 / scale[k]));
  const trace = x[0] + y[1] + z[2];
  let rotation;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    rotation = [(y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, s / 4];
  } else if (x[0] > y[1] && x[0] > z[2]) {
    const s = Math.sqrt(1 + x[0] - y[1] - z[2]) * 2;
    rotation = [s / 4, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s];
  } else if (y[1] > z[2]) {
    const s = Math.sqrt(1 + y[1] - x[0] - z[2]) * 2;
    rotation = [(y[0] + x[1]) / s, s / 4, (z[1] + y[2]) / s, (z[0] - x[2]) / s];
  } else {
    const s = Math.sqrt(1 + z[2] - x[0] - y[1]) * 2;
    rotation = [(z[0] + x[2]) / s, (z[1] + y[2]) / s, s / 4, (x[1] - y[0]) / s];
  }
  return { translation: rounded([m[12], m[13], m[14]], 5), rotation: rounded(rotation, 6), scale: rounded(scale, 5) };
};

const arc = (from, to) => {
  const facing = dot(from, to);
  if (facing < -0.999999) {
    const aside = Math.abs(from[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return [...unit(cross(from, aside)), 0];
  }
  const axis = cross(from, to);
  const turn = [axis[0], axis[1], axis[2], 1 + facing];
  const size = Math.hypot(...turn);
  return turn.map((one) => one / size);
};

const turned = (q, at) => {
  const along = [q[0], q[1], q[2]];
  const once = cross(along, at);
  const twice = cross(along, once);
  return plus(at, plus(times(once, 2 * q[3]), times(twice, 2)));
};

const placed = (placements, path) => {
  const found = placements.find((one) => one.path === path);
  if (!found) throw new Error(`[assembly] no placement at "${path}" in this fold — its cursor points at a piece that is not on the stage`);
  return found;
};

export const worlds = (placements) => {
  const above = frames(placements);
  return (path) => {
    const one = placed(placements, path);
    return multiply(above.get(path), compose(one.translation, one.rotation, one.scale));
  };
};

export const located = (placements, cursor) => {
  const world = worlds(placements)(cursor.path);
  return { point: point(world, cursor.point), axis: heading(world, cursor.axis) };
};

export const posed = (placements, path, { translation = null, rotation = null } = {}) => {
  const one = placed(placements, path);
  const above = frames(placements).get(path);
  const now = decompose(multiply(above, compose(one.translation, one.rotation, one.scale)));
  const world = compose(translation ?? now.translation, rotation ?? now.rotation, now.scale);
  return { slug: one.slug, path, ...decompose(multiply(inverse(above), world)) };
};

export const stood = (placements) => {
  const world = worlds(placements);
  return (path) => decompose(world(path));
};

export const measure = (placements, [first, second]) => {
  const from = located(placements, first);
  const to = located(placements, second);
  const span = minus(to.point, from.point);
  const along = dot(span, from.axis);
  return {
    distance: Number(length(span).toFixed(5)),
    along: Number(along.toFixed(5)),
    across: Number(length(minus(span, times(from.axis, along))).toFixed(5)),
    angle: Number(((Math.acos(Math.max(-1, Math.min(1, dot(from.axis, to.axis)))) * 180) / Math.PI).toFixed(3)),
  };
};

export const mate = (placements, cursors, { flip = false, offset = 0, carry = null } = {}) => {
  if (cursors.length < 2) throw new Error("[assembly] a mate takes two cursors — the first stays, the last one's piece moves onto it");
  const still = cursors[0];
  const moving = cursors[cursors.length - 1];
  const moved = carry ?? moving.path;
  if (moved !== moving.path && !moving.path.startsWith(`${moved}/`)) throw new Error(`[assembly] "${moved}" does not carry "${moving.path}" — carry names the moving piece or a placement above it`);
  if (still.path === moved || still.path.startsWith(`${moved}/`)) throw new Error(`[assembly] both cursors ride "${moved}" — a piece is not mated onto itself`);
  const onto = located(placements, still);
  const from = located(placements, moving);
  const aim = flip ? onto.axis : times(onto.axis, -1);
  const turn = arc(from.axis, aim);
  const land = plus(onto.point, times(onto.axis, offset));
  const shift = compose(minus(land, turned(turn, from.point)), turn, [1, 1, 1]);
  const above = frames(placements).get(moved);
  const one = placed(placements, moved);
  const local = multiply(inverse(above), multiply(shift, multiply(above, compose(one.translation, one.rotation, one.scale))));
  return { slug: one.slug, path: moved, ...decompose(local) };
};
