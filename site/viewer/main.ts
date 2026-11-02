// The site's three.js viewer (/viewer/). It opens a GLB the creator hands it
// (`?handoff=<id>`, src/contracts/handoff.ts), a GLB by URL (`?glb=<url>`), or
// one dropped on the page or picked from disk; loads it with three's own
// GLTFLoader; plays Quaternius' CC0 UAL clips on it by name; drives its face
// units; and lists the licence of every asset inside.
//
// three.js and nothing else: no Babylon, no tosijs-3d character code. What a
// file is and how a clip fits it is in core.ts, tested under Bun.

import {
  AnimationMixer,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SkinnedMesh,
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
import {
  fetchGlb,
  GLB_URL_PARAM,
  HANDOFF_PARAM,
  takeHandoff,
} from '../../src/contracts/handoff'
import type { LicenceEntry } from '../../src/contracts/licences'
import { jointName } from '../../src/contracts/profile'
import {
  describeModel,
  faceUnitNames,
  fitClip,
  foreignOrigin,
  licenceLine,
  loadTickets,
  setFaceUnit,
  type ClipFit,
  type LoadedModel,
} from './core'

/** The bundled clip: UAL's Walk_Loop, CC0 (test/gate1/fixtures/README.md). */
const WALK_URL = new URL('./ual-walk.glb', import.meta.url).href
/** UAL volume 1's core clips on the tosijs CDN, CC0; fetched only on request. */
const UAL_CORE_URL = 'https://cdn.tosijs.net/quaternius/UAL1_core.glb?v=2'
const UAL_CORE_MB = 6.6

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T

const ui = {
  stage: $<HTMLDivElement>('stage'),
  title: $<HTMLSpanElement>('title'),
  status: $<HTMLDivElement>('status'),
  open: $<HTMLButtonElement>('open'),
  file: $<HTMLInputElement>('file'),
  clipRow: $<HTMLDivElement>('clip-row'),
  clip: $<HTMLSelectElement>('clip'),
  pause: $<HTMLButtonElement>('pause'),
  clipNote: $<HTMLDivElement>('clip-note'),
  faceRow: $<HTMLDivElement>('face-row'),
  unit: $<HTMLSelectElement>('unit'),
  weight: $<HTMLInputElement>('weight'),
  blinkRow: $<HTMLDivElement>('blink-row'),
  blink: $<HTMLInputElement>('blink'),
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

// --- the stage --------------------------------------------------------------

const renderer = new WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
ui.stage.append(renderer.domElement)

const scene = new Scene()
scene.background = new Color(0x2a3340)
// Default lighting: a neutral room for the PBR materials, a sky and a sun.
const pmrem = new PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.add(new HemisphereLight(0xffffff, 0x404858, 0.6))
const sun = new DirectionalLight(0xffffff, 1.6)
sun.position.set(2, 4, 3)
scene.add(sun)
scene.add(new GridHelper(4, 8, 0x6b7280, 0x4b5563))

const camera = new PerspectiveCamera(35, 1, 0.05, 100)
camera.position.set(1.2, 1.5, 3.6)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0.95, 0)
controls.enableDamping = true
controls.update()

function resize(): void {
  const { clientWidth: w, clientHeight: h } = ui.stage
  camera.aspect = w / Math.max(h, 1)
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}
window.addEventListener('resize', resize)
resize()

// --- state (also read by the browser test, site/viewer/viewer.e2e.test.ts) --

interface ViewerState {
  status: string
  error: boolean
  /** The model on stage, or null. */
  name: string | null
  source: string | null
  naming: string | null
  dramatis: boolean
  clip: string | null
  clipOk: boolean
  clipSummary: string
  playing: boolean
  faceUnits: number
  licences: LicenceEntry[]
  /** The site a URL-loaded file came from, when it isn't this one. */
  origin: string | null
  frames: number
}
const state: ViewerState = {
  status: '',
  error: false,
  name: null,
  source: null,
  naming: null,
  dramatis: false,
  clip: null,
  clipOk: false,
  clipSummary: '',
  playing: false,
  faceUnits: 0,
  licences: [],
  origin: null,
  frames: 0,
}

let current: {
  gltf: GLTF
  model: LoadedModel
  mixer: AnimationMixer
  action: AnimationAction | null
} | null = null

/** Where a joint is in the world now (profile name), for the browser test. */
function jointWorld(ue: string): number[] | null {
  if (!current) return null
  const name = jointName(ue, current.model.naming ?? 'ue').replace(/:/g, '')
  const node = current.gltf.scene.getObjectByName(name)
  return node ? node.getWorldPosition(new Vector3()).toArray() : null
}

;(globalThis as Record<string, unknown>).dramatisViewer = {
  state,
  jointWorld,
  faceUnitWeight(unit: string): number | null {
    const mesh = current?.model.faceUnits.get(unit)?.[0]
    const i = mesh?.morphTargetDictionary?.[unit]
    return i === undefined ? null : mesh!.morphTargetInfluences![i]!
  },
}

// --- clips --------------------------------------------------------------------

interface ClipSource {
  clips: AnimationClip[]
  /** The clip file's scene at rest (UAL's mannequin), for the hips' height. */
  scene: Object3D
}
const loader = new GLTFLoader()
let walk: Promise<ClipSource> | null = null
let core: Promise<ClipSource> | null = null

async function loadClips(url: string): Promise<ClipSource> {
  const gltf = await loader.loadAsync(url)
  return { clips: gltf.animations, scene: gltf.scene }
}

function clipSource(key: string): Promise<ClipSource> {
  if (key.startsWith('core:')) return (core ??= loadClips(UAL_CORE_URL))
  return (walk ??= loadClips(WALK_URL))
}

/** The option values: `walk:<name>`, `core:<name>`, `file:<index>`, `more`. */
function fillClipMenu(model: LoadedModel, coreClips: AnimationClip[]): void {
  const keep = ui.clip.value
  ui.clip.replaceChildren()
  const group = (label: string) => {
    const g = document.createElement('optgroup')
    g.label = label
    ui.clip.append(g)
    return g
  }
  const option = (parent: HTMLElement, value: string, text: string) => {
    const o = document.createElement('option')
    o.value = value
    o.textContent = text
    parent.append(o)
  }
  const ual = group('UAL (Quaternius, CC0)')
  option(ual, 'walk:Walk_Loop', 'Walk_Loop')
  for (const c of coreClips)
    if (c.name !== 'Walk_Loop') option(ual, `core:${c.name}`, c.name)
  if (coreClips.length === 0)
    option(ual, 'more', `More UAL clips (${UAL_CORE_MB} MB)…`)
  if (model.ownClips.length > 0) {
    const own = group('In this file')
    model.ownClips.forEach((c, i) =>
      option(own, `file:${i}`, c.name || `clip ${i + 1}`)
    )
  }
  option(ui.clip, 'none', 'Stand still (rest pose)')
  ui.clip.value = [...ui.clip.querySelectorAll('option')].some(
    (o) => o.value === keep
  )
    ? keep
    : 'walk:Walk_Loop'
}

async function playSelected(): Promise<void> {
  if (!current) return
  const c = current
  const key = ui.clip.value
  c.action?.stop()
  if (c.action) c.mixer.uncacheClip(c.action.getClip())
  c.action = null
  state.clip = null
  state.clipOk = false
  state.playing = false
  ui.clipNote.hidden = true

  if (key === 'none') {
    c.gltf.scene.traverse((o) => {
      if (o instanceof SkinnedMesh) o.skeleton.pose()
    })
    return
  }
  if (key === 'more') {
    status(`Loading UAL’s clips (${UAL_CORE_MB} MB, CC0)…`)
    try {
      const { clips } = await clipSource('core:')
      if (current !== c) return
      fillClipMenu(c.model, clips)
      ui.clip.value = clips.some((x) => x.name === 'Idle_Loop')
        ? 'core:Idle_Loop'
        : 'walk:Walk_Loop'
      status(`${clips.length} UAL clips loaded.`)
    } catch (e) {
      status(`Couldn’t load UAL’s clips: ${message(e)}`, 'error')
      ui.clip.value = 'walk:Walk_Loop'
    }
    return playSelected()
  }

  let clip: AnimationClip
  let fit: ClipFit | null = null
  if (key.startsWith('file:')) {
    clip = c.model.ownClips[Number(key.slice(5))]!
  } else {
    const name = key.slice(key.indexOf(':') + 1)
    let source: ClipSource
    try {
      source = await clipSource(key)
    } catch (e) {
      status(`Couldn’t load the clip: ${message(e)}`, 'error')
      return
    }
    if (current !== c) return
    const raw = source.clips.find((x) => x.name === name)
    if (!raw) {
      status(`No clip ${name} in the clip file.`, 'error')
      return
    }
    fit = fitClip(raw, c.model, c.gltf.scene, source.scene)
    clip = fit.clip
  }
  c.action = c.mixer.clipAction(clip)
  c.action.play()
  state.clip = clip.name
  state.playing = true
  state.clipOk = fit ? fit.ok : true
  state.clipSummary = fit
    ? fit.summary
    : `${clip.name} is the file’s own clip, played as it is.`
  ui.clipNote.textContent = state.clipSummary
  ui.clipNote.hidden = false
  ui.pause.textContent = 'Pause'
}

ui.clip.addEventListener('change', () => void playSelected())
ui.pause.addEventListener('click', () => {
  const a = current?.action
  if (!a) return
  a.paused = !a.paused
  state.playing = !a.paused
  ui.pause.textContent = a.paused ? 'Play' : 'Pause'
})

// --- face units -----------------------------------------------------------------

const BLINK = ['LeftUpperLidClosed', 'RightUpperLidClosed']

function fillFaceMenu(model: LoadedModel): void {
  const names = faceUnitNames(model)
  ui.unit.replaceChildren(
    ...names.map((n) => {
      const o = document.createElement('option')
      o.value = o.textContent = n
      return o
    })
  )
  ui.faceRow.hidden = names.length === 0
  ui.blinkRow.hidden = !BLINK.every((u) => model.faceUnits.has(u))
  if (names.includes('JawDrop')) ui.unit.value = 'JawDrop'
  // Part the lips, barely: the unit is seen working, the face still rests.
  ui.weight.value = names.length ? '0.05' : '0'
  applyFaceSlider()
  state.faceUnits = names.length
}

let lastUnit = ''
function applyFaceSlider(): void {
  if (!current) return
  if (lastUnit && lastUnit !== ui.unit.value)
    setFaceUnit(current.model, lastUnit, 0)
  lastUnit = ui.unit.value
  if (lastUnit) setFaceUnit(current.model, lastUnit, Number(ui.weight.value))
}
ui.unit.addEventListener('change', applyFaceSlider)
ui.weight.addEventListener('input', applyFaceSlider)

/** A blink every few seconds, on the lid units, when the box is ticked. */
function blink(time: number): void {
  if (!current || ui.blinkRow.hidden) return
  const phase = time % 4
  const w =
    ui.blink.checked && phase < 0.18 ? Math.sin((phase / 0.18) * Math.PI) : 0
  for (const u of BLINK)
    if (u !== ui.unit.value) setFaceUnit(current.model, u, w)
}

// --- licences ---------------------------------------------------------------------

function safeUrl(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

function note(text: string): void {
  const li = document.createElement('li')
  li.className = 'note'
  li.textContent = text
  ui.licences.append(li)
}

/**
 * The file's licence entries. They are the file's own claims: a valid block
 * from this site's creator, or (flagged) an invalid block's entries, or a
 * file from another site, whose entries this site has not checked.
 */
function showLicences(model: LoadedModel, origin: string | null): void {
  ui.licences.replaceChildren()
  const entries = model.licences
  state.licences = entries
  const invalid = !model.extras && entries.length > 0
  if (origin)
    note(
      `From ${origin}: the licences as that file states them. This site has not checked them.`
    )
  if (invalid)
    note(
      `The file’s Dramatis block is invalid (${model.extrasProblems[0]}): these are its entries as stated.`
    )
  for (const entry of entries) {
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
    ui.licences.append(li)
  }
  if (entries.length === 0) {
    const notOurs = model.extrasProblems[0]?.includes('not a Dramatis export')
    const li = document.createElement('li')
    li.textContent = !notOurs
      ? `The file’s Dramatis block is invalid (${model.extrasProblems[0]}) and names no licences. Check them before you use it.`
      : model.copyright
      ? `Not a Dramatis export, so no licence entries. The file says: ${model.copyright}`
      : 'Not a Dramatis export: the file names no licences. Check them before you use it.'
    ui.licences.append(li)
  }
  ui.licenceSummary.textContent = !entries.length
    ? 'Licences'
    : origin || invalid
    ? `Licences: ${entries.length} assets, as the file states them`
    : `Licences: ${entries.length} assets, from the file’s asset.extras`
  ui.licenceBox.hidden = false
  // On a phone the list would cover the character: folded, one tap away.
  ui.licenceBox.open = window.innerWidth > 600
}

// --- loading a model -----------------------------------------------------------------

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function dispose(root: Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return
    o.geometry.dispose()
    const materials = (
      Array.isArray(o.material) ? o.material : [o.material]
    ) as Material[]
    for (const m of materials) {
      for (const v of Object.values(m))
        if (v && typeof v === 'object' && (v as Texture).isTexture)
          (v as Texture).dispose()
      m.dispose()
    }
  })
}

