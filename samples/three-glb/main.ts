// A Dramatis GLB in plain three.js: load it, play a CC0 UAL clip on it, open
// its jaw, list its licences. Copy this file; it is the whole integration.
//
// Run from a checkout: bun samples/three-glb/serve.ts, then open the URL.
// In your own project the import below is `from 'dramatis/three'`; this
// sample imports the source so it runs without a build. `characterClip` is
// fifteen lines (src/three/clip.ts) if you would rather not depend on it.

import {
  AnimationMixer,
  Clock,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { characterClip } from '../../src/three/index' // 'dramatis/three'

// --- a scene with default lighting and orbit controls --------------------

const renderer = new WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
document.body.prepend(renderer.domElement)

const scene = new Scene()
scene.background = new Color(0x2a3340)
scene.add(new HemisphereLight(0xffffff, 0x404858, 1.5))
const sun = new DirectionalLight(0xffffff, 2)
sun.position.set(2, 4, 3)
scene.add(sun)
scene.add(new GridHelper(4, 8, 0x6b7280, 0x4b5563))

const camera = new PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 50)
camera.position.set(1.2, 1.5, 3.6)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0.95, 0)
controls.update()

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

// --- the character: an ordinary glTF load ---------------------------------

const loader = new GLTFLoader()
const glbUrl =
  new URLSearchParams(location.search).get('glb') ?? './character.glb'
const character = await loader.loadAsync(glbUrl)
scene.add(character.scene)

// What Dramatis wrote about the file (site/docs/export-format.md).
const info = (character.asset.extras as Record<string, any> | undefined)
  ?.dramatis as
  | {
      naming: 'ue' | 'mixamo'
      character: string
      licences: {
        title: string
        licence: string
        author: string
        /** A CC BY credit line, word for word: show it. */
        attribution?: string
      }[]
    }
  | undefined

// --- the clip: Quaternius' UAL Walk_Loop (CC0), played by name ------------
//
// The export's joints have UAL's names and rest frames, so UAL's rotation
// keys mean the same thing on it: no retargeting. characterClip keeps the
// rotations, keeps translation on root and pelvis only (UAL's other
// translation keys are its mannequin's bone lengths), and renames the tracks
// when the file uses Mixamo names.

const ual = await loader.loadAsync('./ual-walk.glb')
const walk = ual.animations.find((a) => a.name === 'Walk_Loop')!
const naming = info?.naming ?? 'ue'

// The hips' translation keys are scaled by this body's hip height over UAL's
// mannequin's, so a short or tall character keeps its feet on the floor.
const hipHeight = (root: Object3D, name: string) => {
  root.updateMatrixWorld(true)
  return root.getObjectByName(name)?.getWorldPosition(new Vector3()).y ?? 1
}
const translationScale =
  hipHeight(character.scene, naming === 'ue' ? 'pelvis' : 'mixamorigHips') /
  hipHeight(ual.scene, 'pelvis')

const mixer = new AnimationMixer(character.scene)
mixer.clipAction(characterClip(walk, { naming, translationScale })).play()

// --- a face unit: a morph target, by name, on every mesh that has it ------

function setFaceUnit(unit: string, weight: number): void {
  character.scene.traverse((o) => {
    if (!(o instanceof Mesh) || !o.morphTargetDictionary) return
    const i = o.morphTargetDictionary[unit]
    if (i !== undefined) o.morphTargetInfluences![i] = weight
  })
}
setFaceUnit('JawDrop', 0.3)

// --- the licences, from asset.extras.dramatis ------------------------------

const list = document.getElementById('licences')!
for (const l of info?.licences ?? []) {
  const li = document.createElement('li')
  li.textContent = `${l.title}: ${l.licence}, by ${l.author}.${
    l.attribution ? ` Credit: ${l.attribution}` : ''
  }`
  list.append(li)
}
document.getElementById('name')!.textContent =
  info?.character ?? 'not a Dramatis export'

const clock = new Clock()
renderer.setAnimationLoop(() => {
  mixer.update(clock.getDelta())
  // Blink every four seconds: two more face units.
  const t = clock.elapsedTime % 4
  const lid = t < 0.18 ? Math.sin((t / 0.18) * Math.PI) : 0
  setFaceUnit('LeftUpperLidClosed', lid)
  setFaceUnit('RightUpperLidClosed', lid)
  renderer.render(scene, camera)
})
