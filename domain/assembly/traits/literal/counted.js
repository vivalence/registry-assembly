import { traits } from "@vivalence/typology";
import * as shapes from "../../schematics.js";
import * as pure from "../../resolve.js";

export const COUNTED = traits.define("COUNTED", {
  schematic: shapes.COUNTED,
  repository: {
    async part({ slug, name, description, modeled, parametric, sourced, qty, colour, symbols }, mode) {
      const carried = [];
      const trait = {};
      const held = await this.findOne({ slug });
      if (name != null || description != null || !held) (carried.push("LABELED"), (trait.LABELED = this.labeled(held, slug, name, description)));
      if (sourced) (carried.push("SOURCED"), (trait.SOURCED = sourced));
      if (modeled) (carried.push("MODELED"), (trait.MODELED = modeled));
      if (parametric) (carried.push("PARAMETRIC"), (trait.PARAMETRIC = parametric));
      if (qty != null) (carried.push("COUNTED"), (trait.COUNTED = { qty }));
      if (colour !== undefined) (carried.push("STAGED"), (trait.STAGED = this.coloured(held, colour)));
      return this.over("part", slug, carried, trait, symbols, mode);
    },

    async bom(row, opts = {}) {
      return pure.bom(await this.closure(row), row.slug, opts);
    },
  },
});
