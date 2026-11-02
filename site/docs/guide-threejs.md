# three.js

<!--{"parent": "docs", "order": 11}-->

**A Dramatis GLB is an ordinary glTF file.** three.js opens it with its own
`GLTFLoader`, with no plugin and no fixes. Quaternius' Universal Animation
Library (UAL) clips play on it by name, the face is a set of morph targets,
and the licence of every asset is written inside the file.

This page covers a GLB you exported. If you want to build the character in
the page and keep it live as sliders move, read [dramatis/three](/dramatis-three/).

**Try it:** the [three.js viewer](/viewer/) opens any GLB you drop on it.
The creator's **View in three.js** button sends its export there.

## Load it

```ts
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const gltf = await new GLTFLoader().loadAsync('character.glb')
scene.add(gltf.scene)
```

That is all the setup there is. The file is in metres, Y up, facing +Z, with
its feet on y = 0 (the [export format](/export-format/) gives the full
profile). Its meshes are named `body`, `eyes`, `hair`, `garment_<asset>` and
so on. Every mesh is skinned to one 65-joint skeleton, and the materials are
plain metallic-roughness PBR, so they need no special lighting. A
`HemisphereLight` and a `DirectionalLight` are enough, and an environment
map (`RoomEnvironment`) makes them look better.

## Play an animation

The skeleton is UAL's: the same joint names, and each joint at rest in UAL's
own frame. A UAL clip's rotation keys therefore mean the same thing on your
character as on Quaternius' mannequin, so the clip plays **by name, without
retargeting**.

There is one catch. A clip's translation keys hold the mannequin's bone
lengths, and played as they are they stretch your character to the
mannequin's proportions. So keep the rotations on every joint, keep the
translations only on `root` and `pelvis`, and scale those by the ratio of
the two hips' heights. `characterClip` from `dramatis/three` does exactly
this:

```ts
import { AnimationMixer } from 'three'
import { characterClip } from 'dramatis/three'

const ual = await loader.loadAsync('UAL1.glb') // Quaternius, CC0
const walk = ual.animations.find((a) => a.name === 'Walk_Loop')!

const naming = gltf.asset.extras?.dramatis?.naming ?? 'ue'
const hips = (root, name) =>
  root.getObjectByName(name).getWorldPosition(new Vector3()).y
const translationScale =
  hips(gltf.scene, naming === 'ue' ? 'pelvis' : 'mixamorigHips') /
  hips(ual.scene, 'pelvis')

const mixer = new AnimationMixer(gltf.scene)
mixer.clipAction(characterClip(walk, { naming, translationScale })).play()
// and every frame: mixer.update(delta)
```

If you would rather not depend on Dramatis at run time, the same filter is
about fifteen lines (`src/three/clip.ts`). Walk the clip's tracks, keep
`*.quaternion` and the `.position` of `root` and `pelvis`, and drop the rest.

**Mixamo names.** An export made with Mixamo names (the creator's naming
menu) has the same joints and the same rest frames under other names, such
as `mixamorig:Hips`. three.js drops the `:` when it binds (`mixamorigHips`),
as it does for Mixamo's own files. A UAL clip then needs its tracks
**renamed**, which `characterClip(clip, { naming: 'mixamo' })` does. Nothing
else changes, so this is still not retargeting.

**Clips from elsewhere.** A clip made for another skeleton, with other names
or other rest frames, needs real retargeting. three.js has
`SkeletonUtils.retargetClip` for that, but Dramatis doesn't do it for you.
The viewer says which joints a clip could not find, rather than guessing.

## Drive the face

The face goes out as **morph targets, one per face unit**, named as
MakeHuman names them (`JawDrop`, `LeftUpperLidClosed`, `MouthLeftPullUp` and
the rest: [59 in all](/export-format/)). three.js reads the names from the
file into `morphTargetDictionary`. One unit can be on several meshes (the
lids are on the body and on the eyelashes), and they move together:

```ts
function setFaceUnit(unit: string, weight: number) {
  gltf.scene.traverse((o) => {
    const i = o.morphTargetDictionary?.[unit]
    if (i !== undefined) o.morphTargetInfluences[i] = weight
  })
}

setFaceUnit('JawDrop', 0.3)
setFaceUnit('LeftUpperLidClosed', 1) // and the right, to blink
```

`gltf.asset.extras.dramatis.faceUnits` lists the units the file has.

## Show the licences

Every asset in the file has an entry in `gltf.asset.extras.dramatis.licences`
giving its title, author, source, SPDX licence id and licence URL. A CC BY
asset also has `attribution`, the credit line its licence asks for, word
for word. Show that line wherever you show the character:

```ts
for (const l of gltf.asset.extras.dramatis.licences)
  console.log(
    `${l.title}: ${l.licence}, by ${l.author}`,
    l.attribution ?? ''
  )
```

`gltf.asset.copyright` repeats the same list as one line, for tools that
show only that. The animation you play is not in the character's file, so
credit it yourself. UAL is CC0, which asks for nothing, but naming Quaternius
is kind.

## The viewer

The [viewer](/viewer/) is this page as a working tool. It is three.js only:
its build fails if any Babylon code ends up in its bundle. It opens a GLB in
any of four ways:

- **from the creator:** **View in three.js** puts the export in this
  browser's IndexedDB and opens `/viewer/?handoff=<id>`. Nothing goes over
  the network. The export is kept for a day, so a reload still finds it.
- **by URL:** `/viewer/?glb=<url>` (the server must allow cross-origin reads).
- **by dropping** a `.glb` anywhere on the page.
- **with Open GLB…**, which picks one from disk.

It plays UAL's `Walk_Loop` at once, and **More UAL clips** fetches the
other 38 clips of UAL volume 1 (6.6 MB, CC0) from the tosijs CDN. Under
**Motion** it says how the clip bound: by name with no retargeting, with
the names translated for Mixamo, or not at all, naming the joints it could
not find. **Face** sets any face unit, and **blink** runs the lid units every
four seconds. The licence list is read from the file. A GLB that is not a
Dramatis export still opens, and the viewer says so.

## The sample

`samples/three-glb/` is a whole integration on one page, written to be
copied: a loader, lights, orbit controls, a UAL walk, a face unit, a blink,
and the licence list. Run it from a checkout:

```sh
bun samples/three-glb/serve.ts                  # a sample export
bun samples/three-glb/serve.ts --glb my.glb     # yours
```

Its `main.ts` imports `characterClip` from the source so that it runs
without a build. In your project, import it from `dramatis/three`.

## What is checked

- Under Bun (`bun test site/viewer`), on the real sample exports in both
  namings: the viewer reads the Dramatis block and the naming, `Walk_Loop`
  binds by name to every major joint and moves the hand, the face units
  set every mesh that has them, and each licence line carries its credit.
  A file with a renamed joint is refused, and the refusal names the joint.
  The viewer's bundle has no Babylon in it.
- In headless Chromium (`DRAMATIS_BROWSER=1 bun test site/viewer`, WebGL on
  SwiftShader): the viewer opens a GLB by URL, by file picker, by drop and
  by handoff, which survives a reload. Each time the hand is measured moving
  and the jaw's morph weight is read back. The page fits a phone's width.
  The sample page loads, lists its licences, and its picture changes from
  frame to frame.
- With `DRAMATIS_NETWORK=1` as well, the whole path runs: the creator page
  loads, **View in three.js** is clicked, and the viewer shows the
  character walking, with its licences. Then UAL's other clips load from the
  CDN and `Dance_Loop` plays.

Not checked here: how the character looks on a real GPU (the browser tests
draw with SwiftShader), and other browsers.
