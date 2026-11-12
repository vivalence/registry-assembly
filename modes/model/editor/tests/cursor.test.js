import { specimen } from "@vivalence/typology";
import { feature, patch, survey } from "../buffer/feature.js";
import { located, mate, measure, posed, stood } from "../buffer/mate.js";
import { screen, status } from "../harness.js";
import * as mode from "../editor.viva.js";
import { GIZMOS } from "../schematics.js";

const { describe, it, expect } = specimen;

const plate = (holes, segments = 16) => {
  const positions = [];
  const ring = (cx, cz, r, n) => Array.from({ length: n }, (_, k) => [cx + Math.cos((k / n) * 2 * Math.PI) * r, cz + Math.sin((k / n) * 2 * Math.PI) * r]);
  const push = (a, b, c) => positions.push(a[0], 0, a[1], b[0], 0, b[1], c[0], 0, c[1]);
  const cells = 20;
  const size = 0.04;
  const at = (i, j) => [(i / cells - 0.5) * size, (j / cells - 0.5) * size];
  const inside = (p) => holes.some(([cx, cz, r]) => Math.hypot(p[0] - cx, p[1] - cz) < r * 1.9);
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const corners = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      if (corners.some(inside)) continue;
      push(corners[0], corners[2], corners[1]);
      push(corners[0], corners[3], corners[2]);
    }
  }
  for (const [cx, cz, r] of holes) {
    const inner = ring(cx, cz, r, segments);
    const outer = ring(cx, cz, r * 1.2, segments);
    for (let k = 0; k < segments; k++) {
      const next = (k + 1) % segments;
      push(inner[k], outer[next], outer[k]);
      push(inner[k], inner[next], outer[next]);
    }
  }
  return new Float32Array(positions);
};

const close = (a, b, slack = 1e-4) => a.every((one, k) => Math.abs(one - b[k]) < slack);

describe("a cursor — the spot a click grows to, pure", () => {
  const positions = plate([[0.01, 0.01, 0.0015]]);
  const surveyed = survey(positions, null);
  const triangles = positions.length / 9;
  const collar = triangles - 1;

  it("P-hole: a click beside a round inner rim is the hole — its centre, the face's normal, its radius", () => {
    const hit = [0.01 + 0.0017, 0, 0.01];
    const held = feature(surveyed, collar, hit);
    expect(held.kind).toBe("hole");
    expect(close(held.point, [0.01, 0, 0.01])).toBe(true);
    expect(Math.abs(held.radius - 0.0015) < 1e-4).toBe(true);
    expect(Math.abs(Math.abs(held.axis[1]) - 1) < 1e-6).toBe(true);
  });

  it("P-face: a click on a flat far from any round rim is the face, at the click", () => {
    const held = feature(surveyed, 0, [-0.019, 0, -0.019]);
    expect(held).toMatchObject({ kind: "face", point: [-0.019, 0, -0.019] });
    expect(held.radius).toBe(undefined);
  });

  it("P-patch: a face cursor is its whole flat and nothing beside it; a point off every flat is none", () => {
    const up = surveyed.normals[0];
    const held = patch(surveyed, [-0.019, 0, -0.019], up);
    expect(held.positions.length).toBe((triangles - 32) * 9);
    expect(held.off < 1e-9).toBe(true);
    expect(patch(surveyed, [0.01 + 0.0017, 0, 0.01], up).positions.length).toBe(32 * 9);
    expect(patch(surveyed, [-0.019, 0, -0.019], [1, 0, 0])).toBe(null);
    expect(patch(surveyed, [0.5, 0, 0.5], up)).toBe(null);
    const two = new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(patch(survey(two, null), [0.2, 0, 0.2], [0, 1, 0]).positions.length).toBe(9);
  });

  it("P-disc: a round flat with no hole is a disc at its centre", () => {
    const fan = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 2 * Math.PI;
      const b = ((k + 1) / 12) * 2 * Math.PI;
      fan.push(0, 0, 0, Math.cos(a) * 0.003, Math.sin(a) * 0.003, 0, Math.cos(b) * 0.003, Math.sin(b) * 0.003, 0);
    }
    const held = feature(survey(new Float32Array(fan), null), 0, [0.001, 0.0005, 0]);
    expect(held.kind).toBe("disc");
    expect(close(held.point, [0, 0, 0])).toBe(true);
    expect(Math.abs(held.radius - 0.003) < 1e-5).toBe(true);
  });
});

