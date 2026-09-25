const symbol = (slug, name, description, root = false) => ({
  slug,
  traits: ["ONTOLOGICAL", "LABELED", ...(root ? ["TOPOGRAPHICAL"] : [])],
  trait: { ONTOLOGICAL: {}, LABELED: { name, description }, ...(root ? { TOPOGRAPHICAL: {} } : {}) },
});

export default [
  symbol("step", "Step", "One unit of a guide — the placements it installs, what to do, what to lay out. Core ontological dimension.", true),
  symbol("note.tip", "Tip", "A callout that helps — a trick, a check, a way to hold it."),
  symbol("note.warning", "Warning", "A callout that protects — what goes wrong if you do not read it."),
  symbol("warn.loose", "Leave it loose", "Do not tighten yet."),
  symbol("warn.tight", "Tighten", "Tighten firmly; check nothing sticks out."),
  symbol("warn.orientation", "Orientation", "A side, a direction or a front that must be right."),
  symbol("warn.length", "Length", "The right bolt length — too long touches what it must not."),
  symbol("warn.magnet", "Magnets", "Powerful magnets — keep bolts, nuts and tools away."),
  symbol("warn.force", "Force", "Do not push or press too hard."),
  symbol("warn.wires", "Wires", "Mind the wires — orientation, routing, damage."),
  symbol("tool.hex_2_0", "Hex 2.0", "Hex screwdriver, 2.0 mm."),
  symbol("tool.hex_5_5", "Hex 5.5", "Nut driver, 5.5 mm."),
  symbol("tool.tweezers", "Tweezers", "For grommets and connectors."),
  symbol("tool.wire_cutters", "Wire cutters", "For zip ties."),
  symbol("tool.screw_gauge", "Screw gauge", "The measure tool for sorting bolts."),
  symbol("tool.bolt_organizer", "Bolt organizer", "Magnetised tray."),
  symbol("tool.marker", "Marker", "White marker."),
  symbol("tool.jig", "Jig", "The 3D-printed helper that holds four bolts while the frame is flipped."),
];
