<script>
  import { onMount, untrack } from "svelte";
  import { FILTERS, PANES } from "../schematics.js";
  import { ancestry, chain, free, opening, parent as parentOf, pathOf, reached, rooted, visible } from "./fold.js";
  import { frames } from "./kit/frames.js";
  import { mate, measure } from "./mate.js";
  import { payload, values } from "./form.js";
  import Tree from "./parts/Tree.svelte";
  import Stage from "./parts/Stage.svelte";
  import Inspector from "./parts/Inspector.svelte";
  import Notice from "./parts/Notice.svelte";
  import Retract from "./parts/Retract.svelte";

  const { terminal, buffer, skin } = $props();
  const data = buffer.$data ?? null;
  const files = terminal.client.runtime.entities.file.$entities;

  const LIMITS = { tree: [148, 440], inspector: [196, 520] };
  const KEPT = 40;
  const CHIPS = { tree: "tree", stage: "stage", inspector: "insp" };

  const SCREEN = {
    subject: null,
    selected: [],
    scope: "daemon",
    filter: "ALL",
    query: "",
    opened: [],
    caret: null,
    cursors: [],
    mating: { flip: false, offset: 0 },
    focus: null,
    desk: null,
    gizmo: "translate",
    joins: [],
    draft: null,
    draftOf: null,
    move: { layer: "", parent: "" },
    renaming: null,
    undo: [],
    redo: [],
    log: [],
    ghost: false,
    ghosted: [],
    hidden: [],
    locked: [],
    edges: true,
    explode: 0,
    camera: null,
    view: "iso",
    scrolls: {},
    panes: { tree: true, stage: true, inspector: true },
    sizes: { tree: 248, inspector: 312 },
  };

  const screened = (held = {}) => ({
    ...SCREEN,
    ...held,
    panes: { ...SCREEN.panes, ...(held.panes ?? {}) },
    sizes: { ...SCREEN.sizes, ...(held.sizes ?? {}) },
  });

  let local = $state(screened(buffer.data ?? {}));
  let tree = $state.raw({ rows: [], counts: {}, parts: [] });
  let shapes = $state.raw(null);
  let vocabulary = $state.raw({});
  let folded = $state.raw(null);
  let foldedOf = $state(null);
  let geometry = $state.raw({});
  let notice = $state(null);
  let dialog = $state(null);
  let loaded = $state(false);
  let root = $state(null);
  let drag = null;
  let token = 0;
  let mounted = false;
  let sending = null;

  const opened = $derived(new Set(local.opened));

  $effect(() => {
    const held = (data ? $data : buffer.data) ?? {};
    local = screened(held);
  });

  const say = (nature, words) => (notice = { nature, words });

  const persist = () => {
    sending = null;
    terminal.client.runtime.entities.buffer.updateOne({ id: buffer.id }, { data: buffer.data }).catch((error) => say("buffer", error.message));
  };

  const retain = (patch, { soon = false } = {}) => {
    buffer.data = { ...(buffer.data ?? {}), ...patch };
    local = screened(buffer.data);
    clearTimeout(sending);
    if (!soon) return persist();
    sending = setTimeout(persist, 400);
  };

  const call = (route, input = {}) => buffer.mode.connection.call(`/${route}`, input);

  const record = (nature, words, { write = false, fail = false } = {}) => retain({ log: [{ nature, words, write, fail }, ...local.log].slice(0, KEPT) }, { soon: true });

  const bySlug = $derived.by(() => {
    const held = {};
    for (const row of tree.rows) held[row.slug] ??= row;
    for (const row of tree.parts ?? []) held[row.slug] ??= row;
    return held;
  });
  const known = $derived(Object.values(bySlug));
  const byPart = $derived(Object.fromEntries((tree.parts ?? []).map((held) => [held.slug, held])));
  const card = $derived(local.selected.length === 1 ? (bySlug[local.selected[0]] ?? null) : null);
  const subject = $derived(local.subject ? (bySlug[local.subject] ?? null) : null);
  const fastener = $derived(card?.ontology === "placement" ? card.slug : null);
  const crumbs = $derived(local.subject ? chain(known, local.subject) : []);
  const top = $derived(crumbs[0] ?? null);
  const above = $derived(local.subject ? parentOf(known, local.subject) : null);
  const siblings = $derived(
    card?.ontology === "placement"
      ? known.filter((row) => row.ontology === "placement" && row.layer === card.layer && row.slug !== card.slug).map((row) => ({ slug: row.slug, name: row.trait?.PLACED?.name ?? row.name, path: pathOf(row.trait?.PLACED) }))
      : [],
  );
  const total = $derived(Object.values(tree.counts ?? {}).reduce((sum, one) => sum + one, 0));

  const matches = (row, held) => !held || row.slug.toLowerCase().includes(held) || (row.name ?? "").toLowerCase().includes(held);

  const listed = $derived.by(() => {
    if (local.scope === "buffer") return top ? visible(rooted(tree.rows, top), opened) : [];
    const held = local.query.trim().toLowerCase();
    if (!held && local.filter === "ALL") return visible(tree.rows, opened);
    const source = known.filter((row) => local.filter === "ALL" || row.ontology === local.filter.toLowerCase());
    return source
      .filter((row) => matches(row, held))
      .sort((a, b) => (a.slug < b.slug ? -1 : 1))
      .slice(0, 200)
      .map((row) => ({ ...row, key: row.slug, depth: 0, kids: false, opened: false }));
  });

  const empty = $derived(local.scope === "buffer" ? (local.subject ? "nothing in the buffer" : "pick a model in the daemon view") : total ? "nothing matches" : "the daemon holds no literals — import a model, or new");

  const asset = (path) =>
    path
      ? ($files.find((file) => file.path === path && file.mode.daemon === buffer.mode.daemon)?.url ?? null)
      : null;

  const entries = $derived.by(() => {
    if (!folded) return [];
    const parents = frames(folded.placements);
    const grouped = new Map();
    for (const one of folded.placements) {
      if (!grouped.has(one.ref)) grouped.set(one.ref, []);
      grouped.get(one.ref).push({
        path: one.path,
        slug: one.slug,
        parentMatrix: parents.get(one.path),
        active: one.active,
        ...(one.translation && { translation: one.translation }),
        ...(one.rotation && { rotation: one.rotation }),
        ...(one.scale && { scale: one.scale }),
        ...(one.colour && { colour: one.colour }),
      });
    }
    return [...grouped]
      .map(([slug, nodes]) => ({ id: slug, url: asset(folded.parts[slug]?.MODELED?.file ?? byPart[slug]?.modeled?.file), json: geometry[slug] ?? null, nodes }))
      .filter((entry) => entry.url || entry.json);
  });

  const hollows = $derived.by(() => {
    if (!folded) return [];
    const parents = frames(folded.placements);
    return folded.placements
      .filter((one) => one.children?.length)
      .map((one) => ({
        slug: one.slug,
        path: one.path,
        parentMatrix: parents.get(one.path),
        translation: one.translation,
        rotation: one.rotation,
        scale: one.scale,
      }));
  });

  const status = $derived.by(() => {
    const out = [];
    if (local.draft && local.draftOf) out.push({ tone: "step", label: `unsaved · ${local.draftOf}` });
    if (local.renaming) out.push({ tone: "part", label: `renaming ${local.renaming.slug}` });
    const last = local.log.find((one) => one.fail || one.write);
    if (last) out.push(last.fail ? { tone: "fail", label: `${last.nature} refused` } : { tone: "good", label: `${last.nature} written` });
    return out;
  });

  async function refresh() {
    try {
      tree = await call("tree", {});
      loaded = true;
    } catch (error) {
      say("/tree refused", error.message);
    }
  }

  async function refold() {
    const slug = local.subject;
    const mine = ++token;
    if (!slug || !bySlug[slug]) {
      folded = null;
      foldedOf = null;
      return;
    }
    try {
      const held = await call("resolve", { slug });
      const more = {};
      for (const [part, traits] of Object.entries(held.parts)) {
        if (traits.PARAMETRIC && !traits.MODELED && !geometry[part]) more[part] = await call("geometry", traits.PARAMETRIC).catch(() => null);
      }
      if (mine !== token) return;
      if (Object.keys(more).length) geometry = { ...geometry, ...more };
      folded = held;
      foldedOf = slug;
    } catch (error) {
      if (mine === token) say("/resolve refused", error.message);
    }
  }

  const drawing = $derived(local.subject);

  $effect(() => {
    const slug = drawing;
    const ready = loaded;
    void slug;
    if (ready && mounted) untrack(refold);
  });

  const stamp = $derived(local.undo[0]?.stamp ?? null);
  let stamped = untrack(() => stamp);

  $effect(() => {
    const at = stamp;
    if (!at || at === stamped || !mounted) return;
    stamped = at;
    untrack(() => refold().then(refresh));
  });

  $effect(() => {
    if (!loaded) return;
    const held = bySlug;
    untrack(() => {
      const gone = (one) => one && !held[one];
      const selected = local.selected.filter((one) => held[one]);
      const cursors = local.cursors.filter((one) => held[one.slug]);
      if (!gone(local.subject) && !gone(local.desk) && !gone(local.focus) && selected.length === local.selected.length && cursors.length === local.cursors.length) return;
      retain({ selected, cursors, ...(gone(local.subject) && { subject: null }), ...(gone(local.desk) && { desk: null }), ...(gone(local.focus) && { focus: null }) });
    });
  });

  $effect(() => {
    const chosen = local.selected;
    if (!chosen.length || !tree.rows.length) return;
    untrack(() => {
      const next = new Set(local.opened);
      let grew = false;
      for (const slug of chosen) for (const key of reached(tree.rows, slug)) if (!next.has(key)) (next.add(key), (grew = true));
      const found = listed.find((row) => row.slug === chosen[0]);
      const at = found && found.key !== local.caret ? found.key : null;
      if (grew || at) retain({ ...(grew && { opened: [...next] }), ...(at && { caret: at }) }, { soon: true });
    });
  });

  $effect(() => {
    const rows = listed;
    if (!rows.length) return;
    untrack(() => {
      if (!rows.some((row) => row.key === local.caret)) retain({ caret: rows[0].key }, { soon: true });
    });
  });

  const describe = (row) => (Array.isArray(row?.retracted) ? `${row.retracted.length} gone` : row?.slug ? `${row.ontology} ${row.slug}` : "ok");

  async function act(verb, input, follow = null) {
    try {
      const row = await call(verb, input);
      if (follow) retain(follow(row));
      notice = null;
      record(`/${verb}`, describe(row), { write: true });
      await refresh();
      await refold();
      return row;
    } catch (error) {
      say(`/${verb} refused`, error.message);
      record(`/${verb}`, error.message, { fail: true });
      return null;
    }
  }

  async function acts(verb, inputs) {
    try {
      const rows = [];
      for (const input of inputs) rows.push(await call(verb, input));
      notice = null;
      record(`/${verb}`, rows.length === 1 ? describe(rows[0]) : `${rows.length} written`, { write: true });
      return rows;
    } catch (error) {
      say(`/${verb} refused`, error.message);
      record(`/${verb}`, error.message, { fail: true });
      return null;
    } finally {
      await refold();
      await refresh();
    }
  }

  const toggle = (row) => {
    const next = new Set(local.opened);
    if (next.has(row.key)) next.delete(row.key);
    else next.add(row.key);
    retain({ opened: [...next] });
  };

  const isRoot = (slug) => tree.rows.some((row) => row.depth === 0 && row.slug === slug && (row.ontology === "part" || row.ontology === "guide"));

  // what the stage folds for a row: a part itself, a guide its subject, a step its guide's subject
  const foldable = (row) => {
    if (!row) return null;
    if (row.ontology === "part") return row.slug;
    if (row.ontology === "placement") return row.ref;
    if (row.ontology === "guide") return row.trait?.SEQUENCED?.subject ?? null;
    const host = parentOf(known, row.slug);
    return host ? foldable(bySlug[host]) : null;
  };

  function pick(row, event) {
    const many = event?.metaKey || event?.ctrlKey;
    const selected = many ? (local.selected.includes(row.slug) ? local.selected.filter((one) => one !== row.slug) : [...local.selected, row.slug]) : [row.slug];
    const moving = row.ontology === "placement" ? { layer: row.layer ?? "", parent: row.trait?.PLACED?.parent ?? "" } : local.move;
    const preview = local.scope === "daemon" && !many && isRoot(row.slug) ? foldable(row) : null;
    retain({ caret: row.key, selected, draft: null, draftOf: null, move: moving, ...(preview && { subject: preview, focus: null }) });
  }

  function enter(slug, { selected = null, scope = null } = {}) {
    if (!bySlug[slug]) return say("open refused", `no literal named "${slug}"`);
    const next = new Set([...local.opened, ...opening(tree.rows, slug)]);
    retain({ subject: slug, selected: selected ?? [slug], focus: null, opened: [...next], ...(scope && { scope }) });
  }

  function open(row) {
    if (!row) return;
    const scope = local.scope === "daemon" ? "buffer" : null;
    const slug = foldable(row);
    if (!slug) return say("open refused", `"${row.slug}" is a ${row.ontology} with nothing to fold — set its subject in the guide editor`);
    enter(slug, { selected: row.ontology === "part" || row.ontology === "placement" ? null : [row.slug], scope });
  }

  const single = (row) => enter(row.ontology === "placement" ? row.ref : row.slug, { selected: [row.slug] });

  function up() {
    if (above) return enter(above);
    if (local.scope === "buffer") return retain({ scope: "daemon" });
    retain({ subject: null, selected: [], focus: null });
  }

  function focusSlug(slug) {
    const row = bySlug[slug];
    if (!row) return say("focus refused", `no literal named "${slug}"`);
    if (row.ontology !== "placement") return open(row);
    if (folded?.placements.some((one) => one.slug === slug)) return retain({ selected: [slug], focus: slug });
    const host = row.layer;
    if (!host || !bySlug[host]) return retain({ selected: [slug], focus: slug });
    const next = new Set([...local.opened, ...opening(tree.rows, host)]);
    retain({ subject: host, selected: [slug], focus: slug, opened: [...next] });
  }

  const veiled = (which, slug) =>
    retain({ [which]: local[which].includes(slug) ? local[which].filter((one) => one !== slug) : [...local[which], slug] });

  const stagePick = (slug, path, event) => {
    if (!slug) return retain({ selected: [], focus: null });
    if (local.gizmo === "joint") {
      if (!path) return;
      return retain({ joins: local.joins.includes(path) ? local.joins.filter((one) => one !== path) : [...local.joins, path] });
    }
    const many = event?.metaKey || event?.ctrlKey || event?.shiftKey;
    retain({ selected: many ? (local.selected.includes(slug) ? local.selected.filter((one) => one !== slug) : [...local.selected, slug]) : [slug], draft: null, draftOf: null });
  };

  const NEAR = 0.0005;

  const stageCursor = (found) => {
    const same = (one) => one.path === found.path && one.kind === found.kind && Math.hypot(...one.point.map((held, k) => held - found.point[k])) < NEAR;
    retain({ cursors: local.cursors.some(same) ? local.cursors.filter((one) => !same(one)) : [...local.cursors, found] });
  };

  const dropCursor = (index) => retain({ cursors: index === null ? [] : local.cursors.filter((_, at) => at !== index) });

  const carry = $derived.by(() => {
    const last = local.cursors.at(-1);
    if (!last || !folded) return null;
    const above = folded.placements.filter((one) => local.selected.includes(one.slug) && last.path.startsWith(`${one.path}/`));
    return above.length === 1 ? above[0].path : null;
  });

  const measured = $derived.by(() => {
    if (local.cursors.length < 2 || !folded) return null;
    try {
      return measure(folded.placements, [local.cursors[0], local.cursors.at(-1)]);
    } catch {
      return null;
    }
  });

  const mated = () => {
    try {
      const { slug, translation, rotation, scale } = mate(folded.placements, local.cursors, { ...local.mating, carry });
      return moved([{ slug, translation, rotation, scale }]);
    } catch (error) {
      say("mate", error.message);
    }
  };

  const stageBox = (slugs, event) => {
    const many = event?.metaKey || event?.ctrlKey || event?.shiftKey;
    retain({ selected: many ? [...new Set([...local.selected, ...slugs])] : slugs, draft: null, draftOf: null });
  };

  const REST = { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };

  const seated = (slug, trs) => {
    const placed = bySlug[slug]?.trait?.PLACED;
    if (!placed) return null;
    const was = { translation: placed.translation, rotation: placed.rotation, scale: placed.scale };
    return {
      layer: placed.layer,
      name: placed.name,
      ...(placed.parent && { parent: placed.parent }),
      ref: placed.ref,
      ...REST,
      ...Object.fromEntries(Object.entries(trs ?? was).filter(([, held]) => held)),
    };
  };

  const ahead = (writes) => {
    if (!folded) return;
    const held = new Map(writes.map((write) => [`${write.layer}.${write.name}`, write]));
    const drawn = (one) => {
      const write = held.get(one.slug);
      return write ? { ...one, translation: write.translation, rotation: write.rotation, scale: write.scale } : one;
    };
    folded = { ...folded, placements: folded.placements.map(drawn) };
  };

  const moved = async (moves) => {
    const writes = moves.map(({ slug, ...trs }) => seated(slug, trs)).filter(Boolean);
    const back = moves.map(({ slug }) => seated(slug)).filter(Boolean);
    if (!writes.length) return;
    ahead(writes);
    const words = moves.length === 1 ? `moved ${moves[0].slug}` : `moved ${moves.length} · ${moves[0].slug} …`;
    if (await acts("placement", writes)) retain({ undo: [{ words, writes: back }, ...local.undo].slice(0, KEPT), redo: [] });
  };

  const slugOf = (write) => `${write.layer}.${(write.parent ? `${write.parent}/${write.name}` : write.name).replaceAll("/", ".")}`;

  const turned = async (from, onto) => {
    const [last, ...rest] = local[from];
    if (!last) return false;
    const standing = last.writes.map((write) => seated(slugOf(write))).filter(Boolean);
    ahead(last.writes);
    if (!(await acts("placement", last.writes))) return false;
    retain({ [from]: rest, [onto]: [{ words: last.words, writes: standing }, ...local[onto]].slice(0, KEPT) });
    return true;
  };

  async function undo(count = 1) {
    for (let done = 0; done < count; done++) if (!(await turned("undo", "redo"))) return;
  }

  const redo = () => turned("redo", "undo");

  const save = async (ontology, draft, was) => {
    const row = await act(ontology, payload(ontology, draft, was));
    if (row) retain({ draft: null, draftOf: null });
  };

  const coloured = (colour) => {
    const was = values(card.ontology, card);
    return act(card.ontology, { ...payload(card.ontology, was, was), colour });
  };

  const relocate = async (input) => {
    const row = await act("move", input);
    if (row) retain({ selected: [row.slug] });
  };

  async function joined() {
    if (!fastener) return say("/placement", "JOINED sits on a placement — select the fastener first");
    if (!local.joins.length) return say("/placement", "a join holds something — pick at least one placement on the stage");
    const placed = bySlug[fastener].trait.PLACED;
    const row = await act("placement", { layer: placed.layer, name: placed.name, ...(placed.parent && { parent: placed.parent }), ref: placed.ref, joins: local.joins.map((one) => one.split("/").pop()) });
    if (row) retain({ joins: [], gizmo: "translate" });
  }

  const beneath = (row) => {
    const from = pathOf(row.trait?.PLACED);
    return known.filter((held) => held.ontology === "placement" && held.layer === row.layer && held.slug !== row.slug && held.trait?.PLACED?.parent && (held.trait.PLACED.parent === from || held.trait.PLACED.parent.startsWith(`${from}/`)));
  };

  const shown = (slugs) => slugs.map((one) => ({ slug: one, ontology: bySlug[one]?.ontology ?? "part" }));

  async function ask(slug) {
    const row = bySlug[slug];
    if (!row) return (say("/retract refused", `no literal named "${slug}"`), null);
    if (row.ontology === "placement") {
      const slugs = [slug, ...beneath(row).map((held) => held.slug)];
      dialog = { slug, taking: shown(slugs), words: `retracting "${slug}" takes it and what sits under its path. the part it places stays.`, run: { slugs } };
      return slugs.length;
    }
    if (row.ontology === "step") {
      dialog = { slug, taking: shown([slug]), words: `retracting "${slug}" takes the step out of its guide's sections first, then the step. its placements stay.`, run: { slugs: [slug] }, host: parentOf(known, slug) };
      return 1;
    }
    try {
      const dry = await call("retract", { slugs: [slug], closure: true, dry: true });
      dialog = { slug, taking: shown(dry.retracted), words: `retracting "${slug}" takes what only it reaches. what something outside still references stays — that is the fixpoint.`, run: { slugs: [slug], closure: true } };
      return dry.retracted.length;
    } catch (error) {
      say("/retract refused", error.message);
      return null;
    }
  }

  async function confirm() {
    const { run, host } = dialog;
    dialog = null;
    if (host && bySlug[host]) {
      const sections = (bySlug[host].trait?.SEQUENCED?.sections ?? []).map((section) => ({ ...section, steps: (section.steps ?? []).filter((one) => one !== run.slugs[0]) }));
      if (!(await act("sequence", { guide: host, sections }))) return;
    }
    const gone = await act("retract", run);
    if (!gone) return;
    const left = (one) => !gone.retracted.includes(one);
    retain({
      selected: local.selected.filter(left),
      ...(!left(local.subject) && { subject: null }),
      ...(!left(local.desk) && { desk: null }),
      ...(!left(local.focus) && { focus: null }),
    });
  }

  const target = $derived(card);
  const taken = $derived(new Set(Object.keys(bySlug)));

  async function create() {
    if (local.scope === "daemon") {
      const made = await act("part", { slug: free(taken, "model") });
      if (made) retain({ selected: [made.slug], subject: made.slug, focus: null });
      return;
    }
    if (!subject || subject.ontology !== "part") return say("/placement", "open a model first — new places into the subject");
    const part = await act("part", { slug: free(taken, "part") });
    if (!part) return;
    const placed = await act("placement", { layer: subject.slug, ref: part.slug, name: `${part.slug}.0` });
    if (placed) retain({ selected: [placed.slug] });
  }

  async function duplicate() {
    if (!target) return;
    const made = await act("duplicate", { slug: target.slug });
    if (made) retain({ selected: [made.slug], desk: made.slug });
  }

  const rename = () => target && retain({ renaming: { slug: target.slug, value: target.ontology === "placement" ? (target.trait?.PLACED?.name ?? target.name) : target.slug } });

  const swapped = (from, to) => (one) => (one === from ? to : one && one.startsWith(`${from}.`) ? `${to}${one.slice(from.length)}` : one);

  const following = (from) => (row) => {
    const swap = swapped(from, row.slug);
    return { selected: local.selected.map(swap), subject: swap(local.subject), desk: swap(local.desk), focus: swap(local.focus) };
  };

  async function committed() {
    const held = local.renaming;
    if (!held) return;
    const value = String(held.value ?? "").trim();
    const row = bySlug[held.slug];
    if (!row || !value) return retain({ renaming: null });
    const done = row.ontology === "placement" ? await act("move", { slug: held.slug, name: value }, following(held.slug)) : await act("rename", { slug: held.slug, to: value }, following(held.slug));
    if (!done) return;
    retain({ renaming: null, draft: null, draftOf: null });
  }

  const crud = $derived([
    { label: "new", title: local.scope === "daemon" ? "new model" : "new part, placed into the subject", on: local.scope === "daemon" || !!subject, run: create },
    { label: "dup", title: "duplicate", on: !!target, run: duplicate },
    { label: "rename", title: "rename", on: !!target, run: rename },
    { label: "delete", title: "retract with its closure", on: !!target, danger: true, run: () => target && ask(target.slug) },
  ]);

  const seam = (which) => ({
    onpointerdown: (event) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag = { which, x: event.clientX };
    },
    onpointermove: (event) => {
      if (drag?.which !== which) return;
      const delta = event.clientX - drag.x;
      drag.x = event.clientX;
      const sign = which === "tree" ? 1 : -1;
      const [low, high] = LIMITS[which];
      retain({ sizes: { ...local.sizes, [which]: Math.max(low, Math.min(high, local.sizes[which] + sign * delta)) } }, { soon: true });
    },
    onpointerup: (event) => {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      drag = null;
    },
    onpointercancel: () => (drag = null),
  });

  const order = $derived(["tree", "stage", "inspector"].filter((one) => local.panes[one]));
  const flexed = $derived(local.panes.stage ? "stage" : local.panes.inspector ? "inspector" : "tree");
  const columns = $derived(order.flatMap((one, index) => [...(index ? ["4px"] : []), one === flexed ? "minmax(0,1fr)" : `${local.sizes[one] ?? 240}px`]).join(" "));

  const seamAfter = (one) => {
    const next = order[order.indexOf(one) + 1];
    if (!next) return null;
    return one === flexed ? next : one;
  };

  const flip = (one) => {
    const panes = { ...local.panes, [one]: !local.panes[one] };
    if (!panes.tree && !panes.stage && !panes.inspector) return;
    retain({ panes });
  };

  function keyed(event) {
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const rows = listed;
    const index = rows.findIndex((row) => row.key === local.caret);
    const row = index >= 0 ? rows[index] : null;
    const go = (to) => {
      const next = rows[Math.max(0, Math.min(rows.length - 1, to))];
      if (next) pick(next);
    };
    const key = event.key;
    if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === "z") return (event.preventDefault(), event.shiftKey ? redo() : undo());
    if (key === "ArrowDown" || key === "j") return (event.preventDefault(), go(index + 1));
    if (key === "ArrowUp" || key === "k") return (event.preventDefault(), go(index - 1));
    if (key === "g") return (event.preventDefault(), go(0));
    if (key === "G") return (event.preventDefault(), go(rows.length - 1));
    if (key === "ArrowRight" || key === "l") {
      event.preventDefault();
      if (!row) return;
      if (row.kids && !row.opened) return toggle(row);
      return go(index + 1);
    }
    if (key === "ArrowLeft" || key === "h") {
      event.preventDefault();
      if (!row) return;
      if (row.kids && row.opened) return toggle(row);
      const to = rows.findIndex((held) => held.key === ancestry(row.key)[0]);
      if (to >= 0) go(to);
      return;
    }
    if (key === "Enter" || key === "o") return (event.preventDefault(), open(row));
    if (key === "u" || key === "Backspace") return (event.preventDefault(), up());
    if (key === " " || key === "x") {
      event.preventDefault();
      if (!row) return;
      return retain({ selected: local.selected.includes(row.slug) ? local.selected.filter((one) => one !== row.slug) : [...local.selected, row.slug] });
    }
    if (key === "f") return (event.preventDefault(), row && focusSlug(row.slug));
    if (key === "n") return (event.preventDefault(), create());
    if (key === "d") return (event.preventDefault(), duplicate());
    if (key === "r") return (event.preventDefault(), rename());
    if (key === "Delete") return (event.preventDefault(), target && ask(target.slug));
    if (key === "Escape") {
      event.preventDefault();
      if (dialog) return (dialog = null);
      if (notice) return (notice = null);
      if (local.renaming) return retain({ renaming: null });
      if (local.selected.length) return retain({ selected: [], focus: null });
      return up();
    }
    if (key === "/") {
      event.preventDefault();
      if (local.scope !== "daemon") retain({ scope: "daemon" });
      return queueMicrotask(() => root?.querySelector("input.search")?.focus());
    }
    if ("123".includes(key)) return (event.preventDefault(), retain({ filter: FILTERS[Number(key) - 1], scope: "daemon" }));
  }

  onMount(() => {
    mounted = true;
    refresh();
    call("schematics", {}).then((one) => (shapes = one)).catch((error) => say("/schematics refused", error.message));
    call("vocabulary", {}).then((one) => (vocabulary = one)).catch(() => (vocabulary = {}));
    root?.focus();
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500&display=swap" rel="stylesheet" />
</svelte:head>

<div class="editor" bind:this={root} tabindex="-1" role="application" aria-label="Assembly editor" onkeydown={keyed}>
  <header>
    <span class="who">@assembly/model/editor</span>
    <span class="rule"></span>
    <span class="key">subject</span>
    <span class="value">{local.subject ?? "— · nothing open"}</span>
    <span class="gap"></span>
    <div class="pips">
      {#each status as one (one.label)}
        <span class="pip-row"><span class="dot {one.tone}"></span><span class="said {one.tone}">{one.label}</span></span>
      {/each}
    </div>
    <span class="rule"></span>
    <div class="chips">
      <button class="chip" disabled={!local.undo.length} title={local.undo[0]?.words} onclick={() => undo()}>undo</button>
      <button class="chip" disabled={!local.redo.length} title={local.redo[0]?.words} onclick={redo}>redo</button>
    </div>
    <span class="rule"></span>
    <div class="chips">
      {#each PANES as one}
        <button class="chip" class:on={local.panes[one]} onclick={() => flip(one)}>{CHIPS[one]}</button>
      {/each}
    </div>
  </header>

  <div class="panes" style="grid-template-columns:{columns}">
    {#each order as one, index (one)}
      {#if index}
        {@const which = seamAfter(order[index - 1])}
        <div class="seam" role="separator" aria-orientation="vertical" {...seam(which)}></div>
      {/if}
      <section class="pane {one}">
        {#if one === "tree"}
          <Tree
            scroll={local.scrolls.tree ?? 0}
            onscroll={(at) => retain({ scrolls: { ...local.scrolls, tree: at } }, { soon: true })}
            scope={local.scope}
            rows={listed}
            {empty}
            filter={local.filter}
            query={local.query}
            caret={local.caret}
            selected={local.selected}
            subject={local.subject}
            focus={local.focus}
            {crumbs}
            root={top}
            {above}
            renaming={local.renaming}
            {crud}
            onscope={(which) => retain({ scope: which })}
            onfilter={(which) => retain({ filter: which })}
            onquery={(value) => retain({ query: value }, { soon: true })}
            onpick={pick}
            onopen={open}
            ontoggle={toggle}
            onsingle={single}
            ghosted={local.ghosted}
            hidden={local.hidden}
            locked={local.locked}
            onveil={veiled}
            oncrumb={(slug) => enter(slug)}
            onup={up}
            onrename={(value) => retain({ renaming: { ...local.renaming, value } }, { soon: true })}
            oncommit={committed}
            oncancel={() => retain({ renaming: null })} />
        {:else if one === "stage"}
          <Stage
            {entries}
            {hollows}
            selected={local.selected}
            joins={local.joins}
            cursors={local.cursors}
            mating={local.mating}
            {carry}
            {measured}
            oncursor={stageCursor}
            ondrop={dropCursor}
            onmating={(mating) => retain({ mating })}
            onmate={mated}
            subject={local.subject}
            focus={local.focus}
            gizmo={local.gizmo}
            {fastener}
            ghost={local.ghost}
            ghosted={local.ghosted}
            hidden={local.hidden}
            locked={local.locked}
            edges={local.edges}
            onedges={(on) => retain({ edges: on })}
            explode={local.explode}
            drawing={foldedOf}
            camera={local.camera}
            view={local.view}
            oncamera={(camera) => retain({ camera }, { soon: true })}
            onview={(view) => retain({ view }, { soon: true })}
            onghost={(on) => retain({ ghost: on })}
            onexplode={(amount) => retain({ explode: amount }, { soon: true })}
            onmode={(which) => retain({ gizmo: which, joins: [] })}
            onpick={stagePick}
            onbox={stageBox}
            ondive={(slug) => {
              const row = bySlug[slug];
              if (row?.ref) enter(row.ref);
            }}
            onmove={moved}
            onfault={(words) => say("stage", words)}
            onjoined={joined} />
        {:else if one === "inspector"}
          <Inspector
            scroll={local.scrolls.inspector ?? 0}
            onscroll={(at) => retain({ scrolls: { ...local.scrolls, inspector: at } }, { soon: true })}
            {card}
            count={local.selected.length}
            {shapes}
            {vocabulary}
            {siblings}
            draft={local.draft}
            draftOf={local.draftOf}
            move={local.move}
            onstate={(patch, soon) => retain(patch, { soon })}
            onsave={save}
            oncolour={coloured}
            onmove={relocate}
            onretract={ask} />
        {/if}
      </section>
    {/each}
  </div>

  {#if notice}
    <Notice nature={notice.nature} words={notice.words} onclear={() => (notice = null)} />
  {/if}
  {#if dialog}
    <Retract slug={dialog.slug} taking={dialog.taking} words={dialog.words} onkeep={() => (dialog = null)} onconfirm={confirm} />
  {/if}
</div>

<style>
  .editor {
    --void: #eff3f8;
    --panel: #fcfdfe;
    --recess: #f6f8fb;
    --field: #ffffff;
    --stage: #eff3f8;
    --line: #b6c3d3;
    --hair: #d4dde8;
    --edge: #8d9db1;
    --pick: #eef2fb;
    --pick-edge: #7e9ada;
    --pick-ink: #112253;
    --lift: #d4dde8;
    --ink: #171e29;
    --hot: #171e29;
    --ink-2: #334052;
    --dim: #4b5b70;
    --mute: #4b5b70;
    --faint: #677990;
    --part: #1e3c8c;
    --placement: #4e70c4;
    --step: #a8741a;
    --guide: #4e70c4;
    --joint: #334052;
    --stage-line: #b3b9c4;
    --stage-hair: #cfd3da;
    --stage-fresh: #f6c630;
    --stage-picked: #3b82f6;
    --stage-ghost: #9aa3b5;
    --stage-edge: #1a1d24;
    --stage-edge-light: #9aa1ad;
    --stage-edge-fresh: #6b4e00;
    --stage-edge-ghost: #5b6475;
    --stage-edge-picked: #1d4ed8;
    --tint-info: #3b6fd1;
    --tint-success: #4f9a47;
    --tint-warning: #d98a1c;
    --tint-danger: #c0392b;
    --tint-accent: #7c5cc4;
    --tint-contrast: #9aa3b5;
    --cursor: #ffb454;
    --fail: #b4532a;
    --good: #3f7a3a;
    --warn-bg: #fbede6;
    --warn-ink: #7a3218;
    --scrim: rgba(23, 30, 41, 0.28);
    --float: 0 4px 12px rgba(23, 30, 41, 0.1), 0 1px 3px rgba(23, 30, 41, 0.06);
    --lifted: 0 4px 12px rgba(23, 30, 41, 0.1);
    --raised: 0 20px 48px rgba(23, 30, 41, 0.18), 0 4px 12px rgba(23, 30, 41, 0.08);
    --nudge: 0 1px 3px rgba(23, 30, 41, 0.08);
    --radius: 4px;
    --sans: "Inter", system-ui, sans-serif;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 520px;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    background: var(--void);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 12px;
    letter-spacing: 0;
    scrollbar-color: var(--line) transparent;
    scrollbar-width: thin;
    overflow: hidden;
    outline: none;
  }
  .editor :global(::selection) {
    background: var(--part);
    color: var(--void);
  }
  .editor :global(::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }
  .editor :global(::-webkit-scrollbar-thumb) {
    background: var(--line);
  }
  .editor :global(::-webkit-scrollbar-track) {
    background: transparent;
  }
  header {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 34px;
    padding: 0 12px;
    background: var(--panel);
    border-bottom: 1px solid var(--line);
    overflow: hidden;
    white-space: nowrap;
  }
  .who {
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--part);
  }
  .rule {
    width: 1px;
    height: 14px;
    background: var(--line);
  }
  .key {
    font-size: 11px;
    color: var(--dim);
  }
  .value {
    font-size: 12px;
    line-height: 1.7;
    color: var(--ink);
  }
  .value.step {
    color: var(--step);
  }
  .gap {
    flex: 1;
    min-width: 12px;
  }
  .pips {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    overflow: hidden;
  }
  .pip-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 0 1 auto;
  }
  .dot {
    width: 6px;
    height: 6px;
    flex: 0 0 6px;
    border-radius: 50%;
    background: var(--mute);
  }
  .dot.step {
    background: var(--step);
  }
  .dot.part {
    background: var(--part);
  }
  .dot.fail {
    background: var(--fail);
  }
  .dot.good {
    background: var(--good);
  }
  .said {
    font-size: 11px;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .said.fail {
    color: var(--warn-ink);
  }
  .said.good {
    color: var(--ink-2);
  }
  .chips {
    display: flex;
    gap: 3px;
    flex: 0 0 auto;
  }
  .chip {
    padding: 2px 6px;
    background: transparent;
    border: 1px solid var(--hair);
    border-radius: var(--radius);
    color: var(--faint);
    font: inherit;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
    cursor: pointer;
  }
  .chip:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .chip.on {
    background: var(--pick);
    border-color: var(--pick-edge);
    color: var(--pick-ink);
  }
  .panes {
    display: grid;
    grid-template-rows: minmax(0, 100%);
    min-height: 0;
    min-width: 0;
  }
  .pane {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .pane.tree {
    background: var(--panel);
  }
  .pane.stage {
    position: relative;
    background: var(--stage);
  }
  .pane.inspector {
    background: var(--panel);
  }
  .seam {
    background: linear-gradient(90deg, transparent calc(50% - 0.5px), var(--line) calc(50% - 0.5px), var(--line) calc(50% + 0.5px), transparent calc(50% + 0.5px));
    cursor: ew-resize;
    touch-action: none;
  }
  .seam:hover {
    background: linear-gradient(90deg, transparent calc(50% - 1px), var(--part) calc(50% - 1px), var(--part) calc(50% + 1px), transparent calc(50% + 1px));
  }
  .editor :global(*) {
    box-sizing: border-box;
  }
  .editor :global(.head) {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 11px 7px;
    border-bottom: 1px solid var(--line);
  }
  .editor :global(.head b) {
    font-weight: 400;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--dim);
  }
  .editor :global(.head .sub) {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .editor :global(.head .gap) {
    flex: 1;
    min-width: 12px;
    height: 1px;
    background: var(--line);
  }
  .editor :global(.sub.part) {
    color: var(--part);
  }
  .editor :global(.sub.placement) {
    color: var(--placement);
  }
  .editor :global(.sub.step) {
    color: var(--step);
  }
  .editor :global(.sub.guide) {
    color: var(--guide);
  }
</style>
