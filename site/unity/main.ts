// The Unity player's page (/unity/): the three.js demo's walk-round, in Unity.
// The player (samples/unity, built for the Web into site/unity/player/) loads
// a GLB at runtime with glTFast; this page finds the GLB and hands it over:
// a character saved in this browser (built here with Dramatis's exporter, as
// the three.js demo does), a file opened or dropped, `?glb=<url>`, or the
// creator's `?handoff=<id>`. The bytes go to the player as a blob: URL
// through SendMessage; its events come back through DramatisBridge.jslib.
//
// No three.js and no Babylon here: the exporter and the store are the
// engine-free core. Until the player is built, the page says so.

import { readCharacter } from 'tosijs-3d/character-file'
import { characterStore, WORKING_CHARACTER } from 'tosijs-3d/character-store'
import { loadHumanPack, type HumanPack } from 'tosijs-3d/human-pack'
import { parseGlbJson } from 'tosijs-3d/glb-manifest'
import { exportCharacterGlb } from '../../src/contracts/export'
import {
  GLB_URL_PARAM,
  HANDOFF_PARAM,
  takeHandoff,
} from '../../src/contracts/handoff'
import type { LicenceEntry } from '../../src/contracts/licences'
import { BUILD_SETTINGS, HM08_PACK_URL } from '../../src/build/settings'
import { licenceLine } from '../viewer/core'
import { DEFAULT_CHARACTER, fileKind, saveChoices } from '../demo/core'

/** Where the Web build lands: Unity names its files after the folder. */
const PLAYER = './player/Build/player'

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T
const ui = {
  canvas: $<HTMLCanvasElement>('unity'),
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

/** What the page knows (also read by a browser test). */
interface UnityPageState {
  status: string
  error: boolean
  built: boolean
  ready: boolean
  name: string | null
  /** The gaits whose clips bound on the loaded character. */
  clips: string[]
  gait: string
}
const state: UnityPageState = {
  status: '',
  error: false,
  built: false,
  ready: false,
  name: null,
  clips: [],
  gait: 'idle',
}
;(window as unknown as { dramatisUnity: UnityPageState }).dramatisUnity = state

function status(message: string, tone: 'info' | 'error' = 'info'): void {
  ui.status.textContent = message
  ui.status.className = tone === 'error' ? 'error' : ''
  state.status = message
  state.error = tone === 'error'
}
const message = (e: unknown) => String((e as Error)?.message ?? e)

// --- the player ---------------------------------------------------------------

interface UnityInstance {
  SendMessage(target: string, method: string, value?: string): void
}
declare global {
  interface Window {
    createUnityInstance?: (
      canvas: HTMLCanvasElement,
      config: Record<string, unknown>,
      progress?: (p: number) => void
    ) => Promise<UnityInstance>
    dramatisUnityEvent?: (kind: string, text: string) => void
  }
}

let unity: UnityInstance | null = null
let playerReady: () => void = () => {}
const ready = new Promise<void>((r) => (playerReady = r))

window.dramatisUnityEvent = (kind, text) => {
  if (kind === 'status') status(text)
  else if (kind === 'error') status(text, 'error')
  else if (kind === 'ready') {
    state.ready = true
    playerReady()
  } else if (kind === 'loaded') {
    state.clips = text ? text.split(',') : []
  } else if (kind === 'gait') state.gait = text
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`couldn’t load ${src}`))
    document.head.append(s)
  })
}

async function startPlayer(): Promise<boolean> {
  const head = await fetch(`${PLAYER}.loader.js`, { method: 'HEAD' }).catch(
    () => null
  )
  if (!head?.ok) {
    status(
      'The Unity player isn’t built yet (bun tools/engines/unity.ts --web). The three.js demo does the same now.',
      'error'
    )
    return false
  }
  state.built = true
  status('Starting Unity…')
  await loadScript(`${PLAYER}.loader.js`)
  if (!window.createUnityInstance) throw new Error('no createUnityInstance')
  unity = await window.createUnityInstance(
    ui.canvas,
    {
      dataUrl: `${PLAYER}.data.unityweb`,
      frameworkUrl: `${PLAYER}.framework.js.unityweb`,
      codeUrl: `${PLAYER}.wasm.unityweb`,
      companyName: 'tosijs',
      productName: 'Dramatis',
      productVersion: '0.1',
    },
    (p) => status(`Starting Unity… ${Math.round(p * 100)}%`)
  )
  await ready
  return true
}

// The latest pick wins: a slower earlier one is dropped when it finishes.
let latest = 0
const begin = () => ++latest

