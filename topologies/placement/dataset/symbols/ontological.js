const symbol = (slug, name, description, root = false) => ({
  slug,
  traits: ["ONTOLOGICAL", "LABELED", ...(root ? ["TOPOGRAPHICAL"] : [])],
  trait: { ONTOLOGICAL: {}, LABELED: { name, description }, ...(root ? { TOPOGRAPHICAL: {} } : {}) },
});

export default [
  symbol("placement", "Placement", "One occurrence of a part under a layer — what it places, where, and, when it fastens, what it holds together. Core ontological dimension.", true),
  symbol("joint.bolted", "Bolted", "A bolt through the parts, into a nut or a thread."),
  symbol("joint.pressed", "Pressed", "Pushed into a hole and held by friction — a grommet, a pigtail."),
  symbol("joint.adhesive", "Adhesive", "Stuck on — a pad, a thermal pad, a sticker."),
  symbol("joint.tied", "Tied", "Held by a zip tie or a strap."),
  symbol("joint.plugged", "Plugged", "A connector plugged into its socket."),
  symbol("joint.threaded", "Threaded", "A threaded part screwed onto another — a nut on a pigtail, a standoff on a bolt."),
];
