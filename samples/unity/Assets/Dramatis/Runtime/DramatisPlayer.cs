// The Unity Web player (/unity/ on the site): the three.js demo's walk-round,
// in Unity. The page hands it a GLB by URL (a file the person opened, a save
// built in the page, or ?glb=) through SendMessage("Dramatis", "LoadGlb", url);
// glTFast loads it at runtime, as a Unity game would, and UAL's CC0 idle, walk,
// jog and sprint loops play on it by name.
//
// HOW THE CLIPS BIND. glTFast imports animation at runtime as legacy clips,
// put on an Animation component on the scene's own object, with each curve
// keyed by the path from there to its node. UAL's file nests its skeleton
// under "Armature"; a Dramatis export has "root" at the top. So the
// character's skeleton is moved under the same chain of names (copied from
// UAL's own instance), and the clips find every joint by path. Nothing is
// retargeted: the export profile copies UAL's joint frames, which is why
// rotation keys mean the same on both. The hips' height is scaled to the
// character's (LateUpdate), as the three.js demo does.
//
// Status goes back to the page through DramatisBridge.jslib.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using GLTFast;
using UnityEngine;

namespace Dramatis
{
    public class DramatisPlayer : MonoBehaviour
    {
        [Tooltip("Where UAL's clips come from, tried in order.")]
        public string[] clipUrls =
        {
            "https://cdn.tosijs.net/quaternius/UAL1_core.glb?v=2",
            "/viewer/ual-walk.glb",
        };
        public Transform floor;
        public Camera cam;
        public Light sun;
        [Tooltip("Materials glTFast made in the editor, kept so the build keeps their shader variants (DramatisWebBuild).")]
        public Material[] keepVariants;

        const double Arena = 30;
        const double WalkerRadius = 0.3;
        static readonly string[] Blink = { "LeftUpperLidClosed", "RightUpperLidClosed" };

        Pillar[] pillars;
        GltfImport clipImport;
        GameObject clipScene;
        Dictionary<string, AnimationClip> clips;

        GameObject character;
        GltfImport characterImport;
        Animation anim;
        Transform pelvis;
        float hipScale = 1;
        Vector3 lastHips;
        // A blend shape's full weight is its last frame's: glTFast imports morph
        // targets at 1, not Unity's usual 100 (100 drew the lids 100x over).
        readonly List<(SkinnedMeshRenderer smr, int index, float full)> lids = new List<(SkinnedMeshRenderer, int, float)>();

        Flat at;
        double heading, speed;
        Flat? goal;
        bool goalRun;
        string playing;
        int loads;

        // The orbit camera: yaw and pitch round the character, and distance.
        float yaw = Mathf.PI, pitch = 0.25f, distance = 4.5f;
        Vector3 downAt;
        bool dragged;

        void Awake()
        {
            name = "Dramatis"; // SendMessage's target
            pillars = Walk.PillarRing();
            if (cam == null) cam = Camera.main;
            // WebGL's default quality skins with two bones a vertex; the export
            // carries four (glTF's JOINTS_0), and two crease the shoulders.
            if (QualitySettings.skinWeights < SkinWeights.FourBones)
                QualitySettings.skinWeights = SkinWeights.FourBones;
        }

        async void Start()
        {
            Post("status", "Loading UAL’s clips…");
            await LoadClips();
            Post("ready", clips != null && clips.Count > 0 ? string.Join(",", clips.Keys) : "");
        }

        // --- the page's messages ----------------------------------------------

        /// <summary>From the page: load a GLB from a URL (blob:, relative or absolute).</summary>
        public void LoadGlb(string url) => _ = LoadCharacter(url);

        /// <summary>From the page: replace the clip URLs (comma separated).</summary>
        public void SetClipUrls(string csv) =>
            clipUrls = csv.Split(',').Select(s => s.Trim()).Where(s => s.Length > 0).ToArray();

        // --- clips ------------------------------------------------------------

        async Task LoadClips()
        {
            foreach (var url in clipUrls)
            {
                var import = new GltfImport();
                var settings = new ImportSettings { AnimationMethod = AnimationMethod.Legacy };
                if (!await import.Load(url, settings)) { import.Dispose(); continue; }
                var holder = new GameObject("UAL (hidden)");
                holder.SetActive(false);
                var inst = new GameObjectInstantiator(import, holder.transform);
                if (!await import.InstantiateMainSceneAsync(inst)) { import.Dispose(); Destroy(holder); continue; }
                var sceneT = inst.SceneTransform;
                var root = Find(sceneT, "root");
                var got = import.GetAnimationClips();
                if (root == null || got == null || got.Length == 0) { import.Dispose(); Destroy(holder); continue; }
                clipImport = import;
                clipScene = holder;
                clips = got.Where(c => c != null).GroupBy(c => c.name).ToDictionary(g => g.Key, g => g.First());
                ualHips = HipsHeight(sceneT);
                ualChain = ChainFrom(sceneT, root);
                return;
            }
            Post("error", "UAL’s clips wouldn’t load from " + string.Join(" or ", clipUrls));
        }

