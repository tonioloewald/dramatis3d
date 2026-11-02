# The Godot import check for Dramatis exports (spike 1). Run headless after
# an import pass, by tools/engines/godot.ts:
#
#   Godot --headless --path samples/godot --import
#   Godot --headless --path samples/godot --script res://scripts/check.gd
#
# It reads res://expect.json (written by the runner from the export profile,
# src/contracts/profile.ts) and writes res://results.json: per character, a
# list of checks, each with `ok` and the evidence. It changes nothing in the
# imported files and applies no fixes: what Godot's default glTF import gives
# is what is checked.
extends SceneTree

const Sample := preload("res://scripts/main.gd")

const ARRAY_VERTEX := Mesh.ARRAY_VERTEX
const ARRAY_BONES := Mesh.ARRAY_BONES
const ARRAY_WEIGHTS := Mesh.ARRAY_WEIGHTS

var expect: Dictionary
var results: Array = []


var done := false


# The work runs on the first frame, once the root window is in the tree
# (skeleton global poses are only recomputed for nodes inside it).
func _process(_delta: float) -> bool:
	if done:
		return true
	done = true
	_run()
	return true


func _run() -> void:
	var text := FileAccess.get_file_as_string("res://expect.json")
	expect = JSON.parse_string(text)
	var clip := _load_clip(expect["clip"])
	for c in expect["characters"]:
		results.append(_check_character(c, clip))
	var f := FileAccess.open("res://results.json", FileAccess.WRITE)
	f.store_string(JSON.stringify({
		"godot": Engine.get_version_info()["string"],
		"clip": expect["clip"],
		"characters": results,
	}, "  "))
	f.close()
	quit()
	return


# --- the clip ---------------------------------------------------------------

## The first animation in the imported UAL clip file, and the joint each of
## its tracks drives (the last element of the track's node path).
func _load_clip(path: String) -> Dictionary:
	var scene: PackedScene = load(path)
	if scene == null:
		return {"error": "could not load %s" % path}
	var inst := scene.instantiate()
	var ap: AnimationPlayer = inst.find_child("AnimationPlayer", true, false)
	if ap == null or ap.get_animation_list().is_empty():
		inst.free()
		return {"error": "no AnimationPlayer with an animation in %s" % path}
	var name: String = ap.get_animation_list()[0]
	var anim: Animation = ap.get_animation(name)
	var hips := Sample.source_hips_height(inst)
	inst.free()
	return {"name": name, "animation": anim, "hips": hips}


# --- one character ----------------------------------------------------------

func _check_character(c: Dictionary, clip: Dictionary) -> Dictionary:
	var out := {"file": c["file"], "naming": c["naming"], "checks": []}
	var checks: Array = out["checks"]
	var scene: PackedScene = load(c["path"])
	if scene == null:
		checks.append(_result("import", false, ["Godot did not import %s" % c["path"]]))
		return out
	var inst: Node3D = scene.instantiate()
	root.add_child(inst)
	checks.append(_result("import", true, ["imported as a PackedScene, root %s" % inst.get_class()]))

	var skeletons := inst.find_children("*", "Skeleton3D", true, false)
	var meshes := inst.find_children("*", "MeshInstance3D", true, false)
	if skeletons.size() != 1:
		checks.append(_result("skeleton", false, ["expected 1 Skeleton3D, found %d" % skeletons.size()]))
		inst.queue_free()
		return out
	var skel: Skeleton3D = skeletons[0]

	var names := _expected_names(c["naming"])
	var renamed := {}
	checks.append(_check_skeleton(skel, names, renamed))
	out["renamed"] = renamed
	checks.append(_check_axes(skel, names))
	checks.append(_check_skins(skel, meshes))
	checks.append(_check_rest_skinning(skel, meshes))
	checks.append(_check_morphs(meshes, c["faceUnits"], c["path"]))
	checks.append(_check_materials(meshes))
	checks.append(_check_clip(inst, skel, meshes, names, clip))

	root.remove_child(inst)
	inst.free()
	return out


func _result(name: String, ok: bool, evidence: Array) -> Dictionary:
	return {"check": name, "ok": ok, "evidence": evidence}


## UE joint name -> the name the file uses (UE or Mixamo).
func _expected_names(naming: String) -> Dictionary:
	var m := {}
	for j in expect["joints"]:
		m[j["name"]] = j["name"] if naming == "ue" else j["mixamo"]
	return m


## The bone Godot made for a joint, by the file's name, or by that name as
## Godot sanitises it (':' and '/' are not allowed in bone names).
func _bone(skel: Skeleton3D, file_name: String) -> int:
	var i := skel.find_bone(file_name)
	if i == -1:
		i = skel.find_bone(file_name.replace(":", "_").replace("/", "_"))
	return i


