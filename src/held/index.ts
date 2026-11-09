// HELD ITEMS IN THE EXPORT (#3909): what the right hand holds, written as a
// `weapon_r` joint under `hand_r` (where engines attach their own items) and,
// with the item, its mesh skinned wholly to that joint.
//
// The items are Tonio's weapon library (static-assets tonio/weapons-classic,
// textured: guns, blades, a plasma blade, a buckler, a game controller), each
// made the same way: its origin at the main-hand grip, +Y up the grip, +Z
// forward, real size, with a `<name>_grip` marker. Where the hand holds an
// item is set per class (tosijs-3d/hold-grip: pistols, one-handed blades…),
// and a character keeps its own adjustments per class (`settings.grips`).
// The mesh path writes it with riggedBodyGlb's `held`; the MakeHuman path
// with the same placement (src/upstream/held-parts.ts).

import { glbNodePosition, glbRigTriangles } from 'tosijs-3d/glb-rig'
import { holdGrip, type HoldGrip } from 'tosijs-3d/hold-grip'
import type { Vec3 } from 'tosijs-3d/hand-socket'
import type { BodyTriangles } from 'tosijs-3d/rigged-body'
import type { LicenceEntry } from '../contracts/licences'
import { EXTRAS_KEY } from '../contracts/profile'
import { lookupLicence } from '../licences'

export { WEAPONS, WEAPONS_PATH, WEAPONS_URL, weaponAsset } from './library'
import { WEAPONS, weaponAsset } from './library'

/** A held item for an export: an item, where the hand holds it, its licence. */
export interface ExportHeld {
  /** The item's name in its library. */
  name: string
  /** The grip: a point and a turn in the hand's socket frame, and a scale. */
  grip: HoldGrip
  /** The item, in its own frame. */
  item: BodyTriangles
  /** Where the item is held, in its frame (default the middle of its lowest third). */
  gripPoint?: Vec3
  licence: LicenceEntry
}

/** The extras the item's mesh carries: its licence's asset id. */
export const heldExtras = (h: ExportHeld) => ({
  [EXTRAS_KEY]: { licence: h.licence.asset },
})

/**
 * An item from Tonio's library (the bytes of `weapons.glb`), held as
 * `grips` says for its class (a character's `settings.grips`; default the
 * class's own grip). Throws for a name the library doesn't have.
 */
export function weaponHeld(
  bytes: Uint8Array,
  name: string,
  grips: Partial<Record<string, Partial<HoldGrip>>> = {}
): ExportHeld {
  const licence = lookupLicence(weaponAsset(name))
  if (!licence || !(WEAPONS as readonly string[]).includes(name))
    throw new Error(`the weapon library has no ${name}`)
  const pick = `${name}.model`
  const item = glbRigTriangles(bytes, { pick })
  const gripPoint = glbNodePosition(bytes, `${name}_grip`, { pick })
  return {
    name,
    grip: holdGrip(name, grips),
    item,
    ...(gripPoint ? { gripPoint } : {}),
    licence,
  }
}
