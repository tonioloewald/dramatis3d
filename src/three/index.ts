// Documented in site/docs/dramatis-three.md.

import { BufferAttribute, BufferGeometry } from 'three'
import type { HumanPack } from 'tosijs-3d/human-pack'
import {
  DEFAULT_HUMAN_BODY,
  macroWeights,
  morphHuman,
  type MacroBody,
} from 'tosijs-3d/human-morph'

export type { MacroBody }
export { DEFAULT_HUMAN_BODY }

/**
 * An indexed `BufferGeometry` from flat vertex positions (x, y, z per vertex)
 * and triangle indices, with vertex normals computed. The arrays are copied,
 * so the caller may reuse them (`morphHuman` writes into its `into` buffer).
 */
export function bodyGeometry(
  positions: ArrayLike<number>,
  triangles: ArrayLike<number>
): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(Float32Array.from(positions), 3)
  )
  geometry.setIndex(new BufferAttribute(Uint32Array.from(triangles), 1))
  geometry.computeVertexNormals()
  return geometry
}

/** The pack's base mesh morphed to `body` by its macro targets, as a three.js geometry. */
export async function morphedBodyGeometry(
  pack: HumanPack,
  body: MacroBody = DEFAULT_HUMAN_BODY
): Promise<BufferGeometry> {
  const weights = macroWeights(body, (name) => pack.has(name))
  const positions = await morphHuman(pack, weights)
  return bodyGeometry(positions, pack.triangles)
}

// The adapter's contract (src/contracts/three-adapter.ts): a built character
// as three.js objects. Lane: three.
export { characterObject } from '../contracts/three-adapter'
export type {
  CharacterObject,
  CharacterObjectOptions,
} from '../contracts/three-adapter'
// Live update: a rebuilt character into the same objects (no reload).
export { updateCharacterObject } from './character-object'
// UAL clips on a character, as the profile says to play them.
export { characterClip, type CharacterClipOptions } from './clip'