function frame(root: Object3D): void {
  const box = new Box3().setFromObject(root)
  if (box.isEmpty()) return
  const size = box.getSize(new Vector3())
  const centre = box.getCenter(new Vector3())
  const fit = Math.max(size.y, size.x / camera.aspect, 0.5)
  const distance = fit / (2 * Math.tan((camera.fov * Math.PI) / 360)) + size.z
  controls.target.copy(centre)
  camera.position.set(
    centre.x + distance * 0.35,
    centre.y + size.y * 0.1,
    centre.z + distance
  )
  camera.near = distance / 100
  camera.far = distance * 100
  camera.updateProjectionMatrix()
  controls.update()
}

/** Each load takes a ticket; a load overtaken by a newer one stops. */
const nextLoad = loadTickets()

async function show(
  live: () => boolean,
  bytes: Uint8Array,
  fileName: string,
  source: string,
  origin: string | null = null
): Promise<void> {
  if (!live()) return
  status(`Loading ${fileName}…`)
  let gltf: GLTF
  try {
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer
    gltf = await loader.parseAsync(buffer, '')
  } catch (e) {
    if (live())
      status(
        `${fileName} isn’t a GLB three.js can open: ${message(e)}`,
        'error'
      )
    return
  }
  if (!live()) {
    dispose(gltf.scene)
    return
  }
  if (current) {
    current.mixer.stopAllAction()
    scene.remove(current.gltf.scene)
    dispose(current.gltf.scene)
  }
  const model = describeModel(gltf, fileName)
  scene.add(gltf.scene)
  current = { gltf, model, mixer: new AnimationMixer(gltf.scene), action: null }
  lastUnit = ''
  frame(gltf.scene)

  Object.assign(state, {
    name: model.name,
    source,
    origin,
    naming: model.naming,
    dramatis: model.extras !== null,
  })
  ui.title.textContent = model.name || fileName
  document.title = `${model.name || fileName} · Dramatis three.js viewer`
  fillFaceMenu(model)
  showLicences(model, origin)
  ui.clipRow.hidden = false
  let coreClips: AnimationClip[] = []
  if (core) coreClips = await core.then((s) => s.clips).catch(() => [])
  if (!live()) return
  fillClipMenu(model, coreClips)
  status(
    !model.extras
      ? `${fileName}: ${model.extrasProblems[0]}. Shown as any glTF.`
      : origin
      ? `${model.name}, from ${origin}: its file says it is a Dramatis export (${model.naming} names, ${model.extras.generator}).`
      : `${model.name}: a Dramatis export (${model.naming} names, ${model.extras.generator}).`
  )
  await playSelected()
}

