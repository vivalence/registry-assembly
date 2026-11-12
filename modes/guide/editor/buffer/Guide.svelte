<script>
  import { onMount, untrack } from "svelte";
  import Stage from "./kit/Stage.svelte";
  import Steps from "./parts/Steps.svelte";
  import GuideTab from "./parts/GuideTab.svelte";
  import StepTab from "./parts/StepTab.svelte";
  import Rail from "./parts/Rail.svelte";
  import { entries as entriesOf } from "./kit/frames.js";
  import { free, installs, kit as kitOf, nextStep, pad, sections as sectionsOf, statuses, tints as tintsOf } from "./kit/guide.js";
  import { guideValues, noteSymbols, payload, stepValues } from "./form.js";

  const { terminal, buffer, surface } = $props();
  const data = buffer.$data ?? null;
  const files = terminal.client.runtime.entities.file.$entities;

  const SCREEN = { guide: null, step: 0, tab: "guide", insp: true, sel: [], scopeF: "step", scopeQ: "", open: {}, subjOpen: false, subjQ: "", picker: false, lb: null, ghost: true, explode: 0, view: null, draft: null, editing: null, slugDraft: null, tints: null, preQ: "" };
  const screened = (held = {}) => ({ ...SCREEN, ...held, open: { ...(held.open ?? {}) } });

  let local = $state(screened(buffer.data ?? {}));
  let guides = $state.raw([]);
  let subjects = $state.raw([]);
  let held = $state.raw(null);
  let geometry = $state.raw({});
  let notice = $state(null);
  let loaded = $state(false);
  let saving = $state(false);
  let running = $state(0);
  let stagePane = $state(null);
  let sending = null;
  let committing = null;
  let token = 0;
  let mounted = false;
  let width = $state(0);
  let height = $state(0);
  let flyout = $state(false);
  let folded = $state("parts");
  let paged = $state(null);
  let sheet = $state("shown");
  let dragging = $state(null);

  $effect(() => {
    const next = (data ? $data : buffer.data) ?? {};
    local = screened(next);
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
  const asset = (path) =>
    path
      ? ($files.find((file) => file.path === path && file.mode.daemon === buffer.mode.daemon)?.url ?? null)
      : null;

  async function refresh() {
    try {
      guides = await call("guides", {});
      subjects = await call("subjects", {});
      loaded = true;
    } catch (error) {
      say("/guides refused", error.message);
    }
  }
  async function reread() {
    const slug = local.guide;
    const mine = ++token;
    if (!slug) {
      held = null;
      return;
    }
    try {
      const next = await call("read", { guide: slug });
      const more = {};
      for (const [part, traits] of Object.entries(next.fold.parts)) {
        if (traits.PARAMETRIC && !traits.MODELED && !geometry[part]) more[part] = await call("geometry", traits.PARAMETRIC).catch(() => null);
      }
      if (mine !== token) return;
      if (Object.keys(more).length) geometry = { ...geometry, ...more };
      held = next;
    } catch (error) {
      if (mine === token) say("/read refused", error.message);
    }
  }
  $effect(() => {
    const slug = local.guide;
    void slug;
    if (mounted) reread();
  });

  async function act(verb, input) {
    running += 1;
    try {
      const row = await call(verb, input);
      notice = null;
      await reread();
      return row;
    } catch (error) {
      say(`/${verb} refused`, error.message);
      return null;
    } finally {
      running -= 1;
    }
  }

  // ── what is read ────────────────────────────────────────────────────────────────────────
  const guide = $derived(held?.guide ?? null);
  const steps = $derived(held?.steps ?? []);
  const n = $derived(steps.length);
  const step = $derived(Math.min(local.step ?? 0, n));
  const current = $derived(step > 0 ? (steps[step - 1] ?? null) : null);
  const fold = $derived(held?.fold ?? null);
  const parts = $derived(held?.parts ?? {});
  const names = $derived(held?.symbols ?? {});
  const groups = $derived.by(() => {
    let count = 0;
    return sectionsOf(guide, steps).map((section) => ({ ...section, next: (count += section.steps.length) + 1 }));
  });
  const guideTab = $derived(local.insp && local.tab === "guide");
  const placements = $derived(fold?.placements ?? []);
  const bySlug = $derived(Object.fromEntries(placements.map((one) => [one.slug, one])));
  const whereOf = (slug) => {
    const one = bySlug[slug];
    if (!one || one.at == null) return "kit";
    return one.at + 1 === step ? "here" : pad(one.at + 1);
  };

  // ── the draft — the unsaved edit, in the buffer, committed 700 ms after the last keystroke ──
  const ins = $derived(current ? (local.draft?.of === current.slug ? local.draft : { of: current.slug, ontology: "step", ...stepValues(current) }) : null);
  const meta = $derived(guide ? (local.draft?.of === guide.slug ? local.draft : { of: guide.slug, ontology: "guide", ...guideValues(guide) }) : null);

  async function commit() {
    clearTimeout(committing);
    committing = null;
    const draft = local.draft;
    if (!draft) return;
    saving = true;
    const row = await act(draft.ontology, payload(draft));
    saving = false;
    if (row && local.draft === draft) retain({ draft: null });
  }
  const edit = (base, fn) => {
    if (!base) return;
    const next = JSON.parse(JSON.stringify(base));
    fn(next);
    retain({ draft: next }, { soon: true });
    saving = true;
    clearTimeout(committing);
    committing = setTimeout(commit, 700);
  };
  const editStep = (fn) => edit(ins, fn);
  const editGuide = (fn) => edit(meta, fn);

  // ── the stage ───────────────────────────────────────────────────────────────────────────
  const stagedOf = $derived(guideTab ? (meta?.staged ?? {}) : (ins?.staged ?? {}));
  const stageStep = $derived(guideTab ? 0 : step);
  const ghost = $derived(local.ghost);
  const explode = $derived(local.explode);
  const view = $derived(local.view ?? stagedOf?.camera ?? "iso");
  const fresh = $derived(current ? installs(current) : []);
  const stepsWithDraft = $derived(steps.map((one) => (local.draft?.of === one.slug && local.draft.ontology === "step" ? { ...one, trait: { ...one.trait, STAGED: local.draft.staged ?? undefined } } : one)));
  const status = $derived(statuses(fold, stepsWithDraft, stageStep, { ghost, overview: guideTab }));
  const tints = $derived(tintsOf(stepsWithDraft, stageStep, fold));
  const labels = $derived.by(() => {
    const out = {};
    for (const one of placements) out[one.slug] = `${parts[one.ref]?.name ?? one.ref}${one.at != null ? ` · step ${pad(one.at + 1)}` : " · kit"}`;
    return out;
  });
  const stageEntries = $derived(entriesOf(fold, { asset, geometry }));

  const pickStage = (slug, path, event) => {
    if (!slug) return event?.shiftKey || event?.metaKey ? null : retain({ sel: [] });
    const many = event?.shiftKey || event?.metaKey || event?.ctrlKey;
    retain({ sel: many ? (local.sel.includes(slug) ? local.sel.filter((one) => one !== slug) : [...local.sel, slug]) : [slug] });
  };
  const marquee = (slugs, add) => retain({ sel: add ? [...new Set([...local.sel, ...slugs])] : slugs });

  // ── steps and sections — every gesture is one /sequence, /step or /retract ─────────────
  const sectionsNow = () => JSON.parse(JSON.stringify(guide?.trait?.SEQUENCED?.sections ?? []));
  const sequence = (sections) => act("sequence", { guide: guide.slug, sections });
  async function pickStep(index) {
    if (local.draft) await commit();
    const at = index > 0 ? steps[index - 1]?.trait?.STAGED : null;
    retain({ step: index, tab: "step", insp: true, picker: false, view: null, slugDraft: null, tints: null, ...(at && "ghost" in at ? { ghost: at.ghost } : {}), explode: at && "explode" in at ? at.explode : 0 });
  }
  const indexOf = (slug) => steps.findIndex((one) => one.slug === slug) + 1;
  const ctlSteps = {
    pick: (index) => pickStep(index),
    renameStep: (slug, name) => {
      const row = steps.find((one) => one.slug === slug);
      if (!row) return;
      if (current?.slug === slug) return editStep((held) => (held.name = name));
      act("step", { slug, name });
    },
    renameSection: (k, name) => {
      const sections = sectionsNow();
      sections[k] = { ...sections[k], name };
      sequence(sections);
    },
    removeSection: (k) => {
      const sections = sectionsNow();
      if (sections[k]?.steps?.length) return;
      sections.splice(k, 1);
      sequence(sections);
    },
    addSection: () => sequence([...sectionsNow(), { name: "New section", steps: [] }]),
    addStep: async (k) => {
      if (local.draft) await commit();
      const slug = nextStep(guide.slug, steps);
      const made = await act("step", { slug, name: "" });
      if (!made) return;
      const sections = sectionsNow();
      if (!sections[k]) sections.push({ name: "Steps", steps: [] });
      sections[k].steps = [...(sections[k].steps ?? []), slug];
      const row = await sequence(sections);
      if (!row) return;
      const order = sections.flatMap((section) => section.steps);
      retain({ step: order.indexOf(slug) + 1, tab: "step", insp: true, editing: slug, sel: [] });
    },
    deleteStep: async (slug) => {
      if (local.draft?.of === slug) retain({ draft: null });
      const sections = sectionsNow().map((section) => ({ ...section, steps: (section.steps ?? []).filter((one) => one !== slug) }));
      if (!(await sequence(sections))) return;
      const gone = await act("retract", { slugs: [slug] });
      if (!gone) return;
      retain({ step: Math.min(indexOf(slug) || step, sections.flatMap((section) => section.steps).length), sel: [] });
    },
    moveStep: (slug, k, before) => {
      const sections = sectionsNow().map((section) => ({ ...section, steps: (section.steps ?? []).filter((one) => one !== slug) }));
      if (!sections[k]) return;
      const at = before ? sections[k].steps.indexOf(before) : -1;
      if (at < 0) sections[k].steps.push(slug);
      else sections[k].steps.splice(at, 0, slug);
      sequence(sections).then((row) => row && retain({ step: sections.flatMap((section) => section.steps).indexOf(slug) + 1 }));
    },
    moveSection: (k, beforeK) => {
      if (k === beforeK) return;
      const sections = sectionsNow();
      const [moved] = sections.splice(k, 1);
      const at = beforeK > k ? beforeK - 1 : beforeK;
      sections.splice(at, 0, moved);
      sequence(sections);
    },
  };

  // ── what a step installs — pull in, remove ──────────────────────────────────────────────
  const opinions = (row) => JSON.parse(JSON.stringify(row?.trait?.ASSEMBLED?.placements ?? []));
  async function pull(slugs) {
    if (!current || !slugs.length) return;
    const byStep = new Map();
    for (const slug of slugs) {
      const one = bySlug[slug];
      if (one?.at != null && one.at + 1 !== step) {
        const other = steps[one.at];
        if (!byStep.has(other.slug)) byStep.set(other.slug, opinions(other));
        byStep.set(other.slug, byStep.get(other.slug).filter((held) => held.literal !== slug));
      }
    }
    for (const [slug, held] of byStep) if (!(await act("step", { slug, placements: held }))) return;
    const mine = opinions(current).filter((held) => !slugs.includes(held.literal));
    await act("step", { slug: current.slug, placements: [...mine, ...slugs.map((literal) => ({ literal, active: true }))] });
  }
  async function remove(slugs) {
    if (!current || !slugs.length) return;
    await act("step", { slug: current.slug, placements: opinions(current).filter((held) => !slugs.includes(held.literal)) });
  }

  // ── the selection card over the stage ───────────────────────────────────────────────────
  const selP = $derived(local.sel.map((slug) => bySlug[slug]).filter(Boolean));
  const selected = $derived.by(() => {
    if (!selP.length) return null;
    const grouped = {};
    for (const one of selP) {
      const where = whereOf(one.slug);
      const key = `${one.ref}|${where}`;
      grouped[key] ??= { ref: one.ref, where, n: 0 };
      grouped[key].n += 1;
    }
    const one = selP.length === 1 ? selP[0] : null;
    return {
      title: one ? `${parts[one.ref]?.name ?? one.ref} · ${one.path}` : `${selP.length} parts selected`,
      rows: Object.values(grouped).map((row) => ({ ...row, name: parts[row.ref]?.name ?? row.ref, material: parts[row.ref]?.material ?? null, label: row.where === "here" ? "this step" : row.where === "kit" ? "kit" : `step ${row.where}` })),
      jump: one && one.at != null && one.at + 1 !== step ? one.at + 1 : null,
    };
  });
  const toPull = $derived(current ? selP.filter((one) => whereOf(one.slug) !== "here") : []);
  const hereSel = $derived(current ? selP.filter((one) => whereOf(one.slug) === "here") : []);
  const pullLabel = $derived(!current ? "Pick a step" : !selP.length ? "Select parts to pull in" : !toPull.length ? "All in this step" : `Pull ${toPull.length} into step ${pad(step)}${toPull.filter((one) => one.at != null).length ? ` (${toPull.filter((one) => one.at != null).length} from other steps)` : ""}`);

  // ── the parts list ──────────────────────────────────────────────────────────────────────
  const scope = $derived.by(() => {
    const f = local.scopeF;
    const q = local.scopeQ.trim().toLowerCase();
    const pass = (one) => (f === "all" || (f === "kit" ? one.at == null : whereOf(one.slug) === "here")) && (!q || (parts[one.ref]?.name ?? one.ref).toLowerCase().includes(q));
    const refs = [...new Set(placements.map((one) => one.ref))];
    const types = refs
      .map((ref) => {
        const all = placements.filter((one) => one.ref === ref);
        const items = all.filter(pass);
        if (!items.length) return null;
        const count = (where) => all.filter((one) => whereOf(one.slug) === where).length;
        const bits = [];
        if (count("here")) bits.push(`${count("here")} here`);
        if (count("kit")) bits.push(`${count("kit")} kit`);
        const other = all.length - count("here") - count("kit");
        if (other) bits.push(`${other} placed`);
        return {
          slug: ref,
          name: parts[ref]?.name ?? ref,
          material: parts[ref]?.material ?? null,
          summary: bits.join(" · "),
          open: !!local.open[ref] || !!q,
          selected: items.filter((one) => local.sel.includes(one.slug)).length,
          items: items.map((one) => ({ slug: one.slug, label: one.path, where: whereOf(one.slug), selected: local.sel.includes(one.slug) })),
        };
      })
      .filter(Boolean);
    return {
      filter: f,
      q: local.scopeQ,
      filters: [["step", "This step"], ["kit", "Kit"], ["all", "All"]],
      types,
      here: current ? fresh.length : 0,
      emptyText: q ? "No parts match" : f === "step" ? "Nothing in this step yet. Switch to Kit or All, select parts, then pull them in." : f === "kit" ? "Kit is empty. Every part is in a step." : "No parts — the guide has no subject",
      selected: selP.length,
      pullable: toPull.length > 0,
      pullLabel,
      removable: hereSel.length > 0,
    };
  });

  // ── prerequisites ───────────────────────────────────────────────────────────────────────
  const pre = $derived.by(() => {
    if (!ins) return { custom: false, items: [], q: "", steps: [], types: [], summary: "" };
    const custom = !!ins.staged?.built;
    const builtNow = ins.staged?.built ?? { steps: [], placements: [] };
    const tintOf = (id) => ins.staged?.tints?.[id] ?? null;
    const has = new Set([...(builtNow.steps ?? []), ...(builtNow.parts ?? []), ...(builtNow.placements ?? [])]);
    const items = [
      ...(builtNow.steps ?? []).map((slug) => {
        const k = indexOf(slug);
        return { id: slug, badge: k ? pad(k) : "?", name: k ? steps[k - 1].name || "Untitled step" : slug, meta: `${installs(steps[k - 1]).length} parts`, tint: tintOf(slug) };
      }),
      ...(builtNow.parts ?? []).map((ref) => ({ id: ref, badge: "", name: parts[ref]?.name ?? ref, meta: `part · ${placements.filter((one) => one.ref === ref).length} placed`, tint: tintOf(ref) })),
      ...(builtNow.placements ?? []).map((slug) => ({ id: slug, badge: "", name: `${parts[bySlug[slug]?.ref]?.name ?? slug} · ${bySlug[slug]?.path ?? ""}`, meta: whereOf(slug) === "kit" ? "kit" : `step ${whereOf(slug)}`, tint: tintOf(slug) })),
    ];
    const solid = Object.values(status).filter((one) => one === "solid").length;
    const q = (local.preQ ?? "").trim().toLowerCase();
    const hit = (...words) => !q || words.some((word) => (word ?? "").toLowerCase().includes(q));
    const refs = [...new Set(placements.map((one) => one.ref))];
    return {
      custom,
      items,
      q: local.preQ ?? "",
      summary: `${solid} shown solid`,
      steps: steps.filter((one) => one.slug !== current.slug && !has.has(one.slug) && hit(one.name, one.slug, pad(indexOf(one.slug)))).map((one) => ({ id: one.slug, label: `${pad(indexOf(one.slug))} ${one.name || "Untitled step"}` })),
      types: refs
        .map((ref) => {
          const name = parts[ref]?.name ?? ref;
          const all = placements.filter((one) => one.ref === ref);
          const items = all.filter((one) => !has.has(one.slug) && hit(name, one.path, one.slug)).sort((a, b) => a.path.localeCompare(b.path));
          if (!items.length && !(hit(name) && !has.has(ref))) return null;
          return { id: ref, name, count: all.length, added: has.has(ref), open: !!q || !!local.open[`pre:${ref}`], items: items.map((one) => ({ id: one.slug, label: one.path, depth: (one.path.match(/[./]/g) ?? []).length, where: whereOf(one.slug) })) };
        })
        .filter(Boolean),
    };
  });


  // ── the inspector's hands ────────────────────────────────────────────────────────────────
  const snapshot = (kind) => {
    const shot = stagePane?.snapshot?.();
    if (!shot) return say("stage", "the stage is not ready");
    const fn = (held) => (held.staged = { ...(held.staged ?? {}), camera: shot, explode: local.explode, ghost: local.ghost });
    kind === "guide" ? editGuide(fn) : editStep(fn);
    retain({ view: null });
  };
  const goCamera = (kind) => {
    const staged = kind === "guide" ? meta?.staged : ins?.staged;
    if (!staged?.camera) return;
    retain({ view: null, ...("explode" in staged ? { explode: staged.explode } : {}), ...("ghost" in staged ? { ghost: staged.ghost } : {}) });
    stagePane?.home?.();
  };
  const clearCamera = (kind) => {
    const fn = (held) => {
      const { camera: _camera, ...rest } = held.staged ?? {};
      held.staged = Object.keys(rest).length ? rest : null;
    };
    kind === "guide" ? editGuide(fn) : editStep(fn);
    retain({ view: null });
  };
  const ctl = {
    fold: (key) => (layout === "phone" ? (paged = key) : (folded = key)),
    editStep,
    editGuide,
    noteSymbols,
    snapshot,
    goCamera,
    clearCamera,
    toggleSubjects: () => retain({ subjOpen: !local.subjOpen }),
    subjectQuery: (value) => retain({ subjQ: value }, { soon: true }),
    setSubject: async (slug) => {
      if (local.draft) await commit();
      if (await act("guide", { slug: guide.slug, subject: slug })) retain({ subjOpen: false, sel: [] });
    },
    autoBuilt: () =>
      editStep((held) => {
        const { built: _built, ...rest } = held.staged ?? {};
        held.staged = Object.keys(rest).length ? rest : null;
      }),
    customBuilt: () => editStep((held) => (held.staged = { ...(held.staged ?? {}), built: { steps: steps.slice(0, step - 1).map((one) => one.slug), placements: [] } })),
    removeBuilt: (id) =>
      editStep((held) => {
        const was = held.staged.built;
        const parts = (was.parts ?? []).filter((one) => one !== id);
        held.staged.built = { steps: was.steps.filter((one) => one !== id), placements: was.placements.filter((one) => one !== id), ...(parts.length ? { parts } : {}) };
      }),
    addBuilt: (kind, id) =>
      editStep((held) => {
        const was = held.staged.built;
        if (kind === "step") was.steps = [...was.steps, id].sort((a, b) => indexOf(a) - indexOf(b));
        else if (kind === "part") was.parts = [...(was.parts ?? []), id];
        else was.placements = [...was.placements, id];
      }),
    preQuery: (value) => retain({ preQ: value }, { soon: true }),
    preOpen: (ref) => retain({ open: { ...local.open, [`pre:${ref}`]: !local.open[`pre:${ref}`] } }),
    openTints: (id) => retain({ tints: local.tints === id ? null : id }),
    setTint: (id, role) => {
      editStep((held) => {
        const tints = { ...(held.staged?.tints ?? {}) };
        if (role) tints[id] = role;
        else delete tints[id];
        held.staged = { ...(held.staged ?? {}), tints };
      });
      retain({ tints: null });
    },
    scopeFilter: (key) => retain({ scopeF: key }),
    scopeQuery: (value) => retain({ scopeQ: value }, { soon: true }),
    toggleOpen: (ref) => retain({ open: { ...local.open, [ref]: !local.open[ref] } }),
    selectType: (type) => {
      const slugs = type.items.map((one) => one.slug);
      retain({ sel: type.selected === type.items.length ? local.sel.filter((one) => !slugs.includes(one)) : [...new Set([...local.sel, ...slugs])] });
    },
    selectOne: (slug) => retain({ sel: local.sel.includes(slug) ? local.sel.filter((one) => one !== slug) : [...local.sel, slug] }),
    pullSelected: () => pull(toPull.map((one) => one.slug)),
    removeSelected: () => remove(hereSel.map((one) => one.slug)),
    showPicture: (path) => retain({ lb: path }),
    openPicker: () => retain({ picker: true }),
    toggleTool: (slug) => editStep((held) => (held.symbols = held.symbols.includes(slug) ? held.symbols.filter((one) => one !== slug) : [...held.symbols, slug])),
  };

  const images = $derived((ins?.images ?? []).map((path) => ({ path, url: asset(path) })));
  const toolChips = $derived(
    Object.keys(names)
      .filter((slug) => slug.startsWith("tool."))
      .sort()
      .map((slug) => ({ slug, name: names[slug], on: (ins?.symbols ?? []).includes(slug) })),
  );
  const pages = $derived(
    $files
      .filter((file) => file.mode.daemon === buffer.mode.daemon)
      .map((file) => file.path)
      .filter((path) => path.startsWith("manual/"))
      .sort(),
  );
  const inventory = $derived.by(() => {
    const counts = kitOf(fold);
    const line = ([slug, count]) => ({ slug, n: count, name: parts[slug]?.name ?? slug, material: parts[slug]?.material ?? null });
    const used = {};
    for (const one of steps) for (const tool of one.prepared?.tools ?? []) (used[tool] ??= []).push(pad(one.index + 1));
    return {
      placements: placements.length,
      parts: Object.entries(counts).filter(([slug]) => !parts[slug]?.fastener).map(line),
      fasteners: Object.entries(counts).filter(([slug]) => parts[slug]?.fastener).map(line),
      tools: Object.entries(used).map(([slug, at]) => ({ slug, name: names[slug] ?? slug, steps: at.join(", ") })),
    };
  });
  const subjectName = $derived(subjects.flatMap((root) => [root, ...root.inside]).find((one) => one.slug === meta?.subject)?.name ?? "");
  const taken = $derived(new Set(guides.map((one) => one.slug)));

  async function newGuide() {
    const slug = free(taken, "guide");
    const made = await act("guide", { slug, name: "New guide" });
    if (!made) return;
    await refresh();
    retain({ guide: slug, step: 0, tab: "guide", insp: true, sel: [], draft: null });
  }
  const openGuide = (slug) => retain({ guide: slug, step: 0, tab: "guide", insp: true, sel: [], draft: null, picker: false, lb: null });

  const BAR = 52;
  const PEEK = 120;
  const layout = $derived(width >= 1200 ? "wide" : width < 768 ? "phone" : "tablet");
  const inspOpen = $derived(local.insp || layout === "phone");
  const columns = $derived(layout === "wide" ? `248px minmax(0,1fr) ${local.insp ? "340px" : "64px"}` : layout === "tablet" ? `56px minmax(0,1fr) ${local.insp ? "320px" : "64px"}` : null);
  const folding = $derived(layout === "tablet" ? { mode: "accordion", open: folded } : layout === "phone" ? { mode: "pages", open: paged } : null);
  const flying = $derived(layout !== "wide" && (flyout || !local.guide));
  const room = $derived(Math.max(0, height - BAR));
  const stops = $derived({ peek: PEEK, shown: Math.round(room * 0.62), full: room });
  const sheetHeight = $derived(dragging ? dragging.height : stops[sheet]);
  const sectionAt = $derived(Math.max(0, groups.findIndex((group) => group.steps.some((row) => row.n === step))));
  const sectionName = $derived(step ? (groups[sectionAt]?.name ?? "") : "");
  const flyoutSteps = {
    ...ctlSteps,
    pick: (index) => {
      flyout = false;
      paged = null;
      return ctlSteps.pick(index);
    },
  };
  const grabbed = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragging = { y: event.clientY, from: stops[sheet], height: stops[sheet], moved: false };
  };
  const dragged = (event) => {
    if (!dragging) return;
    const dy = event.clientY - dragging.y;
    dragging = { ...dragging, height: Math.max(PEEK, Math.min(room, dragging.from - dy)), moved: dragging.moved || Math.abs(dy) > 4 };
  };
  const dropped = () => {
    if (!dragging) return;
    const { height: at, moved } = dragging;
    dragging = null;
    if (!moved) return (sheet = sheet === "shown" ? "full" : "shown");
    sheet = Object.entries(stops).reduce((best, [name, h]) => (Math.abs(h - at) < Math.abs(stops[best] - at) ? name : best), "shown");
  };
  const typing = (event) => {
    if (layout === "phone" && /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName ?? "")) sheet = "full";
  };
  const stageTitle = $derived(guideTab ? (guide?.name ?? "") : current ? `${pad(step)} ${ins?.name || "Untitled step"}` : "No step on screen");

  function keyed(event) {
    if (event.key !== "Escape") return;
    if (local.lb || local.picker || local.sel.length || local.subjOpen) retain({ lb: null, picker: false, sel: [], subjOpen: false, tints: null });
  }

  onMount(() => {
    mounted = true;
    refresh();
    reread();
  });
