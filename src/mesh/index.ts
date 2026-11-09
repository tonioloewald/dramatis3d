// A MESH BODY's export (#3856, "bring your hero"): a character whose body is
// a mesh (an AI-made character, or a file of the user's) rather than
// MakeHuman's, rigged in tosijs-3d's rig tool, as a profile GLB.
//
// All tosijs-3d's, through its pure subpaths: the file's triangles and
// materials (glb-rig), UAL's skeleton fitted to the rig recipe's markers and
// the skin bound by bone heat (rigged-body), and the skinned GLB in
// Dramatis's profile, springs included (rigged-body-glb). Dramatis adds the
// licence block and the decision of where the mesh comes from.
//
// The character file says it: `settings.source` names the body (`MakeHuman`
// for MakeHuman's), `settings.rigs[source]` is its rig recipe, and
// `bodies[source]` is where the mesh is: a URL (and the node picked in it) or
// the file's bytes.

import type { Character, CharacterBody } from 'tosijs-3d/character-file'
import { glbRigTriangles } from 'tosijs-3d/glb-rig'
import { bodyFromMarkers } from 'tosijs-3d/rigged-body'
import { riggedBodyGlb } from 'tosijs-3d/rigged-body-glb'
import type { RigRecipe } from 'tosijs-3d/rig-recipe'
import type { LicenceEntry } from '../contracts/licences'
import {
  EXPORT_FORMAT,
  EXPORT_PROFILE_VERSION,
  EXTRAS_KEY,
  type ExportExtras,
  type NamingProfile,
  type RestPose,
} from '../contracts/profile'
import { GENERATOR } from '../build/version'
import { copyrightLine } from '../build/write'
import {
  CLIP_FPS,
  clipExtras,
  withClipLicences,
  type ExportClip,
} from '../clips'
import { heldExtras, type ExportHeld } from '../held'

import { MAKEHUMAN_SOURCE } from './source'
export { hasMeshBody, MAKEHUMAN_SOURCE } from './source'

/**
 * Where Tonio's AI-made characters are on the asset CDN. Everything under
 * it is CC0 (static-assets `assets/tonio/ai/metadata.json`, which overrides
 * the tonio namespace's CC BY), made with Gemini and Meshy on a paid plan.
 */
export const AI_CAST_BASE = 'https://cdn.tosijs.net/tonio/ai/'

