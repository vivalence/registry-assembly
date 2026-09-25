import { Vector } from "@vivalence/typology";
import { counts, phaseOf, settle } from "./bin.js";

// the system section: what the open bin holds, member by member, and the vocabulary a naming may
// use — read off the daemon's symbol rows, so the agent names with symbols that exist.

const ROLE = [
  "You are the importer's hand: a blend file's objects are on the operator's screen as a bin, walked intake → interpret → annotate → embed → write.",
  "Name members from the [Members] rows only; use symbols from [Vocabulary] only — never invent one.",
  "A member's slug is the component's slug: short, snake_case, the part not the file. Its kit count is what the kit ships; the model's count is a floor, not the answer.",
  "Say what you did in one line; the screen shows the rest.",
].join("\n");

const PREFIXES = ["material.", "source.", "family.", "joint."];

const open = async (ctx) => {
  if (!ctx.thread) return null;
  return ctx.daemon.entities.buffer.findOne({ thread: ctx.thread.id ?? ctx.thread, mode: ctx.mode.id }, { orderBy: { index: "desc" }, filters: { user: false } });
};

export const members = (bin) =>
  bin.members
    .map((member) => {
      const phase = phaseOf(bin, member) ?? "dropped";
      const named = bin.annotations[member.id];
      const minted = bin.embedded[member.id];
      return [
        `${member.id} · ${phase} · ${member.objects.length} placed${member.copies ? ` · ${member.copies} welded` : ""} · ${member.file}`,
        named ? `  → ${named.slug} · ${named.name}${named.qty != null ? ` · qty ${named.qty}` : ""}${named.symbols?.length ? ` · ${named.symbols.join(" ")}` : ""}` : null,
        minted ? `  = ${minted.ontology} ${minted.slug}` : null,
      ].filter(Boolean).join("\n");
    })
    .join("\n");

export const vocabulary = (rows) =>
  rows
    .filter((row) => PREFIXES.some((prefix) => row.slug.startsWith(prefix)))
    .map((row) => `${row.slug} · ${row.trait?.LABELED?.name ?? ""}`)
    .join("\n");

export const screen = (row) => {
  if (!row) return null;
  const bin = settle(row.data?.bin);
  const held = counts(bin);
  return [
    `[Bin] ${bin.source ?? "no blend loaded"} · ${Object.entries(held).map(([phase, n]) => `${n} ${phase}`).join(" · ")}${bin.assembly ? ` · assembly ${bin.assembly.slug}` : ""}${bin.target ? ` → ${bin.target}` : ""}`,
    bin.members.length ? `[Members]\n${members(bin)}` : null,
  ].filter(Boolean).join("\n\n");
};

export const harness = new Vector().use(async (ctx, next) => {
  const symbols = await ctx.daemon.entities.symbol.find({}, { fields: ["slug", "trait"] }).catch(() => []);
  ctx.hallucination.system.import = [ROLE, `[Vocabulary]\n${vocabulary(symbols)}`, screen(await open(ctx))].filter(Boolean).join("\n\n");
  await next();
});
