import { Vector } from "@vivalence/typology";
import { read } from "./aperture/index.js";

export const ROLE = [
  "You are the author's hand over an assembly guide, for the operator who has the guide editor open. A guide names a part it builds and orders steps in sections; a step names the placements it installs by slug, carries numbered lines, notes, pictures and a staging. Composition (parts, placements) is the assembly editor's; here you write guides and steps.",
  "The [Guide] below is an index — one line per step. The [Screen] is where the operator is; use the slugs it and the index show, never invent one: a slug that does not exist is refused.",
  "In order: 1. Read before you write — a step whole with step_read, the guide's own intro, notes and sections with guide_read, the subject's fold with assembly_resolve before naming a placement. 2. Write with assembly_step and assembly_guide: the same slug again is an over, and every list you give — lines, notes, images, placements, symbols, sections — replaces the whole list, so carry what you keep from what you read. A new step is sequenced with assembly_sequence, then put on screen with open. 3. Move the operator with open and select. 4. Say in one or two plain sentences what you did.",
  "assembly_rename and assembly_duplicate follow the same rule. fs_*, shell_run and buffer_update are the machine's, not this office's: the screen is changed with open and select only.",
].join("\n");

export const LIMIT = 40;

const listed = (slugs, more) => `${slugs.slice(0, LIMIT).join(", ")}${slugs.length > LIMIT ? ` … ${slugs.length - LIMIT} more${more ? ` — ${more}` : ""}` : ""}`;

export const FORMAT = "Markdown renders in the dock: a slug in `code`, **bold** for what changed, never a heading.";

const pad = (n) => String(n).padStart(2, "0");

const optionsOf = (held) => held.enum ?? (Array.isArray(held.anyOf) && held.anyOf.length && held.anyOf.every((one) => "const" in one) ? held.anyOf.map((one) => one.const) : null);

const fieldsOf = (schema) =>
  Object.entries(schema?.properties ?? {})
    .map(([key, held]) => {
      const options = optionsOf(held);
      const kind = options ? options.join(" | ") : held.type === "array" ? `${held.items?.type ?? "any"}[]` : (held.type ?? "any");
      const optional = (schema.required ?? []).includes(key) ? "" : "?";
      return `    ${key}${optional}: ${kind} — ${held.description ?? ""}`;
    })
    .join("\n");

// the ontology rendered from the domain's schematics — the guide's and the step's traits
export const ontology = ({ ONTOLOGIES, TRAITS }) =>
  Object.entries(ONTOLOGIES)
    .filter(([name]) => name === "guide" || name === "step")
    .map(([name, held]) => `${name}\n${held.traits.map((trait) => `  ${trait} — ${TRAITS[trait]?.description ?? ""}\n${fieldsOf(TRAITS[trait])}`).join("\n")}`)
    .join("\n\n");

const counted = (n, noun) => (n === 1 ? `1 ${noun}` : `${n} ${noun}s`);

const named = (held, tool) => held.symbols[tool] ?? tool;

const intro = (row) => {
  const said = row.trait.INSTRUCTED?.lines?.length ?? 0;
  const notes = row.trait.ANNOTATED?.notes?.length ?? 0;
  return said || notes ? ` · intro ${counted(said, "line")}${notes ? `, ${counted(notes, "note")}` : ""}` : "";
};

// the index: the guide's header, a legend, then one line per step — what it installs, its tools, how much it says
export const index = (held) => {
  if (!held) return "No guide is open.";
  const { guide, steps, fold } = held;
  const lines = [
    `${guide.name} (${guide.slug})${guide.trait.LABELED?.description ? ` — ${guide.trait.LABELED.description}` : ""}${fold.subject ? ` · builds ${fold.subject}` : " · no subject yet"}${intro(guide)}`,
    "rows: number · name (slug) · installs, − removes · tools · lines · notes — step_read pages one",
  ];
  for (const section of fold.sections) {
    lines.push(`[${section.name}]`);
    for (const slug of section.steps) {
      const step = steps.find((one) => one.slug === slug);
      if (!step) continue;
      const installs = (step.trait.ASSEMBLED?.placements ?? []).map((one) => `${one.active === false ? "−" : ""}${one.literal}`).join(", ");
      const tools = step.prepared.tools.map((tool) => named(held, tool)).join(", ");
      const said = step.trait.INSTRUCTED?.lines?.length ?? 0;
      const notes = step.trait.ANNOTATED?.notes?.length ?? 0;
      lines.push(`${pad(step.index + 1)} ${step.name} (${step.slug})${installs ? ` · installs ${installs}` : " · installs nothing"}${tools ? ` · tools ${tools}` : ""} · ${counted(said, "line")}${notes ? ` · ${counted(notes, "note")}` : ""}`);
    }
  }
  const kit = fold.placements.filter((one) => one.at == null).map((one) => one.slug);
  if (kit.length) lines.push(`Not yet in any step: ${listed(kit, `assembly_resolve { slug: "${fold.subject}" } lists every placement`)}`);
  return lines.join("\n");
};

const staging = (staged) => {
  if (!staged) return [];
  const out = [];
  const built = staged.built;
  if (built) out.push(`built before it: ${[...(built.steps ?? []), ...(built.parts ?? []), ...(built.placements ?? [])].join(", ") || "nothing"}`);
  if (staged.tints && Object.keys(staged.tints).length) out.push(`tints: ${Object.entries(staged.tints).map(([slug, tint]) => `${slug} ${tint}`).join(", ")}`);
  if (staged.explode != null) out.push(`explode ${staged.explode}`);
  if (staged.ghost != null) out.push(`ghost ${staged.ghost}`);
  if (staged.camera) out.push(`camera at ${staged.camera.position.join(", ")} looking at ${staged.camera.target.join(", ")}`);
  return out.map((one) => `  staging · ${one}`);
};