/** The file name a URL or file body is known by. */
const baseName = (path: string) =>
  decodeURIComponent(path.split(/[?#]/)[0]!.split('/').pop() || path)

/**
 * The licence entry for a mesh body: CC0 with how it was made for one of the
 * AI cast; for anything else, the user's own file, whose licence Dramatis
 * can't know (SPDX `NOASSERTION`), said so plainly.
 */
export function meshLicence(name: string, body: CharacterBody): LicenceEntry {
  const url = body.url ?? ''
  if (url.startsWith(AI_CAST_BASE)) {
    const file = baseName(url)
    return {
      asset: `tonio:ai/${file}`,
      title: `${name} (AI-made character: reference sheet by Gemini, mesh by Meshy, directed by Tonio Loewald)`,
      kind: 'base',
      licence: 'CC0-1.0',
      licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      source: url.split('?')[0]!,
      author: 'Tonio Loewald',
      modified: true,
    }
  }
  const file = body.file?.name ?? (url ? baseName(url) : name)
  return {
    asset: `user:${file}`,
    title: `${name} (a mesh supplied by the user; its licence is theirs to know)`,
    kind: 'base',
    licence: 'NOASSERTION',
    licenceUrl: 'https://spdx.org/licenses/',
    source: url ? url.split('?')[0]! : `user-supplied file: ${file}`,
    author: 'not stated (supplied by the user)',
    modified: true,
  }
}

export interface MeshExportOptions {
  /** Skeleton naming. Default `ue`. */
  naming?: NamingProfile
  /** The bind pose. Default `t-pose` (VRM needs it). */
  restPose?: RestPose
  /** Fetches a URL body (as the build's `fetch` does). Default `fetch`. */
  fetch?: (url: string) => Promise<ArrayBuffer>
  /** Clips to carry (as `ExportOptions.clips`). */
  clips?: readonly ExportClip[]
  /** What the right hand holds (as `ExportOptions.held`). */
  held?: ExportHeld
}

/** The mesh's bytes: the file's, or fetched from its URL. */
async function meshBytes(
  name: string,
  body: CharacterBody,
  doFetch?: (url: string) => Promise<ArrayBuffer>
): Promise<Uint8Array> {
  if (body.file) return body.file.bytes
  if (!body.url) throw new Error(`mesh body ${name} has no file and no URL`)
  if (doFetch) return new Uint8Array(await doFetch(body.url))
  const r = await fetch(body.url)
  if (!r.ok)
    throw new Error(
      `mesh body ${name}: ${r.status} ${r.statusText} from ${body.url}`
    )
  return new Uint8Array(await r.arrayBuffer())
}

/**
 * A character with a mesh body as profile GLB bytes: the mesh read, rigged
 * from its recipe's markers, written with UAL's 65 joints, the springs, the
 * file's materials and a licence entry. Throws, saying what is missing, when
 * the body has no mesh or no recipe bound from markers.
 */
export async function exportMeshGlb(
  character: Character,
  options: MeshExportOptions = {}
): Promise<Uint8Array> {
  const name = String(character.settings.source)
  const body = character.bodies?.[name]
  if (!body)
    throw new Error(
      `mesh body ${name}: the character file doesn't say where the mesh is (open the mesh again)`
    )
  const recipe = (
    character.settings.rigs as Record<string, RigRecipe> | undefined
  )?.[name]
  if (!recipe?.binding?.markers)
    throw new Error(
      `mesh body ${name} isn't rigged yet: rig it in the rig tool first`
    )
  const naming = options.naming ?? 'ue'
  const restPose = options.restPose ?? 't-pose'
  const bytes = await meshBytes(name, body, options.fetch)
  const tris = glbRigTriangles(
    bytes,
    body.pick != null ? { pick: body.pick } : {}
  )
  const b = recipe.binding
  const rigged = bodyFromMarkers(tris, {
    markers: b.markers,
    ...(b.tail != null ? { tail: b.tail } : {}),
    ...(b.tailBase != null ? { tailBase: b.tailBase } : {}),
    ...(b.joints ? { joints: b.joints } : {}),
    source: body.url ?? body.file?.name ?? name,
  })
  const clips = options.clips ?? []
  const held = options.held
  const licences = withClipLicences(
    [meshLicence(name, body), ...(held ? [held.licence] : [])],
    clips
  )
  const extras: ExportExtras = {
    format: EXPORT_FORMAT,
    version: EXPORT_PROFILE_VERSION,
    generator: GENERATOR,
    naming,
    restPose,
    faceUnits: [],
    character: character.name,
    licences,
  }
  return riggedBodyGlb(rigged, {
    naming,
    restPose,
    recipe,
    generator: GENERATOR,
    copyright: copyrightLine(licences),
    extras: { [EXTRAS_KEY]: extras },
    ...(held
      ? {
          held: {
            grip: held.grip,
            item: held.item,
            ...(held.gripPoint ? { gripPoint: held.gripPoint } : {}),
            extras: heldExtras(held),
          },
        }
      : {}),
    ...(clips.length
      ? {
          clips: clips.map((c) => ({
            from: c.from,
            clip: c.clip,
            name: c.name ?? c.clip,
            fps: CLIP_FPS,
            ...(recipe.armSpaceDeg != null
              ? { armSpaceDeg: recipe.armSpaceDeg }
              : {}),
            extras: clipExtras(c),
          })),
        }
      : {}),
  })
}
