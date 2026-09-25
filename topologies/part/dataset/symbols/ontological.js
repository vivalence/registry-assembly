const symbol = (slug, name, description, root = false) => ({
  slug,
  traits: ["ONTOLOGICAL", "LABELED", ...(root ? ["TOPOGRAPHICAL"] : [])],
  trait: { ONTOLOGICAL: {}, LABELED: { name, description }, ...(root ? { TOPOGRAPHICAL: {} } : {}) },
});

export default [
  symbol("part", "Part", "What a thing is — geometry of its own, an interior of placements, or both. A part that carries COUNTED is a thing you order. Core ontological dimension.", true),
  // what it is made of / how it is made — the kit list's own vocabulary
  symbol("material.carbon", "Carbon", "Carbon frame geometry. The only parts where dimensional accuracy matters — bolt holes must line up."),
  symbol("material.printed", "3D printed", "Printed parts. The source STL exists upstream."),
  symbol("material.fastener", "Fastener", "Screws, nuts, standoffs. Fully described by a spec string; generated, never scanned."),
  symbol("material.electronics", "Electronics", "Standardised boards with connectors and silkscreen; nobody inspects the chamfer."),
  symbol("material.motor", "Motor", "Rotationally symmetric, no internals shown."),
  symbol("material.soft_goods", "Soft goods", "Cables, antennas, straps, ties, pads. No intrinsic shape — geometry follows the assembly."),
  // where the geometry came from
  symbol("source.3d_scan", "3D scan", "Scanned from the physical part."),
  symbol("source.vendor_cad", "Vendor CAD", "Manufacturer CAD / STEP."),
  symbol("source.print_stl", "Print STL", "The STL the part was printed from."),
  symbol("source.parametric", "Parametric", "Generated from a spec — a generator and its params."),
  symbol("source.procedural_spline", "Procedural spline", "Generated along a routing path defined per assembly step."),
  symbol("source.photo_model", "Photo model", "Modelled from reference photographs."),
  symbol("source.texture_only", "Texture only", "A flat decal, no geometry."),
  symbol("source.none", "None", "No 3D asset — not shown."),
];