describe("a mate — the last cursor's piece lands on the first, pure", () => {
  const quarter = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
  const placements = [
    { slug: "rig.plate.0", path: "plate.0", parent: null, translation: [0.1, 0, 0] },
    { slug: "rig.tail.0", path: "tail.0", parent: null, translation: [0, 0.05, 0.02], rotation: quarter },
    { slug: "tail.half.0", path: "tail.0/half.0", parent: "tail.0", translation: [0.01, 0, 0], rotation: [0.3826834, 0, 0, 0.9238795] },
  ];
  const onto = { slug: "rig.plate.0", path: "plate.0", kind: "hole", point: [0.01, 0.002, 0.01], axis: [0, 1, 0], radius: 0.0015 };
  const from = { slug: "tail.half.0", path: "tail.0/half.0", kind: "face", point: [0.004, -0.001, 0.003], axis: [0, 0, 1] };
  const after = (move) => placements.map((one) => (one.path === move.path ? { ...one, ...move } : one));

  it("P-mate: point on point, axes against each other — the placements handed in are not mutated", () => {
    const before = JSON.stringify(placements);
    const move = mate(placements, [onto, from]);
    expect(move.slug).toBe("tail.half.0");
    const landed = located(after(move), from);
    const still = located(placements, onto);
    expect(close(landed.point, still.point)).toBe(true);
    expect(close(landed.axis, still.axis.map((one) => -one))).toBe(true);
    expect(JSON.stringify(placements)).toBe(before);
  });

  it("P-flip · P-offset: flip faces the axes the same way; offset leaves the gap along the first axis", () => {
    const move = mate(placements, [onto, from], { flip: true, offset: 0.003 });
    const landed = located(after(move), from);
    const still = located(placements, onto);
    expect(close(landed.axis, still.axis)).toBe(true);
    expect(measure(after(move), [onto, from])).toMatchObject({ distance: 0.003, along: 0.003, across: 0, angle: 0 });
  });

  it("P-carry: a placement above the piece moves whole — the piece keeps its seat inside it", () => {
    const move = mate(placements, [onto, from], { carry: "tail.0" });
    expect(move.slug).toBe("rig.tail.0");
    const landed = located(after(move), from);
    expect(close(landed.point, located(placements, onto).point)).toBe(true);
  });

  it("P-pose: a world translation and rotation land in the layer's frame — what is left out stays, a nested piece included", () => {
    const move = posed(placements, "tail.0/half.0", { translation: [0.2, 0.1, 0.05] });
    const stands = stood(after(move))("tail.0/half.0");
    expect(close(stands.translation, [0.2, 0.1, 0.05])).toBe(true);
    expect(close(stands.rotation, stood(placements)("tail.0/half.0").rotation, 1e-5)).toBe(true);
    const turned = posed(placements, "tail.0/half.0", { rotation: [0, 0, 0, 1] });
    const upright = stood(after(turned))("tail.0/half.0");
    expect(close(upright.rotation, [0, 0, 0, 1], 1e-5)).toBe(true);
    expect(close(upright.translation, stood(placements)("tail.0/half.0").translation)).toBe(true);
    expect(() => posed(placements, "gone.0", {})).toThrow(/not on the stage/);
  });

  it("P-model: the screen hands the model every placement where it stands in the world, and each cursor's point and axis there", () => {
    const folded = { slug: "rig", placements: placements.map((one) => ({ ...one, ref: "x" })), joints: [], missing: [] };
    const lines = screen({ subject: "rig", selected: [], cursors: [onto, from] }, folded).split("\n");
    expect(lines[1]).toBe("rig: 3 placements · 0 joints — world frame, metres");
    expect(lines[2]).toBe("  plate.0 ← x (rig.plate.0) at [0.1, 0, 0] rot [0, 0, 0, 1]");
    expect(lines[3]).toBe("  tail.0 ← x (rig.tail.0) at [0, 0.05, 0.02] rot [0, 0, 0.7071, 0.7071]");
    expect(lines[5]).toBe("cursors — world frame:");
    expect(lines[6]).toBe("  1 hole r1.50mm on plate.0 at [0.11, 0.002, 0.01] axis [0, 1, 0]");
    expect(lines[7].startsWith("  2 face on tail.0/half.0 at [")).toBe(true);
  });

  it("P-refused: one cursor, a carry that is not above the piece, and both cursors on what moves are refused by name", () => {
    expect(() => mate(placements, [onto])).toThrow(/two cursors/);
    expect(() => mate(placements, [onto, from], { carry: "plate.0" })).toThrow(/does not carry/);
    expect(() => mate(placements, [{ ...from, path: "tail.0" }, from], { carry: "tail.0" })).toThrow(/onto itself/);
    expect(() => mate(placements, [onto, { ...from, path: "gone.0" }])).toThrow(/not on the stage/);
  });
});

describe("the cursor on the screen and in the recipe", () => {
  it("P-screen: the status names every cursor by number, kind and path; none, and the sentence is as it was", () => {
    expect(status({ subject: "rig", selected: [] })).toBe("On the operator's screen: rig · selected nothing.");
    expect(status({ subject: "rig", selected: [], cursors: [{ kind: "hole", radius: 0.0015, path: "plate.0" }, { kind: "face", path: "tail.0/half.0" }] }))
      .toBe("On the operator's screen: rig · selected nothing · cursors 1 hole r1.50mm on plate.0, 2 face on tail.0/half.0.");
  });

  it("P-recipe: the buffer holds caret, cursors and mating; cursor is a gizmo, no key", () => {
    const schema = JSON.stringify(mode.buffer);
    expect(GIZMOS.includes("cursor")).toBe(true);
    expect(GIZMOS.includes("pick")).toBe(false);
    expect(schema.includes('"cursor":')).toBe(false);
    for (const key of ["caret", "cursors", "mating"]) expect(schema.includes(`"${key}":`)).toBe(true);
  });
});
