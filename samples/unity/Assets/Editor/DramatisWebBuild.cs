// Builds the Unity Web player for the site's /unity/ page. NOT YET RUN: it
// was written without a Unity editor on the machine. Batch mode:
//
//   <Unity> -batchmode -nographics -projectPath samples/unity -buildTarget WebGL \
//     -executeMethod Dramatis.WebBuild.Build -logFile - -dramatisWebOut <dir>
//
// tools/engines/unity.ts --web runs it (after copying the exports into
// Assets/Characters/) and copies the result into site/unity/player/. Also on
// the menu: Dramatis > Build Web player. Needs the editor's Web build support.
//
// What it does, all in code so nothing hand-written in YAML can drift:
// 1. Keeps the shader variants a character needs. glTFast makes materials at
//    runtime with Shader.Find and keywords; a build strips what no material in
//    it uses. So every material glTFast made importing the sample exports in
//    the editor is copied (keywords kept, textures dropped) and referenced from
//    the scene: the runtime import then finds the same shaders and variants.
// 2. Makes the scene: camera, sun, sky, the floor (a faint 2 m grid, drawn
//    here), the ring of pillars (Walk.PillarRing, the same numbers the player
//    collides with) and the player (DramatisPlayer).
// 3. Builds for the Web: Gzip with the decompression fallback (static hosts
//    such as GitHub Pages don't send Content-Encoding), linear colour.

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

namespace Dramatis
{
    public static class WebBuild
    {
        const string Characters = "Assets/Characters";
        const string Generated = "Assets/Dramatis/Generated";
        const string ScenePath = Generated + "/WebPlayer.unity";
        static readonly Color Sky = new Color32(0x2a, 0x33, 0x40, 0xff);

        [MenuItem("Dramatis/Build Web player")]
        public static void Menu() => Run("Builds/player");

        /// <summary>Batch mode entry: -dramatisWebOut sets the output folder (default Builds/player).</summary>
        public static void Build()
        {
            var args = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(args, "-dramatisWebOut");
            var outDir = i >= 0 && i + 1 < args.Length ? args[i + 1] : "Builds/player";
            int code = Run(outDir) ? 0 : 1;
            if (Application.isBatchMode) EditorApplication.Exit(code);
        }

        static bool Run(string outDir)
        {
            try
            {
                AssetDatabase.Refresh();
                Directory.CreateDirectory(Generated);
                var variants = KeepVariants();
                Debug.Log($"[dramatis] {variants.Length} material variants kept: {string.Join(", ", variants.Select(m => m.shader.name + " [" + string.Join(" ", m.shaderKeywords) + "]"))}");
                if (variants.Length == 0)
                    Debug.LogWarning("[dramatis] no glTFast materials found under " + Characters + ": run `bun tools/engines/unity.ts --web` so the exports are copied in first, or characters will render pink");
                MakeScene(variants);

                PlayerSettings.colorSpace = ColorSpace.Linear;
                PlayerSettings.productName = "Dramatis";
                PlayerSettings.companyName = "tosijs";
                PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
                PlayerSettings.WebGL.decompressionFallback = true;
                PlayerSettings.WebGL.dataCaching = true;

                var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
                {
                    scenes = new[] { ScenePath },
                    locationPathName = outDir,
                    target = BuildTarget.WebGL,
                    options = BuildOptions.None,
                });
                var s = report.summary;
                Debug.Log($"[dramatis] Web build {s.result}: {s.totalSize / 1e6:F1} MB in {s.totalTime.TotalSeconds:F0} s to {outDir}");
                return s.result == UnityEditor.Build.Reporting.BuildResult.Succeeded;
            }
            catch (Exception e)
            {
                Debug.LogError("[dramatis] Web build failed: " + e);
                return false;
            }
        }

