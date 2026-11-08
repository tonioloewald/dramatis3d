// THE CREATOR, the heavy half: a Babylon scene with tosijs-3d's character in
// it, shaped from a panel, plus the export actions. Loaded on demand by
// <dramatis-creator> (element.ts), never by the site's shared bundle, so a
// page without the creator never downloads Babylon.
//
// Built on tosijs-3d's character system through its public subpaths:
// makeCharacter (character), the widgets the character builder uses, the
// character file and store. The character builder page in tosijs-3d is the
// reference; this is the product's own, smaller panel over the same parts.
// Its bodies are MakeHuman's, the AI cast's (tosijs-3d's AI_CHARACTER_SOURCES,
// CC0 on the CDN) and a mesh file of the user's, rigged in tosijs-3d's rig tool
// (mountRigTool, hosted) and exported by src/mesh/ (#3856). tosijs-3d's other
// bodies, and garments on a mesh body, are left out until they export.

import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import { tosi } from 'tosijs'
import { setAssetBase } from 'tosijs-3d/asset-url'
import { CREATOR_CLIPS, STARTER_URL } from '../clips'
import { b3d, type B3d } from 'tosijs-3d/tosi-b3d'
import { b3dSun } from 'tosijs-3d/b3d-shadows'
import { b3dLight } from 'tosijs-3d/b3d-light'
import {
  button3d,
  label3d,
  select3d,
  slider3d,
  text3d,
  toggle3d,
  type Widget3d,
} from 'tosijs-3d/widgets3d'
import { colorPicker3d } from 'tosijs-3d/color-picker'
import { studioEnvironment } from 'tosijs-3d/environment'
import { readSkeleton, retargetClip } from 'tosijs-3d/retarget-babylon'
import { HAIR_COLOURS } from 'tosijs-3d/hair-shading'
import { irisColor } from 'tosijs-3d/skin-tone'
import {
  AI_CHARACTER_SOURCES,
  CHARACTER_SLOTS,
  DEFAULT_CHARACTER,
  loadCharacterAssets,
  makeCharacter,
  type CharacterSource,
  type SceneCharacter,
} from 'tosijs-3d/character'
import { mountRigTool, type RigToolHandle } from 'tosijs-3d/rig-tool'
import { undoHistory } from 'tosijs-3d/undo-history'
import type { RigRecipe } from 'tosijs-3d/rig-recipe'
import type { CharacterBody } from 'tosijs-3d/character-file'
import { MAKEHUMAN_SOURCE } from '../../src/mesh/source'
import {
  readCharacter,
  writeCharacter,
  type Character,
  type CharacterDoc,
  type SlotLook,
} from 'tosijs-3d/character-file'
import { characterStore, WORKING_CHARACTER } from 'tosijs-3d/character-store'
import { decideName, dialogs } from './naming'
import { HM08_EYE_UV } from 'tosijs-3d/human-face'
import {
  EYE_STYLES,
  eyePngUrl,
  eyeStyle,
  ONE_EYE_LAYOUT,
  recolourEyePng,
} from 'tosijs-3d/eye-art'
import { chooseFile } from 'tosijs-3d/choose-file'
import { decodeShareLink } from '../../src/contracts/share'
import type { NamingProfile } from '../../src/contracts/profile'
import type { HumanPack } from 'tosijs-3d/human-pack'
import {
  downloadGlb,
  downloadVrm,
  explain,
  licensedChoice,
  fileNameFor,
  importText,
  saveBytes,
  shareFragment,
  shareLink,
  viewInThree,
  viewInUnity,
  type ActionResult,
} from './actions'

/** What the shell (element.ts) gives the app. */
export interface CreatorShell {
  /** The character's name, as typed in the toolbar. */
  name(): string
  setName(name: string): void
  naming(): NamingProfile
  /** A line in the status bar; `false` clears it. */
  status(message: string | false, tone?: 'info' | 'error'): void
  /** The creator's URL for share links. */
  shareBase(): string
}

/** What the app gives the shell: the toolbar's actions. */
export interface CreatorApp {
  view(opened: Window | null): Promise<ActionResult>
  /** The same, in the Unity player. */
  unity(opened: Window | null): Promise<ActionResult>
  download(): Promise<ActionResult>
  /** Download VRM 1.0. */
  vrm(): Promise<ActionResult>
  share(): Promise<ActionResult>
  /** The character as a file, now. */
  character(): Character
  /** Something outside the panel changed (the name): keep the working figure. */
  touched(): void
  dispose(): void
}

