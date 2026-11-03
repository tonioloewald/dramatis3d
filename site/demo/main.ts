// The site's three.js demo (/demo/): walk your character round a small scene.
// It loads a character saved in this browser (the creator's working figure or
// a named save, built to a GLB here with Dramatis's exporter), a GLB or VRM
// you open, a character file (.json), or a GLB the creator hands it
// (`?handoff=<id>`), or one by URL (`?glb=<url>`). It plays UAL's CC0 idle, walk, jog and sprint loops on
// it to match its speed, and blinks.
//
// three.js and the engine-free core only: no Babylon (the build checks). How
// input becomes motion is in core.ts, tested under Bun.

import {
  AnimationMixer,
  CanvasTexture,
  Clock,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type AnimationAction,
  type AnimationClip,
  type Material,
  type Object3D,
  type Texture,
} from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { readCharacter } from 'tosijs-3d/character-file'
import { characterStore, WORKING_CHARACTER } from 'tosijs-3d/character-store'
import { loadHumanPack, type HumanPack } from 'tosijs-3d/human-pack'
import { exportCharacterGlb } from '../../src/contracts/export'
import {
  GLB_URL_PARAM,
  HANDOFF_PARAM,
  takeHandoff,
  fetchGlb,
} from '../../src/contracts/handoff'
import { BUILD_SETTINGS, HM08_PACK_URL } from '../../src/build/settings'
import {
  describeModel,
  fitClip,
  licenceLine,
  setFaceUnit,
  type LoadedModel,
} from '../viewer/core'
import {
  collide,
  DEFAULT_CHARACTER,
  fileKind,
  GAITS,
  gaitFor,
  headingOf,
  KEY_CODES,
  keySign,
  pillarRing,
  saveChoices,
  steer,
  towardGoal,
  turnToward,
  type Flat,
  type Gait,
  type Keys,
} from './core'
import { STARTER_URL } from '../clips'

/** The site's starter clips (site/clips.ts): the gaits, cut from UAL, CC0. */
const UAL_CORE_URL = STARTER_URL
/** The viewer's bundled Walk_Loop, if the CDN is out of reach. */
const WALK_URL = '/viewer/ual-walk.glb'
/** The arena: a square this many metres a side, the floor's tiles 2 m. */
const ARENA = 30
const PILLARS = pillarRing()
const WALKER_RADIUS = 0.3

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T
const ui = {
  stage: $<HTMLDivElement>('stage'),
  title: $<HTMLSpanElement>('title'),
  status: $<HTMLDivElement>('status'),
  savesRow: $<HTMLDivElement>('saves-row'),
  saves: $<HTMLSelectElement>('saves'),
  load: $<HTMLButtonElement>('load'),
  open: $<HTMLButtonElement>('open'),
  file: $<HTMLInputElement>('file'),
  licenceBox: $<HTMLDetailsElement>('licence-box'),
  licenceSummary: $<HTMLElement>('licence-summary'),
  licences: $<HTMLUListElement>('licences'),
}

function status(message: string, tone: 'info' | 'error' = 'info'): void {
  ui.status.textContent = message
  ui.status.className = tone === 'error' ? 'error' : ''
  state.status = message
  state.error = tone === 'error'
}

const message = (e: unknown) => String((e as Error)?.message ?? e)

// --- state (also read by the browser test) -----------------------------------

interface DemoState {
  status: string
  error: boolean
  name: string | null
  gait: Gait
  /** Where the character stands, x and z. */
  at: Flat
  clips: string[]
  frames: number
}
const state: DemoState = {
  status: '',
  error: false,
  name: null,
  gait: 'idle',
  at: { x: 0, z: 0 },
  clips: [],
  frames: 0,
}
;(window as unknown as { dramatisDemo: DemoState }).dramatisDemo = state

// --- the stage ------------------------------------------------------------------

const renderer = new WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
ui.stage.append(renderer.domElement)

