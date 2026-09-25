import { v, Vector } from "@vivalence/typology";
import { VERBS } from "../schematics.js";

const at = (one) => (one.translation ? ` @ [${one.translation.map((x) => Number(x.toFixed(4))).join(", ")}]` : "");

// the folds as tools: read the tree or the bill after `upto` steps — what is placed, what remains
export const fold = new Vector()
  .open(
    {
      nature: "/resolve",
      valence: 'Read the tree of a part — every placement with its path and slug, what it places and where, the joints — or of a guide after `upto` steps, each placement with the step that installs it and whether it is built, and what each step lays out. Read before placing or writing a step — work with real paths and slugs, never remembered ones. Example: { slug: "drone", upto: 4 }',
      input: v.object(VERBS.fold),
    },
    async (ctx) => {
      const tree = await ctx.call["/resolve"]({ user: ctx.user, mode: ctx.mode, thread: ctx.thread, input: ctx.input });
      const lines = [
        `${tree.slug}: ${tree.placements.length} placements · ${tree.joints.length} joints${tree.missing.length ? ` · missing ${tree.missing.join(", ")}` : ""}`,
        ...tree.placements.map((one) => `${one.path} (${one.slug}) ← ${one.ref}${at(one)}${one.at != null ? ` · step ${one.at + 1}` : ""}${one.active === false ? (tree.steps ? " (not built)" : " (removed)") : ""}`),
        ...tree.joints.map((joint) => `${joint.fastener} holds ${joint.joins.join(" + ")}`),
        ...(tree.steps ?? []).map((step) => `${step.slug}: lays out ${Object.entries(step.prepared.parts).map(([slug, n]) => `${slug} × ${n}`).join(", ") || "nothing"}${step.prepared.tools.length ? ` · ${step.prepared.tools.join(", ")}` : ""}`),
      ];
      return { message: lines.join("\n"), object: tree };
    },
  )
  .open(
    {
      nature: "/bom",
      valence: 'Count what the build uses, part → count — a part\'s whole composition, or a guide\'s after `upto` steps — next to what the kit ships; the difference is what remains. Example: { slug: "drone", upto: 5 }',
      input: v.object(VERBS.fold),
    },
    async (ctx) => {
      const caller = { user: ctx.user, mode: ctx.mode, thread: ctx.thread };
      const counts = await ctx.call["/bom"]({ ...caller, input: ctx.input });
      const tree = await ctx.call["/resolve"]({ ...caller, input: ctx.input });
      const lines = Object.entries(counts).map(([slug, used]) => {
        const kit = tree.parts[slug]?.COUNTED?.qty;
        return `${slug} × ${used}${kit != null ? ` of ${kit}` : ""}`;
      });
      return { message: lines.length ? lines.join("\n") : `${ctx.input.slug}: nothing placed yet`, object: counts };
    },
  );