</script>

<svelte:window onkeydown={keyed} />
<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
</svelte:head>

{#snippet stepsPane()}
  {#if !local.guide}
    <div class="column">
      <div class="head"><div class="title">Guides</div></div>
      <div class="scroll">
        {#each guides as one (one.slug)}
          <button class="guide-row" onclick={() => openGuide(one.slug)}>
            <div class="badge">{one.steps}</div>
            <div class="grow"><div class="name">{one.name}</div><div class="sub">{one.subject ? `builds ${one.subject}` : "no subject yet"}</div></div>
          </button>
        {/each}
        {#if loaded && !guides.length}
          <div class="empty">the daemon holds no guide yet</div>
        {/if}
        <button class="add-guide" onclick={newGuide}>+ new guide</button>
      </div>
    </div>
  {:else}
    <Steps title={guide?.name ?? local.guide} {groups} {step} editing={local.editing} ctl={flyoutSteps} />
  {/if}
{/snippet}

<div class="editor {layout}" role="application" aria-label="Guide editor" bind:clientWidth={width} bind:clientHeight={height} style={columns ? `grid-template-columns:${columns}` : null}>
  {#if layout === "phone"}
    <div class="topbar">
      {#if local.guide}
        <button class="crumb" onclick={() => (flyout = !flyout)}><span class="crumb-badge">{step ? pad(step) : "—"}</span><span class="crumb-name">{step ? ins?.name || "Untitled step" : (guide?.name ?? local.guide)}</span><span class="dim">⌄</span></button>
      {:else}
        <div class="crumb"><span class="crumb-name">Guides</span></div>
      {/if}
      <span class="topdot" class:busy={saving || running} title={saving || running ? "Saving" : "Saved"}></span>
      <button class="menu" title="All steps" disabled={!local.guide} onclick={() => (flyout = !flyout)}>☰</button>
    </div>
  {:else}
    <section class="pane steps">
      {#if layout === "tablet"}
        <Rail {groups} {step} ctl={ctlSteps} onmenu={() => (flyout = !flyout)} />
      {:else}
        {@render stepsPane()}
      {/if}
    </section>
  {/if}

  <section class="pane stage" class:dragging style={layout === "phone" ? `bottom:${Math.min(sheetHeight, stops.shown)}px` : null}>
    <div class="stage-head">{#if layout === "tablet" && sectionName && !guideTab}<span class="crumb-section">{sectionName} ›</span>{/if}<div class="stage-title">{stageTitle}</div></div>
    <div class="field">
      <Stage
        bind:this={stagePane}
        entries={stageEntries}
        {status}
        {tints}
        {labels}
        {explode}
        overview={guideTab && !stagedOf?.camera}
        step={stageStep}
        {view}
        selected={local.sel}
        {ghost}
        focus={null}
        select
        empty={local.guide ? (guide?.trait?.SEQUENCED?.subject ? "loading the stage…" : "no subject — pick one in the Guide tab") : "no guide open"}
        onpick={pickStage}
        onmarquee={marquee}
        onghost={() => retain({ ghost: !local.ghost })}
        onexplode={(value) => retain({ explode: value }, { soon: true })}
        onfault={(words) => say("stage", words)} />
      {#if selected}
        <div class="card">
          <div class="card-head"><span class="grow strong">{selected.title}</span><button class="x" title="Clear selection" onclick={() => retain({ sel: [] })}>×</button></div>
          <div class="card-rows">
            {#each selected.rows as row (row.ref + row.where)}
              <div class="card-row"><span class="swatch" style="background:{row.material ? `var(--material-${row.material.slice(row.material.indexOf('.') + 1)}, var(--iron))` : 'var(--iron)'}"></span><span class="grow">{row.name}{row.n > 1 ? ` ×${row.n}` : ""}</span><span class="dim">{row.label}</span></div>
            {/each}
          </div>
          <button class="pull" disabled={!toPull.length} onclick={() => pull(toPull.map((one) => one.slug))}>{pullLabel}</button>
          {#if hereSel.length}
            <button class="secondary danger" onclick={() => remove(hereSel.map((one) => one.slug))}>Remove from this step</button>
          {/if}
          {#if selected.jump}
            <button class="secondary" onclick={() => pickStep(selected.jump)}>Go to step {pad(selected.jump)}</button>
          {/if}
        </div>
      {/if}
      {#if local.picker}
        <div class="picker">
          <div class="picker-head">
            <div><div class="strong">Manual pages</div><div class="mono">manual/*.webp on the freight · {pages.length} pictures</div></div>
            <button class="outline" onclick={() => retain({ picker: false })}>Done</button>
          </div>
          <div class="picker-grid">
            {#each pages as path (path)}
              {@const k = (ins?.images ?? []).indexOf(path)}
              <button class="thumb" class:on={k >= 0} title={path} onclick={() => editStep((held) => (held.images = k >= 0 ? held.images.filter((one) => one !== path) : [...held.images, path]))}>
                <img src={asset(path)} alt="" />
                {#if k >= 0}<span class="tag">{k + 1}</span>{/if}
              </button>
            {/each}
            {#if !pages.length}
              <div class="empty">the freight holds no manual/*.webp</div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </section>

  <section class="pane insp" class:dragging style={layout === "phone" ? `height:${sheetHeight}px` : null} onfocusin={typing}>
    {#if layout === "phone"}
      <div class="grip" role="slider" aria-label="Sheet" aria-valuenow={sheetHeight} tabindex="0" onpointerdown={grabbed} onpointermove={dragged} onpointerup={dropped} onpointercancel={dropped} onkeydown={(event) => event.key === "Enter" && (sheet = sheet === "shown" ? "full" : "shown")}><span></span></div>
    {/if}
    <div class="tabs" class:collapsed={!inspOpen}>
      {#if inspOpen}
        <div class="save" title={saving ? "Saving" : "Changes save automatically"}><span class="dot" class:busy={saving || running}></span>{saving || running ? "Saving" : "Saved"}</div>
      {/if}
      <button class="toggle" title={inspOpen ? "Collapse inspector" : "Expand inspector"} onclick={() => retain({ insp: !local.insp })}><span class="caret" class:flip={!inspOpen}>›</span></button>
      <button class="tab" class:on={inspOpen && local.tab === "guide"} onclick={() => retain({ tab: "guide", insp: true, view: null })}>Guide</button>
      <button class="tab" class:on={inspOpen && local.tab === "step"} onclick={() => retain({ tab: "step", insp: true, view: null })}>Step<span class="n">{step ? pad(step) : ""}</span></button>
    </div>
    {#if inspOpen && local.guide && meta && local.tab === "guide"}
      <GuideTab {meta} {subjects} subject={meta.subject} subjOpen={local.subjOpen} subjQ={local.subjQ} {subjectName} {inventory} {names} {ctl} />
    {:else if inspOpen && !local.guide && local.tab === "guide"}
      <div class="nostep">No guide open.<br />Pick one on the left, or make a new one.</div>
    {:else if inspOpen && local.tab === "step"}
      {#if ins}
        <StepTab {ins} n={step} {steps} {pre} {scope} {images} tools={toolChips} {names} tintsOpen={local.tints} {folding} {ctl} />
      {:else}
        <div class="nostep">{local.guide ? "No step on screen." : "No guide open."}<br />{local.guide ? "Pick one on the left, or add a step." : "Pick one on the left, or make a new one."}</div>
      {/if}
    {/if}
    {#if layout === "phone" && local.guide}
      <div class="sheet-foot">
        <button class="outline" disabled={step <= 1} onclick={() => pickStep(step - 1)}>‹ {step > 1 ? pad(step - 1) : "—"}</button>
        <button class="add-step" onclick={() => ctlSteps.addStep(sectionAt)}>+ step</button>
        <button class="outline" disabled={step >= n} onclick={() => pickStep(step + 1)}>{step < n ? pad(step + 1) : "—"} ›</button>
      </div>
    {/if}
  </section>

  {#if flying}
    <section class="pane flyout">
      {#if local.guide}<button class="close" title="Close steps" onclick={() => (flyout = false)}>×</button>{/if}
      {@render stepsPane()}
    </section>
  {/if}
  {#if local.lb}
    <div class="scrim" role="presentation" onclick={() => retain({ lb: null })}>
      <div class="box" role="presentation" onclick={(event) => event.stopPropagation()}>
        <img src={asset(local.lb)} alt="" />
        <div class="box-foot"><span>{local.lb}</span><button class="solid" onclick={() => retain({ lb: null })}>Close</button></div>
      </div>
    </div>
  {/if}
  {#if notice}
    <div class="notice" role="status"><b>{notice.nature}</b> {notice.words}<button onclick={() => (notice = null)}>×</button></div>
  {/if}
</div>

<style>
  .editor {
    --paper: #fff;
    --paper-2: #eef0f4;
    --paper-3: #f3f4f7;
    --cube-face: #f7f8fa;
    --cube-on: #fdf1c4;
    --control-edge: #c9ced6;
    --menu-on: #eef0f5;
    --ground: #e7e9ed;
    --hair: #d5d9e0;
    --line: #e5e7eb;
    --ink: #17214d;
    --ink-2: #1f2433;
    --dim: #6b7280;
    --iron: #9aa0ab;
    --danger: #b3261e;
    --step: #f6c630;
    --step-surface: #fdf8e7;
    --step-deep: #f6e3a1;
    --good: #3f8a3a;
    --good-surface: #e7f3e4;
    --tip: #3b6fd1;
    --tip-surface: #eef3fb;
    --warn-bg: #fdf0df;
    --warn-ink: #a85500;
    --warn-edge: #c46a0a;
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
    --material-carbon: #2b2f3a;
    --material-printed: #4a4f5c;
    --material-fastener: #9aa0ab;
    --material-electronics: #3f6b3a;
    --material-motor: #6b6a2a;
    --material-soft_goods: #8cc63f;
    --text-light: #6b7280;
    --font-family-body: Inter, system-ui, sans-serif;
    --font-family-code: "IBM Plex Mono", monospace;
    -webkit-font-smoothing: antialiased;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 680px;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    gap: 10px;
    padding: 10px;
    box-sizing: border-box;
    background: var(--ground);
    color: var(--ink-2);
    font-family: var(--font-family-body);
    font-size: 13px;
  }
  .editor :global(*) {
    box-sizing: border-box;
  }
  .pane {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 8px;
  }
  .pane.steps,
  .pane.insp {
    background: var(--paper);
    box-shadow: 0 2px 12px color-mix(in srgb, var(--ink) 8%, transparent);
  }
  .pane.insp {
    position: relative;
  }
  .pane.stage {
    background: var(--ground);
    border: 1px solid var(--hair);
  }
  .column {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .head {
    padding: 14px 16px 12px;
    border-bottom: 1px solid var(--line);
  }
  .title {
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0 8px;
  }
  .guide-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    border: 0;
    background: transparent;
    text-align: left;
    padding: 8px 12px;
    cursor: pointer;
    font-family: inherit;
  }
  .guide-row:hover {
    background: var(--paper-2);
  }
  .badge {
    min-width: 26px;
    height: 20px;
    border-radius: 3px;
    background: var(--paper-2);
    color: var(--ink);
    font-size: 11.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .strong {
    font-weight: 700;
    color: var(--ink);
  }
  .dim {
    color: var(--dim);
    font-size: 11px;
  }
  .name {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
  }
  .sub {
    font-size: 11px;
    color: var(--dim);
  }
  .empty {
    padding: 14px 12px;
    font-size: 12px;
    color: var(--dim);
    text-align: center;
  }
  .add-guide {
    margin: 12px 12px 0;
    border: 1.5px dashed var(--hair);
    background: transparent;
    border-radius: 5px;
    width: calc(100% - 24px);
    height: 32px;
    font: 600 12.5px var(--font-family-body);
    color: var(--ink-2);
    cursor: pointer;
  }
  .add-guide:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .stage-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--paper) 60%, transparent);
    border-bottom: 1px solid var(--hair);
  }
  .stage-title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--ink);
  }
  .field {
    flex: 1;
    min-height: 0;
    position: relative;
  }
  .card {
    position: absolute;
    right: 12px;
    top: 12px;
    width: 240px;
    max-width: calc(100% - 24px);
    background: var(--paper);
    border-radius: 6px;
    box-shadow: 0 6px 24px color-mix(in srgb, var(--ink) 18%, transparent);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 3;
  }
  .card-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .x {
    border: 0;
    background: transparent;
    cursor: pointer;
    color: var(--dim);
    font-size: 15px;
    padding: 0 2px;
  }
  .card-rows {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .card-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--ink);
  }
  .swatch {
    width: 9px;
    height: 9px;
    border-radius: 2px;
    flex: none;
  }
  .pull {
    border: 0;
    background: var(--ink);
    color: var(--paper);
    border-radius: 4px;
    padding: 7px 8px;
    font: 600 12px var(--font-family-body);
    cursor: pointer;
  }
  .pull:disabled {
    background: var(--hair);
    cursor: default;
  }
  .secondary {
    border: 1px solid var(--hair);
    background: var(--paper);
    color: var(--ink-2);
    border-radius: 4px;
    padding: 5px 8px;
    font: 600 12px var(--font-family-body);
    cursor: pointer;
  }
  .secondary.danger {
    color: var(--danger);
  }
  .picker {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--ground) 97%, transparent);
    display: flex;
    flex-direction: column;
    z-index: 4;
  }
  .picker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--hair);
  }
  .mono {
    font-family: var(--font-family-code);
    font-size: 10.5px;
    color: var(--dim);
  }
  .outline,
  .solid {
    border-radius: 5px;
    padding: 5px 12px;
    font: 600 12px var(--font-family-body);
    cursor: pointer;
  }
  .outline {
    border: 1.5px solid var(--ink);
    background: var(--paper);
    color: var(--ink);
  }
  .solid {
    border: 0;
    background: var(--ink);
    color: var(--paper);
  }
  .picker-grid {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
    align-content: start;
  }
  .thumb {
    position: relative;
    border: 2px solid transparent;
    padding: 0;
    border-radius: 3px;
    overflow: hidden;
    cursor: pointer;
    aspect-ratio: 1;
    background: var(--paper);
  }
  .thumb.on {
    border-color: var(--step);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .tag {
    position: absolute;
    top: 2px;
    right: 2px;
    font-size: 10px;
    font-weight: 700;
    background: var(--step);
    color: var(--ink);
    border-radius: 2px;
    padding: 0 3px;
  }
  .tabs {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--line);
    padding: 0 56px 0 4px;
    min-height: 45px;
  }
  .tabs.collapsed {
    flex-direction: column;
    padding: 44px 0 0;
  }
  .save {
    position: absolute;
    top: 6px;
    right: 56px;
    height: 32px;
    display: flex;
    align-items: center;
    gap: 6px;
    font: 500 11.5px var(--font-family-body);
    color: var(--dim);
    z-index: 2;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 4px;
    background: var(--good);
  }
  .dot.busy {
    background: var(--step);
  }
  .toggle {
    position: absolute;
    top: 6px;
    right: 16px;
    z-index: 2;
    width: 32px;
    height: 32px;
    border: 1px solid var(--hair);
    border-radius: 6px;
    background: var(--paper);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: var(--ink);
    font-size: 18px;
  }
  .toggle:hover {
    background: var(--paper-2);
    border-color: var(--ink);
  }
  .caret {
    display: block;
    transition: transform 0.15s;
  }
  .caret.flip {
    transform: rotate(180deg);
  }
  .tab {
    border: 0;
    background: transparent;
    cursor: pointer;
    padding: 11px 12px 9px;
    font: 600 13px var(--font-family-body);
    color: var(--dim);
    border-bottom: 2px solid transparent;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tabs.collapsed .tab {
    writing-mode: vertical-rl;
    border-bottom: 0;
    border-right: 2px solid transparent;
  }
  .tab.on {
    color: var(--ink);
    border-bottom-color: var(--step);
  }
  .tabs.collapsed .tab.on {
    border-right-color: var(--step);
  }
  .tab .n {
    font-size: 11px;
    color: var(--dim);
  }
  .nostep {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30px;
    text-align: center;
    font-size: 13px;
    color: var(--dim);
    line-height: 1.6;
  }
  .scrim {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--ink) 55%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    z-index: 20;
  }
  .box {
    background: var(--paper);
    border-radius: 8px;
    padding: 10px;
    max-width: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .box img {
    max-width: min(900px, 100%);
    max-height: calc(100vh - 160px);
    object-fit: contain;
    border-radius: 4px;
    display: block;
  }
  .box-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--dim);
    gap: 10px;
  }
  .notice {
    position: absolute;
    left: 50%;
    bottom: 22px;
    transform: translateX(-50%);
    z-index: 6;
    background: var(--warn-bg);
    color: var(--warn-ink);
    border: 1px solid var(--warn-edge);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .notice button {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 14px;
  }
  .editor.phone {
    display: block;
    padding: 0;
  }
  .topbar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 52px;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px 0 12px;
    background: var(--paper);
    border-bottom: 1px solid var(--line);
  }
  .crumb {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    padding: 0;
    text-align: left;
    cursor: pointer;
    font: 700 13px var(--font-family-body);
  }
  .crumb-badge {
    flex: none;
    background: var(--step);
    color: var(--ink);
    font-size: 11.5px;
    padding: 3px 6px;
    border-radius: 3px;
  }
  .crumb-name {
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .crumb-section {
    color: var(--dim);
    font-size: 12px;
    font-weight: 500;
  }
  .topdot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 4px;
    background: var(--good);
  }
  .topdot.busy {
    background: var(--step);
  }
  .menu {
    flex: none;
    width: 36px;
    height: 36px;
    border: 1px solid var(--hair);
    border-radius: 6px;
    background: var(--paper);
    color: var(--ink);
    font-size: 15px;
    cursor: pointer;
  }
  .menu:disabled {
    color: var(--iron);
    cursor: default;
  }
  .phone .pane.stage {
    position: absolute;
    top: 52px;
    left: 0;
    right: 0;
    border: 0;
    border-radius: 0;
    transition: bottom 0.2s ease;
  }
  .phone .pane.stage .stage-head {
    display: none;
  }
  .phone .pane.insp {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 3;
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -6px 24px color-mix(in srgb, var(--ink) 14%, transparent);
    transition: height 0.2s ease;
  }
  .phone .pane.dragging {
    transition: none;
  }
  .phone .tabs {
    padding: 0 8px;
  }
  .phone .save,
  .phone .toggle {
    display: none;
  }
  .grip {
    flex: none;
    display: flex;
    justify-content: center;
    padding: 8px 0 4px;
    cursor: grab;
    touch-action: none;
  }
  .grip span {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--hair);
  }
  .sheet-foot {
    flex: none;
    display: flex;
    gap: 8px;
    padding: 10px 14px;
    border-top: 1px solid var(--line);
  }
  .sheet-foot button {
    height: 44px;
    padding: 0 16px;
    border-radius: 5px;
    font: 600 13px var(--font-family-body);
    cursor: pointer;
  }
  .sheet-foot .outline:disabled {
    border-color: var(--hair);
    color: var(--iron);
    cursor: default;
  }
  .add-step {
    flex: 1;
    border: 1.5px dashed var(--hair);
    background: var(--paper);
    color: var(--ink);
  }
  .pane.flyout {
    position: absolute;
    z-index: 6;
    background: var(--paper);
    box-shadow: 0 10px 40px color-mix(in srgb, var(--ink) 18%, transparent);
  }
  .tablet .pane.flyout {
    left: 76px;
    top: 10px;
    bottom: 10px;
    width: 248px;
  }
  .phone .pane.flyout {
    inset: 52px 0 0 0;
    border-radius: 0;
  }
  .pane.flyout :global(.head) {
    padding-right: 46px;
  }
  .close {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1;
    width: 28px;
    height: 28px;
    border: 1px solid var(--hair);
    border-radius: 6px;
    background: var(--paper);
    color: var(--ink);
    cursor: pointer;
  }
</style>