        /// <summary>Copies of every glTFast material under Assets/Characters, one per shader and keyword set.</summary>
        static Material[] KeepVariants()
        {
            var dir = Generated + "/Variants";
            if (AssetDatabase.IsValidFolder(dir)) AssetDatabase.DeleteAsset(dir);
            AssetDatabase.CreateFolder(Generated, "Variants");
            var seen = new HashSet<string>();
            var kept = new List<Material>();
            if (!AssetDatabase.IsValidFolder(Characters)) return kept.ToArray();
            foreach (var guid in AssetDatabase.FindAssets("", new[] { Characters }))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                if (!path.EndsWith(".glb", StringComparison.OrdinalIgnoreCase)) continue;
                foreach (var m in AssetDatabase.LoadAllAssetsAtPath(path).OfType<Material>())
                {
                    var key = m.shader.name + "|" + string.Join(" ", m.shaderKeywords.OrderBy(k => k)) + "|" + m.renderQueue;
                    if (!seen.Add(key)) continue;
                    var copy = new Material(m) { name = "variant " + kept.Count };
                    foreach (var prop in copy.GetTexturePropertyNames()) copy.SetTexture(prop, null);
                    AssetDatabase.CreateAsset(copy, $"{dir}/variant-{kept.Count}.mat");
                    kept.Add(copy);
                }
            }
            AssetDatabase.SaveAssets();
            return kept.ToArray();
        }

        /// <summary>The floor: the floor colour with faint 2 m tile lines (one tile per texture).</summary>
        static Texture2D FloorTexture()
        {
            const int n = 256;
            var tex = new Texture2D(n, n, TextureFormat.RGBA32, true);
            var baseC = new Color32(0x5d, 0x66, 0x72, 0xff);
            var line = new Color32(0x6a, 0x73, 0x80, 0xff);
            var px = new Color32[n * n];
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                    px[y * n + x] = x < 3 || y < 3 ? line : baseC;
            tex.SetPixels32(px);
            tex.Apply();
            var path = Generated + "/floor.png";
            File.WriteAllBytes(path, tex.EncodeToPNG());
            AssetDatabase.ImportAsset(path);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.wrapMode = TextureWrapMode.Repeat;
            importer.anisoLevel = 8;
            importer.sRGBTexture = true;
            importer.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }

        static Material Standard(string name, Color color, Texture2D tex = null, float tiles = 1)
        {
            var m = new Material(Shader.Find("Standard")) { name = name, color = color };
            m.SetFloat("_Glossiness", 0.15f);
            if (tex != null)
            {
                m.mainTexture = tex;
                m.mainTextureScale = new Vector2(tiles, tiles);
            }
            AssetDatabase.CreateAsset(m, $"{Generated}/{name}.mat");
            return m;
        }

        static void MakeScene(Material[] variants)
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.62f, 0.66f, 0.72f);
            RenderSettings.ambientEquatorColor = new Color(0.42f, 0.45f, 0.5f);
            RenderSettings.ambientGroundColor = new Color(0.25f, 0.28f, 0.32f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = Sky;
            RenderSettings.fogStartDistance = 14;
            RenderSettings.fogEndDistance = 30;

            var camGo = new GameObject("Camera") { tag = "MainCamera" };
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Sky;
            cam.fieldOfView = 40;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 80;

            var sunGo = new GameObject("Sun");
            var sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 1.2f;
            sun.shadows = LightShadows.Soft;
            sunGo.transform.rotation = Quaternion.LookRotation(new Vector3(-3, -6, -4));

            var floor = GameObject.CreatePrimitive(PrimitiveType.Plane); // 10 m a side
            floor.name = "Floor";
            UnityEngine.Object.DestroyImmediate(floor.GetComponent<Collider>());
            floor.transform.localScale = new Vector3(3, 1, 3); // 30 m, the arena
            floor.GetComponent<MeshRenderer>().sharedMaterial =
                Standard("floor", Color.white, FloorTexture(), 15); // 2 m tiles

            var pillarMat = Standard("pillar", new Color32(0x8a, 0x93, 0xa3, 0xff));
            var ring = Walk.PillarRing();
            for (int i = 0; i < ring.Length; i++)
            {
                var p = ring[i];
                float h = (float)Walk.PillarHeight(i);
                var c = GameObject.CreatePrimitive(PrimitiveType.Cylinder); // 2 m tall, 1 m across
                c.name = "Pillar " + i;
                UnityEngine.Object.DestroyImmediate(c.GetComponent<Collider>());
                c.transform.position = new Vector3((float)p.x, h / 2, (float)p.z);
                c.transform.localScale = new Vector3((float)p.r * 2, h / 2, (float)p.r * 2);
                c.GetComponent<MeshRenderer>().sharedMaterial = pillarMat;
            }

            var playerGo = new GameObject("Dramatis");
            var player = playerGo.AddComponent<DramatisPlayer>();
            player.cam = cam;
            player.sun = sun;
            player.floor = floor.transform;
            player.keepVariants = variants;

            EditorSceneManager.SaveScene(scene, ScenePath);
        }
    }
}
