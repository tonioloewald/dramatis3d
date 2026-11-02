// The creator's export actions: View in three.js, View in Unity, Download GLB, Share link.
// No Babylon here: these take a character file and the pack, call the
// contracts, and say what happened in words a person can act on. Kept apart
// from the scene so they can be tested under bun.

import type { Character } from 'tosijs-3d/character-file'
import { parseGlbJson } from 'tosijs-3d/glb-manifest'
import type { HumanPack } from 'tosijs-3d/human-pack'
import { exportCharacterGlb } from '../../src/contracts/export'
import {
  characterLicences,
  UnlicensedAssetError,
  type LicenceEntry,
} from '../../src/contracts/licences'
import type { NamingProfile } from '../../src/contracts/profile'
import { encodeShareLink, SHARE_FRAGMENT_KEY } from '../../src/contracts/share'
import { UNITY_PATH, VIEWER_PATH, viewerUrl } from '../../src/contracts/handoff'
import { putHandoff } from './handoff'

/** What an action reports: a line for the status bar, and how it went. */
export interface ActionResult {
  ok: boolean
  message: string
  /** The share link, when one was made. */
  url?: string
}

/** What each lane's stub stands for, for a stub that has not landed. */
const NOT_YET: Record<string, string> = {
  'skinned-glb': 'GLB export',
  'share-licence': 'Sharing',
  vrm: 'VRM export',
  three: 'The three.js adapter',
  'site-creator': 'The viewer handoff',
}

/**
 * A thrown error as a sentence. A contract stub (`not implemented: <lane>`)
 * is not a crash: that part of Dramatis is not built yet, and it says so.
 * `doing` finishes "Could not …" (`export the GLB`).
 */
export function explain(error: unknown, doing: string): string {
  const message = error instanceof Error ? error.message : String(error)
  const lane = /^not implemented: ([\w-]+)/.exec(message)?.[1]
  if (lane)
    return `${
      NOT_YET[lane] ?? `This part (${lane})`
    } isn't in this build yet, so the creator could not ${doing}. Your character is kept.`
  return `Could not ${doing}: ${message}`
}

/**
 * Whether the creator may offer `name` for `key` (a slot, or hair, beard,
 * moustache, brows): the licence manifest has an entry for it. The pack
 * carries community assets nobody has checked yet; offering them would let a
 * person design a character that cannot be exported (LANES.md rule 5).
 * Asked of `characterLicences` itself, so the asset ids stay its business.
 */
export function licensedChoice(
  key: string,
  name: string,
  pack: HumanPack
): boolean {
  if (name === 'none') return true
  try {
    characterLicences(
      {
        name: '',
        settings: { [key]: name },
        cloth: {},
        tailor: [],
        garments: {},
      },
      pack
    )
    return true
  } catch (error) {
    if (error instanceof UnlicensedAssetError) return false
    throw error
  }
}

/** A safe file name from a character's name. */
export function fileNameFor(name: string, ext: string): string {
  const base = name
    .trim()
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `${base || 'character'}.${ext}`
}

/**
 * The licence entries a GLB carries (`asset.extras.dramatis.licences`), read
 * from its JSON chunk without parsing the rest. Empty when there are none or
 * it is not a GLB.
 */
export function glbLicences(glb: Uint8Array): LicenceEntry[] {
  const licences = parseGlbJson(glb)?.asset?.extras?.dramatis?.licences
  return Array.isArray(licences) ? licences : []
}

export interface ExportInput {
  character: Character
  pack: HumanPack
  naming: NamingProfile
}

/** Export a GLB, or a sentence saying why not. */
export async function exportGlb(
  input: ExportInput
): Promise<
  | { ok: true; glb: Uint8Array; fileName: string }
  | { ok: false; message: string }
> {
  try {
    const glb = await exportCharacterGlb(input.character, input.pack, {
      naming: input.naming,
    })
    return { ok: true, glb, fileName: fileNameFor(input.character.name, 'glb') }
  } catch (error) {
    return { ok: false, message: explain(error, 'export the GLB') }
  }
}

