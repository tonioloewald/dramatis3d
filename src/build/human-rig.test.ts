import { expect, test } from 'bun:test'
import type * as Real from 'tosijs-3d/human-rig'
import * as bridge from './human-rig.js'
import type * as Shim from './human-rig.js'

// The bridge's Babylon-free declarations describe the real module: each real
// export is assignable to what the bridge declares, so src/build cannot be
// typed against something human-rig does not do. (This file may see Babylon's
// types: it is a test, reached from no entry.)
type Assignable<From, To> = From extends To ? true : false
const checks: [
  Assignable<typeof Real.humanBodyMaker, typeof Shim.humanBodyMaker>,
  Assignable<typeof Real.humanSkin, typeof Shim.humanSkin>,
  Assignable<typeof Real.humanRig, typeof Shim.humanRig>,
  Assignable<typeof Real.HM08_UAL, typeof Shim.HM08_UAL>
] = [true, true, true, true]

test('the bridge declares what human-rig exports, Babylon-free', () => {
  expect(checks).toEqual([true, true, true, true])
  expect(typeof bridge.humanBodyMaker).toBe('function')
  expect(typeof bridge.humanSkin).toBe('function')
  expect(typeof bridge.humanRig).toBe('function')
  expect(bridge.HM08_UAL).toHaveLength(65)
})
