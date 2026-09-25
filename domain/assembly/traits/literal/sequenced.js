import { traits } from "@vivalence/typology";
import * as shapes from "../../schematics.js";
import { checked } from "./rows.js";

export const SEQUENCED = traits.define("SEQUENCED", {
  schematic: shapes.SEQUENCED,
  repository: {
    async guide({ slug, name, description, subject, sections, lines, images, notes, staged, symbols }, mode) {
      const carried = [];
      const trait = {};
      const held = await this.findOne({ slug });
      if (held && held.ontology !== "guide") throw new Error(`[assembly] "${slug}" is a ${held.ontology}, not a guide`);
      if (name != null || description != null || !held) (carried.push("LABELED"), (trait.LABELED = this.labeled(held, slug, name, description)));
      if (subject !== undefined || sections || !held) {
        const was = held?.trait?.SEQUENCED ?? { sections: [] };
        const next = subject === undefined ? was.subject : subject;
        carried.push("SEQUENCED");
        trait.SEQUENCED = { ...(next && { subject: next }), sections: sections ?? was.sections ?? [] };
      }
      const found = await this.told("guide", held, { lines, images, notes, staged }, carried, trait);
      const sequenced = trait.SEQUENCED ?? held?.trait?.SEQUENCED;
      if (sequenced?.subject) {
        const part = found.find((one) => one.slug === sequenced.subject);
        if (part && part.ontology !== "part") throw new Error(`[assembly] "${sequenced.subject}" is a ${part.ontology} — a guide builds a part`);
      }
      for (const step of (sequenced?.sections ?? []).flatMap((section) => section.steps ?? [])) {
        const row = found.find((one) => one.slug === step);
        if (row && row.ontology !== "step") throw new Error(`[assembly] "${step}" is a ${row.ontology}, not a step`);
      }
      const row = await this.over("guide", slug, carried, trait, symbols, mode);
      await this.uses(row);
      await this.em.flush();
      return row;
    },

    async sequence(row, sections) {
      if (row.ontology !== "guide") throw new Error(`[assembly] "${row.slug}" is a ${row.ontology} — only a guide sequences steps`);
      checked(shapes.SEQUENCED.properties.sections, sections, "SEQUENCED sections");
      const steps = sections.flatMap((section) => section.steps ?? []);
      const found = steps.length ? await this.find({ slug: { $in: steps } }) : [];
      for (const slug of steps) {
        const step = found.find((held) => held.slug === slug);
        if (!step) throw new Error(`[assembly] no step "${slug}"`);
        if (step.ontology !== "step") throw new Error(`[assembly] "${slug}" is a ${step.ontology}, not a step`);
      }
      if (new Set(steps).size !== steps.length) throw new Error(`[assembly] a step is sequenced once in "${row.slug}"`);
      this.carry(row, "SEQUENCED", { ...row.trait?.SEQUENCED, sections: JSON.parse(JSON.stringify(sections)) });
      await this.uses(row);
      await this.em.flush();
      return row;
    },
  },
});
