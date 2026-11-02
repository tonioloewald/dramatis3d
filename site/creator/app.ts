// THE CREATOR, the heavy half: a Babylon scene with tosijs-3d's character in
// it, shaped from a panel, plus the export actions. Loaded on demand by
// <dramatis-creator> (element.ts), never by the site's shared bundle, so a
// page without the creator never downloads Babylon.
//
// Built on tosijs-3d's character system through its public subpaths:
// makeCharacter (character), the widgets the character builder uses, the
// character file and store. The character builder page in tosijs-3d is the
// reference; this is the product's own, smaller panel over the same parts.
// Sources of the body, garments and rig tools other than MakeHuman's are left
// out: Dramatis exports MakeHuman's body.

import * as BABYLON from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import { tosi } from 'tosijs'
import { setAssetBase, assetUrl } from 'tosijs-3d/asset-url'
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
  CHARACTER_SLOTS,
  DEFAULT_CHARACTER,
  loadCharacterAssets,
  makeCharacter,
  type SceneCharacter,
} from 'tosijs-3d/character'
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
} from '../../src/upstream/eyes'
import { chooseFile } from 'tosijs-3d/choose-file'
import { decodeShareLink } from '../../src/contracts/share'
import type { NamingProfile } from '../../src/contracts/profile'
import type { HumanPack } from 'tosijs-3d/human-pack'
import {
  downloadGlb,
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
  share(): Promise<ActionResult>
  /** The character as a file, now. */
  character(): Character
  /** Something outside the panel changed (the name): keep the working figure. */
  touched(): void
  dispose(): void
}

type Box = { value: any; observe(cb: () => void): unknown }

const SLOTS = CHARACTER_SLOTS as readonly string[]
const CLIPS = [
  'Idle_Loop',
  'Walk_Loop',
  'Jog_Fwd_Loop',
  'Dance_Loop',
  'Crouch_Fwd_Loop',
]
// The settings a character file keeps: tosijs-3d's character settings that
// describe MakeHuman's body (not mesh sources, rigs or surfaces).
const NOT_KEPT = new Set(['hideClothes', 'rigs', 'surfaces', 'source'])
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
  art instead (src/upstream/eyes), so the creator paints that art onto the same
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
    save: async () => {},
    rename: async () => {},
    load: async () => {},
    forget: async () => {},
    exportJson: () => {},
    importJson: () => {},
  }

  const characterRows = (): Widget3d[] => [
    label3d({ text: 'Character', collapsible: true }),
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

  const panel = (): Widget3d[] => [
    label3d({ text: 'Body', collapsible: true, open: true }),
    slider('gender', 'gender'),
    slider('age', 'age'),
    slider('muscle', 'muscle'),
    slider('weight', 'weight'),
    slider('height', 'height'),
    slider('proportions', 'proportions'),
    slider('waist', 'waist'),
    slider('chest depth', 'chestDepth'),
    slider('pecs', 'pecs'),
    slider('bust', 'bustSize'),
    slider('firmness', 'bustFirmness'),
    label3d({ text: 'Ancestry', collapsible: true }),
    slider('african', 'african'),
    slider('asian', 'asian'),
    slider('caucasian', 'caucasian'),
    label3d({ text: 'Skin and eyes', collapsible: true }),
    slider('tone', 'tone'),
    slider('redness', 'redness'),
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
    label3d({ text: 'Face', collapsible: true }),
    toggle3d({ label: 'blink', value: box('blink') }),
    toggle3d({ label: 'talk', value: box('talk') }),
    slider('smile', 'smile'),
    slider('brows up', 'browsUp'),
    slider('frown', 'frown'),
    label3d({ text: 'Hair', collapsible: true }),
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
    label3d({ text: 'Clothes', collapsible: true }),
    ...SLOTS.map((slot) => select(slot, slot, choices(slot))),
    label3d({ text: 'Motion', collapsible: true }),
    select3d({
      label: 'clip',
      value: box('clip'),
      options: CLIPS,
      stayOpen: true,
    }),
    toggle3d({ label: 'pause', value: box('paused') }),
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
      scenePanel: () => panel(),
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

    // UAL's mannequin is only where the clips come from: kept hidden.
    const ual = await BABYLON.LoadAssetContainerAsync(
      assetUrl('quaternius/UAL1_core.glb', 2),
      scene
    )
    host.setLoading('loading the body…')
    ual.addAllToScene()
    for (const g of ual.animationGroups) g.stop()
    const ualRoot = ual.meshes.find((m) => m.name === '__root__')
    const ualSkeleton = ual.skeletons[0]
    if (!ualRoot || !ualSkeleton)
      throw new Error('UAL1_core.glb has no skeleton')
    const source = readSkeleton(ualSkeleton, ualRoot)
    ualRoot.setEnabled(false)

    const assets = await loadCharacterAssets(scene)
    const pack = assets.pack
    offered = pack
    const settings = () => ({
      ...Object.fromEntries(KEPT.map((k) => [k, plain(box(k).value)])),
      source: 'MakeHuman',
    })

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
    // The eyes as the export draws them (src/upstream/eyes), painted over
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
    const snapshot = (
      name = shell.name().trim() || 'character'
    ): Character => ({
      name,
      settings: {
        ...Object.fromEntries(KEPT.map((k) => [k, plain(box(k).value)])),
      },
      cloth: slotLooks(),
      tailor: [],
      garments: {},
    })
    const defaults = () => ({
      settings: Object.fromEntries(KEPT.map((k) => [k, START[k]])),
      slots: slotLooks(),
    })
    const tell = (message: string) => {
      note = message
      host.refreshScenePanel?.()
    }

    let restoring = false
    const apply = async (c: Character, warnings: string[]) => {
      restoring = true
      try {
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
      share: () => shareLink(snapshot(), shell.shareBase()),
      character: () => snapshot(),
      touched: () => changed(),
      dispose,
    })
  }

  function dispose() {
    if (disposed) return
    disposed = true
    clearTimeout(pendingSave)
    for (const off of unwatch.splice(0)) off()
    ch?.dispose()
    el.remove()
  }

  return appReady
}