/** Put bytes in the browser's downloads. */
export function saveBytes(
  bytes: Uint8Array | string,
  name: string,
  type: string
) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type }))
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const size = (n: number) =>
  n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`

/** Download GLB. */
export async function downloadGlb(input: ExportInput): Promise<ActionResult> {
  const out = await exportGlb(input)
  if (!out.ok) return out
  saveBytes(out.glb, out.fileName, 'model/gltf-binary')
  const n = glbLicences(out.glb).length
  return {
    ok: true,
    message: `Saved ${out.fileName} (${size(
      out.glb.byteLength
    )}, ${n} licence ${n === 1 ? 'entry' : 'entries'} inside).`,
  }
}

/** Where an export can be opened: the page, and what to call it. */
export interface ViewTarget {
  path: string
  name: string
  /** What must be on the site for the page to work (default: `path`). */
  probe?: string
}
export const THREE_VIEWER: ViewTarget = {
  path: VIEWER_PATH,
  name: 'the three.js viewer',
}
export const UNITY_PLAYER: ViewTarget = {
  path: UNITY_PATH,
  name: 'the Unity player',
  // The page is always there; the player's build may not be.
  probe: `${UNITY_PATH}player/Build/player.loader.js`,
}

/** Whether a page is on this site. */
async function pageExists(path: string): Promise<boolean> {
  try {
    const r = await fetch(path, { method: 'HEAD', cache: 'no-store' })
    return r.ok
  } catch {
    return false
  }
}

/**
 * View in three.js or Unity: export, put the GLB in the handoff store, open
 * `target` on it. `opened` is a window the click opened at once (a popup
 * opened after an await is blocked); it is pointed at the page, or closed
 * when there is nothing to show.
 */
export async function viewIn(
  input: ExportInput,
  opened: Window | null,
  target: ViewTarget = THREE_VIEWER
): Promise<ActionResult> {
  const fail = (message: string): ActionResult => {
    opened?.close()
    return { ok: false, message }
  }
  const out = await exportGlb(input)
  if (!out.ok) return fail(out.message)
  let id: string
  try {
    id = await putHandoff({
      glb: out.glb,
      fileName: out.fileName,
      character: input.character.name || 'character',
      licences: glbLicences(out.glb),
    })
  } catch (error) {
    return fail(explain(error, `hand the GLB to ${target.name}`))
  }
  if (!(await pageExists(target.probe ?? target.path)))
    return fail(
      `${target.name[0]!.toUpperCase()}${target.name.slice(
        1
      )} is not on this site. The export worked: use Download GLB and open it in any glTF viewer.`
    )
  const url = viewerUrl(id, undefined, target.path)
  if (opened) opened.location.href = url
  else if (!window.open(url, '_blank'))
    return { ok: false, message: `Pop-up blocked: open ${url}` }
  return { ok: true, message: `Opened ${out.fileName} in ${target.name}.` }
}

/** View in three.js: `viewIn` the three.js viewer. */
export const viewInThree = (input: ExportInput, opened: Window | null) =>
  viewIn(input, opened, THREE_VIEWER)

/** View in Unity: `viewIn` the Unity player (Unity 6's Web player). */
export const viewInUnity = (input: ExportInput, opened: Window | null) =>
  viewIn(input, opened, UNITY_PLAYER)

/** Share link: made, copied to the clipboard when the browser lets it. */
export async function shareLink(
  character: Character,
  base: string
): Promise<ActionResult> {
  let link
  try {
    link = encodeShareLink(character, { base })
  } catch (error) {
    return { ok: false, message: explain(error, 'make a share link') }
  }
  let copied = false
  try {
    await navigator.clipboard.writeText(link.url)
    copied = true
  } catch {
    // Not allowed here (no focus, or an insecure origin): the link is shown.
  }
  const dropped = link.dropped.length
    ? ` Left out: ${link.dropped.join('; ')}.`
    : ''
  return {
    ok: true,
    url: link.url,
    message: `${copied ? 'Link copied' : 'Share link ready'} (${
      link.url.length
    } characters).${dropped}`,
  }
}

/** The share fragment in a URL's hash, if it has one. */
export function shareFragment(hash: string): string | null {
  const h = hash.replace(/^#/, '')
  return h.startsWith(`${SHARE_FRAGMENT_KEY}=`) ? h : null
}
