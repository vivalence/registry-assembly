import { specimen } from "@vivalence/typology";

const { describe, it, expect } = specimen;

// the two guide modes carry the same stage kit — copied, never imported across a mode's
// directory — and neither mode paints a colour of its own: every hue is a theme token
const ROOT = new URL("../modes/", import.meta.url).pathname;
const MODES = ["guide/player", "guide/editor"];

const walk = async (dir, out = []) => {
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) await walk(path, out);
    else if (/\.(svelte|js)$/.test(entry.name)) out.push(path);
  }
  return out;
};

describe("the guide modes' kit", () => {
  it("P-kit-pinned: the player's and the editor's buffer/kit are byte-equal, file for file", async () => {
    const [a, b] = await Promise.all(MODES.map((one) => walk(`${ROOT}${one}/buffer/kit`)));
    const names = (list, base) => list.map((path) => path.slice(base.length)).sort();
    expect(names(a, `${ROOT}guide/player/buffer/kit`)).toEqual(names(b, `${ROOT}guide/editor/buffer/kit`));
    for (const path of a) {
      const twin = path.replace(`${ROOT}guide/player/buffer/kit`, `${ROOT}guide/editor/buffer/kit`);
      expect(await Deno.readTextFile(path), path).toBe(await Deno.readTextFile(twin));
    }
    expect(a.length).toBeGreaterThan(3);
  });

  it("P-palette-in-one-place: a mode's hexes live only in its root palette block — the parts and the kit read variables", async () => {
    for (const one of MODES) {
      for (const path of await walk(`${ROOT}${one}/buffer`)) {
        if (path.endsWith("/Guide.svelte")) continue;
        expect([...(await Deno.readTextFile(path)).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) => match[0]), path).toEqual([]);
      }
    }
  });
});
