# harvest the model's geometry out of the blend, headless:
#
#   blender -b <model>.blend -P harvest.py -- --scale <metres per blender unit> [--origin <object>] [--out <dir>]
#
# writes, per mesh object, a GLB in the part's LOCAL frame — modifiers applied, |scale| × factor
# baked into the geometry (metres), rotation and location zeroed — into <out>/<object>.glb, and
# <out>/blend.json: every object's placement as glTF's exporter decomposes it (translation
# recentred on --origin and scaled, quaternion xyzw, Y-up), its size, its triangle count, the
# collection it sat in. the importer reads that as the bin's objects.
#
# a negative scale (a mirrored instance) is dropped with a note — the arm is one component with
# four placements, not four mirrored meshes; a "(xN)" name is one mesh with N copies welded and
# stays one file here — the intake cuts islands.
import bpy, json, os, sys, tempfile

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
opt = lambda key, default=None: argv[argv.index(key) + 1] if key in argv else default
for required in ("--scale", "--out"):
    if required not in argv:
        sys.exit(f"harvest.py: {required} is required — the scale is the operator's number and the intake is the mountpoint's; nothing is assumed")
SCALE = float(opt("--scale"))
ORIGIN = opt("--origin")
OUT = opt("--out")
os.makedirs(OUT, exist_ok=True)

scene = bpy.context.scene
def kw(fn, **opts):
    known = fn.get_rna_type().properties.keys()
    return {k: v for k, v in opts.items() if k in known}
def slug(name):
    return name.replace(" ", "_").replace("(", "").replace(")", "").replace(".", "_")

# 1. the placements, as glTF decomposes them: whole scene, Y-up, no geometry needed
tmp = os.path.join(tempfile.mkdtemp(), "scene.gltf")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=tmp, **kw(bpy.ops.export_scene.gltf, export_format="GLTF_SEPARATE", export_apply=True, export_yup=True, use_selection=False, export_materials="NONE", export_hierarchy_full_collections=True))
gltf = json.load(open(tmp))
placed = {node["name"]: node for node in gltf["nodes"] if "name" in node}
origin = placed[ORIGIN]["translation"] if ORIGIN else [0, 0, 0]

# 2. per object: local geometry in metres
parts = []
for obj in [o for o in scene.objects if o.type == "MESH"]:
    node = placed.get(obj.name, {})
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.duplicate()
    dup = bpy.context.active_object
    for modifier in list(dup.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        except Exception as error:
            print("modifier skipped", obj.name, modifier.name, error)
    mirrored = [axis for axis, value in zip("xyz", obj.scale) if value < 0]
    dup.scale = [abs(value) * SCALE for value in obj.scale]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    dup.location = (0, 0, 0)
    dup.rotation_euler = (0, 0, 0)
    dup.name = slug(obj.name)
    bpy.ops.object.select_all(action="DESELECT")
    dup.select_set(True)
    file = f"{slug(obj.name)}.glb"
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, file), **kw(bpy.ops.export_scene.gltf, export_format="GLB", export_apply=True, export_yup=True, use_selection=True, export_materials="EXPORT"))
    dims = [round(v, 5) for v in dup.dimensions]  # blender x y z, Z-up
    parts.append({
        "object": obj.name,
        "file": file,
        "collection": obj.users_collection[0].name if obj.users_collection else None,
        "verts": len(dup.data.vertices),
        "tris": sum(len(polygon.vertices) - 2 for polygon in dup.data.polygons),
        "bbox": [dims[0], dims[2], dims[1]],  # glTF x y z, Y-up, metres
        "materials": [slot.material.name for slot in obj.material_slots if slot.material],
        "modifiers": [modifier.type for modifier in obj.modifiers],
        "mirrored": mirrored,
        "bytes": os.path.getsize(os.path.join(OUT, file)),
        "translation": [round((a - b) * SCALE, 5) for a, b in zip(node.get("translation", [0, 0, 0]), origin)],
        "rotation": [round(v, 5) for v in node.get("rotation", [0, 0, 0, 1])],
    })
    bpy.data.objects.remove(dup, do_unlink=True)

json.dump({"source": os.path.basename(bpy.data.filepath), "blender": bpy.app.version_string, "scale": SCALE, "origin": ORIGIN, "units": "metres, Y-up, quaternion xyzw", "parts": parts},
          open(os.path.join(OUT, "blend.json"), "w"), indent=1)
print("HARVESTED", len(parts), "→", OUT)
