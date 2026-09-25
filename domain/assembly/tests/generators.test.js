import { specimen } from "@vivalence/typology";
import * as THREE from "three";
import { generate, generators } from "../generators/index.js";

const { describe, it, expect } = specimen;

const size = (object) => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).toArray().map((n) => Math.round(n * 100000) / 100000);
const bottom = (object) => Math.round(new THREE.Box3().setFromObject(object).min.y * 100000) / 100000 + 0;

describe("the generators — geometry at read, metres, Y-up, origin where the part meets what it holds", () => {
  it("P-registry: six generators, each with a params schema and a build", () => {
    expect(Object.keys(generators).sort()).toEqual(["cable.route", "fastener.bolt", "fastener.nut", "fastener.standoff", "solid.box", "solid.bushing"]);
    for (const held of Object.values(generators)) {
      expect(typeof held.build).toBe("function");
      expect(typeof held.params.check).toBe("function");
    }
  });

  it("P-fasteners: a bolt hangs its shaft below the origin, a standoff and a nut stand on it, sized by the thread table", () => {
    const bolt = generate({ generator: "fastener.bolt", params: { thread: "M3", length: 16 } });
    expect(size(bolt)[1]).toBe(0.01765);
    expect(bottom(bolt)).toBe(-0.016);
    const standoff = generate({ generator: "fastener.standoff", params: { thread: "M3", length: 27 } });
    expect(size(standoff)[1]).toBe(0.027);
    expect(bottom(standoff)).toBe(0);
    const nut = generate({ generator: "fastener.nut", params: { thread: "M5" } });
    expect(size(nut)[1]).toBe(0.004);
    expect(bottom(nut)).toBe(0);
  });

  it("P-solids: a box stands on the origin with the footprint asked for; a bushing is a tube of the outer diameter and the length", () => {
    const box = generate({ generator: "solid.box", params: { x: 20, y: 4, z: 12 } });
    expect(size(box)).toEqual([0.02, 0.004, 0.012]);
    expect(bottom(box)).toBe(0);
    const bushing = generate({ generator: "solid.bushing", params: { outer: 6, inner: 3, length: 5 } });
    const [x, y, z] = size(bushing);
    expect(Math.abs(x - 0.006) < 0.0002 && Math.abs(z - 0.006) < 0.0002).toBe(true);
    expect(y).toBe(0.005);
    expect(bottom(bushing)).toBe(0);
  });

  it("P-route: a cable follows its points and spans them; fewer than two points is refused", () => {
    const cable = generate({ generator: "cable.route", params: { route: [[0, 0, 0], [0.1, 0, 0]], diameter: 2.4 } });
    const [x, y, z] = size(cable);
    expect(Math.abs(x - 0.1) < 0.0005).toBe(true);
    expect(Math.abs(y - 0.0024) < 0.0005 && Math.abs(z - 0.0024) < 0.0005).toBe(true);
    expect(() => generate({ generator: "cable.route", params: { route: [[0, 0, 0]], diameter: 2 } })).toThrow();
  });

  it("P-json: every generator's build serialises to three.js JSON the stage can parse", () => {
    const loader = new THREE.ObjectLoader();
    for (const [name, held] of Object.entries(generators)) {
      const params = { "fastener.bolt": { thread: "M3", length: 8 }, "fastener.standoff": { thread: "M3", length: 27 }, "fastener.nut": { thread: "M3" }, "solid.box": { x: 1, y: 1, z: 1 }, "solid.bushing": { outer: 6, inner: 3, length: 5 }, "cable.route": { route: [[0, 0, 0], [0, 0.01, 0], [0.01, 0.01, 0]], diameter: 2 } }[name];
      const json = generate({ generator: name, params }).toJSON();
      const back = loader.parse(json);
      let meshes = 0;
      back.traverse((object) => {
        if (object.isMesh) meshes++;
      });
      expect(meshes, name).toBeGreaterThan(0);
      expect(held.params.check(params), name).toBe(true);
    }
  });
});
