// The Unity import check for Dramatis exports (spike 1). NOT YET RUN: it was
// written without a Unity editor on the machine. Run it in batch mode:
//
//   <Unity> -batchmode -nographics -projectPath samples/unity \
//     -executeMethod Dramatis.EngineCheck.Run -logFile - \
//     -dramatisOut <results.json>
//
// tools/engines/unity.ts copies the exports into Assets/Characters/ first,
// each with a ".walk.glb" twin that carries UAL's Walk_Loop on the export's
// own joints (tools/engines/splice-clip.ts), and prints the command.
//
// glTFast (com.unity.cloud.gltfast) imports every .glb with its defaults.
// For each character this checks: the import; the skeleton (65 bones, names,
// parents); every SkinnedMeshRenderer on it; rest-pose skinning (BakeMesh at
// rest against the mesh); the face units as blend shapes; a Humanoid avatar
// built from the profile's bone map (AvatarBuilder) being valid and human;
// and the walk: the clip sampled over its length moves the hands and feet,
// the baked skin follows, and the Humanoid pose (muscles) changes with it.
// Results go to -dramatisOut as JSON in the same shape as the other engines.

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEngine;

namespace Dramatis
{
    public static class EngineCheck
    {
        const string Folder = "Assets/Characters";

        // UE (UAL) joint -> Unity Humanoid bone. root and the _leaf tips are not human bones.
        static readonly Dictionary<HumanBodyBones, string> UeForHuman = new Dictionary<HumanBodyBones, string>
        {
            { HumanBodyBones.Hips, "pelvis" }, { HumanBodyBones.Spine, "spine_01" },
            { HumanBodyBones.Chest, "spine_02" }, { HumanBodyBones.UpperChest, "spine_03" },
            { HumanBodyBones.Neck, "neck_01" }, { HumanBodyBones.Head, "Head" },
            { HumanBodyBones.LeftShoulder, "clavicle_l" }, { HumanBodyBones.LeftUpperArm, "upperarm_l" },
            { HumanBodyBones.LeftLowerArm, "lowerarm_l" }, { HumanBodyBones.LeftHand, "hand_l" },
            { HumanBodyBones.RightShoulder, "clavicle_r" }, { HumanBodyBones.RightUpperArm, "upperarm_r" },
            { HumanBodyBones.RightLowerArm, "lowerarm_r" }, { HumanBodyBones.RightHand, "hand_r" },
            { HumanBodyBones.LeftUpperLeg, "thigh_l" }, { HumanBodyBones.LeftLowerLeg, "calf_l" },
            { HumanBodyBones.LeftFoot, "foot_l" }, { HumanBodyBones.LeftToes, "ball_l" },
            { HumanBodyBones.RightUpperLeg, "thigh_r" }, { HumanBodyBones.RightLowerLeg, "calf_r" },
            { HumanBodyBones.RightFoot, "foot_r" }, { HumanBodyBones.RightToes, "ball_r" },
            { HumanBodyBones.LeftThumbProximal, "thumb_01_l" }, { HumanBodyBones.LeftThumbIntermediate, "thumb_02_l" },
            { HumanBodyBones.LeftThumbDistal, "thumb_03_l" },
            { HumanBodyBones.LeftIndexProximal, "index_01_l" }, { HumanBodyBones.LeftIndexIntermediate, "index_02_l" },
            { HumanBodyBones.LeftIndexDistal, "index_03_l" },
            { HumanBodyBones.LeftMiddleProximal, "middle_01_l" }, { HumanBodyBones.LeftMiddleIntermediate, "middle_02_l" },
            { HumanBodyBones.LeftMiddleDistal, "middle_03_l" },
            { HumanBodyBones.LeftRingProximal, "ring_01_l" }, { HumanBodyBones.LeftRingIntermediate, "ring_02_l" },
            { HumanBodyBones.LeftRingDistal, "ring_03_l" },
            { HumanBodyBones.LeftLittleProximal, "pinky_01_l" }, { HumanBodyBones.LeftLittleIntermediate, "pinky_02_l" },
            { HumanBodyBones.LeftLittleDistal, "pinky_03_l" },
            { HumanBodyBones.RightThumbProximal, "thumb_01_r" }, { HumanBodyBones.RightThumbIntermediate, "thumb_02_r" },
            { HumanBodyBones.RightThumbDistal, "thumb_03_r" },
            { HumanBodyBones.RightIndexProximal, "index_01_r" }, { HumanBodyBones.RightIndexIntermediate, "index_02_r" },
            { HumanBodyBones.RightIndexDistal, "index_03_r" },
            { HumanBodyBones.RightMiddleProximal, "middle_01_r" }, { HumanBodyBones.RightMiddleIntermediate, "middle_02_r" },
            { HumanBodyBones.RightMiddleDistal, "middle_03_r" },
            { HumanBodyBones.RightRingProximal, "ring_01_r" }, { HumanBodyBones.RightRingIntermediate, "ring_02_r" },
            { HumanBodyBones.RightRingDistal, "ring_03_r" },
            { HumanBodyBones.RightLittleProximal, "pinky_01_r" }, { HumanBodyBones.RightLittleIntermediate, "pinky_02_r" },
            { HumanBodyBones.RightLittleDistal, "pinky_03_r" },
        };