// the lines, notes and pictures a step or a guide carries — every list whole, so an over can carry it back
const said = (held, row) => {
  const lines = [];
  (row.trait.INSTRUCTED?.lines ?? []).forEach((line, n) => lines.push(`  ${n + 1}. ${line.text}${line.at?.literals?.length ? ` → ${line.at.literals.join(", ")}` : ""}`));
  for (const note of row.trait.ANNOTATED?.notes ?? []) lines.push(`  ! ${note.text}${note.symbols?.length ? ` [${note.symbols.map((one) => named(held, one)).join(", ")}]` : ""}`);
  for (const image of row.trait.INSTRUCTED?.images ?? []) lines.push(`  picture ${image}`);
  lines.push(...staging(row.trait.STAGED));
  return lines;
};

// one step in full
export const page = (held, slug) => {
  const step = held.steps.find((one) => one.slug === slug);
  if (!step) throw new Error(`[assembly] no step "${slug}" in "${held.guide.slug}" — the [Guide] index lists its steps by slug`);
  const lines = [`${pad(step.index + 1)} ${step.name} (${step.slug}) · section ${step.section ?? "none"}${step.trait.LABELED?.description ? ` — ${step.trait.LABELED.description}` : ""}`];
  const placements = step.trait.ASSEMBLED?.placements ?? [];
  lines.push(`  installs: ${placements.length ? placements.map((one) => `${one.literal}${one.active === false ? " (removed)" : ""}`).join(", ") : "nothing"}`);
  const parts = Object.entries(step.prepared.parts).map(([part, n]) => `${held.parts[part]?.name ?? part} × ${n}`).join(", ");
  if (parts) lines.push(`  lays out: ${parts}`);
  const tools = step.prepared.tools.map((tool) => named(held, tool)).join(", ");
  if (tools) lines.push(`  tools: ${tools}`);
  lines.push(...said(held, step));
  return lines.join("\n");
};

// the guide's own page — what assembly_guide overs: its intro, notes, pictures, staging and sections
export const head = (held) => {
  const { guide, fold } = held;
  const lines = [`${guide.name} (${guide.slug})${guide.trait.LABELED?.description ? ` — ${guide.trait.LABELED.description}` : ""}`];
  lines.push(`  builds: ${fold.subject ?? "nothing yet"}`);
  lines.push(...said(held, guide));
  lines.push(`  sections: ${fold.sections.length ? fold.sections.map((section) => `${section.name} [${section.steps.join(", ")}]`).join(" · ") : "none"}`);
  return lines.join("\n");
};

// the one sentence the model's picture and the operator's screen share — the head of [Screen], and what open and select answer
export const status = (data, held) => {
  if (!data?.guide) return "Nothing is on the operator's screen — no guide open.";
  if (!held) return `On the operator's screen: "${data.guide}", which cannot be read.`;
  const step = data.step ?? 0;
  const at = step > 0 && held.steps[step - 1] ? `step ${pad(step)} of ${held.steps.length}, ${held.steps[step - 1].name} (${held.steps[step - 1].slug})` : "the guide tab";
  return [
    `On the operator's screen: ${held.guide.name} (${held.guide.slug}) · ${at}`,
    `selected ${data.sel?.length ? listed(data.sel) : "nothing"}`,
    ...(data.draft?.of ? [`an edit of ${data.draft.of} typed, unsaved`] : []),
  ].join(" · ") + ".";
};

export const screen = (data, held, guides = null) => {
  const line = status(data, held);
  if (data?.guide) return line;
  return `${line} ${guides?.length ? `The daemon holds: ${listed(guides)}. Open one with open.` : "The daemon holds no guide yet; the operator can make one from the screen."}`;
};

export const threadOf = (ctx) => ctx.thread?.id ?? ctx.thread ?? null;

// the newest buffer of this mode on this thread is the operator's screen
export const open = (ctx) => {
  const thread = threadOf(ctx);
  if (!thread) return null;
  return ctx.entities.buffer.findOne({ thread, mode: ctx.mode.id }, { orderBy: { index: "desc" }, filters: false });
};

// the guide the screen holds, read whole; null when none is open or it cannot be read
export const held = async (ctx, data) => {
  if (!data?.guide) return null;
  try {
    return await read(ctx, data.guide);
  } catch {
    return null;
  }
};

export const harness = new Vector()
  .use(async (ctx, next) => {
    const row = await open(ctx);
    const data = row?.data ?? {};
    const guide = await held(ctx, data);
    const guides = data.guide ? null : (await ctx.entities.literal.find({ ontology: "guide" })).map((one) => one.slug);
    ctx.hallucination.primer.open("role", ROLE);
    ctx.hallucination.primer.open("ontology", `[Ontology]\n${ontology(ctx.domain.schematics)}`);
    ctx.hallucination.primer.open("guide", `[Guide]\n${index(guide)}`);
    ctx.screen = `[Screen]\n${screen(data, guide, guides)}`;
    await next();
  });

harness.branch("/dialogue").use(async (ctx, next) => {
  ctx.hallucination.primer.open("format", FORMAT);
  ctx.hallucination.primer.open("screen", ctx.screen);
  await next();
});
