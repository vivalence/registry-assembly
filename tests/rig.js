import { Aperture, Connection, contexts, Path, shape, shard, steer, Twitch, Url } from "@vivalence/typology";
import { gestalten, sets, DaemonEntity, UserEntity } from "@vivalence/runtime";
import { provider as datamap, descriptors, twitches } from "@vivalence/runtime/scenarios";

import * as domain from "../domain/assembly/assembly.viva.js";
import part from "../topologies/part/dataset/symbols/ontological.js";
import placement from "../topologies/placement/dataset/symbols/ontological.js";
import step from "../topologies/step/dataset/symbols/ontological.js";
import guide from "../topologies/guide/dataset/symbols/ontological.js";

const { gather, mint, strike } = gestalten.belt;

export const DAEMON = "assembly-rig";
export const TOPOLOGIES = ["part", "placement", "step", "guide"];
export const SYMBOLS = { part, placement, step, guide };

export async function mount({ symbols = true, install = [] } = {}) {
  const held = await datamap(descriptors);
  const { orm } = held;
  const em = held.entities.em;
  const runtime = new Twitch();
  for (const each of twitches) runtime.graft(each);
  runtime.branch("/after").use(shard.datamap.detached(held));
  held.registerSubscriber(runtime);
  const traits = Object.fromEntries(Object.keys(sets.traits).map((kind) => [kind, gather(domain, [], kind)]));
  const entities = { ...held.entities, ...strike(mint({ slug: DAEMON, kinds: sets.traits, traits }), em, sets.traits) };

  em.create(DaemonEntity, { slug: DAEMON, mask: { manifest: { type: "daemon", slug: DAEMON } } });
  const user = em.create(UserEntity, { slug: "beef" });
  await em.flush();

  const modes = {};
  for (const slug of TOPOLOGIES) modes[slug] = entities.mode.create({ type: "topology", slug, name: slug, daemon: DAEMON, traits: [], installed: "", version: "0.0.1" });
  modes.model = entities.mode.create({ type: "topography", slug: "model", name: "model", daemon: DAEMON, traits: [], installed: "", version: "0.0.0" });
  await em.flush();
  em.setFilterParams("user", { user: user.id });

  if (symbols) for (const [slug, rows] of Object.entries(SYMBOLS)) for (const row of rows) entities.symbol.create({ slug: row.slug, mode: modes[slug], daemon: DAEMON, traits: row.traits, trait: row.trait });
  for (const row of install) entities.symbol.create({ slug: row.slug, mode: modes.model, daemon: DAEMON, traits: row.traits, trait: row.trait });
  await em.flush();
  em.clear();

  const daemon = {
    slug: DAEMON,
    manifest: { slug: DAEMON, traits: [] },
    aperture: new Aperture(),
    twitch: new Twitch(),
    entities,
    datamap: held,
    providers: {},
    domain,
    modes: {},
    reference: new Path(`/daemon/${DAEMON}`),
  };
  daemon.twitch.use(shard.context.spread(contexts.daemonDie, daemon)).use(shard.datamap.owned());
  daemon.twitch.branch("/after").use(shard.datamap.detached(held));
  held.registerSubscriber(daemon.twitch);
  daemon.aperture.use(shard.context.spread(contexts.daemonDie, daemon));
  domain.aperture.use(shard.context.spread(contexts.daemonDie, daemon));
  daemon.aperture.graft(domain.aperture);
  daemon.call = shape.proxy(domain.aperture, steer.strategy.direct);
  await domain.resolve?.(daemon);

  const handler = shape.http(daemon.aperture);
  const conn = new Connection(new Url("http://assembly-rig"), shard.transmitter.inline(handler));

  const tools = shape.proxy(domain.tools, steer.strategy.direct);
  const caller = () => ({ ...shard.context.lift(contexts.daemonDie, daemon), user, mode: { id: modes.model.id } });
  const call = (path, input) => steer.dispatch.invoke(domain.aperture, path, steer.strategy.direct)({ ...caller(), input });
  const invoke = (path, input) => tools[path]({ ...caller(), input });

  return { orm, em, entities, modes, mode: modes.model, user, literal: entities.literal, daemon, conn, tools, call, invoke, close: () => orm.close() };
}