        // UE -> Mixamo (the profile's other naming), for the human bones and the tips.
        static string Mixamo(string ue)
        {
            var fixedNames = new Dictionary<string, string>
            {
                { "pelvis", "Hips" }, { "spine_01", "Spine" }, { "spine_02", "Spine1" }, { "spine_03", "Spine2" },
                { "neck_01", "Neck" }, { "Head", "Head" },
            };
            if (ue == "root") return "root";
            if (fixedNames.TryGetValue(ue, out var f)) return "mixamorig:" + f;
            var side = ue.EndsWith("_l") ? "Left" : "Right";
            var stem = ue.Substring(0, ue.Length - 2);
            var limbs = new Dictionary<string, string>
            {
                { "clavicle", "Shoulder" }, { "upperarm", "Arm" }, { "lowerarm", "ForeArm" }, { "hand", "Hand" },
                { "thigh", "UpLeg" }, { "calf", "Leg" }, { "foot", "Foot" }, { "ball", "ToeBase" }, { "ball_leaf", "Toe_End" },
            };
            if (limbs.TryGetValue(stem, out var l)) return "mixamorig:" + side + l;
            // fingers: thumb_01, index_04_leaf ...
            var parts = stem.Split('_');
            var finger = new Dictionary<string, string>
            {
                { "thumb", "Thumb" }, { "index", "Index" }, { "middle", "Middle" }, { "ring", "Ring" }, { "pinky", "Pinky" },
            }[parts[0]];
            return "mixamorig:" + side + "Hand" + finger + int.Parse(parts[1]);
        }

        [Serializable] class Check { public string check; public bool ok; public List<string> evidence = new List<string>(); }
        [Serializable] class CharacterResult { public string file; public string naming; public List<Check> checks = new List<Check>(); }
        [Serializable] class Results { public string unity; public string gltfast; public List<CharacterResult> characters = new List<CharacterResult>(); }

        [MenuItem("Dramatis/Run engine check")]
        public static void RunFromMenu() => Run();

        public static void Run()
        {
            var outPath = ArgAfter("-dramatisOut") ?? Path.GetFullPath("dramatis-results.json");
            var results = new Results { unity = Application.unityVersion, gltfast = GltfastVersion() };
            int code = 0;
            try
            {
                AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
                foreach (var path in Directory.GetFiles(Folder, "*.glb").Where(p => !p.EndsWith(".walk.glb")).OrderBy(p => p))
                    results.characters.Add(CheckCharacter(path.Replace('\\', '/')));
            }
            catch (Exception e)
            {
                results.characters.Add(new CharacterResult
                {
                    file = "(run)", naming = "",
                    checks = { new Check { check = "script", ok = false, evidence = { e.ToString() } } },
                });
            }
            File.WriteAllText(outPath, ToJson(results));
            Debug.Log("[dramatis] wrote " + outPath);
            foreach (var c in results.characters)
                foreach (var k in c.checks)
                {
                    Debug.Log($"[dramatis] {(k.ok ? "PASS" : "FAIL")} {c.file} {k.check}: {string.Join(" | ", k.evidence)}");
                    if (!k.ok) code = 1;
                }
            if (Application.isBatchMode) EditorApplication.Exit(code);
        }