let lastUrl: string | null = null
async function hand(
  glb: Uint8Array,
  name: string,
  ticket = begin()
): Promise<void> {
  if (!state.built)
    return status(
      'The Unity player isn’t built yet, so it can’t show this. The three.js demo can.',
      'error'
    )
  await ready
  if (ticket !== latest) return
  showLicences(glb)
  ui.title.textContent = state.name = name.replace(/\.(glb|vrm)$/i, '')
  if (lastUrl) URL.revokeObjectURL(lastUrl)
  lastUrl = URL.createObjectURL(
    new Blob([glb as BlobPart], { type: 'model/gltf-binary' })
  )
  unity?.SendMessage('Dramatis', 'LoadGlb', lastUrl)
}

// --- licences -----------------------------------------------------------------

function safeUrl(url: string): string | null {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

function showLicences(glb: Uint8Array): void {
  const raw = parseGlbJson(glb)?.asset?.extras?.dramatis?.licences
  const entries: LicenceEntry[] = Array.isArray(raw) ? raw : []
  ui.licences.replaceChildren(
    ...entries.map((entry) => {
      const li = document.createElement('li')
      li.append(licenceLine(entry), ' ')
      const href = safeUrl(entry.licenceUrl)
      if (href)
        li.append(
          Object.assign(document.createElement('a'), {
            href,
            target: '_blank',
            rel: 'noopener',
            textContent: 'licence',
          })
        )
      return li
    }),
    Object.assign(document.createElement('li'), {
      textContent: 'Animations: Quaternius, Universal Animation Library, CC0.',
    })
  )
  ui.licenceSummary.textContent = entries.length
    ? `Licences: ${entries.length} assets`
    : 'Licences (not a Dramatis export: the file names none)'
  ui.licenceBox.hidden = false
}

// --- sources --------------------------------------------------------------------

let pack: Promise<HumanPack> | null = null
async function fromCharacter(doc: unknown, label: string): Promise<void> {
  const ticket = begin()
  status(`Building ${label}…`)
  try {
    const { character } = readCharacter(doc, { settings: BUILD_SETTINGS })
    pack ??= loadHumanPack(HM08_PACK_URL)
    const glb = await exportCharacterGlb(character, await pack)
    if (ticket !== latest) return
    await hand(glb, character.name || label, ticket)
  } catch (e) {
    pack = null
    if (ticket === latest)
      status(`Couldn’t build ${label}: ${message(e)}`, 'error')
  }
}

async function fromFile(file: File): Promise<void> {
  const kind = fileKind(file.name)
  if (kind === 'character')
    return fromCharacter(JSON.parse(await file.text()), file.name)
  if (kind !== 'glb')
    return status(
      `${file.name}: open a .glb, .vrm or character .json.`,
      'error'
    )
  await hand(new Uint8Array(await file.arrayBuffer()), file.name)
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
  await fromCharacter(
    doc,
    key === WORKING_CHARACTER ? 'the figure in the creator' : key
  )
}

ui.load.addEventListener('click', () => void fromSave(ui.saves.value))
ui.open.addEventListener('click', () => ui.file.click())
ui.file.addEventListener('change', () => {
  const f = ui.file.files?.[0]
  if (f) void fromFile(f)
  ui.file.value = ''
})
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => {
  e.preventDefault()
  const f = e.dataTransfer?.files?.[0]
  if (f) void fromFile(f)
})

async function start(): Promise<void> {
  let built: boolean
  try {
    built = await startPlayer()
  } catch (e) {
    return status(`Unity wouldn’t start: ${message(e)}`, 'error')
  }
  const saved = await listSaves()
  if (!built) return
  const params = new URLSearchParams(location.search)
  const handoff = params.get(HANDOFF_PARAM)
  if (handoff) {
    const entry = await takeHandoff(handoff).catch(() => null)
    if (entry) return hand(entry.glb, entry.fileName)
    status('That hand-off has expired. Pick a character below.', 'error')
  }
  const glbUrl = params.get(GLB_URL_PARAM)
  if (glbUrl) {
    try {
      const res = await fetch(glbUrl)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return hand(
        new Uint8Array(await res.arrayBuffer()),
        glbUrl.split('/').pop()!
      )
    } catch (e) {
      return status(`${glbUrl} wouldn’t load: ${message(e)}`, 'error')
    }
  }
  if (saved.length) return fromSave(saved[0]!)
  await fromCharacter(DEFAULT_CHARACTER, 'a default character')
}
void start()