        float ualHips = 1;
        List<Transform> ualChain = new List<Transform>();

        // --- the character --------------------------------------------------------

        async Task LoadCharacter(string url)
        {
            int ticket = ++loads;
            Post("status", "Loading the character…");
            var import = new GltfImport();
            var settings = new ImportSettings { AnimationMethod = AnimationMethod.None };
            if (!await import.Load(url, settings))
            {
                import.Dispose();
                if (ticket == loads) Post("error", "glTFast couldn’t read that file.");
                return;
            }
            var holder = new GameObject("Character");
            var inst = new GameObjectInstantiator(import, holder.transform);
            if (!await import.InstantiateMainSceneAsync(inst) || ticket != loads)
            {
                import.Dispose();
                Destroy(holder);
                if (ticket == loads) Post("error", "glTFast couldn’t build that file’s scene.");
                return;
            }
            if (character != null) Destroy(character);
            characterImport?.Dispose();
            character = holder;
            characterImport = import;
            Setup(inst.SceneTransform);
        }

        void Setup(Transform sceneT)
        {
            at = new Flat(0, 0);
            heading = 0;
            speed = 0;
            goal = null;
            playing = null;
            lids.Clear();
            foreach (var smr in sceneT.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                smr.updateWhenOffscreen = true; // the bind-pose bounds lie once it walks
                smr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
                var mesh = smr.sharedMesh;
                if (mesh == null) continue;
                foreach (var b in Blink)
                {
                    int i = mesh.GetBlendShapeIndex(b);
                    if (i >= 0) lids.Add((smr, i, mesh.GetBlendShapeFrameWeight(i, mesh.GetBlendShapeFrameCount(i) - 1)));
                }
            }

            var root = Find(sceneT, "root");
            if (root == null)
            {
                bool mixamo = sceneT.GetComponentsInChildren<Transform>(true).Any(t => t.name.StartsWith("mixamorig"));
                Post("error", mixamo
                    ? "This export uses Mixamo names; the Unity player plays UE-named exports (the creator’s default)."
                    : "No skeleton named as Dramatis exports it (no “root” joint).");
                return;
            }
            if (clips == null || clips.Count == 0)
            {
                Post("error", "The character is here, but UAL’s clips didn’t load.");
                return;
            }

            // Put the skeleton under the same chain of names as UAL's (e.g.
            // "Armature"), with the same local transforms, so the clip paths resolve.
            Transform parent = sceneT;
            for (int i = 0; i < ualChain.Count - 1; i++)
            {
                var u = ualChain[i];
                var t = new GameObject(u.name).transform;
                t.SetParent(parent, false);
                t.localPosition = u.localPosition;
                t.localRotation = u.localRotation;
                t.localScale = u.localScale;
                parent = t;
            }
            root.SetParent(parent, false);

            pelvis = Find(sceneT, "pelvis");
            float ours = HipsHeight(sceneT);
            hipScale = ualHips > 0 && ours > 0 ? ours / ualHips : 1;
            lastHips = new Vector3(float.NaN, 0, 0);

            anim = sceneT.gameObject.GetComponent<Animation>() ?? sceneT.gameObject.AddComponent<Animation>();
            anim.playAutomatically = false;
            foreach (var kv in clips)
            {
                kv.Value.wrapMode = WrapMode.Loop;
                anim.AddClip(kv.Value, kv.Key);
            }
            SetGait("idle", 0);
            var have = Walk.Gaits.Where(g => clips.ContainsKey(g.clip)).Select(g => g.name).ToArray();
            Post("loaded", string.Join(",", have));
            Post("status", have.Contains("idle")
                ? "Ready. Walk them round."
                : "Ready (only the walk loaded; the CDN is out of reach).");
        }

        void SetGait(string gait, float fade = 0.25f)
        {
            if (anim == null) return;
            string want = gait;
            if (!clips.ContainsKey(ClipOf(want)))
                want = Walk.Gaits.Select(g => g.name).FirstOrDefault(g => g != "idle" && clips.ContainsKey(ClipOf(g))) ?? want;
            var clip = ClipOf(want);
            if (playing == want || !clips.ContainsKey(clip)) return;
            anim.CrossFade(clip, fade);
            // With no idle clip, standing still is the walk held still.
            anim[clip].speed = gait == "idle" && want != "idle" ? 0 : 1;
            playing = want;
            Post("gait", gait);
        }

        static string ClipOf(string gait) => Walk.Gaits.First(g => g.name == gait).clip;

        // --- every frame ----------------------------------------------------------

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.1f);
            Orbit();
            if (character == null || anim == null) { PlaceCamera(); return; }

