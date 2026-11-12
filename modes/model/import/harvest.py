import bpy, json, os, sys, tempfile
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
opt = lambda key, default=None: argv[argv.index(key) + 1] if key in argv else default
for required in ("--file", "--format", "--out"):
    if required not in argv:
        sys.exit(f"harvest.py: {required} is required")
FILE = opt("--file")
FORMAT = opt("--format")
OUT = opt("--out")
UNIT = opt("--unit")
UP = opt("--up")
RECENTRE = opt("--recentre")
os.makedirs(OUT, exist_ok=True)

AXES = {"Y": dict(forward_axis="NEGATIVE_Z", up_axis="Y"), "Z": dict(forward_axis="Y", up_axis="Z")}
axes = AXES.get(UP, {})
IMPORTERS = {
    "gltf": lambda: bpy.ops.import_scene.gltf(filepath=FILE),
    "fbx": lambda: bpy.ops.import_scene.fbx(filepath=FILE),
    "obj": lambda: bpy.ops.wm.obj_import(filepath=FILE, **axes),
    "stl": lambda: bpy.ops.wm.stl_import(filepath=FILE, **axes),
    "usd": lambda: bpy.ops.wm.usd_import(filepath=FILE),
    "3ds": lambda: bpy.ops.import_scene.autodesk_3ds(filepath=FILE),
}

if FORMAT != "blend":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if FORMAT == "3ds" and not hasattr(bpy.ops.import_scene, "autodesk_3ds"):
        sys.exit("harvest.py: no 3ds importer in this blender — the io_scene_3ds extension is not installed")
    IMPORTERS[FORMAT]()

scene = bpy.context.scene
if FORMAT in ("obj", "stl"):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
declared = scene.unit_settings.scale_length if FORMAT == "blend" else None
SCALE = float(UNIT) if UNIT else (declared if declared is not None else 1.0)

def kw(fn, **opts):
    known = fn.get_rna_type().properties.keys()
    return {k: v for k, v in opts.items() if k in known}

def slug(name):
    return name.replace(" ", "_").replace("(", "").replace(")", "").replace(".", "_")

collections = {}
def walk(collection, path):
    for child in collection.children:
        collections[child.name] = path + [child.name.replace("/", "-")]
        walk(child, collections[child.name])
walk(scene.collection, [])
def collection_of(obj):
    held = obj.users_collection[0].name if obj.users_collection else None
    return "/".join(collections[held]) if held in collections else None

meshes = [o for o in scene.objects if o.type == "MESH"]
if not meshes:
    sys.exit("harvest.py: the file holds no mesh objects")

tmp = os.path.join(tempfile.mkdtemp(), "scene.gltf")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=tmp, **kw(bpy.ops.export_scene.gltf, export_format="GLTF_SEPARATE", export_apply=True, export_yup=True, use_selection=False, export_materials="NONE", export_hierarchy_full_collections=True))
placed = {node["name"]: node for node in json.load(open(tmp))["nodes"] if "name" in node}
origin = [0, 0, 0]
if RECENTRE == "centre":
    corners = [p for o in meshes for p in (o.matrix_world @ Vector(c) for c in o.bound_box)]
    if corners:
        origin = [(min(c[i] for c in corners) + max(c[i] for c in corners)) / 2 for i in (0, 2, 1)]
        origin[2] = -origin[2]
elif RECENTRE and RECENTRE in placed:
    origin = placed[RECENTRE].get("translation", [0, 0, 0])

strays = [o.name for o in meshes if o.name not in placed]

objects = []
for obj in meshes:
    node = placed.get(obj.name)
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
    dims = [round(v, 5) for v in dup.dimensions]
    objects.append({
        "object": obj.name,
        "file": file,
        "collection": collection_of(obj),
        "verts": len(dup.data.vertices),
        "tris": sum(len(polygon.vertices) - 2 for polygon in dup.data.polygons),
        "bbox": [dims[0], dims[2], dims[1]],
        "materials": [slot.material.name for slot in obj.material_slots if slot.material],
        "modifiers": [modifier.type for modifier in obj.modifiers],
        "mirrored": mirrored,
        "bytes": os.path.getsize(os.path.join(OUT, file)),
        "hidden": bool(obj.hide_get() or obj.hide_render or obj.hide_viewport),
        "translation": None if node is None else [round((a - b) * SCALE, 5) for a, b in zip(node.get("translation", [0, 0, 0]), origin)],
        "rotation": None if node is None else [round(v, 5) for v in node.get("rotation", [0, 0, 0, 1])],
        "placed": node is not None,
    })
    bpy.data.objects.remove(dup, do_unlink=True)

materials = {slot.material.name for obj in meshes for slot in obj.material_slots if slot.material}
json.dump({
    "source": os.path.basename(FILE),
    "format": FORMAT,
    "decoder": f"blender {bpy.app.version_string}",
    "unit": SCALE,
    "declared": declared,
    "up": UP or ("Z" if FORMAT in ("blend", "stl") else "Y"),
    "recentre": RECENTRE,
    "strays": strays,
    "hidden": sum(1 for o in objects if o["hidden"]),
    "empties": [o.name for o in scene.objects if o.type == "EMPTY"],
    "others": sorted({o.type for o in scene.objects if o.type not in ("MESH", "EMPTY")}),
    "meshes": len(objects),
    "materials": len(materials),
    "animations": len(bpy.data.actions),
    "triangles": sum(o["tris"] for o in objects),
    "objects": objects,
}, open(os.path.join(OUT, "harvest.json"), "w"), indent=1)
print("HARVESTED", len(objects), "→", OUT)
