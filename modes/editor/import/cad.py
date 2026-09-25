import os, sys
import FreeCAD, Import, MeshPart

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
opt = lambda key, default=None: argv[argv.index(key) + 1] if key in argv else default
FILE = opt("--file") or os.environ.get("VIVA_CAD_FILE")
OUT = opt("--out") or os.environ.get("VIVA_CAD_OUT")
if not FILE or not OUT:
    sys.exit("cad.py: --file and --out are required")

MM = 0.001
CHORD = float(opt("--chord") or 0.05)

document = FreeCAD.newDocument("cad")
Import.insert(FILE, document.Name)
document.recompute()

solids = [o for o in document.Objects if o.TypeId == "Part::Feature" and hasattr(o, "Shape") and o.Shape.Solids]
if not solids:
    sys.exit("cad.py: the file holds no solids")

lines = []
offset = 0
seen = {}
for feature in solids:
    shape = feature.Shape.copy()
    shape.Placement = feature.getGlobalPlacement()
    mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=CHORD, AngularDeflection=0.3, Relative=False)
    points, facets = mesh.Topology
    label = feature.Label.replace(" ", "_")
    seen[label] = seen.get(label, 0) + 1
    lines.append(f"o {label}" if seen[label] == 1 else f"o {label}.{seen[label] - 1:03d}")
    for p in points:
        lines.append(f"v {p.x * MM:.6f} {p.z * MM:.6f} {-p.y * MM:.6f}")
    for a, b, c in facets:
        lines.append(f"f {a + 1 + offset} {b + 1 + offset} {c + 1 + offset}")
    offset += len(points)

with open(OUT, "w") as out:
    out.write("\n".join(lines) + "\n")
print("CAD", len(solids), "→", OUT)
