# samples/unity

A minimal Unity project that imports Dramatis exports with **glTFast**
(`com.unity.cloud.gltfast`, pinned in `Packages/manifest.json`), builds a
**Humanoid** avatar for each, and plays Quaternius' UAL `Walk_Loop` (CC0) on
it, in batch mode. It is spike 1's Unity check (`reports/spike-1.md`).

**Status: run, 28/28 pass** (Unity 6000.6.7f1, glTFast 6.14.1, 2026-11-02;
`reports/spike-1.md`).

## What is here

| Path | What |
| --- | --- |
| `Packages/manifest.json` | glTFast plus the animation and image modules. Nothing else. |
| `Assets/Editor/DramatisEngineCheck.cs` | The check (`Dramatis.EngineCheck.Run`), also on the menu as **Dramatis > Run engine check**. |
| `Assets/Characters/` | Not committed: filled from `samples/out/` by `tools/engines/unity.ts`. |

Unity generates `ProjectSettings/`, `Library/` and the rest the first time
it opens the folder; they are git-ignored apart from what it writes into
`ProjectSettings/` (commit that after the first run, so the editor version
is recorded).

## Run it (exact steps)

1. Install a Unity editor with Unity Hub (Unity 6 LTS, `6000.0.x`, is what
   this was written for; 2022.3 LTS should work too: glTFast 6 supports
   2020.3 and later). macOS build support is enough; no platform modules.
2. From the repo root, copy the exports in and run the check:

   ```sh
   bun tools/engines/unity.ts
   ```

   It finds the newest editor under `/Applications/Unity/Hub/Editor/`
   (or `UNITY=/path/to/Unity bun tools/engines/unity.ts`), runs it, and
   prints PASS or FAIL per check. Without an editor it prints the command
   and exits 2. The command it runs is:

   ```sh
   /Applications/Unity/Hub/Editor/<version>/Unity.app/Contents/MacOS/Unity \
     -batchmode -nographics \
     -projectPath "$PWD/samples/unity" \
     -executeMethod Dramatis.EngineCheck.Run \
     -logFile - \
     -dramatisOut "$PWD/samples/unity/dramatis-results.json"
   ```

   The first run resolves glTFast from the Unity registry (network) and
   imports eight GLBs; expect several minutes. `-logFile -` puts Unity's
   log on stdout; the check's own lines start with `[dramatis]`.
3. If Package Manager says glTFast `6.14.1` is not available, change the
   version in `Packages/manifest.json` to the newest 6.x it offers and
   record that in the report.
4. To look at a character: open the project in the editor, drag
   `Assets/Characters/clothed-casual.walk.glb` into a scene, select it and
   play its clip from the Animation window. (Or **Dramatis > Run engine
   check**, which writes `dramatis-results.json` and logs each result.)

## The Web player (/unity/ on the site)

**Status: built** (2026-11-02, 6.5 MB). The same project also builds a Unity Web
player that the site's [/unity/](https://dramatis.tosijs.net/unity/) page
loads: the three.js demo's walk-round, in Unity. glTFast loads the GLB at
runtime, as a Unity game would, and UAL's idle, walk, jog and sprint loops
play on it by name (legacy clips, bound by path; nothing is retargeted).

| Path | What |
| --- | --- |
| `Assets/Dramatis/Runtime/DramatisPlayer.cs` | The player: loading, clips, walking, the camera, blinking |
| `Assets/Dramatis/Runtime/Walk.cs` | Its movement, a port of site/demo/core.ts; checked against it with Mono by `tools/engines/unity-walk.test.ts` |
| `Assets/Dramatis/Runtime/Bridge.cs`, `Assets/Plugins/WebGL/DramatisBridge.jslib` | Events back to the page |
| `Assets/Editor/DramatisWebBuild.cs` | The build: keeps glTFast's shader variants, makes the scene in code, builds for the Web |

To build it, add **Web Build Support** to the editor in Unity Hub, then:

```sh
bun tools/engines/unity.ts --web
```

It copies the exports in (their glTFast materials are what keeps the shader
variants), builds, and copies `Build/` to `site/unity/player/Build/`. Commit
that; the site ships it. Rebuild it when the export format or the player
changes.

## What it checks, per export

- **import**: glTFast makes a GameObject with SkinnedMeshRenderers.
- **skeleton**: one bone list of 65 shared by every renderer; the human
  bones found by name (Mixamo names with or without the `:`).
- **axes**: metres, Y up, the left hand at Unity's -X (glTFast mirrors X
  to go left-handed), facing +Z.
- **rest-skinning**: `BakeMesh` at rest equals the mesh (inverse bind
  matrices agree with the joints).
- **morphs**: 59 distinct blend shapes (the face units); `JawDrop` moves
  the body.
- **humanoid**: `AvatarBuilder.BuildHumanAvatar` with the profile's bone
  map (both namings) gives a valid human avatar. This is the spike's
  question "does Unity Humanoid need Mixamo naming": with an explicit map,
  it should not; run it and see.
- **clip**: `Walk_Loop` from the `.walk.glb` twin (UAL's keys spliced onto
  the export's own joints by `tools/engines/splice-clip.ts`) sampled over
  its length: head, hands and feet travel, the baked skin follows, and the
  Humanoid muscles change.

## Humanoid import settings

glTFast's importer has no Humanoid rig option of its own (it makes Legacy
or Generic clips). The Humanoid avatar is built in code from the bone map
in `DramatisEngineCheck.cs` (`UeForHuman`): UE (UAL) names to Unity's
`HumanBodyBones`, the same map VRM uses (`site/docs/export-format.md`,
"What VRM adds"). To use Unity's FBX Humanoid importer instead, export the
GLB to FBX from Blender; that route is not part of the check.
