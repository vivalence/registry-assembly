import { traits } from "@vivalence/typology";
import * as shapes from "../../schematics.js";
import { mentions } from "./rows.js";

export const ASSEMBLED = traits.define("ASSEMBLED", {
  schematic: shapes.ASSEMBLED,
  repository: {
    async told(kind, held, { lines, images, notes, staged }, carried, trait) {
      if (lines || images || !held) {
        const was = held?.trait?.INSTRUCTED ?? { lines: [], images: [] };
        carried.push("INSTRUCTED");
        trait.INSTRUCTED = { lines: lines ?? was.lines ?? [], images: images ?? was.images ?? [] };
      }
      if (notes || !held) (carried.push("ANNOTATED"), (trait.ANNOTATED = { notes: notes ?? held?.trait?.ANNOTATED?.notes ?? [] }));
      if (staged) (carried.push("STAGED"), (trait.STAGED = staged));
      const kinds = (trait.ANNOTATED?.notes ?? []).flatMap((note) => note.symbols ?? []);
      if (kinds.length) await this.symbolsNamed(kinds);
      const slugs = mentions({ ontology: kind, trait: { ...held?.trait, ...trait } });
      const found = slugs.length ? await this.find({ slug: { $in: slugs } }) : [];
      const lost = slugs.filter((slug) => !found.some((one) => one.slug === slug));
      if (lost.length) throw new Error(`[assembly] no literal named ${lost.map((slug) => `"${slug}"`).join(", ")} — a ${kind} names what is there`);
      return found;
    },

    async step({ slug, name, description, placements, lines, images, notes, staged, symbols }, mode) {
      const carried = [];
      const trait = {};
      const held = await this.findOne({ slug });
      if (held && held.ontology !== "step") throw new Error(`[assembly] "${slug}" is a ${held.ontology}, not a step`);
      if (name != null || description != null || !held) (carried.push("LABELED"), (trait.LABELED = this.labeled(held, slug, name, description)));
      if (placements || !held) (carried.push("ASSEMBLED"), (trait.ASSEMBLED = { placements: placements ?? held?.trait?.ASSEMBLED?.placements ?? [] }));
      const found = await this.told("step", held, { lines, images, notes, staged }, carried, trait);
      for (const one of trait.ASSEMBLED?.placements ?? []) {
        const row = found.find((each) => each.slug === one.literal);
        if (row && row.ontology !== "placement") throw new Error(`[assembly] "${one.literal}" is a ${row.ontology} — a step installs placements`);
      }
      const row = await this.over("step", slug, carried, trait, symbols, mode);
      await this.uses(row);
      await this.em.flush();
      return row;
    },
  },
});