const scene = new Scene()
const sky = new Color(0x2a3340)
scene.background = sky
scene.fog = new Fog(sky, 14, 30)
const pmrem = new PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.add(new HemisphereLight(0xffffff, 0x404858, 0.5))
const sun = new DirectionalLight(0xffffff, 1.8)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024) // 12 m across: sharp enough, and cheap
sun.shadow.camera.left = sun.shadow.camera.bottom = -6
sun.shadow.camera.right = sun.shadow.camera.top = 6
sun.shadow.bias = -0.0005
const SUN_OFFSET = new Vector3(3, 6, 4)
scene.add(sun, sun.target)

// The creator's floor: a faint tosijs grid, 2 m a tile. three.js (no tone
// mapping, a brighter room) shows it about twice as strong as Babylon does,
// so it is drawn again at half strength over the floor colour.
const floorCanvas = document.createElement('canvas')
floorCanvas.width = floorCanvas.height = 512
const floorTexture = new CanvasTexture(floorCanvas)
{
  const g = floorCanvas.getContext('2d')!
  g.fillStyle = '#5d6672'
  g.fillRect(0, 0, 512, 512)
  const img = new Image()
  img.onload = () => {
    g.globalAlpha = 0.5
    g.drawImage(img, 0, 0, 512, 512)
    floorTexture.needsUpdate = true
  }
  img.src = '/creator-ground.svg'
}
floorTexture.wrapS = floorTexture.wrapT = RepeatWrapping
floorTexture.repeat.set(ARENA / 2, ARENA / 2)
floorTexture.colorSpace = SRGBColorSpace
floorTexture.anisotropy = 8
const floor = new Mesh(
  new PlaneGeometry(ARENA, ARENA),
  new MeshStandardMaterial({ map: floorTexture, roughness: 0.9 })
)
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)

const pillarMaterial = new MeshStandardMaterial({
  color: 0x8a93a3,
  roughness: 0.7,
})
PILLARS.forEach((p, i) => {
  const h = 1 + (i % 4) * 0.6
  const m = new Mesh(new CylinderGeometry(p.r, p.r, h, 24), pillarMaterial)
  m.position.set(p.x, h / 2, p.z)
  m.castShadow = m.receiveShadow = true
  scene.add(m)
})

const camera = new PerspectiveCamera(40, 1, 0.05, 80)
camera.position.set(1.4, 1.7, 4.2)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1, 0)
controls.enableDamping = true
controls.enablePan = false
controls.minDistance = 1.2
controls.maxDistance = 12
controls.maxPolarAngle = Math.PI * 0.49
controls.update()

function resize(): void {
  const { clientWidth: w, clientHeight: h } = ui.stage
  camera.aspect = w / Math.max(h, 1)
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}
window.addEventListener('resize', resize)
resize()

// --- clips --------------------------------------------------------------------------

const loader = new GLTFLoader()
interface ClipSource {
  clips: AnimationClip[]
  scene: Object3D
}
let clipSource: Promise<ClipSource> | null = null
/** The starter clips, else the bundled walk alone. */
function clips(): Promise<ClipSource> {
  return (clipSource ??= loader
    .loadAsync(UAL_CORE_URL)
    .catch(() => loader.loadAsync(WALK_URL))
    .then((g) => ({ clips: g.animations, scene: g.scene })))
}

// --- the character -------------------------------------------------------------

interface Walker {
  gltf: GLTF
  model: LoadedModel
  mixer: AnimationMixer
  actions: Partial<Record<Gait, AnimationAction>>
  playing: Gait | null
  heading: number
  speed: number
}
let walker: Walker | null = null

function dispose(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh
    mesh.geometry?.dispose()
    const mats = ([] as Material[]).concat(mesh.material ?? [])
    for (const m of mats) {
      for (const v of Object.values(m))
        if ((v as Texture)?.isTexture) (v as Texture).dispose()
      m.dispose()
    }
  })
}

