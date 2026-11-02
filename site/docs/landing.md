# Dramatis

<!--{"home": true, "pin": "top", "description": "An open 3D character creator for the web: CC0 base data, GLB and VRM out, works in any engine."}-->

**An open 3D character creator for the web.** Make a person, dress them, and
take them anywhere: CC0 base data, GLB and VRM out, for any engine.

**[Open the creator](/creator/)** · [three.js demo](/demo/) · [three.js viewer](/viewer/) ·
[Documentation](/docs/)

Dramatis is in development. The creator works today: shape a body, dress it,
then download it as a GLB, open it in the three.js viewer, or share it as a
link. It runs on [tosijs-3d](https://3d.tosijs.net)'s character system.

## What it is for

- **A character that leaves.** A character made here should import into
  three.js, Babylon, Unity, Godot and Unreal 5 with no manual fixes, and
  play an animation you already have. That is the launch gate, and nothing
  ships before it passes.
- **Open data.** The bodies come from MakeHuman's CC0 data. Every asset
  states its [licence](/licences/) on this site and carries it into the
  files you export.
- **Yours to keep.** The creator stores characters in your browser and
  shares them by link. There are no accounts.

## Where it stands

| Engine | Status |
| --- | --- |
| [three.js](/guide-threejs/) | Verified: loads, plays UAL's walk by name, face and licences read |
| [Godot 4.5](/guide-godot/) | Verified: default import, skeleton, blend shapes, walk |
| [Babylon.js](/guide-babylon/) | Verified headless (`NullEngine`): skeleton, morphs, walk |
| [Unity 6](/guide-unity/) | Verified: glTFast import, Humanoid, walk; [Web player](/unity/) |
| [Unreal Engine 5](/guide-unreal/) | Not verified yet: a procedure, not yet run |

All of this was checked on four sample exports, headless. How the
characters look on a real GPU has not been judged yet. A VRM 1.0 export
exists in the library ([VRM](/vrm/)) but has no button in the creator, and
has not been tried in a VTuber app.

## Where to go next

- [Documentation](/docs/): the docs index.
- [GitHub](https://github.com/tonioloewald/dramatis3d): the source.
