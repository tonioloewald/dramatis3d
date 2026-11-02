import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BABYLON_MARKERS } from '../three-page'
import { buildDemo } from './build'
import {
  collide,
  fileKind,
  gaitFor,
  headingOf,
  keySign,
  pillarRing,
  saveChoices,
  steer,
  towardGoal,
  turnToward,
} from './core'

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6)

describe('the demo’s movement', () => {
  test('a speed plays the gait whose stride is nearest', () => {
    expect(gaitFor(0).name).toBe('idle')
    expect(gaitFor(1.4).name).toBe('walk')
    expect(gaitFor(3).name).toBe('jog')
    expect(gaitFor(9).name).toBe('sprint')
  })

  test('the keys steer relative to the camera, seen from above', () => {
    expect(steer({ forward: 0, right: 0, run: false }, 0)).toBeNull()
    // Camera looking along +Z: forward is +Z, and screen right is -X.
    const f = steer({ forward: 1, right: 0, run: false }, 0)!
    close(f.x, 0)
    close(f.z, 1)
    const r = steer({ forward: 0, right: 1, run: false }, 0)!
    close(r.x, -1)
    close(r.z, 0)
    // Camera looking along +X: forward is +X, right is +Z.
    const f2 = steer({ forward: 1, right: 0, run: false }, Math.PI / 2)!
    close(f2.x, 1)
    const r2 = steer({ forward: 0, right: 1, run: false }, Math.PI / 2)!
    close(r2.z, 1)
    // Diagonals are unit length, not faster.
    const d = steer({ forward: 1, right: 1, run: false }, 0.3)!
    close(Math.hypot(d.x, d.z), 1)
  })

  test('S, Down, A and Left count backwards', () => {
    expect(['KeyS', 'ArrowDown', 'KeyA', 'ArrowLeft'].map(keySign)).toEqual([
      -1, -1, -1, -1,
    ])
    expect(['KeyW', 'ArrowUp', 'KeyD', 'ArrowRight'].map(keySign)).toEqual([
      1, 1, 1, 1,
    ])
  })

  test('turning takes the short way round and stops on the heading', () => {
    close(headingOf({ x: 0, z: 1 }), 0)
    close(headingOf({ x: 1, z: 0 }), Math.PI / 2)
    // From just under +pi to just over -pi is a small step, not a full turn.
    const t = turnToward(3, -3, 1)
    close(Math.atan2(Math.sin(t), Math.cos(t)), -3)
    close(turnToward(0, 1, 0.25), 0.25)
  })

  test('a clicked goal leads there and lets go on arrival', () => {
    const d = towardGoal({ x: 0, z: 0 }, { x: 3, z: 4 })!
    close(d.x, 0.6)
    close(d.z, 0.8)
    expect(towardGoal({ x: 3, z: 4 }, { x: 3.05, z: 4 })).toBeNull()
  })

  test('the walker is pushed out of pillars and kept in the arena', () => {
    const out = collide({ x: 0.1, z: 0 }, 0.3, [{ x: 0, z: 0, r: 0.5 }], 10)
    close(Math.hypot(out.x, out.z), 0.8)
    expect(collide({ x: 20, z: -20 }, 0.3, [], 10)).toEqual({
      x: 9.7,
      z: -9.7,
    })
    // Clear of every pillar, the ring leaves the middle open to start in.
    for (const p of pillarRing())
      expect(Math.hypot(p.x, p.z) - p.r).toBeGreaterThan(5)
  })
})

describe('the demo’s loading', () => {
  test('the creator’s working figure is offered first, by what it is', () => {
    expect(saveChoices(['Ada', '(working)', 'Bo'], true, '(working)')).toEqual([
      { key: '(working)', label: 'the figure in the creator' },
      { key: 'Ada', label: 'Ada' },
      { key: 'Bo', label: 'Bo' },
    ])
    expect(saveChoices([], false, '(working)')).toEqual([])
  })

  test('files are told apart by extension', () => {
    expect(fileKind('Ada.GLB')).toBe('glb')
    expect(fileKind('ada.vrm')).toBe('glb')
    expect(fileKind('ada.gltf')).toBe('gltf')
    expect(fileKind('ada.character.json')).toBe('character')
    expect(fileKind('ada.fbx')).toBeNull()
  })

  test('the page builds with three.js and the exporter, and no Babylon', async () => {
    const out = mkdtempSync(join(tmpdir(), 'dramatis-demo-'))
    expect(await buildDemo(out)).toBe(true)
    const js = readFileSync(join(out, 'main.js'), 'utf8')
    for (const m of BABYLON_MARKERS) expect(js.includes(m)).toBe(false)
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain(
      'src="./main.js"'
    )
  })
})
