import { traits } from "@vivalence/typology";
import * as shapes from "../../schematics.js";
import * as pure from "../../resolve.js";
import { ONTOLOGIES, checked, joinsOf, mentions, modeId, placedOf, rebase, reslugged, slugOf, subjectOf, under } from "./rows.js";

export const PLACED = traits.define("PLACED", {
  schematic: shapes.PLACED,
  repository: {
    get card() {
      return {
        fields: ["slug", "ontology", "traits"],
        populate: [],
        project: (literal) => ({
          slug: literal.slug,
          ontology: literal.ontology,
          name: literal.trait?.LABELED?.name ?? literal.slug,
          ...(literal.trait?.COUNTED && { qty: literal.trait.COUNTED.qty }),
          ...(literal.trait?.MODELED && { file: literal.trait.MODELED.file }),
          ...(literal.trait?.PARAMETRIC && { generator: literal.trait.PARAMETRIC.generator }),
          ...(literal.ontology === "guide" && { steps: pure.order(literal).length, ...(literal.trait?.SEQUENCED?.subject && { subject: literal.trait.SEQUENCED.subject }) }),
          ...(literal.trait?.ASSEMBLED && { placements: literal.trait.ASSEMBLED.placements.length }),
          ...(literal.trait?.PLACED && { layer: literal.trait.PLACED.layer, ref: literal.trait.PLACED.ref }),
        }),
      };
    },

    search(query) {
      const like = `%${query.search}%`;
      return [{ slug: { $like: like } }, { trait: { LABELED: { name: { $like: like } } } }];
    },

    async named(slug) {
      const found = await this.findOne({ slug });
      if (!found) throw new Error(`[assembly] no literal named "${slug}"`);
      return found;
    },

    async symbolsNamed(slugs) {
      const wanted = [...new Set(slugs.filter(Boolean))];
      if (!wanted.length) return [];
      const found = await this.entities.symbol.find({ slug: { $in: wanted } });
      const missing = wanted.filter((slug) => !found.some((symbol) => symbol.slug === slug));
      if (missing.length) throw new Error(`[assembly] no symbol ${missing.map((slug) => `"${slug}"`).join(", ")} — the vocabulary is what the topologies ship`);
      return found;
    },

    async mint(kind, slug, data, symbols, mode) {
      const declared = ONTOLOGIES[kind];
      if (!declared) throw new Error(`[assembly] no ontology "${kind}" — one of ${Object.keys(ONTOLOGIES).join(", ")}`);
      if (!slug) throw new Error(`[assembly] a ${kind} needs a slug`);
      const held = data.traits ?? [];
      const stray = held.filter((trait) => !declared.traits.includes(trait));
      if (stray.length) throw new Error(`[assembly] a ${kind} carries no ${stray.join(", ")} — its traits are ${declared.traits.join(", ")}`);
      for (const trait of held) checked(shapes.TRAITS[trait], data.trait?.[trait], `${trait} payload on "${slug}"`);
      const taken = await this.findOne({ slug });
      if (taken) throw new Error(`[assembly] "${slug}" is already a ${taken.ontology} — a slug is unique; name it deeper, or number it`);
      const found = await this.symbolsNamed([kind, ...symbols]).catch((error) => {
        if (/no symbol "[^"]*"/.test(error.message) && error.message.includes(`"${kind}"`)) {
          throw new Error(`[assembly] the symbol "${kind}" is not installed — mount @assembly/topology/${kind}`);
        }
        throw error;
      });
      const root = found.find((symbol) => symbol.slug === kind);
      const row = this.create({ slug, mode: modeId(mode) ?? root.mode, traits: held, trait: data.trait ?? {} });
      for (const symbol of found) row.symbols.add(symbol);
      await this.em.flush();
      return row;
    },

    async over(kind, slug, held, trait, symbols, mode) {
      const row = await this.findOne({ slug });
      if (!row) {
        if (!held.includes("LABELED")) (held.unshift("LABELED"), (trait.LABELED = { name: slug }));
        return this.mint(kind, slug, { traits: held, trait }, symbols ?? [], mode);
      }
      if (row.ontology !== kind) throw new Error(`[assembly] "${slug}" is a ${row.ontology}, not a ${kind}`);
      for (const one of held) checked(shapes.TRAITS[one], trait[one], `${one} payload on "${slug}"`);
      row.trait = { ...row.trait, ...trait };
      for (const one of held) if (!row.traits.includes(one)) row.traits = [...row.traits, one];
      if (symbols) await this.mark(row, symbols);
      await this.em.flush();
      return row;
    },

    async mark(row, symbols) {
      const found = await this.symbolsNamed([row.ontology, ...symbols]);
      if (!row.symbols.isInitialized()) await row.symbols.init();
      row.symbols.set(found);
    },

    labeled(held, slug, name, description) {
      const was = held?.trait?.LABELED ?? {};
      return { name: name ?? was.name ?? slug, ...((description ?? was.description) != null && { description: description ?? was.description }) };
    },

    async placement({ label, description, joins, symbols, ...placed }, mode) {
      checked(shapes.PLACED, placed, "PLACED");
      const layer = await this.named(placed.layer);
      if (!ONTOLOGIES[layer.ontology]?.layer) throw new Error(`[assembly] cannot place into "${layer.slug}" — a ${layer.ontology} is not a layer`);
      const into = await this.named(placed.ref);
      if (into.ontology !== "part") throw new Error(`[assembly] "${placed.ref}" is a ${into.ontology} — a placement places a part`);
      if ((await this.closure(into)).has(layer.slug)) throw new Error(`[assembly] "${placed.ref}" already contains "${layer.slug}" — placing it here would eat itself`);
      const slug = slugOf(placed);
      const held = await this.findOne({ slug });
      if (held && held.ontology !== "placement") throw new Error(`[assembly] "${slug}" is a ${held.ontology}, not a placement`);
      const carried = ["PLACED"];
      const trait = { PLACED: { ...(held?.trait?.PLACED ?? {}), ...placed } };
      if (label != null || description != null || !held) {
        carried.unshift("LABELED");
        trait.LABELED = this.labeled(held, placed.name, label, description);
      }
      if (joins) (carried.push("JOINED"), (trait.JOINED = { joins }));
      const row = await this.over("placement", slug, carried, trait, symbols, mode);
      await this.uses(row);
      await this.em.flush();
      return row;
    },

    follow(every, map) {
      const to = (slug) => map.get(slug) ?? slug;
      const touched = [];
      for (const row of every) {
        if (row.ontology !== "step" && row.ontology !== "guide") continue;
        if (!mentions(row).some((slug) => map.has(slug))) continue;
        row.trait = reslugged(row, to);
        touched.push(row);
      }
      return touched;
    },

    async move(slug, to) {
      const row = await this.named(slug);
      if (row.ontology !== "placement") throw new Error(`[assembly] "${slug}" is a ${row.ontology} — only a placement moves; a part or a step is named by its slug`);
      const was = placedOf(row);
      const from = pure.path(was);
      const next = { ...was, ...(to.layer && { layer: to.layer }), ...(to.name && { name: to.name }) };
      if (to.parent !== undefined) {
        if (to.parent) next.parent = to.parent;
        else delete next.parent;
      }
      checked(shapes.PLACED, next, "PLACED");
      const at = pure.path(next);
      const target = slugOf(next);
      if (target === slug) return row;
      if (next.layer !== was.layer) {
        const layer = await this.named(next.layer);
        if (!ONTOLOGIES[layer.ontology]?.layer) throw new Error(`[assembly] cannot move into "${layer.slug}" — a ${layer.ontology} is not a layer`);
        if ((await this.closure(await this.named(was.ref))).has(layer.slug)) throw new Error(`[assembly] "${was.ref}" already contains "${layer.slug}" — moving it there would eat itself`);
      }
      const every = await this.find({}, { populate: ["uses"] });
      const placements = every.filter((held) => held.ontology === "placement" && placedOf(held));
      if (next.parent) {
        if (next.layer === was.layer && under(next.parent, from)) throw new Error(`[assembly] "${next.parent}" is under "${from}" — a placement cannot move under itself`);
        if (!placements.some((held) => placedOf(held).layer === next.layer && pure.path(placedOf(held)) === next.parent)) throw new Error(`[assembly] no placement "${next.parent}" in "${next.layer}"`);
      }
      if (await this.findOne({ slug: target })) throw new Error(`[assembly] "${target}" is already there — a slug is unique`);
      const affected = placements.filter((held) => placedOf(held).layer === was.layer);
      const family = affected.filter((held) => held !== row && placedOf(held).parent && under(placedOf(held).parent, from));
      const renamed = new Map([[slug, target]]);
      for (const child of family) {
        child.trait = { ...child.trait, PLACED: { ...placedOf(child), layer: next.layer, parent: rebase(placedOf(child).parent, from, at) } };
        const slugged = slugOf(placedOf(child));
        renamed.set(child.slug, slugged);
        child.slug = slugged;
      }
      const followers = this.follow(every, renamed);
      for (const held of affected) {
        const joins = joinsOf(held);
        if (!joins.length) continue;
        const rebased = joins.map((join) => (under(join, from) ? rebase(join, from, at) : join));
        if (rebased.some((join, index) => join !== joins[index])) held.trait = { ...held.trait, JOINED: { ...held.trait.JOINED, joins: rebased } };
      }
      const label = row.trait?.LABELED?.name;
      row.trait = { ...row.trait, PLACED: next, ...(label === was.name && { LABELED: { ...row.trait.LABELED, name: next.name } }) };
      row.slug = target;
      for (const held of [row, ...family, ...followers]) await this.uses(held, every);
      await this.em.flush();
      return row;
    },

    async rename(slug, to) {
      const row = await this.named(slug);
      if (row.ontology === "placement") throw new Error(`[assembly] "${slug}" is a placement — its name is its path; move it to a new name`);
      const target = String(to ?? "").trim();
      if (!target) throw new Error(`[assembly] a ${row.ontology} needs a slug`);
      if (target === slug) return row;
      if (await this.findOne({ slug: target })) throw new Error(`[assembly] "${target}" is already there — a slug is unique; name it deeper, or number it`);
      const every = await this.find({}, { populate: ["uses"] });
      const inside = every.filter((held) => placedOf(held)?.layer === slug);
      const placing = every.filter((held) => placedOf(held)?.ref === slug);
      const next = new Map(inside.map((held) => [held, slugOf({ ...placedOf(held), layer: target })]));
      for (const [held, slugged] of next) {
        const taken = every.find((one) => one.slug === slugged && one !== held && !next.has(one));
        if (taken) throw new Error(`[assembly] "${slugged}" is already a ${taken.ontology} — "${held.slug}" cannot follow "${slug}" to "${target}"`);
      }
      const renamed = new Map([[slug, target], ...[...next].map(([held, slugged]) => [held.slug, slugged])]);
      for (const [held, slugged] of next) {
        held.trait = { ...held.trait, PLACED: { ...placedOf(held), layer: target } };
        held.slug = slugged;
      }
      for (const held of placing) held.trait = { ...held.trait, PLACED: { ...placedOf(held), ref: target } };
      const followers = this.follow(every, renamed);
      const label = row.trait?.LABELED?.name;
      row.trait = { ...row.trait, ...(label === slug && { LABELED: { ...row.trait.LABELED, name: target } }) };
      row.slug = target;
      for (const held of followers) await this.uses(held, every);
      await this.em.flush();
      return row;
    },

    async duplicate(slug, { to } = {}, mode) {
      const row = await this.named(slug);
      const every = await this.find({}, { populate: ["uses"] });
      const taken = new Set(every.map((held) => held.slug));
      const free = (base) => {
        let slugged = base;
        for (let n = 2; taken.has(slugged); n++) slugged = `${base}_${n}`;
        taken.add(slugged);
        return slugged;
      };
      const claim = (slugged) => {
        if (taken.has(slugged)) throw new Error(`[assembly] "${slugged}" is already there — a slug is unique; name it deeper, or number it`);
        taken.add(slugged);
        return slugged;
      };
      const payload = (held) => JSON.parse(JSON.stringify(held.trait ?? {}));
      const marks = async (held) => {
        if (!held.symbols.isInitialized()) await held.symbols.init();
        return held.symbols.getItems().map((symbol) => symbol.slug).filter((one) => one !== held.ontology);
      };
      const layerOf = (layer) => every.filter((held) => placedOf(held)?.layer === layer);
      const planned = [];
      const copied = [];
      const mintOf = (kind, slugged, carried, trait, symbols) =>
        planned.push(async () => {
          const made = await this.mint(kind, slugged, { traits: carried, trait }, symbols, mode);
          copied.push(made);
          return made;
        });
      const layered = async (from, into, { joined = true } = {}) => {
        for (const held of layerOf(from)) {
          const placed = { ...placedOf(held), layer: into };
          const trait = payload(held);
          trait.PLACED = placed;
          const carried = held.traits.filter((one) => joined || one !== "JOINED");
          if (!joined) delete trait.JOINED;
          mintOf("placement", claim(slugOf(placed)), carried, trait, await marks(held));
        }
      };
      const settle = async () => {
        for (const run of planned) await run();
        const made = copied[0];
        for (const held of copied) await this.uses(held);
        await this.em.flush();
        return made;
      };

      if (row.ontology === "part") {
        const target = to ? claim(String(to).trim()) : free(`${slug}_copy`);
        const trait = payload(row);
        trait.LABELED = { ...trait.LABELED, name: `${trait.LABELED?.name ?? slug} copy` };
        delete trait.SEQUENCED;
        mintOf("part", target, row.traits.filter((one) => one !== "SEQUENCED"), trait, await marks(row));
        await layered(slug, target);
        return settle();
      }

      if (row.ontology === "guide") {
        const target = to ? claim(String(to).trim()) : free(`${slug}_copy`);
        const own = pure.order(row).filter((step) => every.some((one) => one.slug === step));
        const renamed = new Map([[slug, target]]);
        for (const step of own) renamed.set(step, step.startsWith(`${slug}.`) ? free(`${target}${step.slice(slug.length)}`) : free(`${step}_copy`));
        const follow = (one) => renamed.get(one) ?? one;
        const trait = reslugged(row, follow);
        trait.LABELED = { ...trait.LABELED, name: `${trait.LABELED?.name ?? slug} copy` };
        mintOf("guide", target, [...row.traits], trait, await marks(row));
        for (const step of own) {
          const held = every.find((one) => one.slug === step);
          mintOf("step", renamed.get(step), [...held.traits], reslugged(held, follow), await marks(held));
        }
        return settle();
      }

      if (row.ontology === "step") {
        const target = to ? claim(String(to).trim()) : free(`${slug}_copy`);
        const hosts = every.filter((held) => held.ontology === "guide" && pure.order(held).includes(slug));
        const trait = payload(row);
        trait.LABELED = { ...trait.LABELED, name: `${trait.LABELED?.name ?? slug} copy` };
        mintOf("step", target, [...row.traits], trait, await marks(row));
        for (const run of planned) await run();
        const made = copied[0];
        for (const host of hosts) {
          const sections = (host.trait?.SEQUENCED?.sections ?? []).map((section) => {
            const steps = [...(section.steps ?? [])];
            if (steps.includes(slug)) steps.splice(steps.indexOf(slug) + 1, 0, target);
            return { ...section, steps };
          });
          this.carry(host, "SEQUENCED", { ...host.trait?.SEQUENCED, sections });
          copied.push(host);
        }
        for (const held of copied) await this.uses(held);
        await this.em.flush();
        return made;
      }

      const was = placedOf(row);
      const from = pure.path(was);
      const siblings = layerOf(was.layer);
      const sibling = (name) => slugOf({ ...was, name });
      let name = to ? String(to).trim() : null;
      if (name) claim(sibling(name));
      else {
        for (let n = 0; !name; n++) if (!taken.has(sibling(`${was.ref}.${n}`))) name = `${was.ref}.${n}`;
        claim(sibling(name));
      }
      const at = pure.path({ ...was, name });
      const trait = payload(row);
      trait.PLACED = { ...was, name };
      delete trait.JOINED;
      if (trait.LABELED?.name === was.name) trait.LABELED = { ...trait.LABELED, name };
      mintOf("placement", sibling(name), row.traits.filter((one) => one !== "JOINED"), trait, await marks(row));
      for (const held of siblings) {
        const placed = placedOf(held);
        if (held === row || !placed.parent || !under(placed.parent, from)) continue;
        const moved = { ...placed, parent: rebase(placed.parent, from, at) };
        const inner = payload(held);
        inner.PLACED = moved;
        delete inner.JOINED;
        mintOf("placement", claim(slugOf(moved)), held.traits.filter((one) => one !== "JOINED"), inner, await marks(held));
      }
      return settle();
    },

    async retract(slugs, { closure: whole = false, dry = false } = {}) {
      const wanted = [...new Set(slugs.filter(Boolean))];
      if (!wanted.length) return { retracted: [] };
      let rows = await this.find({ slug: { $in: wanted } });
      const every = await this.find({}, { populate: ["uses"] });
      if (whole) {
        const reach = new Map();
        for (const row of rows) {
          for (const [slug, held] of await this.closure(row)) {
            if (row.ontology === "guide" && held.ontology !== "guide" && held.ontology !== "step") continue;
            reach.set(slug, held);
          }
        }
        const taken = new Set(reach.keys());
        const beneath = (held) =>
          !!placedOf(held)?.parent && [...taken].some((slug) => {
            const above = placedOf(reach.get(slug) ?? {});
            return !!above && above.layer === placedOf(held).layer && under(placedOf(held).parent, pure.path(above));
          });
        for (let settled = false; !settled;) {
          settled = true;
          for (const slug of [...taken]) {
            if (wanted.includes(slug)) continue;
            const held = reach.get(slug);
            const outside = every.some((one) => !taken.has(one.slug) && this.references(one).includes(slug));
            const stranded = !!placedOf(held) && !taken.has(placedOf(held).layer) && !beneath(held);
            if (outside || stranded) (taken.delete(slug), (settled = false));
          }
        }
        rows = [...reach.values()].filter((held) => taken.has(held.slug));
      }
      const taken = new Set(rows.map((row) => row.slug));
      for (const row of every) {
        if (taken.has(row.slug)) continue;
        const held = this.references(row).filter((slug) => taken.has(slug));
        if (held.length) throw new Error(`[assembly] "${row.slug}" still references ${held.join(", ")} — retract those too, or none`);
      }
      if (dry) return { retracted: [...taken] };
      for (const row of rows) {
        if (!row.uses.isInitialized()) await row.uses.init();
        for (const used of row.uses.getItems()) if (used.in?.isInitialized()) used.in.remove(row);
        row.uses.removeAll();
        if (!row.in.isInitialized()) await row.in.init();
        for (const user of row.in.getItems()) if (user.uses?.isInitialized()) user.uses.remove(row);
        row.in.removeAll();
        if (!row.symbols.isInitialized()) await row.symbols.init();
        for (const symbol of row.symbols.getItems()) symbol.literals?.removeWithoutPropagation?.(row);
        row.symbols.removeAll();
      }
      await this.em.flush();
      for (const row of rows) this.em.remove(row);
      await this.em.flush();
      return { retracted: [...taken] };
    },

    async closure(row) {
      const rows = new Map([[row.slug, row]]);
      let frontier = [row];
      while (frontier.length) {
        const next = new Map();
        const wanted = new Set();
        for (const held of frontier) {
          for (const slug of this.references(held)) if (!rows.has(slug)) wanted.add(slug);
          if (!ONTOLOGIES[held.ontology]?.layer) continue;
          if (!held.in.isInitialized()) await held.in.init();
          for (const inner of held.in.getItems()) {
            if (placedOf(inner)?.layer === held.slug && !rows.has(inner.slug)) next.set(inner.slug, inner);
          }
        }
        if (wanted.size) {
          for (const found of await this.find({ slug: { $in: [...wanted] } })) {
            if (!rows.has(found.slug)) next.set(found.slug, found);
          }
        }
        frontier = [...next.values()];
        for (const held of frontier) rows.set(held.slug, held);
      }
      return rows;
    },

    async resolve(row, opts = {}) {
      const rows = await this.closure(row);
      for (const held of rows.values()) if (held.ontology === "step" && !held.symbols.isInitialized()) await held.symbols.init();
      return pure.resolve(rows, row.slug, opts);
    },

    async tree(slugs) {
      const counts = () => Object.fromEntries(Object.keys(ONTOLOGIES).map((ontology) => [ontology, 0]));
      if (slugs && !slugs.length) return { rows: [], counts: counts(), parts: [] };
      const rows = new Map();
      if (slugs) {
        for (const row of await this.find({ slug: { $in: [...new Set(slugs)] } }, { populate: ["mode", "symbols"], orderBy: { id: "asc" } })) {
          for (const [slug, held] of await this.closure(row)) rows.set(slug, held);
        }
      } else {
        for (const row of await this.find({}, { populate: ["mode", "symbols"], orderBy: { id: "asc" } })) rows.set(row.slug, row);
      }
      for (const row of rows.values()) if (!row.symbols.isInitialized()) await row.symbols.init();
      const every = [...rows.values()];
      const used = new Map();
      for (const row of every) if (placedOf(row)?.ref) used.set(placedOf(row).ref, (used.get(placedOf(row).ref) ?? 0) + 1);
      const tally = counts();
      for (const row of every) tally[row.ontology] = (tally[row.ontology] ?? 0) + 1;
      const layerOf = (slug) => every.filter((row) => placedOf(row)?.layer === slug);
      const counted = (n, what) => `${n} ${what}${n === 1 ? "" : "s"}`;
      const scenery = (row) => {
        try {
          return pure.resolve(rows, row.slug).placements.map((one) => ({
            path: one.path,
            ref: one.ref,
            ...(one.translation && { translation: one.translation }),
            ...(one.rotation && { rotation: one.rotation }),
            ...(one.scale && { scale: one.scale }),
          }));
        } catch {
          return [];
        }
      };
      const card = (row, depth, tail, key, extra = {}) => ({
        key,
        depth,
        ontology: row.ontology,
        slug: row.slug,
        name: row.trait?.LABELED?.name ?? row.slug,
        tail,
        ...(placedOf(row)?.ref && { ref: placedOf(row).ref, layer: placedOf(row).layer }),
        ...(row.trait?.SOURCED?.file && { source: row.trait.SOURCED.file }),
        traits: [...row.traits],
        trait: row.trait ?? {},
        symbols: row.symbols.getItems().map((symbol) => symbol.slug).filter((slug) => slug !== row.ontology),
        ...(row.trait?.MODELED && { modeled: row.trait.MODELED }),
        ...(row.ontology === "part" && { used: used.get(row.slug) ?? 0 }),
        ...(row.mode?.slug && { mode: row.mode.slug }),
        ...extra,
      });
      const tree = [];
      const walk = (row, depth, key, seen) => {
        for (const one of layerOf(row.slug)) {
          const into = rows.get(placedOf(one).ref);
          const below = into ? layerOf(into.slug).length : 0;
          const here = `${key}/${one.slug}`;
          tree.push(card(one, depth, below ? counted(below, "placement") : `← ${placedOf(one).ref}`, here, { scene: into ? scenery(into) : [] }));
          if (into && below && !seen.includes(into.slug)) walk(into, depth + 1, here, [...seen, into.slug]);
        }
      };
      const roots = every.filter((row) => row.ontology === "part" && !used.has(row.slug)).sort((a, b) => (a.slug < b.slug ? -1 : 1));
      for (const row of roots) {
        const inside = layerOf(row.slug);
        tree.push(card(row, 0, inside.length ? counted(inside.length, "placement") : `qty ${row.trait?.COUNTED?.qty ?? 0}`, row.slug, { scene: scenery(row) }));
        walk(row, 1, row.slug, [row.slug]);
      }
      const guides = every.filter((row) => row.ontology === "guide").sort((a, b) => (a.slug < b.slug ? -1 : 1));
      for (const guide of guides) {
        const subject = subjectOf(guide) ? rows.get(subjectOf(guide)) : null;
        const steps = pure.order(guide);
        tree.push(card(guide, 0, counted(steps.length, "step"), guide.slug, { scene: subject ? scenery(subject) : [] }));
        for (const slug of steps) {
          const step = rows.get(slug);
          if (!step) continue;
          const installs = (step.trait?.ASSEMBLED?.placements ?? []).map((one) => rows.get(one.literal)).filter(Boolean);
          const here = `${guide.slug}/${slug}`;
          tree.push(card(step, 1, counted(installs.length, "placement"), here, { scene: [] }));
          for (const one of installs) tree.push(card(one, 2, `← ${placedOf(one)?.ref}`, `${here}/${one.slug}`, { scene: [] }));
        }
      }
      const parts = every
        .filter((row) => row.ontology === "part")
        .sort((a, b) => (a.slug < b.slug ? -1 : 1))
        .map((row) => {
          const inside = layerOf(row.slug).length;
          return card(row, 0, inside ? counted(inside, "placement") : `qty ${row.trait?.COUNTED?.qty ?? 0}`, row.slug, { scene: inside ? scenery(row) : [] });
        });
      return { rows: tree, counts: tally, parts };
    },

    references(row) {
      const placed = placedOf(row);
      return [...new Set([...(placed ? [placed.ref, placed.layer] : []), ...mentions(row)].filter(Boolean))];
    },

    carry(row, trait, payload) {
      row.trait = { ...row.trait, [trait]: payload };
      if (!row.traits.includes(trait)) row.traits = [...row.traits, trait];
    },

    async uses(row, among) {
      const slugs = this.references(row);
      const found = among ? among.filter((one) => slugs.includes(one.slug)) : slugs.length ? await this.find({ slug: { $in: slugs } }) : [];
      if (!row.uses.isInitialized()) await row.uses.init();
      row.uses.set(found);
    },
  },
});