async function show(gltf: GLTF, fileName: string): Promise<void> {
  if (walker) {
    walker.mixer.stopAllAction()
    scene.remove(walker.gltf.scene)
    dispose(walker.gltf.scene)
  }
  const model = describeModel(gltf, fileName)
  gltf.scene.traverse((o) => {
    if ((o as Mesh).isMesh) {
      o.castShadow = true
      o.frustumCulled = false // skinned: the bind-pose bounds lie
    }
  })
  gltf.scene.position.set(0, 0, 0)
  scene.add(gltf.scene)
  const w: Walker = {
    gltf,
    model,
    mixer: new AnimationMixer(gltf.scene),
    actions: {},
    playing: null,
    heading: 0,
    speed: 0,
  }
  walker = w
  state.name = model.name
  state.at = { x: 0, z: 0 }
  ui.title.textContent = model.name
  showLicences(model)
  goal = null

  status(`${model.name}: fetching the clips…`)
  let source: ClipSource
  try {
    source = await clips()
  } catch (e) {
    status(
      `${model.name} is here, but the clips wouldn’t load: ${message(e)}`,
      'error'
    )
    return
  }
  if (walker !== w) return
  const bad: string[] = []
  for (const g of GAITS) {
    const raw = source.clips.find((c) => c.name === g.clip)
    if (!raw) continue
    const fit = fitClip(raw, model, gltf.scene, source.scene)
    if (!fit.ok) bad.push(fit.summary)
    const action = w.mixer.clipAction(fit.clip)
    action.enabled = true
    action.setEffectiveWeight(0)
    action.play()
    w.actions[g.name] = action
  }
  state.clips = Object.keys(w.actions)
  setGait(w, 'idle', 0)
  if (bad.length) status(bad[0]!, 'error')
  else
    status(
      w.actions.idle
        ? `${model.name} is ready. Walk them round.`
        : `${model.name} is ready (only the walk loaded; the CDN is out of reach).`
    )
}

/** Cross-fade to a gait's clip (or the nearest one that loaded). */
function setGait(w: Walker, gait: Gait, fade = 0.25): void {
  const order = GAITS.map((g) => g.name)
  let want = gait
  if (!w.actions[want])
    want = order.find((g) => w.actions[g] && g !== 'idle') ?? want
  if (w.playing === want) return
  const next = w.actions[want]
  if (!next) return
  const prev = w.playing ? w.actions[w.playing] : undefined
  next.reset().setEffectiveWeight(1).play()
  if (prev) next.crossFadeFrom(prev, fade, true)
  // With no idle clip, standing still is the walk held at its first frame.
  next.timeScale = gait === 'idle' && want !== 'idle' ? 0 : 1
  w.playing = want
  state.gait = gait
}

// --- licences --------------------------------------------------------------------

