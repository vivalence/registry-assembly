import { contexts, Controller, Cortex, shape, shard, steer, Vector } from "@vivalence/typology";

// what HARNESSED hands the cortex: the primer loaded into sections, beside the rest of the hallucination
const primed = async (ctx) => {
  const { primer, ...hallucination } = ctx.hallucination;
  return { ...hallucination, system: await shape.primer.load(primer, ctx) };
};

// a stand-in for the runtime's HARNESSED: binds daemon, mode and thread, builds ctx.hallucination,
// arms the domain's tools under its slug and the mode's at the root the way `arming` does, and opens
// the dialogue and object leaves onto a scripted cortex — so the harness runs against the real
// lowering, loop and dispatch offline, and every request the model would have seen is captured.

export const userTurn = (text) => ({ role: "user", parts: [{ type: "text", text }] });

export const answered = (turns) => turns.flatMap((turn) => turn.parts ?? []).filter((part) => part.type === "tool_result");

export const call = (id, name, input) => ({ role: "assistant", parts: [{ type: "tool_use", id, name, input }], meta: { state: "tools" } });

export const say = (text) => ({ role: "assistant", parts: [{ type: "text", text }], meta: { state: "complete" } });

export const scripted = (script) => {
  const seen = [];
  const cortex = new Cortex().register([{
    type: "dialogue",
    tune: [0.5, 0.5, 0.5],
    channels: { in: ["text", "tool_result"], out: ["text", "tool_use", "object"] },
    via: {
      render: async (request) => {
        seen.push(JSON.parse(JSON.stringify({ ...request, tools: request.tools?.map((tool) => tool.name) })));
        return script(request, seen.length - 1);
      },
    },
  }]);
  return { cortex, seen };
};

export const assemble = ({ daemon, mode, thread, harness, tools }) => {
  const armed = new Vector();
  if (daemon.domain?.tools) armed.branch(daemon.domain.manifest.slug, daemon.domain.tools);
  if (tools) armed.graft(tools);
  armed.use(shard.context.spread(contexts.host, daemon));
  armed.use(shard.context.bind("mode", mode));
  if (thread) armed.use(shard.context.bind("thread", thread.id));

  const vector = new Vector()
    .use(shard.context.spread(contexts.host, daemon))
    .use(shard.context.bind("mode", mode))
    .use(async (ctx, next) => {
      ctx.input = typeof ctx.input === "string" ? { prompt: ctx.input } : (ctx.input ?? {});
      ctx.thread = thread ?? null;
      const { system, turns, output, tune } = ctx.input;
      ctx.hallucination = {
        controller: new Controller(),
        policy: { ...(tune && { tune }) },
        primer: Object.entries(system ?? {}).reduce((primer, [nature, text]) => primer.open(nature, text), new Vector()),
        turns: turns ?? [],
        tools: armed,
        ...(output && { output: { schema: output } }),
      };
      await next();
    })
    .graft(harness);

  for (const type of ["dialogue", "object"]) {
    vector.branch(type).open("render", async (ctx) => ctx.cortex.hallucinate[type].render(await primed(ctx)));
  }

  return shape.object(vector, steer.strategy.echo);
};