        static CharacterResult CheckCharacter(string path)
        {
            var r = new CharacterResult { file = Path.GetFileName(path) };
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (prefab == null)
            {
                r.checks.Add(Fail("import", "glTFast did not import " + path + " as a GameObject"));
                return r;
            }
            var go = UnityEngine.Object.Instantiate(prefab);
            try
            {
                var smrs = go.GetComponentsInChildren<SkinnedMeshRenderer>(true);
                r.checks.Add(Result("import", smrs.Length > 0, $"{smrs.Length} SkinnedMeshRenderer: {string.Join(", ", smrs.Select(s => s.name))}"));
                var all = go.GetComponentsInChildren<Transform>(true);
                bool mixamo = all.Any(t => t.name == "mixamorig:Hips" || t.name == "mixamorigHips" || t.name == "mixamorig_Hips");
                r.naming = mixamo ? "mixamo" : "ue";
                Func<string, Transform> bone = ue =>
                {
                    var n = mixamo ? Mixamo(ue) : ue;
                    return all.FirstOrDefault(t => t.name == n)
                        ?? all.FirstOrDefault(t => t.name == n.Replace(":", ""))
                        ?? all.FirstOrDefault(t => t.name == n.Replace(":", "_"));
                };

                // Skeleton: every renderer shares one bone list of 65.
                var sk = new Check { check = "skeleton" };
                var bones = smrs.Length > 0 ? smrs[0].bones : new Transform[0];
                sk.evidence.Add($"{bones.Length} bones on {smrs.FirstOrDefault()?.name}; root bone {smrs.FirstOrDefault()?.rootBone?.name}");
                if (bones.Length != 65) sk.evidence.Add("expected 65 bones");
                foreach (var s in smrs)
                    if (!s.bones.SequenceEqual(bones)) sk.evidence.Add($"{s.name} has a different bone list");
                var renamed = UeForHuman.Values.Concat(new[] { "root" })
                    .Where(ue => bone(ue) != null && bone(ue).name != (mixamo ? Mixamo(ue) : ue)).ToList();
                if (renamed.Count > 0) sk.evidence.Add($"glTFast renamed {renamed.Count} joints, e.g. {(mixamo ? Mixamo(renamed[0]) : renamed[0])} -> {bone(renamed[0]).name}");
                var missing = UeForHuman.Values.Where(ue => bone(ue) == null).ToList();
                if (missing.Count > 0) sk.evidence.Add("missing: " + string.Join(", ", missing.Take(6)));
                sk.ok = bones.Length == 65 && missing.Count == 0 && smrs.All(s => s.bones.SequenceEqual(bones));
                r.checks.Add(sk);

                // Axes: Unity is left-handed, Y up; glTFast flips X, so the
                // character's left hand (glTF +X) is at Unity -X, facing +Z.
                var head = bone("Head").position; var hl = bone("hand_l").position;
                var foot = bone("foot_l").position; var ball = bone("ball_l").position;
                r.checks.Add(Result("axes", head.y > 1f && head.y < 2.5f && hl.x < -0.3f && ball.z > foot.z,
                    $"Head {head}, hand_l {hl}, foot_l {foot}, ball_l {ball} (Unity world)"));

                // Rest-pose skinning: BakeMesh at rest equals the mesh.
                var rest = new Check { check = "rest-skinning", ok = true };
                foreach (var s in smrs)
                {
                    var baked = new Mesh();
                    s.BakeMesh(baked, true);
                    var a = s.sharedMesh.vertices; var b = baked.vertices;
                    float worst = 0;
                    for (int i = 0; i < a.Length; i += Math.Max(1, a.Length / 2000)) worst = Math.Max(worst, (a[i] - b[i]).magnitude);
                    rest.evidence.Add($"{s.name} {worst * 1000:F3} mm");
                    if (worst > 0.0005f) rest.ok = false;
                    UnityEngine.Object.DestroyImmediate(baked);
                }
                r.checks.Add(rest);

                // Blend shapes: the face units.
                var morph = new Check { check = "morphs" };
                var units = new HashSet<string>();
                foreach (var s in smrs)
                {
                    var m = s.sharedMesh;
                    for (int i = 0; i < m.blendShapeCount; i++) units.Add(m.GetBlendShapeName(i));
                    if (m.blendShapeCount > 0) morph.evidence.Add($"{s.name}: {m.blendShapeCount}");
                }
                var body = smrs.FirstOrDefault(s => s.name == "body");
                float jaw = 0;
                if (body != null)
                {
                    int jd = body.sharedMesh.GetBlendShapeIndex("JawDrop");
                    if (jd >= 0)
                    {
                        var dv = new Vector3[body.sharedMesh.vertexCount];
                        body.sharedMesh.GetBlendShapeFrameVertices(jd, 0, dv, null, null);
                        jaw = dv.Max(v => v.magnitude);
                    }
                }
                morph.evidence.Insert(0, $"{units.Count} distinct blend shapes; JawDrop moves the body up to {jaw * 1000:F1} mm");
                morph.ok = units.Count == 59 && jaw > 0.002f;
                r.checks.Add(morph);

                // Humanoid: an avatar from the profile's bone map.
                var avatar = BuildHumanoid(go, bone, out var avatarNote);
                r.checks.Add(Result("humanoid", avatar != null && avatar.isValid && avatar.isHuman,
                    avatar == null ? avatarNote : $"avatar isValid={avatar.isValid} isHuman={avatar.isHuman}; {avatarNote}"));

                // The walk: UAL's Walk_Loop from the spliced twin.
                r.checks.Add(CheckWalk(path, avatar, mixamo));
            }
            catch (Exception e)
            {
                r.checks.Add(Fail("script", e.ToString()));
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(go);
            }
            return r;
        }