func _check_skeleton(skel: Skeleton3D, names: Dictionary, renamed: Dictionary) -> Dictionary:
	var problems: Array = []
	if skel.get_bone_count() != expect["joints"].size():
		problems.append("%d bones, expected %d" % [skel.get_bone_count(), expect["joints"].size()])
	for j in expect["joints"]:
		var want: String = names[j["name"]]
		var i := _bone(skel, want)
		if i == -1:
			problems.append("no bone for %s" % want)
			continue
		if skel.get_bone_name(i) != want:
			renamed[want] = skel.get_bone_name(i)
		var p := skel.get_bone_parent(i)
		if j["parent"] == null:
			if p != -1:
				problems.append("%s has parent %s, expected none" % [want, skel.get_bone_name(p)])
		else:
			var pi := _bone(skel, names[j["parent"]])
			if p != pi:
				problems.append("%s's parent is %s, expected %s" % [want, skel.get_bone_name(p) if p >= 0 else "none", names[j["parent"]]])
	var ev: Array = ["%d bones" % skel.get_bone_count()]
	if not renamed.is_empty():
		ev.append("Godot renamed %d bones, e.g. %s -> %s" % [renamed.size(), renamed.keys()[0], renamed.values()[0]])
	return _result("skeleton", problems.is_empty(), ev + problems)


func _global(skel: Skeleton3D, names: Dictionary, ue: String) -> Vector3:
	return skel.transform * skel.get_bone_global_pose(_bone(skel, names[ue])).origin


func _check_axes(skel: Skeleton3D, names: Dictionary) -> Dictionary:
	skel.force_update_all_bone_transforms()
	var head := _global(skel, names, "Head")
	var hl := _global(skel, names, "hand_l")
	var hr := _global(skel, names, "hand_r")
	var foot := _global(skel, names, "foot_l")
	var ball := _global(skel, names, "ball_l")
	var rootp := _global(skel, names, "root")
	var problems: Array = []
	if head.y < 1.0 or head.y > 2.5:
		problems.append("head at y=%.3f m: not metres, Y up" % head.y)
	if not (hl.x > 0.3 and hr.x < -0.3):
		problems.append("hands at x=%.3f / %.3f: left hand not on +X (or not a T-pose)" % [hl.x, hr.x])
	if abs(hl.y - hr.y) > 0.02 or abs(hl.y - head.y) > 0.5:
		problems.append("hands not level at shoulder height (y %.3f, %.3f)" % [hl.y, hr.y])
	if ball.z <= foot.z:
		problems.append("toes behind the ankle: not facing +Z")
	if rootp.length() > 0.001:
		problems.append("root joint at %s, not the origin" % rootp)
	return _result("axes", problems.is_empty(), [
		"Head %s, hand_l %s, hand_r %s, foot_l %s, ball_l %s (metres, Godot world)" % [head, hl, hr, foot, ball]
	] + problems)


## Every mesh is skinned to the one skeleton and every bind resolves to a bone.
func _check_skins(skel: Skeleton3D, meshes: Array) -> Dictionary:
	var problems: Array = []
	var ev: Array = []
	for mi: MeshInstance3D in meshes:
		if mi.skin == null:
			problems.append("%s has no skin" % mi.name)
			continue
		if mi.get_node_or_null(mi.skeleton) != skel:
			problems.append("%s's skeleton path %s is not the Skeleton3D" % [mi.name, mi.skeleton])
		var unresolved := 0
		for b in range(mi.skin.get_bind_count()):
			if _bind_bone(skel, mi.skin, b) == -1:
				unresolved += 1
		if unresolved > 0:
			problems.append("%s: %d of %d binds name no bone" % [mi.name, unresolved, mi.skin.get_bind_count()])
	ev.append("%d MeshInstance3D: %s" % [meshes.size(), ", ".join(meshes.map(func(m): return str(m.name)))])
	return _result("skins", problems.is_empty() and meshes.size() > 0, ev + problems)


func _bind_bone(skel: Skeleton3D, skin: Skin, b: int) -> int:
	var n := skin.get_bind_name(b)
	if n != &"":
		return skel.find_bone(n)
	return skin.get_bind_bone(b)


## Linear-blend skinning on the CPU, as Godot's renderer does it: the bind's
## bone global pose times the skin's bind pose, weighted. The headless
## renderer does not skin, so this is how the check sees the deformed mesh.
func _skin_matrices(skel: Skeleton3D, skin: Skin) -> Array:
	var m: Array = []
	for b in range(skin.get_bind_count()):
		var bone := _bind_bone(skel, skin, b)
		m.append(skel.get_bone_global_pose(bone) * skin.get_bind_pose(b) if bone >= 0 else Transform3D())
	return m


