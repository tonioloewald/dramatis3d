// UAL clips on a Dramatis character, the way the profile says to play them
// (site/docs/export-format.md, "Playing UAL clips").

import {
  AnimationClip,
  PropertyBinding,
  VectorKeyframeTrack,
  type KeyframeTrack,
} from 'three'
import { jointName, UE_JOINTS, type NamingProfile } from '../contracts/profile'

/** Options for `characterClip`. */
export interface CharacterClipOptions {
  /** The character's bone names (default `ue`); the clip's are UAL's (`ue`). */
  naming?: NamingProfile
  /**
   * Multiplies the `root` and `pelvis` translation keys: the character's hip
   * height over the clip's skeleton's (UAL's mannequin), so a taller or
   * shorter body keeps its feet on the floor. Default 1.
   */
  translationScale?: number
}

const UE = new Set(UE_JOINTS.map((j) => j.name))

/**
 * A UAL (or any UE-mannequin) clip made fit for a Dramatis character: its
 * rotation tracks on every profile joint, its translation tracks on `root`
 * and `pelvis` only (scaled by `translationScale`), no scale tracks, and the
 * track names renamed to the character's naming. A clip's other translation
 * keys hold the mannequin's bone lengths and would stretch the body to it.
 * Tracks for nodes outside the profile are dropped. Returns a new clip.
 */
export function characterClip(
  clip: AnimationClip,
  options: CharacterClipOptions = {}
): AnimationClip {
  const naming = options.naming ?? 'ue'
  const scale = options.translationScale ?? 1
  const tracks: KeyframeTrack[] = []
  for (const track of clip.tracks) {
    const parsed = PropertyBinding.parseTrackName(track.name)
    const ue = parsed.nodeName
    if (ue === undefined || !UE.has(ue)) continue
    const isRotation = parsed.propertyName === 'quaternion'
    const isHipTranslation =
      parsed.propertyName === 'position' && (ue === 'root' || ue === 'pelvis')
    if (!isRotation && !isHipTranslation) continue
    const t = track.clone()
    t.name = `${PropertyBinding.sanitizeNodeName(jointName(ue, naming))}.${
      parsed.propertyName
    }`
    if (isHipTranslation && scale !== 1 && t instanceof VectorKeyframeTrack) {
      const values = Float32Array.from(t.values)
      for (let i = 0; i < values.length; i++) values[i] = values[i]! * scale
      t.values = values
    }
    tracks.push(t)
  }
  return new AnimationClip(clip.name, clip.duration, tracks)
}
