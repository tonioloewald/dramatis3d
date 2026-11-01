// The three.js adapter's contract: a built character as three.js objects.
// Lane: three (src/three/). Re-exported from src/three/index.ts only; the core
// entry never imports three.

import type { Group, Skeleton, SkinnedMesh } from 'three'
import type { FaceUnitName, NamingProfile } from './profile'

export interface CharacterObjectOptions {
  /**
   * Bone names. Default `ue`, so UAL clips bind by name (three's
   * PropertyBinding strips `:`, so Mixamo's `mixamorig:Hips` binds as
   * `mixamorigHips`, as it does for Mixamo's own files).
   */
  naming?: NamingProfile
}

/** A built character in a three.js scene graph. */
export interface CharacterObject {
  /** Add this to the scene. Its children are the root bone and the meshes. */
  root: Group
  /** The one skeleton every mesh shares. */
  skeleton: Skeleton
  /** In `BuiltCharacter.meshes` order. */
  meshes: SkinnedMesh[]
  /** Set a face unit's weight (0..1) on every mesh that has it. */
  setFaceUnit(unit: FaceUnitName, weight: number): void
  /** Release the geometries, materials and textures. */
  dispose(): void
}

// The implementation, with its TSDoc: src/three/character-object.ts.
export { characterObject } from '../three/character-object'