func _skinned(arrays: Array, mats: Array, v: int) -> Vector3:
	var pos: Vector3 = arrays[ARRAY_VERTEX][v]
	var bones: PackedInt32Array = arrays[ARRAY_BONES]
	var weights: PackedFloat32Array = arrays[ARRAY_WEIGHTS]
	var per: int = bones.size() / arrays[ARRAY_VERTEX].size()
	var acc := Vector3.ZERO
	for k in range(per):
		var w := weights[v * per + k]
		if w > 0.0:
			acc += w * (mats[bones[v * per + k]] * pos)
	return acc


## At the rest pose, skinning must leave every vertex where it is: the
## inverse bind matrices agree with the joints' rest transforms.
func _check_rest_skinning(skel: Skeleton3D, meshes: Array) -> Dictionary:
	skel.reset_bone_poses()
	skel.force_update_all_bone_transforms()
	var worst := 0.0
	var worst_mesh := ""
	var counted := 0
	var influences := 0
	var problems: Array = []
	for mi: MeshInstance3D in meshes:
		if mi.skin == null:
			continue
		var mats := _skin_matrices(skel, mi.skin)
		for s in range(mi.mesh.get_surface_count()):
			var arrays := mi.mesh.surface_get_arrays(s)
			var n: int = arrays[ARRAY_VERTEX].size()
			influences = max(influences, arrays[ARRAY_BONES].size() / n)
			var weights: PackedFloat32Array = arrays[ARRAY_WEIGHTS]
			var per: int = weights.size() / n
			var step: int = max(1, n / 2000)
			for v in range(0, n, step):
				var sum := 0.0
				for k in range(per):
					sum += weights[v * per + k]
				if abs(sum - 1.0) > 0.01:
					problems.append("%s vertex %d: weights sum to %.3f" % [mi.name, v, sum])
					break
				var d := _skinned(arrays, mats, v).distance_to(arrays[ARRAY_VERTEX][v])
				counted += 1
				if d > worst:
					worst = d
					worst_mesh = mi.name
	if worst > 0.0005:
		problems.append("rest-pose skinning moves %s by %.2f mm" % [worst_mesh, worst * 1000.0])
	return _result("rest-skinning", problems.is_empty() and counted > 0, [
		"%d vertices sampled; worst rest-pose drift %.4f mm (%s); %d influences per vertex as Godot stores them" % [counted, worst * 1000.0, worst_mesh, influences]
	] + problems.slice(0, 5))


func _check_morphs(meshes: Array, face_units: Array, path: String) -> Dictionary:
	var seen := {}
	var problems: Array = []
	var ev: Array = []
	var jaw := 0.0
	for mi: MeshInstance3D in meshes:
		var mesh: ArrayMesh = mi.mesh
		var count := mesh.get_blend_shape_count()
		if count == 0:
			continue
		var list: Array = []
		for i in range(count):
			var n := String(mesh.get_blend_shape_name(i))
			list.append(n)
			seen[n] = true
			if not face_units.has(n):
				problems.append("%s: blend shape %s is not a face unit of the file" % [mi.name, n])
		ev.append("%s: %d blend shapes" % [mi.name, count])
		# The blend shape works: JawDrop moves the body's vertices.
		if mi.name == "body":
			var idx := mi.find_blend_shape_by_name("JawDrop")
			if idx == -1:
				problems.append("body has no JawDrop")
			else:
				mi.set_blend_shape_value(idx, 1.0)
				if mi.get_blend_shape_value(idx) != 1.0:
					problems.append("set_blend_shape_value(JawDrop) did not stick")
				mi.set_blend_shape_value(idx, 0.0)
	# The headless (dummy) renderer keeps no blend shape data, so the deltas
	# are read from the same file through Godot's own glTF parser instead.
	jaw = _blend_delta(path, "body", "JawDrop")
	for u in face_units:
		if not seen.has(u):
			problems.append("face unit %s is on no mesh" % u)
	if jaw < 0.002:
		problems.append("JawDrop moves the body by only %.2f mm" % (jaw * 1000.0))
	ev.append("%d distinct face units as blend shapes (file declares %d); JawDrop moves the body up to %.1f mm" % [seen.size(), face_units.size(), jaw * 1000.0])
	return _result("morphs", problems.is_empty(), ev + problems.slice(0, 8))


