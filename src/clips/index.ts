// CLIPS IN THE EXPORT (#3908): the clips an exported GLB carries, chosen by
// the user (the creator's Motion tab), each retargeted onto the character's
// own skeleton and written as a glTF animation.
//
// tosijs-3d does the work engine-free: readGlbClips reads a GLB's clips and
// skeleton, bakeClip retargets one onto another skeleton (glb-clips). The
// MakeHuman path bakes onto the built skeleton here and writes the result
// with skinned-glb's animations; a mesh body hands its clips to
// riggedBodyGlb (src/mesh/). Either way each clip's licence entry joins the
// file's licences, and the animation's extras name it.

import { bakeClip, readGlbClips, type GlbClipSource } from 'tosijs-3d/glb-clips'
import { humanoidRoles, type Skeleton } from 'tosijs-3d/retarget'
import type { GlbAnimation } from 'tosijs-3d/skinned-glb'
import type { BuiltJoint } from '../contracts/built-character'
import type { LicenceEntry } from '../contracts/licences'
import { EXTRAS_KEY } from '../contracts/profile'
import { lookupLicence } from '../licences'

/** A clip for an export: one of a file's clips, with its licence. */
export interface ExportClip {
  /** The file's clips and skeleton (`readGlbClips`, or `ualClips`). */
  from: GlbClipSource
  /** The clip's name in `from`. */
  clip: string
  /** Its name in the export (default its own). */
  name?: string
  /** Its licence entry: a clip with none is not exported. */
  licence: LicenceEntry
}

/** Keys a second for a baked clip. */
export const CLIP_FPS = 30

/** UAL volume 1's licence entry (CC0, Quaternius). */
export const UAL_CLIPS_LICENCE: LicenceEntry = (() => {
  const entry = lookupLicence('quaternius:animation/ual1')
  if (!entry) throw new Error('the licence manifest has no UAL clips entry')
  return entry
})()

/**
 * Clips from a file of Universal Animation Library clips (UAL1_core.glb, or
 * the site's starter cut of it), by name, ready for `ExportOptions.clips`.
 * Throws for a name the file doesn't have.
 */
export function ualClips(
  bytes: Uint8Array | GlbClipSource,
  names: readonly string[]
): ExportClip[] {
  const from = bytes instanceof Uint8Array ? readGlbClips(bytes) : bytes
  const have = new Set(from.clips.map((c) => c.name))
  return names.map((clip) => {
    if (!have.has(clip)) throw new Error(`the clips file has no ${clip}`)
    return { from, clip, licence: UAL_CLIPS_LICENCE }
  })
}

/** Each clip's licence, once, after the ones already there. */
export function withClipLicences(
  licences: readonly LicenceEntry[],
  clips: readonly ExportClip[]
): LicenceEntry[] {
  const out = [...licences]
  const seen = new Set(out.map((l) => l.asset))
  for (const c of clips)
    if (!seen.has(c.licence.asset)) {
      seen.add(c.licence.asset)
      out.push(c.licence)
    }
  return out
}

/** The extras an exported animation carries: its licence's asset id. */
export const clipExtras = (c: ExportClip) => ({
  [EXTRAS_KEY]: { licence: c.licence.asset },
})

/** The built skeleton as the retargeter reads it. */
export function builtSkeleton(joints: readonly BuiltJoint[]): Skeleton {
  const bones = joints.map((j) => ({
    name: j.name,
    parent: j.parent < 0 ? null : joints[j.parent]!.name,
    rotation: {
      x: j.rotation[0],
      y: j.rotation[1],
      z: j.rotation[2],
      w: j.rotation[3],
    },
    position: { x: j.translation[0], y: j.translation[1], z: j.translation[2] },
  }))
  return { bones, roles: humanoidRoles(bones) }
}

/**
 * Clips baked onto the built skeleton as glTF animations (joint indices are
 * the skeleton's, so any naming profile writes them as they are).
 */
export function bakeAnimations(
  joints: readonly BuiltJoint[],
  clips: readonly ExportClip[]
): GlbAnimation[] {
  if (clips.length === 0) return []
  const target = builtSkeleton(joints)
  const index = new Map(joints.map((j, i) => [j.name, i]))
  const hips = target.roles.hips
  return clips.map((c) => {
    const baked = bakeClip(c.from, c.clip, target, {
      fps: CLIP_FPS,
      name: c.name ?? c.clip,
    })
    const channels: GlbAnimation['channels'] = []
    for (const [name, values] of baked.rotations) {
      const joint = index.get(name)
      if (joint !== undefined)
        channels.push({
          joint,
          path: 'rotation',
          times: baked.times,
          values,
        })
    }
    const h = hips !== undefined ? index.get(hips) : undefined
    if (baked.hips && h !== undefined)
      channels.push({
        joint: h,
        path: 'translation',
        times: baked.times,
        values: baked.hips,
      })
    if (channels.length === 0)
      throw new Error(`clip ${c.clip}: nothing in it moves this skeleton`)
    return { name: baked.name, channels, extras: clipExtras(c) }
  })
}