function safeUrl(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

function showLicences(model: LoadedModel): void {
  const entries = model.extras?.licences ?? []
  ui.licences.replaceChildren(
    ...entries.map((entry) => {
      const li = document.createElement('li')
      li.append(licenceLine(entry), ' ')
      const href = safeUrl(entry.licenceUrl)
      if (href) {
        const a = document.createElement('a')
        a.href = href
        a.target = '_blank'
        a.rel = 'noopener'
        a.textContent = 'licence'
        li.append(a)
      }
      return li
    }),
    Object.assign(document.createElement('li'), {
      textContent: 'Animations: Quaternius, Universal Animation Library, CC0.',
    })
  )
  if (entries.length === 0)
    ui.licences.prepend(
      Object.assign(document.createElement('li'), {
        textContent: 'Not a Dramatis export: the file names no licences.',
      })
    )
  ui.licenceSummary.textContent = entries.length
    ? `Licences: ${entries.length} assets`
    : 'Licences'
  ui.licenceBox.hidden = false
}

// --- loading ---------------------------------------------------------------------

let pack: Promise<HumanPack> | null = null

// The latest pick wins: a slower earlier one (a save still building when
// another is picked) is dropped when it finishes.
let latest = 0
const begin = () => ++latest

/** A character file to a GLB, built here with Dramatis's exporter. */
async function fromCharacter(doc: unknown, label: string): Promise<void> {
  const ticket = begin()
  status(`Building ${label}…`)
  try {
    const { character } = readCharacter(doc, { settings: BUILD_SETTINGS })
    pack ??= loadHumanPack(HM08_PACK_URL)
    const glb = await exportCharacterGlb(character, await pack)
    if (ticket !== latest) return
    await fromBytes(glb, `${character.name || label}.glb`, ticket)
  } catch (e) {
    pack = null
    if (ticket === latest)
      status(`Couldn’t build ${label}: ${message(e)}`, 'error')
  }
}

async function fromBytes(
  bytes: Uint8Array,
  name: string,
  ticket = begin()
): Promise<void> {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const gltf = await loader.parseAsync(buffer, '')
  if (ticket !== latest) return
  await show(gltf, name)
}

async function fromFile(file: File): Promise<void> {
  const kind = fileKind(file.name)
  if (kind === 'character')
    return fromCharacter(JSON.parse(await file.text()), file.name)
  if (kind === 'gltf')
    return status(
      `${file.name}: a .gltf names its buffers as separate files. Open a .glb (Dramatis exports GLB).`,
      'error'
    )
  if (kind === null)
    return status(
      `${file.name}: open a .glb, .vrm or character .json.`,
      'error'
    )
  status(`Opening ${file.name}…`)
  const ticket = begin()
  try {
    await fromBytes(new Uint8Array(await file.arrayBuffer()), file.name, ticket)
  } catch (e) {
    status(`${file.name} wouldn’t load: ${message(e)}`, 'error')
  }
}

const store = characterStore()

async function listSaves(): Promise<string[]> {
  const names = await store.list().catch(() => [] as string[])
  const working = await store.get(WORKING_CHARACTER).catch(() => null)
  const choices = saveChoices(names, working !== null, WORKING_CHARACTER)
  ui.saves.replaceChildren(
    ...choices.map((c) =>
      Object.assign(document.createElement('option'), {
        value: c.key,
        textContent: c.label,
      })
    )
  )
  ui.savesRow.hidden = choices.length === 0
  return choices.map((c) => c.key)
}

async function fromSave(key: string): Promise<void> {
  const doc = await store.get(key).catch(() => null)
  if (!doc) return status(`No saved character called ${key}.`, 'error')
  const label = key === WORKING_CHARACTER ? 'the figure in the creator' : key
  await fromCharacter(doc, label)
}

ui.load.addEventListener('click', () => void fromSave(ui.saves.value))
ui.open.addEventListener('click', () => ui.file.click())
ui.file.addEventListener('change', () => {
  const f = ui.file.files?.[0]
  if (f) void fromFile(f)
  ui.file.value = ''
})

let dragDepth = 0
window.addEventListener('dragenter', (e) => {
  e.preventDefault()
  dragDepth++
  document.body.classList.add('dragging')
})
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) {
    dragDepth = 0
    document.body.classList.remove('dragging')
  }
})
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => {
  e.preventDefault()
  dragDepth = 0
  document.body.classList.remove('dragging')
  const f = e.dataTransfer?.files?.[0]
  if (f) void fromFile(f)
})

// --- input ------------------------------------------------------------------------

const keys: Keys = { forward: 0, right: 0, run: false }
const held = new Set<string>()
function readKeys(): void {
  keys.forward = keys.right = 0
  keys.run = false
  for (const code of held) {
    const axis = KEY_CODES[code]
    if (axis === 'run') keys.run = true
    else if (axis) keys[axis] += keySign(code)
  }
  keys.forward = Math.sign(keys.forward)
  keys.right = Math.sign(keys.right)
}
const typing = (e: KeyboardEvent) =>
  e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement
window.addEventListener('keydown', (e) => {
  if (typing(e) || !(e.code in KEY_CODES)) return
  e.preventDefault()
  held.add(e.code)
  goal = null
  readKeys()
})
window.addEventListener('keyup', (e) => {
  held.delete(e.code)
  readKeys()
})
window.addEventListener('blur', () => {
  held.clear()
  readKeys()
})

