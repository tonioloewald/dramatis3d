# The sample scene: the first character in res://characters/ walking UAL's
# Walk_Loop (Quaternius, CC0). Open the project in Godot 4.5 and press Play.
#
# What a Godot user does with a Dramatis export, and nothing more: the
# character is the editor's default glTF import; the clip is UAL's own file,
# its tracks pointed at the character's Skeleton3D by bone name. The
# skeleton's rest frames are UAL's (the export profile), so the keys play
# unchanged. Rotations go on every bone, translations on root and pelvis only,
# the pelvis's scaled by the ratio of the hips' heights.
extends Node3D

const CLIP := "res://animations/ual-walk.glb"


func _ready() -> void:
	var path := _first_character()
	if path == "":
		push_warning("No .glb in res://characters/: run tools/engines/godot.ts or drop an export there.")
		return
	var character: Node3D = (load(path) as PackedScene).instantiate()
	add_child(character)
	var skel: Skeleton3D = character.find_children("*", "Skeleton3D", true, false)[0]
	var clip_scene: Node = (load(CLIP) as PackedScene).instantiate()
	var src_player: AnimationPlayer = clip_scene.find_child("AnimationPlayer", true, false)
	var src: Animation = src_player.get_animation(src_player.get_animation_list()[0])
	var src_hips := source_hips_height(clip_scene)
	clip_scene.free()

	var walk := retarget(src, character.get_path_to(skel), skel, src_hips)
	var lib := AnimationLibrary.new()
	lib.add_animation(&"walk", walk)
	var player := AnimationPlayer.new()
	character.add_child(player)
	player.root_node = NodePath("..")
	player.add_animation_library(&"ual", lib)
	player.play(&"ual/walk")


## `-- <file>.glb` on the command line picks one; otherwise the first.
func _first_character() -> String:
	for a in OS.get_cmdline_user_args():
		if a.ends_with(".glb"):
			return "res://characters/" + a.get_file()
	for f in DirAccess.get_files_at("res://characters"):
		if f.ends_with(".glb"):
			return "res://characters/" + f
	return ""


## The bone for a UE joint name: as is, or with the Mixamo prefix Godot
## makes of `mixamorig:` (it replaces ':' in bone names with '_').
static func bone_for(skel: Skeleton3D, ue: String) -> int:
	var i := skel.find_bone(ue)
	if i == -1:
		i = skel.find_bone("mixamorig_" + MIXAMO.get(ue, ue))
	return i


## The pelvis's rest height in UAL's own armature (the clip file's scene,
## not yet in the tree: the transforms are multiplied up by hand).
static func source_hips_height(clip_scene: Node) -> float:
	var p: Node = clip_scene.find_child("pelvis", true, false)
	var t := Transform3D()
	while p is Node3D:
		t = (p as Node3D).transform * t
		p = p.get_parent()
	return t.origin.y


static func retarget(src: Animation, skel_path: NodePath, skel: Skeleton3D, src_hips: float) -> Animation:
	var pelvis := bone_for(skel, "pelvis")
	var hips := (skel.get_bone_global_rest(pelvis).origin).y
	var ratio := hips / src_hips if src_hips > 0.0 else 1.0
	var a := Animation.new()
	a.length = src.length
	a.loop_mode = Animation.LOOP_LINEAR
	for t in range(src.get_track_count()):
		var joint := String(src.track_get_path(t)).get_file()
		var type := src.track_get_type(t)
		var is_pos := type == Animation.TYPE_POSITION_3D
		if not (type == Animation.TYPE_ROTATION_3D or (is_pos and (joint == "root" or joint == "pelvis"))):
			continue
		var bone := bone_for(skel, joint)
		if bone == -1:
			continue
		var nt := a.add_track(type)
		a.track_set_path(nt, NodePath("%s:%s" % [skel_path, skel.get_bone_name(bone)]))
		for k in range(src.track_get_key_count(t)):
			var v: Variant = src.track_get_key_value(t, k)
			if is_pos and joint == "pelvis":
				v = v * ratio
			a.track_insert_key(nt, src.track_get_key_time(t, k), v)
	return a


const MIXAMO := {
	"pelvis": "Hips", "spine_01": "Spine", "spine_02": "Spine1", "spine_03": "Spine2",
	"neck_01": "Neck", "Head": "Head",
	"clavicle_l": "LeftShoulder", "upperarm_l": "LeftArm", "lowerarm_l": "LeftForeArm", "hand_l": "LeftHand",
	"clavicle_r": "RightShoulder", "upperarm_r": "RightArm", "lowerarm_r": "RightForeArm", "hand_r": "RightHand",
	"thigh_l": "LeftUpLeg", "calf_l": "LeftLeg", "foot_l": "LeftFoot", "ball_l": "LeftToeBase", "ball_leaf_l": "LeftToe_End",
	"thigh_r": "RightUpLeg", "calf_r": "RightLeg", "foot_r": "RightFoot", "ball_r": "RightToeBase", "ball_leaf_r": "RightToe_End",
	"thumb_01_l": "LeftHandThumb1", "thumb_02_l": "LeftHandThumb2", "thumb_03_l": "LeftHandThumb3", "thumb_04_leaf_l": "LeftHandThumb4",
	"index_01_l": "LeftHandIndex1", "index_02_l": "LeftHandIndex2", "index_03_l": "LeftHandIndex3", "index_04_leaf_l": "LeftHandIndex4",
	"middle_01_l": "LeftHandMiddle1", "middle_02_l": "LeftHandMiddle2", "middle_03_l": "LeftHandMiddle3", "middle_04_leaf_l": "LeftHandMiddle4",
	"ring_01_l": "LeftHandRing1", "ring_02_l": "LeftHandRing2", "ring_03_l": "LeftHandRing3", "ring_04_leaf_l": "LeftHandRing4",
	"pinky_01_l": "LeftHandPinky1", "pinky_02_l": "LeftHandPinky2", "pinky_03_l": "LeftHandPinky3", "pinky_04_leaf_l": "LeftHandPinky4",
	"thumb_01_r": "RightHandThumb1", "thumb_02_r": "RightHandThumb2", "thumb_03_r": "RightHandThumb3", "thumb_04_leaf_r": "RightHandThumb4",
	"index_01_r": "RightHandIndex1", "index_02_r": "RightHandIndex2", "index_03_r": "RightHandIndex3", "index_04_leaf_r": "RightHandIndex4",
	"middle_01_r": "RightHandMiddle1", "middle_02_r": "RightHandMiddle2", "middle_03_r": "RightHandMiddle3", "middle_04_leaf_r": "RightHandMiddle4",
	"ring_01_r": "RightHandRing1", "ring_02_r": "RightHandRing2", "ring_03_r": "RightHandRing3", "ring_04_leaf_r": "RightHandRing4",
	"pinky_01_r": "RightHandPinky1", "pinky_02_r": "RightHandPinky2", "pinky_03_r": "RightHandPinky3", "pinky_04_leaf_r": "RightHandPinky4",
}