type Box = { value: any; observe(cb: () => void): unknown }

const SLOTS = CHARACTER_SLOTS as readonly string[]
const CLIPS: string[] = [...CREATOR_CLIPS]
// The settings a character file keeps: tosijs-3d's character settings, with
// the body's source and each mesh's rig recipe (not hideClothes, nor
// surfaces: a mesh exports in its own materials).
const NOT_KEPT = new Set(['hideClothes', 'surfaces'])
const TOSI_KEPT = Object.keys(DEFAULT_CHARACTER).filter((k) => !NOT_KEPT.has(k))
// Dramatis's own settings, kept in the file beside tosijs-3d's (the build
// reads them; tosijs-3d's character ignores them): the eye art.
const OWN: Record<string, unknown> = { eyeStyle: 'basic' }
const KEPT = [...TOSI_KEPT, ...Object.keys(OWN)]
const START: Record<string, unknown> = {
  ...Object.fromEntries(TOSI_KEPT.map((k) => [k, DEFAULT_CHARACTER[k]])),
  ...OWN,
  clip: 'Idle_Loop',
  paused: false,
}

const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v))

/** The AI cast: CC0 meshes on the CDN (static-assets tonio/ai). */
const CAST: Record<string, CharacterSource> = AI_CHARACTER_SOURCES

