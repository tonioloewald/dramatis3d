# Blender as a second opinion on Dramatis exports (spike 1). Run by
# tools/engines/blender.ts:
#
#   Blender --background --factory-startup --python tools/engines/blender_check.py \
#     -- <expect.json> <results.json>
#
# expect.json is written by the runner from the export profile. Each export is
# imported with Blender's bundled glTF importer at its defaults, into an empty
# scene, and checked: the armature, the vertex weights, the shape keys, rest
# skinning, a posed limb, and UAL's Walk_Loop played on it. Nothing is fixed
# up: what the importer gives is what is checked.

import json
import math
import sys
import traceback

import bpy
from mathutils import Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
EXPECT = json.load(open(argv[0]))
OUT = argv[1]


def result(name, ok, evidence):
    return {"check": name, "ok": bool(ok), "evidence": evidence}


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def names_for(naming):
    return {
        j["name"]: (j["name"] if naming == "ue" else j["mixamo"])
        for j in EXPECT["joints"]
    }


def evaluated_coords(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    mesh = ev.to_mesh()
    m = obj.matrix_world
    coords = [m @ v.co for v in mesh.vertices]
    ev.to_mesh_clear()
    return coords


def fcurves_of(action, slot=None):
    """Every F-curve of an action, legacy or layered (Blender 4.4+)."""
    if hasattr(action, "layers") and len(action.layers) > 0:
        out = []
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    if slot is None or bag.slot == slot:
                        out.extend(bag.fcurves)
        return out
    return list(getattr(action, "fcurves", []))


def check_character(c):
    out = {"file": c["file"], "naming": c["naming"], "checks": []}
    checks = out["checks"]
    clear()
    try:
        objs = import_glb(c["path"])
    except Exception as e:  # noqa: BLE001
        checks.append(result("import", False, [f"import failed: {e}"]))
        return out
    arms = [o for o in objs if o.type == "ARMATURE"]
    # The importer adds an Icosphere as the bones' display shape: not ours.
    meshes = [o for o in objs if o.type == "MESH" and any(md.type == "ARMATURE" for md in o.modifiers)]
    checks.append(
        result(
            "import",
            len(arms) == 1 and len(meshes) > 0,
            [f"{len(arms)} armature, {len(meshes)} meshes: {', '.join(sorted(m.name for m in meshes))}"],
        )
    )
    if len(arms) != 1:
        return out
    arm = arms[0]
    names = names_for(c["naming"])

    # --- armature
    problems = []
    bones = arm.data.bones
    if len(bones) != len(EXPECT["joints"]):
        problems.append(f"{len(bones)} bones, expected {len(EXPECT['joints'])}")
    for j in EXPECT["joints"]:
        n = names[j["name"]]
        b = bones.get(n)
        if b is None:
            problems.append(f"no bone {n}")
            continue
        want = None if j["parent"] is None else names[j["parent"]]
        have = b.parent.name if b.parent else None
        if have != want:
            problems.append(f"{n}'s parent is {have}, expected {want}")
    checks.append(result("armature", not problems, [f"{len(bones)} bones; names kept as in the file"] + problems[:8]))

    # --- axes (Blender is Z up: the importer turns glTF's +Y up into +Z)
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    head = mw @ bones[names["Head"]].head_local
    hl = mw @ bones[names["hand_l"]].head_local
    foot = mw @ bones[names["foot_l"]].head_local
    ball = mw @ bones[names["ball_l"]].head_local
    lowest = min(min(v.z for v in evaluated_coords(m)) for m in meshes)
    ap = []
    if not (1.0 < head.z < 2.5):
        ap.append(f"head at z={head.z:.3f}")
    if not hl.x > 0.3:
        ap.append(f"left hand at x={hl.x:.3f}, not +X")
    # glTF +Z (forward) becomes Blender -Y.
    if not ball.y < foot.y:
        ap.append("toes not ahead of the ankle along Blender -Y (glTF +Z)")
    checks.append(
        result(
            "axes",
            not ap,
            [f"Head {tuple(round(x, 3) for x in head)}, hand_l {tuple(round(x, 3) for x in hl)}, lowest vertex z={lowest * 1000:.1f} mm (Blender Z up)"] + ap,
        )
    )

    # --- weights
    problems = []
    over4 = 0
    badsum = 0
    total = 0
    for m in meshes:
        mods = [md for md in m.modifiers if md.type == "ARMATURE"]
        if not mods or mods[0].object != arm:
            problems.append(f"{m.name}: no Armature modifier on the armature")
        group_names = {g.index: g.name for g in m.vertex_groups}
        unknown = [g for g in group_names.values() if g not in bones]
        if unknown:
            problems.append(f"{m.name}: vertex groups not bones: {unknown[:3]}")
        for v in m.data.vertices:
            ws = [g.weight for g in v.groups if g.weight > 0]
            total += 1
            if len(ws) > 4:
                over4 += 1
            if abs(sum(ws) - 1.0) > 0.01:
                badsum += 1
    if over4:
        problems.append(f"{over4} vertices with more than 4 weights")
    if badsum:
        problems.append(f"{badsum} vertices whose weights do not sum to 1")
    checks.append(result("weights", not problems, [f"{total} vertices across {len(meshes)} meshes"] + problems[:8]))

    # --- shape keys
    problems = []
    seen = set()
    ev = []
    jaw = 0.0
    for m in meshes:
        keys = m.data.shape_keys
        if keys is None:
            continue
        blocks = [k for k in keys.key_blocks if k != keys.reference_key]
        ev.append(f"{m.name}: {len(blocks)} shape keys")
        for k in blocks:
            seen.add(k.name)
            if k.name not in c["faceUnits"]:
                problems.append(f"{m.name}: shape key {k.name} is not a face unit")
        jd = keys.key_blocks.get("JawDrop")
        if m.name == "body" and jd is not None:
            base = keys.reference_key.data
            jaw = max((jd.data[i].co - base[i].co).length for i in range(len(base)))
    missing = [u for u in c["faceUnits"] if u not in seen]
    if missing:
        problems.append(f"{len(missing)} face units on no mesh: {missing[:4]}")
    if jaw < 0.002:
        problems.append(f"JawDrop moves the body by {jaw * 1000:.2f} mm")
    ev.append(f"{len(seen)} distinct face units as shape keys (file declares {len(c['faceUnits'])}); JawDrop moves the body up to {jaw * 1000:.1f} mm")
    checks.append(result("shape-keys", not problems, ev + problems))

    # --- rest skinning and a posed arm
    body = next((m for m in meshes if m.name == "body"), meshes[0])
    rest = [body.matrix_world @ v.co for v in body.data.vertices]
    now = evaluated_coords(body)
    drift = max((a - b).length for a, b in zip(rest, now))
    pb = arm.pose.bones[names["upperarm_l"]]
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = Quaternion((1, 0, 0), math.radians(45)) @ pb.rotation_quaternion
    bpy.context.view_layer.update()
    posed = evaluated_coords(body)
    pb.rotation_quaternion = Quaternion()
    bpy.context.view_layer.update()
    gi = body.vertex_groups.get(names["hand_l"]).index
    # The head must not move when an arm turns (feet under shoes are cut from the body).
    fi = body.vertex_groups.get(names["Head"]).index
    hand_v = [v.index for v in body.data.vertices if any(g.group == gi and g.weight > 0.5 for g in v.groups)]
    head_v = [v.index for v in body.data.vertices if any(g.group == fi and g.weight > 0.5 for g in v.groups)]
    hand_move = max((posed[i] - rest[i]).length for i in hand_v) if hand_v else 0
    head_move = max((posed[i] - rest[i]).length for i in head_v) if head_v else 1
    sp = []
    if drift > 0.0005:
        sp.append(f"rest pose moves the body by {drift * 1000:.2f} mm")
    if hand_move < 0.05:
        sp.append(f"turning upperarm_l 45 degrees moves the hand by {hand_move * 100:.1f} cm")
    if head_move > 0.0005:
        sp.append(f"turning upperarm_l moves the head by {head_move * 1000:.2f} mm")
    checks.append(
        result(
            "skinning",
            not sp,
            [f"rest drift {drift * 1000:.4f} mm; upperarm_l +45 deg moves {len(hand_v)} hand vertices up to {hand_move * 100:.1f} cm and the head {head_move * 1000:.3f} mm"] + sp,
        )
    )

    # --- the UAL clip
    checks.append(check_clip(c, names))
    return out


def check_clip(c, names):
    """UAL's Walk_Loop on the export, as Blender's importer reads a glTF
    animation on the export's own joints: the runner spliced UAL's keys into
    a copy of the export by joint name (tools/engines/splice-clip.ts), since
    Blender imports UAL's skinless clip file as empties, not an armature."""
    clear()
    objs = import_glb(c["walkPath"])
    arm = next((o for o in objs if o.type == "ARMATURE"), None)
    body = next((o for o in objs if o.type == "MESH" and o.name == "body"), None)
    if arm is None or body is None:
        return result("clip", False, ["the spliced file imported with no armature or no body"])
    ad = arm.animation_data
    action = ad.action if ad else None
    if action is None and ad is not None:
        for t in ad.nla_tracks:
            for st in t.strips:
                action = st.action
        if action is not None:
            ad.action = action
    if action is None:
        return result("clip", False, ["the armature has no action after import"])
    f0, f1 = (int(x) for x in action.frame_range)
    scene = bpy.context.scene
    tracked = ["Head", "hand_l", "hand_r", "foot_l", "foot_r"]
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    rest = {ue: (arm.matrix_world @ arm.pose.bones[names[ue]].head).copy() for ue in tracked}
    body_rest = evaluated_coords(body)
    lowest_rest = min(v.z for v in body_rest)
    arm.data.pose_position = "POSE"
    travel = {ue: 0.0 for ue in tracked}
    vmove = 0.0
    lowest = 1e9
    gi = body.vertex_groups.get(names["hand_l"]).index
    hand_v = [v.index for v in body.data.vertices if any(g.group == gi and g.weight > 0.5 for g in v.groups)][:50]
    for f in range(f0, f1 + 1, max(1, (f1 - f0) // 12)):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        for ue in tracked:
            p = arm.matrix_world @ arm.pose.bones[names[ue]].head
            travel[ue] = max(travel[ue], (p - rest[ue]).length)
        co = evaluated_coords(body)
        lowest = min(lowest, min(v.z for v in co))
        for i in hand_v:
            vmove = max(vmove, (co[i] - body_rest[i]).length)
    problems = [f"{ue} travels {travel[ue] * 100:.1f} cm" for ue in tracked if travel[ue] < 0.01]
    if vmove < 0.01:
        problems.append(f"hand vertices travel {vmove * 100:.1f} cm")
    return result(
        "clip",
        not problems,
        [
            f"action {action.name}, frames {f0}-{f1}",
            "travel (cm): " + ", ".join(f"{ue} {travel[ue] * 100:.1f}" for ue in tracked),
            f"{len(hand_v)} hand_l body vertices travel up to {vmove * 100:.1f} cm",
            f"lowest body vertex during the walk {lowest * 100:.1f} cm (at rest {lowest_rest * 100:.1f} cm)",
        ]
        + problems,
    )


results = []
for c in EXPECT["characters"]:
    try:
        results.append(check_character(c))
    except Exception:  # noqa: BLE001
        results.append({"file": c["file"], "naming": c["naming"], "checks": [result("script", False, traceback.format_exc().splitlines()[-6:])]})
json.dump({"blender": bpy.app.version_string, "characters": results}, open(OUT, "w"), indent=2)