        static Avatar BuildHumanoid(GameObject go, Func<string, Transform> bone, out string note)
        {
            var human = new List<HumanBone>();
            foreach (var kv in UeForHuman)
            {
                var t = bone(kv.Value);
                if (t == null) continue;
                var hb = new HumanBone { boneName = t.name, humanName = HumanTrait.BoneName[(int)kv.Key] };
                hb.limit.useDefaultValues = true;
                human.Add(hb);
            }
            var skeleton = go.GetComponentsInChildren<Transform>(true)
                .Select(t => new SkeletonBone { name = t.name, position = t.localPosition, rotation = t.localRotation, scale = t.localScale })
                .ToArray();
            var desc = new HumanDescription
            {
                human = human.ToArray(), skeleton = skeleton,
                upperArmTwist = 0.5f, lowerArmTwist = 0.5f, upperLegTwist = 0.5f, lowerLegTwist = 0.5f,
                armStretch = 0.05f, legStretch = 0.05f, feetSpacing = 0f, hasTranslationDoF = false,
            };
            var avatar = AvatarBuilder.BuildHumanAvatar(go, desc);
            note = $"{human.Count} human bones mapped (no T-pose fix-up)";
            return avatar;
        }

        static Check CheckWalk(string path, Avatar avatar, bool mixamo)
        {
            var c = new Check { check = "clip" };
            var walkPath = path.Substring(0, path.Length - 4) + ".walk.glb";
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(walkPath);
            var clips = AssetDatabase.LoadAllAssetsAtPath(walkPath).OfType<AnimationClip>().ToList();
            if (prefab != null && clips.Count == 0)
            {
                // glTFast's importer setting for clips; the field name is
                // glTFast's serialised one (importSettings.animationMethod:
                // 0 None, 1 Legacy, 2 Mecanim). Recorded when it is used.
                var importer = AssetImporter.GetAtPath(walkPath);
                var so = importer != null ? new SerializedObject(importer) : null;
                var prop = so?.FindProperty("importSettings.animationMethod");
                if (prop != null)
                {
                    prop.intValue = 1;
                    so.ApplyModifiedPropertiesWithoutUndo();
                    importer.SaveAndReimport();
                    c.evidence.Add("the importer made no clip by default; set Animation to Legacy and reimported");
                    prefab = AssetDatabase.LoadAssetAtPath<GameObject>(walkPath);
                    clips = AssetDatabase.LoadAllAssetsAtPath(walkPath).OfType<AnimationClip>().ToList();
                }
            }
            if (prefab == null || clips.Count == 0)
            {
                c.evidence.Add($"{walkPath}: {(prefab == null ? "not imported" : "no AnimationClip (set the importer's Animation to Legacy or Mecanim)")}");
                return c;
            }
            var clip = clips[0];
            var go = UnityEngine.Object.Instantiate(prefab);
            try
            {
                var all = go.GetComponentsInChildren<Transform>(true);
                Func<string, Transform> bone = ue =>
                {
                    var n = mixamo ? Mixamo(ue) : ue;
                    return all.FirstOrDefault(t => t.name == n) ?? all.FirstOrDefault(t => t.name == n.Replace(":", ""));
                };
                var tracked = new[] { "Head", "hand_l", "hand_r", "foot_l", "foot_r" };
                var rest = tracked.ToDictionary(u => u, u => bone(u).position);
                var travel = tracked.ToDictionary(u => u, u => 0f);
                var body = go.GetComponentsInChildren<SkinnedMeshRenderer>(true).First(s => s.name == "body");
                var baked = new Mesh();
                body.BakeMesh(baked, true);
                var restV = baked.vertices;
                float vmove = 0;
                HumanPoseHandler handler = avatar != null && avatar.isValid ? new HumanPoseHandler(avatar, go.transform) : null;
                var pose = new HumanPose();
                float[] firstMuscles = null;
                float muscleChange = 0;
                for (int k = 0; k <= 12; k++)
                {
                    clip.SampleAnimation(go, clip.length * k / 12f);
                    foreach (var u in tracked) travel[u] = Math.Max(travel[u], (bone(u).position - rest[u]).magnitude);
                    body.BakeMesh(baked, true);
                    var v = baked.vertices;
                    for (int i = 0; i < v.Length; i += 7) vmove = Math.Max(vmove, (v[i] - restV[i]).magnitude);
                    if (handler != null)
                    {
                        handler.GetHumanPose(ref pose);
                        if (firstMuscles == null) firstMuscles = (float[])pose.muscles.Clone();
                        else for (int m = 0; m < pose.muscles.Length; m++) muscleChange = Math.Max(muscleChange, Math.Abs(pose.muscles[m] - firstMuscles[m]));
                    }
                }
                UnityEngine.Object.DestroyImmediate(baked);
                c.evidence.Add($"clip {clip.name} ({(clip.legacy ? "legacy" : "mecanim generic")}), {clip.length:F2} s");
                c.evidence.Add("travel (cm): " + string.Join(", ", tracked.Select(u => $"{u} {travel[u] * 100:F1}")));
                c.evidence.Add($"body vertices (baked) travel up to {vmove * 100:F1} cm");
                c.evidence.Add(handler == null ? "no Humanoid avatar to read muscles" : $"Humanoid muscles change by up to {muscleChange:F2} over the clip");
                c.ok = tracked.All(u => travel[u] > 0.01f) && vmove > 0.01f && (handler == null || muscleChange > 0.05f);
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(go);
            }
            return c;
        }

        static Check Result(string name, bool ok, string evidence) => new Check { check = name, ok = ok, evidence = { evidence } };
        static Check Fail(string name, string evidence) => Result(name, false, evidence);

        static string ArgAfter(string flag)
        {
            var a = Environment.GetCommandLineArgs();
            var i = Array.IndexOf(a, flag);
            return i >= 0 && i + 1 < a.Length ? a[i + 1] : null;
        }

        static string GltfastVersion()
        {
            var info = UnityEditor.PackageManager.PackageInfo.FindForAssetPath("Packages/com.unity.cloud.gltfast");
            return info != null ? info.version : "unknown";
        }

        // JsonUtility cannot write top-level lists of nested lists cleanly
        // across versions, so the results are written by hand.
        static string ToJson(Results r)
        {
            var sb = new StringBuilder();
            sb.Append("{\"unity\":").Append(Q(r.unity)).Append(",\"gltfast\":").Append(Q(r.gltfast)).Append(",\"characters\":[");
            sb.Append(string.Join(",", r.characters.Select(c =>
                "{\"file\":" + Q(c.file) + ",\"naming\":" + Q(c.naming) + ",\"checks\":[" +
                string.Join(",", c.checks.Select(k => "{\"check\":" + Q(k.check) + ",\"ok\":" + (k.ok ? "true" : "false") +
                    ",\"evidence\":[" + string.Join(",", k.evidence.Select(Q)) + "]}")) + "]}")));
            return sb.Append("]}").ToString();
        }

        static string Q(string s) => "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "") + "\"";
    }
}
