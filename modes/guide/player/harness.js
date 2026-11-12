import { Vector } from "@vivalence/typology";
import { read } from "./aperture/index.js";

export const ROLE = [
  "You are the mentor beside a builder walking an assembly guide. The [Guide] below is an index — one line per step, what each lays out and how much it says. The [Screen] is where the builder is.",
  "Read a step in full with step_read before you quote it or instruct from it; never invent a part, a tool or a step. Turn the builder to a step with step when a question belongs there.",
  "This office only reads the guide: assembly_step, assembly_guide, assembly_rename, assembly_duplicate and the other assembly_* writers author it and are not yours here. fs_* and shell_run are the machine's.",
  "Short answers. One or two plain sentences, then the step's own line when it says it better.",
].join("\n");

export const FORMAT = "Markdown renders beside the stage: **bold** a warning, never a heading; a part by its name, not its slug.";

const pad = (n) => String(n).padStart(2, "0");

const counted = (n, noun) => (n === 1 ? `1 ${noun}` : `${n} ${noun}s`);

const warned = (step) => (step.trait.ANNOTATED?.notes ?? []).some((note) => (note.symbols ?? []).some((one) => one === "note.warning" || one.startsWith("warn.")));

// the index: the guide's header and intro, then one line per step — what it lays out, its tools, how much it says
export const index = (held) => {
  if (!held) return "No guide is open.";
  const { guide, steps, fold, parts, symbols } = held;
  const lines = [`${guide.name} (${guide.slug})${guide.trait.LABELED?.description ? ` — ${guide.trait.LABELED.description}` : ""}${fold.subject ? ` · builds ${fold.subject}` : ""}`];
  for (const line of guide.trait.INSTRUCTED?.lines ?? []) lines.push(`  ${line.text}`);
  for (const note of guide.trait.ANNOTATED?.notes ?? []) lines.push(`  ! ${note.text}`);
  for (const section of fold.sections) {
    lines.push(`[${section.name}]`);
    for (const slug of section.steps) {
      const step = steps.find((one) => one.slug === slug);
      if (!step) continue;
      const lays = Object.entries(step.prepared.parts).map(([part, n]) => `${parts[part]?.name ?? part} × ${n}`).join(", ");
      const tools = step.prepared.tools.map((tool) => symbols[tool] ?? tool).join(", ");
      const said = step.trait.INSTRUCTED?.lines?.length ?? 0;
      lines.push(`${pad(step.index + 1)} ${step.name} (${step.slug})${lays ? ` · lays out ${lays}` : ""}${tools ? ` · tools ${tools}` : ""} · ${counted(said, "line")}${warned(step) ? " · ⚠" : ""}`);
    }
  }
  return lines.join("\n");
};

// one step in full, in the builder's words — parts by name, notes with their kind, lines pointing at what they name
export const page = (held, slug) => {
  const step = held.steps.find((one) => one.slug === slug);
  if (!step) throw new Error(`[assembly] no step "${slug}" in "${held.guide.slug}"`);
  const { parts, symbols } = held;
  const named = (placement) => parts[held.fold.placements.find((one) => one.slug === placement)?.ref]?.name ?? placement;
  const lines = [`${pad(step.index + 1)} ${step.name} (${step.slug}) · ${step.section ?? "no section"}`];
  const lays = Object.entries(step.prepared.parts).map(([part, n]) => `${parts[part]?.name ?? part} × ${n}`).join(", ");
  if (lays) lines.push(`  lays out: ${lays}`);
  const tools = step.prepared.tools.map((tool) => symbols[tool] ?? tool).join(", ");
  if (tools) lines.push(`  tools: ${tools}`);
  const removed = (step.trait.ASSEMBLED?.placements ?? []).filter((one) => one.active === false).map((one) => named(one.literal));
  if (removed.length) lines.push(`  takes off: ${removed.join(", ")}`);
  for (const note of step.trait.ANNOTATED?.notes ?? []) lines.push(`  ! ${note.symbols?.length ? `${note.symbols.map((one) => symbols[one] ?? one).join(", ")}: ` : ""}${note.text}`);
  (step.trait.INSTRUCTED?.lines ?? []).forEach((line, n) => lines.push(`  ${n + 1}. ${line.text}${line.at?.literals?.length ? ` → ${line.at.literals.map(named).join(", ")}` : ""}`));
  const pictures = step.trait.INSTRUCTED?.images?.length ?? 0;
  if (pictures) lines.push(`  ${counted(pictures, "picture")} on the builder's screen`);
  return lines.join("\n");
};

export const screen = (data, held) => {
  if (!data?.guide) return "The builder has no guide open.";
  if (!held) return `The builder opened "${data.guide}", which cannot be read.`;
  const step = data.step ?? 0;
  const lines = [step === 0 ? `On the overview of ${held.guide.name}.` : `On step ${pad(step)} of ${held.steps.length}: ${held.steps[step - 1]?.name ?? "?"} (${held.steps[step - 1]?.slug ?? "?"}).`];
  lines.push(`Done: ${data.done?.length ? data.done.join(", ") : "nothing yet"}.`);
  if (data.ghost) lines.push("Ghosts are on.");
  return lines.join("\n");
};

export const threadOf = (ctx) => ctx.thread?.id ?? ctx.thread ?? null;

// the newest buffer of this mode on this thread is the builder's screen
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
    ctx.hallucination.primer.open("role", ROLE);
    ctx.hallucination.primer.open("guide", `[Guide]\n${index(guide)}`);
    ctx.screen = `[Screen]\n${screen(data, guide)}`;
    await next();
  });

harness.branch("/dialogue").use(async (ctx, next) => {
  ctx.hallucination.primer.open("format", FORMAT);
  ctx.hallucination.primer.open("screen", ctx.screen);
  await next();
});