async function fromUrl(url: string): Promise<void> {
  const live = nextLoad()
  status(`Fetching ${url}…`)
  let bytes: Uint8Array
  try {
    bytes = await fetchGlb(url)
  } catch (e) {
    if (live()) status(`Couldn’t fetch ${url}: ${message(e)}`, 'error')
    return
  }
  const name = decodeURIComponent(url.split(/[?#]/)[0]!.split('/').pop() || '')
  await show(
    live,
    bytes,
    name || 'model.glb',
    'url',
    foreignOrigin(url, location.href)
  )
}

async function fromFile(file: File): Promise<void> {
  const live = nextLoad()
  const bytes = new Uint8Array(await file.arrayBuffer())
  await show(live, bytes, file.name, 'file')
}

async function fromHandoff(id: string): Promise<void> {
  const live = nextLoad()
  status('Opening the character from the creator…')
  let entry
  try {
    entry = await takeHandoff(id)
  } catch (e) {
    if (live())
      status(`Couldn’t read the creator’s export: ${message(e)}`, 'error')
    return
  }
  if (!live()) return
  if (!entry) {
    status(
      'That export isn’t here: exports are kept a day, in the browser that made them. Export again from the creator, or open a GLB.',
      'error'
    )
    return
  }
  await show(live, entry.glb, entry.fileName, 'handoff')
}

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

// --- go ------------------------------------------------------------------------------

const clock = new Clock()
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta()
  current?.mixer.update(dt)
  blink(clock.elapsedTime)
  controls.update()
  renderer.render(scene, camera)
  state.frames++
})

const params = new URLSearchParams(location.search)
const handoff = params.get(HANDOFF_PARAM)
const glbUrl = params.get(GLB_URL_PARAM)
if (handoff) void fromHandoff(handoff)
else if (glbUrl) void fromUrl(glbUrl)
else
  status('Drop a GLB here, open one, or export a character from the creator.')