## The largest vertex movement of one blend shape, as Godot's GLTFDocument
## parses it (the ImporterMesh the editor import is made from).
func _blend_delta(path: String, mesh_name: String, shape: String) -> float:
	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	if doc.append_from_file(ProjectSettings.globalize_path(path), state) != OK:
		return -1.0
	for node: GLTFNode in state.get_nodes():
		if node.original_name != mesh_name or node.mesh < 0:
			continue
		var im: ImporterMesh = state.get_meshes()[node.mesh].mesh
		for i in range(im.get_blend_shape_count()):
			if im.get_blend_shape_name(i) != shape:
				continue
			var base: PackedVector3Array = im.get_surface_arrays(0)[ARRAY_VERTEX]
			var moved: PackedVector3Array = im.get_surface_blend_shape_arrays(0, i)[ARRAY_VERTEX]
			var worst := 0.0
			for v in range(base.size()):
				worst = max(worst, base[v].distance_to(moved[v]))
			return worst
	return -1.0


func _check_materials(meshes: Array) -> Dictionary:
	var ev: Array = []
	var problems: Array = []
	for mi: MeshInstance3D in meshes:
		for s in range(mi.mesh.get_surface_count()):
			var m := mi.get_active_material(s)
			if m == null:
				problems.append("%s surface %d has no material" % [mi.name, s])
				continue
			var line := "%s: %s" % [mi.name, m.get_class()]
			if m is BaseMaterial3D:
				var bm: BaseMaterial3D = m
				line += " albedo %s" % bm.albedo_color.to_html(false)
				if bm.albedo_texture != null:
					line += " texture %dx%d" % [bm.albedo_texture.get_width(), bm.albedo_texture.get_height()]
				if bm.transparency == BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR:
					line += " alpha-scissor %.2f" % bm.alpha_scissor_threshold
				elif bm.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
					line += " transparency %d" % bm.transparency
			ev.append(line)
	return _result("materials", problems.is_empty(), ev + problems)


# --- the clip on the character ------------------------------------------------

## The clip as the sample plays it (main.gd's retarget): each track's last
## node-path element is a UE joint name, pointed at that bone of the
## character's Skeleton3D; rotations for every joint, positions for root and
## pelvis only, the pelvis's scaled by the hips' heights (profile, "Playing
## UAL clips"). Returns the animation and the UE joints it drives.
func _retarget(src: Animation, skel_path: String, skel: Skeleton3D, names: Dictionary, src_hips: float) -> Dictionary:
	var a: Animation = Sample.retarget(src, NodePath(skel_path), skel, src_hips)
	var by_bone := {}
	for ue in names:
		var b := _bone(skel, names[ue])
		if b != -1:
			by_bone[skel.get_bone_name(b)] = ue
	var bound := {}
	for t in range(a.get_track_count()):
		var bone_name := String(a.track_get_path(t)).get_slice(":", 1)
		if by_bone.has(bone_name):
			bound[by_bone[bone_name]] = true
	return {"animation": a, "bound": bound}


