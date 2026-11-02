import { describe, expect, test } from 'bun:test'
import { UE_JOINT_NAMES } from '../contracts/profile'
import { builtSkin } from './build'

// BuiltSkin's promise (src/contracts/built-character.ts): each vertex's
// weights sum to 1. The three.js path feeds them straight to skinWeight.
describe('builtSkin', () => {
  test('weights are renormalised to sum to 1', () => {
    const s = builtSkin([3, 4, 0, 0], [0.2, 0.6, 0, 0])
    expect([...s.joints]).toEqual([3, 4, 0, 0])
    expect(s.weights[0]! + s.weights[1]!).toBeCloseTo(1, 6)
  })

  test('a vertex with no weight goes wholly to the pelvis', () => {
    const s = builtSkin([5, 6, 7, 8], [0, 0, 0, 0])
    expect([...s.joints]).toEqual([UE_JOINT_NAMES.indexOf('pelvis'), 0, 0, 0])
    expect([...s.weights]).toEqual([1, 0, 0, 0])
  })
})
