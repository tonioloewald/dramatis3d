// A plain three.js page: a Dramatis character, live sliders, orbit controls,
// and a third-party UAL clip played on it by name. No framework.
//
// Run: bun samples/three/serve.ts, then open the URL it prints.
//
// An adopter imports `dramatis/three`; this sample imports the source so it
// runs from a checkout without a build.
//
// Until the skinned-glb lane's builder exists, the character is the adapter's
// hand-made stand-in (src/three/fixture-character.ts). With the builder:
//   const built = await buildCharacter(character, pack)   // from 'dramatis'
// and on a slider change, rebuild and call updateCharacterObject(c, built).

import {
  AnimationMixer,
  Clock,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type AnimationAction,
  type AnimationClip,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  characterClip,
  characterObject,
  updateCharacterObject,
} from '../../src/three/index'
import {
  fixtureCharacter,
  ualRest,
  type FixtureShape,
} from '../../src/three/fixture-character'

const renderer = new WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
document.body.prepend(renderer.domElement)

const scene = new Scene()
scene.background = new Color(0x20232a)
scene.add(new HemisphereLight(0xffffff, 0x404040, 1.5))
const sun = new DirectionalLight(0xffffff, 2)
sun.position.set(2, 4, 3)
scene.add(sun)
scene.add(new GridHelper(4, 8, 0x666666, 0x444444))

const camera = new PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 50)
camera.position.set(1.2, 1.4, 3.2)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0.95, 0)
controls.update()

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

// The skeleton's rest and the clip both come from UAL (CC0).
const bytes = new Uint8Array(
  await (await fetch('./ual-walk.glb')).arrayBuffer()
)
const rest = ualRest(bytes)
const ual = await new GLTFLoader().parseAsync(bytes.buffer, '')
const walk = ual.animations.find((a) => a.name === 'Walk_Loop') as AnimationClip

const shape: Required<FixtureShape> = { height: 1, arms: 1, bulk: 1 }
const character = characterObject(fixtureCharacter(rest, shape))
scene.add(character.root)

const mixer = new AnimationMixer(character.root)
let action: AnimationAction | null = null
let walking = true
function playWalk(): void {
  const time = action?.time ?? 0
  action?.stop()
  if (action) mixer.uncacheClip(action.getClip())
  action = null
  if (!walking) return
  // Rotations on every joint; hips' translation scaled to this body.
  action = mixer.clipAction(
    characterClip(walk, { translationScale: shape.height })
  )
  action.time = time
  action.play()
}
playWalk()

// --- the panel -------------------------------------------------------------

const panel = document.getElementById('panel')!
function slider(
  label: string,
  min: number,
  max: number,
  value: number,
  onInput: (v: number) => void
): void {
  const name = document.createElement('label')
  name.textContent = label
  const input = document.createElement('input')
  Object.assign(input, { type: 'range', min, max, step: 0.01, value })
  const out = document.createElement('output')
  out.textContent = value.toFixed(2)
  input.addEventListener('input', () => {
    const v = Number(input.value)
    out.textContent = v.toFixed(2)
    onInput(v)
  })
  panel.append(name, input, out)
}

// Body sliders rebuild the character and update it in place: same root,
// same bones, the mixer keeps playing.
const reshape =
  (key: keyof FixtureShape) =>
  (v: number): void => {
    shape[key] = v
    updateCharacterObject(character, fixtureCharacter(rest, shape))
    if (key === 'height') playWalk()
  }
slider('height', 0.8, 1.2, 1, reshape('height'))
slider('arms', 0.8, 1.25, 1, reshape('arms'))
slider('bulk', 0.6, 1.8, 1, reshape('bulk'))
// Face units are morph targets: no rebuild at all.
slider('jaw', 0, 1, 0, (v) => character.setFaceUnit('JawDrop', v))
slider('left eye', 0, 1, 0, (v) => character.setFaceUnit('LeftEyeturnLeft', v))

const toggle = document.createElement('label')
const box = document.createElement('input')
box.type = 'checkbox'
box.checked = true
box.addEventListener('change', () => {
  walking = box.checked
  playWalk()
})
toggle.append(box, ' walk')
panel.append(toggle)

const clock = new Clock()
renderer.setAnimationLoop(() => {
  mixer.update(clock.getDelta())
  renderer.render(scene, camera)
})
