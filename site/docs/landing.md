# Dramatis

<!--{"home": true, "pin": "top", "description": "An open 3D character creator for the web: CC0 base data, GLB and VRM out, works in any engine."}-->

**An open 3D character creator for the web.** Make a person, dress them, and
take them anywhere: CC0 base data, GLB and VRM out, for any engine.

<img
  class="hero"
  src="/art/dramatis-1200.webp"
  srcset="/art/dramatis-800.webp 800w, /art/dramatis-1200.webp 1200w, /art/dramatis-1600.webp 1600w"
  sizes="(max-width: 900px) 100vw, 900px"
  width="1600"
  height="894"
  decoding="async"
  style="display: block; width: 100%; height: auto; margin: 1em 0"
  alt="An engraving of a stage: a company of players in a row before the footlights, a housewife, a gentleman in a frock coat, a jester, a courtier with his hat in his hand, a lady in a plumed hat, a ragged boy, a knight and a girl in a ball gown, among others."
/>

**[Open the creator](/creator/)** · [three.js demo](/demo/) · [Unity demo](/unity/) ·
[three.js viewer](/viewer/) · [Documentation](/docs/)

Dramatis 0.1 is out (`npm install dramatis`). Shape a body, dress it, then
download it as a GLB, walk it round the three.js or Unity demo, or share it as
a link. It runs on [tosijs-3d](https://3d.tosijs.net)'s character system.

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

All of this was checked on spike 1's four sample exports, headless. How the
characters look on a real GPU has not been judged yet. A [VRM 1.0](/vrm/) export
(**Download VRM** in the creator) is **verified**: checked with three-vrm, and run in
VCam, a macOS VTuber app.

## Where to go next

- [Documentation](/docs/): the docs index.
- [GitHub](https://github.com/tonioloewald/dramatis3d): the source.
