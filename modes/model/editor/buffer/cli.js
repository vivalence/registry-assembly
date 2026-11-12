export const VERBS = ["part", "place", "move", "rename", "duplicate", "retract", "open", "select", "focus", "resolve", "bom", "closure", "tree", "geometry"];

export const GRAMMAR = VERBS.join(" · ");

const THREADS = ["M2", "M3", "M4", "M5"];

const vector = (text) => {
  const held = String(text ?? "").split(",").map((one) => Number(one.trim()));
  return held.length === 3 && held.every((one) => Number.isFinite(one)) ? held : null;
};

const generator = (tokens) => {
  const kind = tokens.shift();
  if (!["bolt", "standoff", "nut"].includes(kind)) return { fault: `no generator "${kind}" — bolt · standoff · nut` };
  const thread = String(tokens.shift() ?? "M3").toUpperCase();
  if (!THREADS.includes(thread)) return { fault: `no thread "${thread}" — ${THREADS.join(" · ")}` };
  if (kind === "nut") return { parametric: { generator: "fastener.nut", params: { thread } } };
  const length = Number(tokens.shift());
  if (!Number.isFinite(length)) return { fault: `${kind} takes a length in millimetres — ${kind} ${thread.toLowerCase()} 16` };
  return { parametric: { generator: `fastener.${kind}`, params: { thread, length } } };
};

export const lines = (text) => String(text ?? "").split("\n").map((one) => one.trim()).filter(Boolean);

export const parse = (line, { subject = null, selected = [] } = {}) => {
  const raw = String(line ?? "").trim();
  if (!raw) return null;
  const quoted = raw.match(/"([^"]*)"/);
  const name = quoted ? quoted[1] : null;
  const tokens = raw.replace(/"[^"]*"/, " ").trim().split(/\s+/).filter(Boolean);
  const verb = tokens.shift();

  if (verb === "part") {
    const slug = tokens.shift();
    if (!slug) return { fault: 'part takes a slug — part frame_bottom "Frame bottom"' };
    const input = { slug, ...(name && { name }) };
    if (tokens.length) {
      const held = generator(tokens);
      if (held.fault) return held;
      Object.assign(input, held, { qty: 1 });
    }
    return { nature: "/part", input, select: slug };
  }

  if (verb === "place") {
    const ref = tokens.shift();
    if (!ref) return { fault: "place takes a part — place arm into frame" };
    if (tokens[0] === "into" || tokens[0] === "in") tokens.shift();
    const layer = tokens[0] && tokens[0] !== "at" ? tokens.shift() : subject;
    if (!layer) return { fault: "place takes a layer — open a part first, or name it: place arm into frame" };
    const input = { layer, ref };
    if (tokens[0] === "at") {
      tokens.shift();
      const at = vector(tokens.shift());
      if (!at) return { fault: "at takes three metres, comma separated — at 0.1,0,0" };
      input.translation = at;
    }
    return { nature: "/placement", input, place: true };
  }

  if (verb === "move") {
    const slug = tokens.shift();
    const how = tokens.shift();
    const target = tokens.shift();
    if (!slug || !how) return { fault: "move takes a placement and where — move frame.arm.0 into chassis" };
    if (how === "into") return target ? { nature: "/move", input: { slug, layer: target }, select: true } : { fault: "move into takes a part — move frame.arm.0 into chassis" };
    if (how === "under") return { nature: "/move", input: { slug, parent: target ?? "" }, select: true };
    if (how === "as") return target ? { nature: "/move", input: { slug, name: target }, select: true } : { fault: "move as takes a name — move frame.arm.0 as arm.front" };
    return { fault: `no move "${how}" — into a layer · under a path · as a name` };
  }

  if (verb === "rename") {
    const slug = tokens.shift();
    const to = tokens.shift();
    if (!slug || !to) return { fault: "rename takes a slug and its new one — rename frame frame_carbon" };
    return { nature: "/rename", input: { slug, to }, select: true, renamed: slug };
  }

  if (verb === "duplicate") {
    const slug = tokens.shift() ?? selected[0];
    if (!slug) return { fault: "duplicate takes a slug — duplicate frame" };
    const to = tokens.shift();
    return { nature: "/duplicate", input: { slug, ...(to && { to }) }, select: true };
  }

  if (verb === "retract") {
    const slug = tokens.shift() ?? selected[0];
    if (!slug) return { fault: "retract takes a slug — retract drone_rig" };
    return { ask: slug };
  }

  if (verb === "open") {
    const slug = tokens.shift();
    if (!slug) return { fault: "open takes a part — open frame" };
    return { screen: { subject: slug, selected: [], scope: "buffer" } };
  }

  if (verb === "select") return { screen: { selected: tokens } };

  if (verb === "focus") {
    const slug = tokens.shift() ?? selected[0];
    if (!slug) return { fault: "focus takes a slug — focus frame.arm.0" };
    return { focus: slug };
  }

  if (verb === "resolve" || verb === "bom") {
    const slug = tokens.shift() ?? subject;
    if (!slug) return { fault: `${verb} takes a part — open one first, or name it: ${verb} frame` };
    return { read: `/${verb}`, input: { slug } };
  }

  if (verb === "closure" || verb === "geometry") {
    const slug = tokens.shift() ?? selected[0] ?? subject;
    if (!slug) return { fault: `${verb} takes a slug — ${verb} frame` };
    return { read: `/${verb}`, input: { slug } };
  }

  if (verb === "tree") return { read: "/tree", input: {} };

  return { fault: `no verb ${verb} — ${GRAMMAR}` };
};