export async function mountCreator(
  stage: HTMLElement,
  shell: CreatorShell
): Promise<CreatorApp> {
  setAssetBase('https://cdn.tosijs.net')
  const state = tosi({ dramatisCreator: structuredClone(START) })
    .dramatisCreator as unknown as Record<string, Box>
  const box = (k: string): Box => state[k] as Box
  /*
  THE EYES AS EXPORTED. tosijs-3d draws its eyes into a canvas texture named
  "eye", both eyes on one picture (HM08_EYE_UV). The export uses Tonio's eye
  art instead (tosijs-3d/eye-art), so the creator paints that art onto the same
  canvas, at each eye's place and size, so what is seen here is what exports.
  */
  let eyePaint = 0
  const eyeArt: Partial<Record<string, Promise<Uint8Array>>> = {}
  const paintEyes = async (scene: BABYLON.Scene): Promise<void> => {
    const ticket = ++eyePaint
    const tex = scene.textures.find((t) => t.name === 'eye') as
      | BABYLON.DynamicTexture
      | undefined
    if (!tex || typeof tex.getContext !== 'function') return
    const style = eyeStyle(box('eyeStyle').value)
    let img: ImageBitmap
    try {
      eyeArt[style] ??= fetch(eyePngUrl(style)).then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        return new Uint8Array(await r.arrayBuffer())
      })
      const png = recolourEyePng(
        await eyeArt[style]!,
        String(box('irisColour').value)
      )
      img = await createImageBitmap(
        new Blob([png as BlobPart], { type: 'image/png' })
      )
    } catch (e) {
      // Try again next time (a moment offline is not forever); tosijs-3d's
      // own eyes stay meanwhile, as the export's plain ones would.
      delete eyeArt[style]
      console.warn('dramatis creator: the eye art did not load', e)
      return
    }
    if (ticket !== eyePaint) return
    const ctx = tex.getContext() as CanvasRenderingContext2D
    const size = tex.getSize().width
    // The art's iris is 48 px of 256; tosijs-3d's is HM08_EYE_UV.iris of the canvas.
    const scale = (HM08_EYE_UV.iris * size) / (ONE_EYE_LAYOUT.iris * img.width)
    const w = img.width * scale
    ctx.fillStyle = '#d8cbc2'
    ctx.fillRect(0, 0, size, size)
    for (const e of [HM08_EYE_UV.l, HM08_EYE_UV.r]) {
      const x = e.u * size
      const y = (1 - e.v) * size
      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, HM08_EYE_UV.iris * size * 2.5, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, x - w / 2, y - w / 2, w, w)
      ctx.restore()
    }
    tex.update()
  }
  // Every observer this mount adds, removed again on dispose (the state is
  // global, and the page may mount the creator again after navigating).
  const unwatch: Array<() => void> = []
  const watch = (b: Box, cb: () => void) => {
    const off = b.observe(cb)
    if (typeof off === 'function') unwatch.push(off as () => void)
  }

  let ch: SceneCharacter | null = null
  // Mesh bodies: the cast, and files opened here (kept with their bytes, which
  // the character file carries).
  const sources: Record<string, CharacterSource> = { ...CAST }
  const fileBytes = new Map<string, Uint8Array>()
  let rigging: RigToolHandle | null = null
  const madeHuman = () => box('source').value === MAKEHUMAN_SOURCE
  let note = ''
  let saved: string[] = []
  const pick = tosi({ dramatisPick: { value: '' } })
    .dramatisPick as unknown as {
    value: Box
  }
  // Only what can ship: the pack's unchecked community assets are left out.
  let offered: HumanPack | null = null
  const choices = (key: string) =>
    (ch?.choices(key) ?? ['none']).filter(
      (name) => offered === null || licensedChoice(key, name, offered)
    )
  const slider = (label: string, key: string, min = 0, max = 1, step = 0.01) =>
    slider3d({ label, value: box(key), min, max, step })
  const select = (label: string, key: string, options: string[]) =>
    select3d({ label, value: box(key), options, stayOpen: true })

  const handlers = {
    rig: (_file?: File) => {},
    openMesh: () => {},
    save: async () => {},
    rename: async () => {},
    load: async () => {},
    forget: async () => {},
    exportJson: () => {},
    importJson: () => {},
    undo: () => {},
    redo: () => {},
  }
  // UNDO: the panel's settings, a step per pause in the editing.
  const history = undoHistory<Record<string, unknown>>({
    limit: 100,
    same: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  })

  const characterRows = (): Widget3d[] => [
    label3d({ text: 'Character', collapsible: true, icon: 'character' }),
    button3d({
      label: 'save in this browser…',
      handleClick: () => handlers.save(),
    }),
    ...(saved.length
      ? [
          select3d({ label: 'saved', value: pick.value, options: saved }),
          button3d({ label: 'load', handleClick: () => handlers.load() }),
          button3d({ label: 'rename…', handleClick: () => handlers.rename() }),
          button3d({ label: 'forget', handleClick: () => handlers.forget() }),
        ]
      : []),
    button3d({
      label: 'export character (.json)',
      handleClick: () => handlers.exportJson(),
    }),
    button3d({
      label: 'import character (.json)…',
      handleClick: () => handlers.importJson(),
    }),
    ...(note ? [text3d({ text: note })] : []),
  ]

  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0')
  const irisPresets = (
    [
      ['dark brown', 0],
      ['brown', 0.15],
      ['amber', 0.3],
      ['hazel', 0.45],
      ['green', 0.6],
      ['blue-green', 0.72],
      ['blue', 0.85],
      ['grey', 1],
    ] as const
  ).map(([name, t]) => {
    const c = irisColor(t)
    return { name, value: `#${hex(c.r)}${hex(c.g)}${hex(c.b)}` }
  })

  const bodyChoice = (): Widget3d[] => [
    select3d({
      label: 'body',
      value: box('source'),
      options: [MAKEHUMAN_SOURCE, ...Object.keys(sources)],
      stayOpen: true,
    }),
    button3d({
      label: 'open a mesh file (.glb)…',
      handleClick: () => handlers.openMesh(),
    }),
  ]
  // A mesh's body: rig it, and say what travels with it.
  const meshRows = (): Widget3d[] => {
    const name = String(box('source').value)
    const own = fileBytes.has(name)
    return [
      button3d({
        label: rigging ? 'rigging…' : `rig ${name}`,
        handleClick: () => handlers.rig(),
      }),
      text3d({
        text: own
          ? "Your own mesh: it's saved in this browser and exported, with its licence marked as not known (it's yours to know). A share link can't carry it."
          : 'One of the AI cast: CC0, made with Gemini and Meshy. Exports carry that.',
      }),
    ]
  }
  const panel = (): Widget3d[] =>
    madeHuman()
      ? humanPanel()
      : [
          label3d({
            text: 'Body',
            collapsible: true,
            open: true,
            icon: 'body',
          }),
          ...bodyChoice(),
          ...meshRows(),
          ...motionRows(),
          ...characterRows(),
        ]
  const motionRows = (): Widget3d[] => [
    label3d({ text: 'Motion', collapsible: true, icon: 'motion' }),
    select3d({
      label: 'clip',
      value: box('clip'),
      options: CLIPS,
      stayOpen: true,
    }),
    toggle3d({ label: 'pause', value: box('paused') }),
  ]
  const humanPanel = (): Widget3d[] => [
    label3d({ text: 'Body', collapsible: true, open: true, icon: 'body' }),
    ...bodyChoice(),
    // Subheadings in Body (accordions once a tab can hold them).
    label3d({ text: 'vital stats' }),
    slider('gender', 'gender'),
    slider('age', 'age'),
    slider('height', 'height'),
    slider('proportions', 'proportions'),
    slider('chest depth', 'chestDepth'),
    label3d({ text: 'shape' }),
    slider('weight', 'weight'),
    slider('muscle', 'muscle'),
    slider('waist', 'waist'),
    slider('pecs', 'pecs'),
    slider('bust', 'bustSize'),
    slider('firmness', 'bustFirmness'),
    // A subheading in Body, not a tab of its own (as tosijs-3d's builder).
    label3d({ text: 'ancestry' }),
    slider('african', 'african'),
    slider('asian', 'asian'),
    slider('caucasian', 'caucasian'),
    label3d({ text: 'Skin', collapsible: true, icon: 'skin' }),
    slider('tone', 'tone'),
    slider('redness', 'redness'),
    label3d({ text: 'Eyes', collapsible: true, icon: 'eyes' }),
    colorPicker3d({
      label: 'eye colour',
      value: box('irisColour') as {
        value: string
        observe(cb: () => void): unknown
      },
      alpha: false,
      defaultPresets: 'off',
      presets: irisPresets,
    }),
    select('eye art', 'eyeStyle', [...EYE_STYLES]),
    label3d({ text: 'Face', collapsible: true, icon: 'face' }),
    toggle3d({ label: 'blink', value: box('blink') }),
    toggle3d({ label: 'talk', value: box('talk') }),
    slider('smile', 'smile'),
    slider('brows up', 'browsUp'),
    slider('frown', 'frown'),
    label3d({ text: 'Hair', collapsible: true, icon: 'hair' }),
    select('hair', 'hair', choices('hair')),
    select('beard', 'beard', choices('beard')),
    select('moustache', 'moustache', choices('moustache')),
    slider('stubble', 'stubble'),
    select('brows', 'brows', choices('brows')),
    colorPicker3d({
      label: 'base',
      value: box('hairBase') as {
        value: string
        observe(cb: () => void): unknown
      },
      alpha: false,
      defaultPresets: 'off',
      presets: Object.entries(HAIR_COLOURS).map(([name, c]) => ({
        name,
        value: c.base,
      })),
    }),
    colorPicker3d({
      label: 'highlights',
      value: box('hairHighlight') as {
        value: string
        observe(cb: () => void): unknown
      },
      alpha: false,
      defaultPresets: 'off',
      presets: Object.entries(HAIR_COLOURS).map(([name, c]) => ({
        name,
        value: c.highlight,
      })),
    }),
    label3d({ text: 'Clothes', collapsible: true, icon: 'clothing' }),
    ...SLOTS.map((slot) => select(slot, slot, choices(slot))),
    ...motionRows(),
    ...characterRows(),
  ]

  let disposed = false
  let pendingSave: ReturnType<typeof setTimeout> | undefined
  let resolveApp: (app: CreatorApp) => void = () => {}
  let rejectApp: (e: unknown) => void = () => {}
  const appReady = new Promise<CreatorApp>((ok, no) => {
    resolveApp = ok
    rejectApp = no
  })

  const el = b3d(
    {
      clearColor: '#2a3340',
      panelTitle: 'Dramatis',
      scenePanelOpen: true,
      // A tab per section, each its icon; undo and redo on the icon bar.
      panelSections: 'tabs',
      scenePanel: () => panel(),
      panelActions: () => [
        {
          icon: 'rotateCcw',
          title: 'undo (⌘Z)',
          dim: !history.canUndo,
          handleClick: () => handlers.undo(),
        },
        {
          icon: 'rotateCw',
          title: 'redo (⇧⌘Z)',
          dim: !history.canRedo,
          handleClick: () => handlers.redo(),
        },
      ],
      async sceneCreated(host: B3d) {
        try {
          await build(host)
        } catch (e) {
          host.setLoading(explain(e, 'start'), { spin: false })
          rejectApp(e)
        }
      },
    },
    b3dSun({
      timeOfDay: 16.5,
      shadowTextureSize: 2048,
      shadowMaxZ: 20,
      shadowNormalBias: 0.008,
    }),
    b3dLight({ intensity: 0.5 })
  ) as B3d
  el.style.width = '100%'
  el.style.height = '100%'
  stage.append(el)

  async function build(host: B3d) {
    const scene = host.scene
    host.setLoading('loading the animations…')
    studioEnvironment(scene)
    const cam = new BABYLON.ArcRotateCamera(
      'creator-camera',
      Math.PI / 2 - 0.5,
      1.35,
      3.6,
      new BABYLON.Vector3(0, 0.9, 0),
      scene
    )
    cam.minZ = 0.05
    cam.lowerRadiusLimit = 0.3
    cam.upperRadiusLimit = 10
    cam.wheelPrecision = 60
    cam.attachControl(host.querySelector('canvas'), true)
    host.setActiveCamera(cam)

    const floor = BABYLON.MeshBuilder.CreateGround(
      'floor_nocast',
      { width: 12, height: 12 },
      scene
    )
    const floorMat = new BABYLON.PBRMaterial('floor', scene)
    // A faint tosijs grid (site/static/creator-ground.svg), 2 m a tile.
    // Resolved from this bundle (/creator-app/app.js) so any base path works.
    const grid = new BABYLON.Texture(
      new URL('../creator-ground.svg', import.meta.url).href,
      scene
    )
    grid.uScale = grid.vScale = 6
    grid.anisotropicFilteringLevel = 8
    floorMat.albedoTexture = grid
    floorMat.metallic = 0
    floorMat.roughness = 0.9
    floor.material = floorMat
    host.register({ meshes: [floor] })

    // UAL's mannequin is only where the clips come from: kept hidden. The
    // site's starter cut (site/clips.ts), not the CDN's 6.3 MB of clips.
    const ual = await BABYLON.LoadAssetContainerAsync(STARTER_URL, scene)
    host.setLoading('loading the body…')
    ual.addAllToScene()
    for (const g of ual.animationGroups) g.stop()
    const ualRoot = ual.meshes.find((m) => m.name === '__root__')
    const ualSkeleton = ual.skeletons[0]
    if (!ualRoot || !ualSkeleton)
      throw new Error('the starter clips have no skeleton')
    const source = readSkeleton(ualSkeleton, ualRoot)
    ualRoot.setEnabled(false)

    const assets = await loadCharacterAssets(scene)
    const pack = assets.pack
    offered = pack
    const settings = () =>
      Object.fromEntries(KEPT.map((k) => [k, plain(box(k).value)]))

    let playing: BABYLON.AnimationGroup | null = null
    const play = () => {
      playing?.dispose()
      playing = null
      if (!ch?.skeleton) return
      const clip = ual.animationGroups.find((g) => g.name === box('clip').value)
      playing = clip
        ? retargetClip(clip, source, ch.skeleton, {
            scene,
            armSpaceDeg: ch.recipe?.armSpaceDeg,
          })
        : null
      playing?.start(true)
      ch.groundFor(playing)
      if (box('paused').value) playing?.pause()
    }

    ch = await makeCharacter(scene, assets, {
      settings: settings(),
      sources,
      gaze: () => scene.activeCamera?.globalPosition ?? cam.position,
      handleStatus: (m) => host.setLoading(m),
      handleMeshes: (meshes) => host.register({ meshes }),
      handleShown: () => {
        void paintEyes(scene)
        host.refreshScenePanel?.()
        play()
      },
    })
    const character = ch
    for (const k of TOSI_KEPT)
      watch(box(k), () => character.set({ [k]: plain(box(k).value) }))
    // The eyes as the export draws them (tosijs-3d/eye-art), painted over
    // tosijs-3d's own after it repaints.
    const eyesLater = () => setTimeout(() => void paintEyes(scene), 0)
    watch(box('irisColour'), eyesLater)
    // tosijs-3d repaints the same canvas when its iris dial moves, too.
    watch(box('iris'), eyesLater)
    watch(box('eyeStyle'), eyesLater)
    eyesLater()
    // An outfit replaces a top and bottom, and either replaces an outfit.
    watch(box('outfit'), () => {
      if (box('outfit').value !== 'none') {
        box('top').value = 'none'
        box('bottom').value = 'none'
      }
    })
    for (const k of ['top', 'bottom'])
      watch(box(k), () => {
        if (box(k).value !== 'none') box('outfit').value = 'none'
      })
    watch(box('hairBase'), () => {
      const pair = Object.values(HAIR_COLOURS).find(
        (c) => c.base === box('hairBase').value
      )
      if (pair && box('hairHighlight').value !== pair.highlight)
        box('hairHighlight').value = pair.highlight
    })

    // THE CHARACTER FILE: the figure being worked on, as a character.
    const slotLooks = (): Record<string, SlotLook> =>
      Object.fromEntries(
        SLOTS.map((slot) => [slot, plain(character.cloth(slot))])
      )
    // A mesh body travels as where it is (the cast's URL) or as its bytes (a
    // file of the user's), and with the recipe it is shown rigged from: the
    // rig tool's, else the first guess the character made.
    const bodyOf = (source: string): CharacterBody | null => {
      const bytes = fileBytes.get(source)
      if (bytes) return { file: { name: source, bytes } }
      const from = sources[source]
      if (!from?.url) return null
      return {
        url: from.url,
        ...(from.pick != null ? { pick: from.pick } : {}),
      }
    }
    const snapshot = (name = shell.name().trim() || 'character'): Character => {
      const kept = Object.fromEntries(KEPT.map((k) => [k, plain(box(k).value)]))
      const source = String(kept.source)
      const body = source === MAKEHUMAN_SOURCE ? null : bodyOf(source)
      const rigs = { ...(kept.rigs as Record<string, RigRecipe>) }
      const shown = character.shown
      if (body && !rigs[source] && shown?.source === source && shown.recipe)
        rigs[source] = plain(shown.recipe)
      return {
        name,
        settings: { ...kept, rigs },
        cloth: slotLooks(),
        tailor: [],
        garments: {},
        ...(body ? { bodies: { [source]: body } } : {}),
      }
    }
    const defaults = () => ({
      settings: Object.fromEntries(KEPT.map((k) => [k, START[k]])),
      slots: slotLooks(),
    })
    const tell = (message: string) => {
      note = message
      host.refreshScenePanel?.()
    }

    // A mesh the file carries and this page doesn't have becomes a body.
    const addBody = (name: string, b: CharacterBody) => {
      if (b.file) {
        fileBytes.set(name, b.file.bytes)
        sources[name] = {
          file: new File([b.file.bytes as BlobPart], b.file.name),
          ...(b.pick != null ? { pick: b.pick } : {}),
        }
      } else if (b.url)
        sources[name] = {
          url: b.url,
          ...(b.pick != null ? { pick: b.pick } : {}),
        }
      else return
      character.addSource(name, sources[name]!)
    }
    let restoring = false
    const apply = async (c: Character, warnings: string[]) => {
      restoring = true
      try {
        for (const [name, b] of Object.entries(c.bodies ?? {}))
          if (!(name in sources)) addBody(name, b)
        const source = c.settings.source
        if (
          typeof source === 'string' &&
          source !== MAKEHUMAN_SOURCE &&
          !(source in sources)
        ) {
          warnings.push(
            `body ${source}: open that mesh file again; MakeHuman's is shown`
          )
          c.settings.source = MAKEHUMAN_SOURCE
        }
        // An outfit first: each of top and bottom clears it.
        for (const k of ['outfit', ...KEPT.filter((k) => k !== 'outfit')])
          if (k in c.settings) box(k).value = c.settings[k]
        character.set(
          Object.fromEntries(
            KEPT.map((k) => [k, plain(c.settings[k] ?? START[k])])
          )
        )
        for (const slot of SLOTS)
          if (c.cloth[slot]) character.setCloth(slot, c.cloth[slot])
        await character.ready()
        if (c.name && c.name !== WORKING_CHARACTER) shell.setName(c.name)
      } finally {
        restoring = false
      }
      if (warnings.length)
        console.warn('dramatis creator: loaded with changes', warnings)
    }
    const applyDoc = async (doc: unknown) => {
      const { character: c, warnings } = readCharacter(doc, defaults())
      await apply(c, warnings)
      return warnings
    }

    const store = characterStore()
    const doc = (name: string): CharacterDoc =>
      writeCharacter(snapshot(name), { saved: new Date().toISOString() })
    const changed = () => {
      if (restoring || disposed) return
      clearTimeout(pendingSave)
      pendingSave = setTimeout(() => {
        store
          .put(WORKING_CHARACTER, doc(shell.name().trim() || WORKING_CHARACTER))
          .catch((e) =>
            console.warn(
              'dramatis creator: could not keep the working figure',
              e
            )
          )
      }, 800)
    }
    for (const k of KEPT) watch(box(k), changed)

    const listSaved = async () => {
      saved = await store.list().catch(() => [])
      if (!saved.includes(pick.value.value)) pick.value.value = saved[0] ?? ''
      host.refreshScenePanel?.()
    }
    // Save and rename ask for the name in a popup (tosijs-ui's dialog), filled
    // in with the current one, and ask before replacing a different character.
    const askName = async (
      title: string,
      message: string,
      current: string
    ): Promise<string | null> => {
      const ui = dialogs()
      // Embedded without the site's tosi-* elements: the name box is the input.
      const typed = ui ? await ui.prompt(message, title, current) : shell.name()
      const decided = decideName(typed, saved, current, WORKING_CHARACTER)
      if (decided === null) return null
      if (!decided.ok) {
        tell(decided.message)
        return null
      }
      if (
        decided.overwrites &&
        !(await (ui?.confirm(
          `A saved character is already called "${decided.name}". Replace it?`,
          'Replace?'
        ) ?? Promise.resolve(true)))
      )
        return null
      return decided.name
    }
    handlers.save = async () => {
      const current = shell.name().trim()
      const name = await askName(
        'Save in this browser',
        'Name this character',
        current === WORKING_CHARACTER ? '' : current
      )
      if (name === null) return
      shell.setName(name)
      try {
        await store.put(name, doc(name))
      } catch (e) {
        return tell(explain(e, 'save it'))
      }
      pick.value.value = name
      tell(`saved ${name}`)
      await listSaved()
    }
    handlers.rename = async () => {
      const old = pick.value.value as string
      const found = old ? await store.get(old).catch(() => null) : null
      if (!found) return tell(`no character called ${old}`)
      const name = await askName('Rename', `Rename "${old}" to`, old)
      if (name === null || name === old) return
      try {
        await store.put(name, { ...found, name })
        await store.delete(old)
      } catch (e) {
        return tell(explain(e, 'rename it'))
      }
      if (shell.name().trim() === old) shell.setName(name)
      pick.value.value = name
      tell(`renamed ${old} to ${name}`)
      await listSaved()
    }
    handlers.load = async () => {
      const name = pick.value.value as string
      const found = name ? await store.get(name).catch(() => null) : null
      if (!found) return tell(`no character called ${name}`)
      try {
        const warnings = await applyDoc(found)
        tell(
          warnings.length
            ? `loaded ${name}; ${warnings.length} setting(s) skipped`
            : `loaded ${name}`
        )
      } catch (e) {
        tell(explain(e, 'load it'))
      }
      changed()
    }
    handlers.forget = async () => {
      const name = pick.value.value as string
      if (!name) return
      await store.delete(name).catch(() => {})
      tell(`forgot ${name}`)
      await listSaved()
    }
    handlers.exportJson = () => {
      const name = shell.name().trim() || 'character'
      saveBytes(
        JSON.stringify(doc(name), null, 1),
        fileNameFor(name, 'character.json'),
        'application/json'
      )
    }
    handlers.importJson = () => {
      chooseFile('.json,application/json').then(async (file) => {
        if (!file) return
        try {
          const warnings = await applyDoc(await importText(file))
          tell(
            warnings.length
              ? `imported; ${warnings.length} setting(s) skipped`
              : `imported ${file.name}`
          )
          changed()
        } catch (e) {
          tell(
            `${file.name}: ${String((e as Error)?.message ?? e).replace(
              /^character-file: /,
              ''
            )}`
          )
        }
      })
    }

    // THE RIG TOOL (tosijs-3d's, hosted): it rigs the mesh shown, or a file
    // opened in it, and done makes what it rigged the body, with its recipe
    // kept in the character. The character steps aside while the tool shows
    // the same mesh; cancel puts it back as it was.
    const meshName = (file: File) => {
      const base = file.name.replace(/\.(glb|gltf)$/i, '') || 'mesh'
      let name = base
      for (let i = 2; name in CAST || name === MAKEHUMAN_SOURCE; i++)
        name = `${base} ${i}`
      return name
    }
    handlers.rig = (file?: File) => {
      if (rigging) return
      if (!file && madeHuman()) return
      const name = file ? meshName(file) : String(box('source').value)
      const from = file ? { file } : sources[name]
      if (!from) return
      character.hide(true)
      playing?.stop()
      const finish = () => {
        rigging = null
        character.hide(false)
        host.refreshScenePanel?.()
      }
      const kept =
        (box('rigs').value as Record<string, RigRecipe>)[name] ??
        character.recipe
      rigging = mountRigTool(host, {
        models: [
          {
            label: name,
            url: from.url ?? '',
            ...(from.file ? { file: from.file } : {}),
            ...(from.pick != null ? { pick: from.pick } : {}),
          },
        ],
        // A new file starts from nothing; a body shown starts where it is.
        ...(file || !kept ? {} : { recipe: plain(kept) }),
        files: false,
        stage: false,
        camera: cam,
        handleDone: async ({ recipe, body, model }) => {
          finish()
          delete (recipe as { model?: unknown }).model
          const loaded =
            model instanceof File ? model : model?.file ?? file ?? null
          if (loaded) {
            fileBytes.set(name, new Uint8Array(await loaded.arrayBuffer()))
            sources[name] = { file: loaded }
            character.addSource(name, sources[name]!)
          }
          if (body) character.adopt(name, body, recipe)
          box('rigs').value = {
            ...plain(box('rigs').value as Record<string, RigRecipe>),
            [name]: plain(recipe),
          }
          if (box('source').value !== name) box('source').value = name
          else play()
          host.refreshScenePanel?.()
        },
        handleCancel: () => {
          finish()
          play()
        },
      })
      host.refreshScenePanel?.()
    }
    handlers.openMesh = () => {
      chooseFile('.glb,model/gltf-binary').then((f) => f && handlers.rig(f))
    }
    watch(box('source'), () => host.refreshScenePanel?.())

    // Where the page opens: a share link's character, else the working figure.
    const fragment = shareFragment(location.hash)
    let opened = false
    if (fragment) {
      try {
        const { character: c, warnings } = decodeShareLink(fragment, defaults())
        await apply(c, warnings)
        opened = true
        shell.status(`Opened a shared character${c.name ? `: ${c.name}` : ''}.`)
        changed()
      } catch (e) {
        shell.status(explain(e, 'open the shared character'), 'error')
      }
    }
    if (!opened) {
      const working = await store.get(WORKING_CHARACTER).catch(() => null)
      if (working)
        await applyDoc(working).catch((e) =>
          console.warn('dramatis creator: the working figure would not load', e)
        )
    }
    await listSaved()
    host.setLoading(false)
    play()

    // UNDO AND REDO over the panel's settings (what the file keeps): a step
    // is recorded once the editing pauses, so a slider's drag is one step.
    // Loading, importing and rigging are steps too.
    const kept = () =>
      Object.fromEntries(KEPT.map((k) => [k, plain(box(k).value)]))
    let stepping = false
    let pendingStep: ReturnType<typeof setTimeout> | undefined
    const recordLater = () => {
      if (stepping || disposed) return
      clearTimeout(pendingStep)
      pendingStep = setTimeout(() => {
        pendingStep = undefined
        if (history.record(kept())) host.refreshScenePanel?.()
      }, 400)
    }
    const step = (to: Record<string, unknown> | undefined) => {
      if (!to) return
      clearTimeout(pendingStep)
      stepping = true
      try {
        // An outfit first: each of top and bottom clears it.
        for (const k of ['outfit', ...KEPT.filter((k) => k !== 'outfit')])
          if (k in to && JSON.stringify(box(k).value) !== JSON.stringify(to[k]))
            box(k).value = plain(to[k])
      } finally {
        stepping = false
      }
      changed()
      host.refreshScenePanel?.()
    }
    history.clear(kept())
    for (const k of KEPT) watch(box(k), recordLater)
    handlers.undo = () => {
      // An edit still waiting to be recorded is the step undo takes back.
      if (pendingStep) {
        clearTimeout(pendingStep)
        pendingStep = undefined
        history.record(kept())
      }
      step(history.undo())
    }
    handlers.redo = () => step(history.redo())
    const keys = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, [contenteditable="true"]')) return
      e.preventDefault()
      if (e.shiftKey) handlers.redo()
      else handlers.undo()
    }
    window.addEventListener('keydown', keys)
    unwatch.push(() => {
      window.removeEventListener('keydown', keys)
      clearTimeout(pendingStep)
    })
    host.refreshScenePanel?.()
    watch(box('clip'), play)
    watch(box('paused'), () =>
      box('paused').value ? playing?.pause() : playing?.play(true)
    )

    const input = () => ({
      character: snapshot(),
      pack,
      naming: shell.naming(),
    })
    resolveApp({
      view: (w) => viewInThree(input(), w),
      unity: (w) => viewInUnity(input(), w),
      download: () => downloadGlb(input()),
      vrm: () => downloadVrm(input()),
      share: () => shareLink(snapshot(), shell.shareBase()),
      character: () => snapshot(),
      touched: () => changed(),
      dispose,
    })
  }

  function dispose() {
    if (disposed) return
    disposed = true
    rigging?.unmount()
    clearTimeout(pendingSave)
    for (const off of unwatch.splice(0)) off()
    ch?.dispose()
    el.remove()
  }

  return appReady
}
