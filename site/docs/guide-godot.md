# Godot

<!--{"parent": "docs", "order": 21}-->

A Dramatis export is a plain GLB, so Godot 4 imports it with its own glTF
importer and no add-ons. Checked with **Godot 4.5** on every sample export
(spike 1, `reports/spike-1.md`): skeleton, skins, blend shapes, materials and
a third-party animation all come through with default import settings.

## Import

Drop the `.glb` into your project. Godot makes a scene:

```
character (Node3D)
  Skeleton3D            65 bones: root, pelvis, spine_01 ... (UE mannequin names)
    body                MeshInstance3D, skinned, the face units as blend shapes
    eyes, eyelashes, teeth, tongue, brows, hair
    garment_<asset>     one per garment, skinned to the same skeleton
```

- Metres, Y up, the character facing +Z with its left hand on +X, feet on
  the floor. No rotation or scale to fix.
- **Mixamo-named exports:** Godot does not allow `:` in bone names, so
  `mixamorig:Hips` becomes `mixamorig_Hips` (all 64 Mixamo bones). Look
  bones up by the underscore name.
- The import log shows `UVs are required to generate tangents` once per
  blend shape on the meshes that carry no UVs yet (body, eyes, eyelashes).
  It is harmless: those meshes are untextured today. It goes away when the
  baked skin texture lands.

## Facial expressions and lip sync

The 59 face units (MakeHuman's pose units, named as in the
[export format](/export-format/)) are blend shapes. One unit can be on several
meshes (`JawDrop` moves the body, the teeth and the tongue): set it on all
of them.

```gdscript
func set_unit(character: Node, unit: String, value: float) -> void:
	for mi in character.find_children("*", "MeshInstance3D", true, false):
		var i: int = mi.find_blend_shape_by_name(unit)
		if i != -1:
			mi.set_blend_shape_value(i, value)
```

## Playing UAL (and other UE-mannequin) animations

The skeleton's rest frames are those of Quaternius' Universal Animation
Library, so UAL's clips play **by bone name with no retargeting**. Import
UAL's GLB, then point its tracks at your character's `Skeleton3D`. Keep the
rotation tracks for every bone and the position tracks for `root` and
`pelvis` only (the others hold UAL's own bone lengths), scaling the
pelvis's by the ratio of the hips' heights so a tall or short character
keeps its feet on the floor:

```gdscript
static func retarget(src: Animation, skel_path: NodePath, skel: Skeleton3D, src_hips: float) -> Animation:
	var hips := skel.get_bone_global_rest(skel.find_bone("pelvis")).origin.y
	var a := Animation.new()
	a.length = src.length
	a.loop_mode = Animation.LOOP_LINEAR
	for t in src.get_track_count():
		var joint := String(src.track_get_path(t)).get_file()   # "Armature/root/pelvis" -> "pelvis"
		var type := src.track_get_type(t)
		var is_pos := type == Animation.TYPE_POSITION_3D
		if not (type == Animation.TYPE_ROTATION_3D or (is_pos and joint in ["root", "pelvis"])):
			continue
		if skel.find_bone(joint) == -1:
			continue
		var nt := a.add_track(type)
		a.track_set_path(nt, NodePath("%s:%s" % [skel_path, joint]))
		for k in src.track_get_key_count(t):
			var v = src.track_get_key_value(t, k)
			if is_pos and joint == "pelvis":
				v *= hips / src_hips
			a.track_insert_key(nt, src.track_get_key_time(t, k), v)
	return a
```

The complete, runnable version (with Mixamo names) is
`samples/godot/scripts/main.gd`; open `samples/godot` and press Play.

Two importer behaviours to know when importing UAL's file:

- A clip named `Walk_Loop` arrives as **`Walk`**, set to loop: Godot reads
  a `_Loop` (or `-loop`) suffix as a loop flag and strips it.
- **Remove Immutable Tracks** (on by default) drops tracks that hold a bone
  at one value, such as UAL's `spine_01` in the walk. On a Dramatis export
  that is harmless (the held value is the shared rest), but turn it off in
  the clip's import settings if you retarget to a skeleton with other rest
  frames. The sample does.

Godot's own retargeting (the import dock's **Retarget > Bone Map** with
`SkeletonProfileHumanoid`) also works for clips from other skeletons; it is
not needed for UAL.

## Materials

Each mesh gets a `StandardMaterial3D`: base colour and texture, roughness,
metallic. Hair, brows and teeth use alpha scissor (glTF `MASK`). The
creator's skin scattering and hair shading do not travel; the eyes are a
flat colour until the baked eye texture lands (spike 2).