func _check_clip(inst: Node3D, skel: Skeleton3D, meshes: Array, names: Dictionary, clip: Dictionary) -> Dictionary:
	if clip.has("error"):
		return _result("clip", false, [clip["error"]])
	var problems: Array = []
	var skel_path := String(inst.get_path_to(skel))
	var r := _retarget(clip["animation"], skel_path, skel, names, clip["hips"])
	var bound: Dictionary = r["bound"]
	for ue in expect["majorJoints"]:
		if not bound.has(ue):
			problems.append("%s: the clip has no track for it" % ue)
	var lib := AnimationLibrary.new()
	lib.add_animation(&"walk", r["animation"])
	var ap := AnimationPlayer.new()
	inst.add_child(ap)
	ap.root_node = NodePath("..")
	ap.add_animation_library(&"ual", lib)

	skel.reset_bone_poses()
	skel.force_update_all_bone_transforms()
	var rest_q := {}
	var rest_p := {}
	for ue in expect["majorJoints"] + expect["extremities"]:
		var b := _bone(skel, names[ue])
		rest_q[ue] = skel.get_bone_pose_rotation(b)
		rest_p[ue] = skel.get_bone_global_pose(b).origin
	# The hand's own vertices: the body vertices weighted most to hand_l.
	var body: MeshInstance3D = null
	for mi in meshes:
		if mi.name == "body":
			body = mi
	var hand_bind := -1
	var arrays: Array = []
	var hand_verts: Array = []
	var top_weight := 0.0
	if body != null:
		arrays = body.mesh.surface_get_arrays(0)
		var hb := _bone(skel, names["hand_l"])
		for b in range(body.skin.get_bind_count()):
			if _bind_bone(skel, body.skin, b) == hb:
				hand_bind = b
		var bones: PackedInt32Array = arrays[ARRAY_BONES]
		var weights: PackedFloat32Array = arrays[ARRAY_WEIGHTS]
		var per: int = bones.size() / arrays[ARRAY_VERTEX].size()
		var weighted: Array = []
		for v in range(arrays[ARRAY_VERTEX].size()):
			for k in range(per):
				if bones[v * per + k] == hand_bind and weights[v * per + k] > 0.0:
					weighted.append([weights[v * per + k], v])
		weighted.sort_custom(func(a, b): return a[0] > b[0])
		for e in weighted.slice(0, 50):
			hand_verts.append(e[1])
		if not weighted.is_empty():
			top_weight = weighted[0][0]
	var rest_v := {}
	if not hand_verts.is_empty():
		var mats := _skin_matrices(skel, body.skin)
		for v in hand_verts:
			rest_v[v] = _skinned(arrays, mats, v)

	ap.play(&"ual/walk")
	var turn := {}
	var travel := {}
	var vtravel := 0.0
	var lowest_foot := INF
	var follow := 0.0
	var steps := 12
	for k in range(steps + 1):
		ap.seek(clip["animation"].length * k / steps, true)
		skel.force_update_all_bone_transforms()
		for ue in rest_q:
			var b := _bone(skel, names[ue])
			turn[ue] = max(turn.get(ue, 0.0), skel.get_bone_pose_rotation(b).angle_to(rest_q[ue]))
			travel[ue] = max(travel.get(ue, 0.0), skel.get_bone_global_pose(b).origin.distance_to(rest_p[ue]))
			if ue == "foot_l" or ue == "foot_r":
				lowest_foot = min(lowest_foot, (skel.transform * skel.get_bone_global_pose(b)).origin.y - (skel.transform * Transform3D(Basis(), rest_p[ue])).origin.y)
		if not hand_verts.is_empty():
			var mats := _skin_matrices(skel, body.skin)
			var hb := _bone(skel, names["hand_l"])
			var hand_now := skel.get_bone_global_pose(hb)
			for v in hand_verts:
				var p := _skinned(arrays, mats, v)
				vtravel = max(vtravel, p.distance_to(rest_v[v]))
			# A vertex weighted ~1 to the hand stays fixed in the hand's frame.
			var v0: int = hand_verts[0]
			var local_rest: Vector3 = skel.get_bone_global_rest(hb).affine_inverse() * rest_v[v0]
			var local_now: Vector3 = hand_now.affine_inverse() * _skinned(arrays, mats, v0)
			follow = max(follow, local_now.distance_to(local_rest))
	ap.stop()
	for ue in expect["turning"]:
		if turn.get(ue, 0.0) < deg_to_rad(0.5):
			problems.append("%s: the clip does not turn it" % ue)
	for ue in expect["extremities"]:
		if travel.get(ue, 0.0) < 0.01:
			problems.append("%s travels %.1f cm, under 1 cm" % [ue, travel.get(ue, 0.0) * 100.0])
	if hand_verts.is_empty():
		problems.append("found no body vertices weighted to hand_l")
	elif vtravel < 0.01:
		problems.append("hand vertices travel %.1f cm: the skin does not follow" % (vtravel * 100.0))
	if top_weight > 0.95 and follow > 0.005:
		problems.append("a hand vertex drifts %.1f cm in the hand's frame" % (follow * 100.0))
	var ev: Array = [
		"clip %s, %.2f s, %d of %d tracks kept" % [clip["name"], clip["animation"].length, r["animation"].get_track_count(), clip["animation"].get_track_count()],
		"%d of %d major joints bound" % [bound.keys().filter(func(j): return expect["majorJoints"].has(j)).size(), expect["majorJoints"].size()],
		"travel (cm): " + ", ".join(expect["extremities"].map(func(ue): return "%s %.1f" % [ue, travel.get(ue, 0.0) * 100.0])),
		"turn (deg): " + ", ".join(expect["turning"].map(func(ue): return "%s %.1f" % [ue, rad_to_deg(turn.get(ue, 0.0))])),
		"lowest ankle during the clip: %.1f cm from its rest height (pelvis translation scaled by the hips' heights)" % (lowest_foot * 100.0),
		"%d body vertices most weighted to hand_l (top weight %.2f) travel up to %.1f cm; the top one drifts %.2f mm in the hand's frame" % [hand_verts.size(), top_weight, vtravel * 100.0, follow * 1000.0],
	]
	ap.queue_free()
	return _result("clip", problems.is_empty(), ev + problems)