// Click (or tap) the ground to walk there: a click, not the end of a drag.
let goal: Flat | null = null
let goalRun = false
const ray = new Raycaster()
let down: { x: number; y: number } | null = null
renderer.domElement.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY }
})
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return
  down = null
  const r = renderer.domElement.getBoundingClientRect()
  ray.setFromCamera(
    new Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    ),
    camera
  )
  const hit = ray.intersectObject(floor)[0]
  if (!hit) return
  goal = { x: hit.point.x, z: hit.point.z }
  goalRun = e.shiftKey || e.detail >= 2 // shift-click or double-click runs
})

// --- go ------------------------------------------------------------------------------

const look = new Vector3()
const clock = new Clock()
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1)
  const w = walker
  if (w) {
    camera.getWorldDirection(look)
    const byKeys = steer(keys, Math.atan2(look.x, look.z))
    const byGoal = !byKeys && goal ? towardGoal(state.at, goal) : null
    if (!byKeys && goal && !byGoal) goal = null
    const dir = byKeys ?? byGoal
    const run = byKeys ? keys.run : goalRun
    const target = dir ? GAITS[run ? 2 : 1].speed : 0
    // Ease the speed, so the cross-fades have time to land.
    w.speed += (target - w.speed) * Math.min(1, dt * 6)
    if (dir) w.heading = turnToward(w.heading, headingOf(dir), dt * 8)
    const fwd = { x: Math.sin(w.heading), z: Math.cos(w.heading) }
    const before = state.at
    state.at = collide(
      {
        x: before.x + fwd.x * w.speed * dt,
        z: before.z + fwd.z * w.speed * dt,
      },
      WALKER_RADIUS,
      PILLARS,
      ARENA / 2
    )
    w.gltf.scene.position.set(state.at.x, 0, state.at.z)
    w.gltf.scene.rotation.y = w.heading
    setGait(w, w.speed < 0.25 ? 'idle' : gaitFor(w.speed).name)
    // The camera follows: the target moves with the character.
    const dx = state.at.x - before.x
    const dz = state.at.z - before.z
    controls.target.x += dx
    controls.target.z += dz
    camera.position.x += dx
    camera.position.z += dz
    sun.position.set(
      state.at.x + SUN_OFFSET.x,
      SUN_OFFSET.y,
      state.at.z + SUN_OFFSET.z
    )
    sun.target.position.set(state.at.x, 0, state.at.z)
    w.mixer.update(dt)
    blink(w, clock.elapsedTime)
  }
  controls.update()
  renderer.render(scene, camera)
  state.frames++
})

const BLINK = ['LeftUpperLidClosed', 'RightUpperLidClosed']
function blink(w: Walker, time: number): void {
  const phase = time % 3.7
  const weight = phase < 0.16 ? Math.sin((phase / 0.16) * Math.PI) : 0
  for (const u of BLINK) setFaceUnit(w.model, u, weight)
}

async function start(): Promise<void> {
  const params = new URLSearchParams(location.search)
  const handoff = params.get(HANDOFF_PARAM)
  if (handoff) {
    const glb = await takeHandoff(handoff).catch(() => null)
    if (glb) return fromBytes(glb.glb, glb.fileName)
    status('That hand-off has expired. Pick a character below.', 'error')
  }
  const glbUrl = params.get(GLB_URL_PARAM)
  if (glbUrl) {
    status(`Opening ${glbUrl}…`)
    try {
      await fromBytes(await fetchGlb(glbUrl), glbUrl)
    } catch (e) {
      status(`${glbUrl} wouldn’t load: ${message(e)}`, 'error')
    }
    void listSaves()
    return
  }
  const saved = await listSaves()
  if (saved.length) return fromSave(saved[0]!)
  // Nobody saved yet: a default character, built here like any other.
  await fromCharacter(DEFAULT_CHARACTER, 'a default character')
  if (!state.error)
    status(
      'A default character. Make your own in the creator and it shows up here.'
    )
}
void start()