            double f = Axis(KeyCode.W, KeyCode.UpArrow, KeyCode.S, KeyCode.DownArrow);
            double r = Axis(KeyCode.D, KeyCode.RightArrow, KeyCode.A, KeyCode.LeftArrow);
            bool run = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
            var byKeys = Walk.Steer(f, r, yaw); // relative to where the camera looks
            if (byKeys != null) goal = null;
            var byGoal = byKeys == null && goal != null ? Walk.TowardGoal(at, goal.Value) : null;
            if (byKeys == null && goal != null && byGoal == null) goal = null;
            var dir = byKeys ?? byGoal;
            bool running = byKeys != null ? run : goalRun;
            double target = dir != null ? Walk.Gaits[running ? 2 : 1].speed : 0;
            speed += (target - speed) * Math.Min(1, dt * 6);
            if (dir != null) heading = Walk.TurnToward(heading, Walk.HeadingOf(dir.Value), dt * 8);
            at = Walk.Collide(
                new Flat(at.x + Math.Sin(heading) * speed * dt, at.z + Math.Cos(heading) * speed * dt),
                WalkerRadius, pillars, Arena / 2);
            character.transform.SetPositionAndRotation(
                new Vector3((float)at.x, 0, (float)at.z),
                Quaternion.Euler(0, (float)(heading * Mathf.Rad2Deg), 0));
            SetGait(speed < 0.25 ? "idle" : Walk.GaitFor(speed).name);
            PlaceCamera();
        }

        void LateUpdate()
        {
            // The clips carry UAL's hip height; scale it to this character's. Only
            // a value the animation just wrote is scaled (never twice).
            if (pelvis != null && hipScale != 1 && pelvis.localPosition != lastHips)
            {
                pelvis.localPosition *= hipScale;
                lastHips = pelvis.localPosition;
            }
            float phase = Time.time % 3.7f;
            float w = phase < 0.16f ? Mathf.Sin(phase / 0.16f * Mathf.PI) : 0;
            foreach (var lid in lids) if (lid.smr != null) lid.smr.SetBlendShapeWeight(lid.index, w * lid.full);
        }

        static double Axis(KeyCode a, KeyCode b, KeyCode neg, KeyCode neg2) =>
            (Input.GetKey(a) || Input.GetKey(b) ? 1 : 0) - (Input.GetKey(neg) || Input.GetKey(neg2) ? 1 : 0);

        void Orbit()
        {
            if (Input.GetMouseButtonDown(0)) { downAt = Input.mousePosition; dragged = false; }
            if (Input.GetMouseButton(0))
            {
                var d = Input.mousePosition - downAt;
                if (d.magnitude > 6) dragged = true;
                if (dragged)
                {
                    yaw += Input.GetAxis("Mouse X") * 0.08f;
                    pitch = Mathf.Clamp(pitch - Input.GetAxis("Mouse Y") * 0.05f, -0.1f, 1.3f);
                }
            }
            if (Input.GetMouseButtonUp(0) && !dragged) ClickToWalk(Input.mousePosition);
            distance = Mathf.Clamp(distance - Input.mouseScrollDelta.y * 0.4f, 1.2f, 12f);
        }

        void ClickToWalk(Vector3 screen)
        {
            if (cam == null) return;
            var ray = cam.ScreenPointToRay(screen);
            var ground = new Plane(Vector3.up, Vector3.zero);
            if (!ground.Raycast(ray, out float hit)) return;
            var p = ray.GetPoint(hit);
            goal = new Flat(p.x, p.z);
            goalRun = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
        }

        void PlaceCamera()
        {
            if (cam == null) return;
            var target = new Vector3((float)at.x, 1.0f, (float)at.z);
            // The camera looks along yaw (round Y from +Z), down by pitch, from
            // `distance` back: yaw = pi starts it in front, facing the character.
            var look = new Vector3(
                Mathf.Sin(yaw) * Mathf.Cos(pitch),
                -Mathf.Sin(pitch),
                Mathf.Cos(yaw) * Mathf.Cos(pitch));
            cam.transform.position = target - look * distance;
            cam.transform.LookAt(target);
        }

        // --- helpers ----------------------------------------------------------

        static Transform Find(Transform under, string name) =>
            under.GetComponentsInChildren<Transform>(true).FirstOrDefault(t => t.name == name);

        /// <summary>The nodes from just under `from` down to `to`, inclusive.</summary>
        static List<Transform> ChainFrom(Transform from, Transform to)
        {
            var chain = new List<Transform>();
            for (var t = to; t != null && t != from; t = t.parent) chain.Insert(0, t);
            return chain;
        }

        /// <summary>The pelvis's height above the scene's origin, at rest.</summary>
        static float HipsHeight(Transform sceneT)
        {
            var p = Find(sceneT, "pelvis");
            return p == null ? 0 : sceneT.InverseTransformPoint(p.position).y;
        }

        static void Post(string kind, string text) => Bridge.Post(kind, text);

        void OnDestroy()
        {
            characterImport?.Dispose();
            clipImport?.Dispose();
            if (clipScene != null) Destroy(clipScene);
        }
    }
}
