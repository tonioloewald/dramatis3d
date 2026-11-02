// A hand-made export, small, to the profile: UAL's 65 joints at UAL's own rest
// (T-pose, from the clip fixture), a "body" of one small triangle per major
// joint skinned rigidly to it, two face units as morph targets, a 1x1 PNG base
// colour, and the licence block. `makeFixture()` is the positive control; each
// bad fixture is it with one thing broken (fixtures.test.ts).
//
// It is not the exporter and proves nothing about one: it proves the checks.

import { Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import {
  EXPORT_FORMAT,
  EXPORT_PROFILE_VERSION,
  EXTRAS_KEY,
  type ExportExtras,
  type FaceUnitName,
  jointName,
  MAJOR_JOINTS,
  type NamingProfile,
  UE_JOINTS,
} from '../../src/contracts/profile'
import {
  BinBuilder,
  readGlb,
  writeGlb,
  type Glb,
} from '../../src/upstream/glb/glb-chunks'

export const CLIP_PATH = new URL('./fixtures/ual-walk.glb', import.meta.url)
  .pathname

export async function clipBytes(): Promise<Uint8Array> {
  return new Uint8Array(await Bun.file(CLIP_PATH).arrayBuffer())
}

const PNG_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
)

const UNITS: FaceUnitName[] = ['LeftUpperLidClosed', 'JawDrop']

export interface FixtureOptions {
  naming?: NamingProfile
  /** Change the JSON (and binary) before it is written. */
  mutate?: (glb: Glb) => void
}

/** The good fixture's GLB bytes, optionally broken by `mutate`. */
export async function makeFixture(
  options: FixtureOptions = {}
): Promise<Uint8Array> {
  const naming = options.naming ?? 'ue'
  const ual = readGlb(await clipBytes()).json
  type UalNode = {
    name: string
    translation?: number[]
    rotation?: number[]
    scale?: number[]
  }
  const ualNode = new Map<string, UalNode>(
    (ual.nodes as UalNode[]).map((n) => [n.name, n])
  )

  // Joints: node i is UE_JOINTS[i], with UAL's rest transform.
  const objects = UE_JOINTS.map((row) => {
    const n = ualNode.get(row.name)
    if (n === undefined) throw new Error(`UAL clip lacks ${row.name}`)
    const o = new Object3D()
    o.name = row.name
    if (n.translation) o.position.fromArray(n.translation)
    if (n.rotation) o.quaternion.fromArray(n.rotation)
    return o
  })
  const index = new Map(UE_JOINTS.map((r, i) => [r.name, i]))
  UE_JOINTS.forEach((r, i) => {
    if (r.parent !== null) objects[index.get(r.parent)!]!.add(objects[i]!)
  })
  objects[0]!.updateMatrixWorld(true)

  const bin = new BinBuilder()
  const accessors: unknown[] = []
  const accessor = (
    data: Float32Array | Uint16Array,
    type: string,
    target?: number,
    bounds = false
  ): number => {
    const view = bin.add(new Uint8Array(data.buffer), target)
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type]!
    const a: Record<string, unknown> = {
      bufferView: view,
      componentType: data instanceof Float32Array ? 5126 : 5123,
      count: data.length / width,
      type,
    }
    if (bounds) {
      const min = Array(width).fill(Infinity)
      const max = Array(width).fill(-Infinity)
      for (let i = 0; i < data.length; i++) {
        const k = i % width
        min[k] = Math.min(min[k], data[i]!)
        max[k] = Math.max(max[k], data[i]!)
      }
      a.min = min
      a.max = max
    }
    accessors.push(a)
    return accessors.length - 1
  }

  // The body: a small triangle at each major joint, rigid on it.
  const at = MAJOR_JOINTS.map((n) => index.get(n)!)
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const joints: number[] = []
  const weights: number[] = []
  const indices: number[] = []
  const w = new Vector3()
  for (const j of at) {
    objects[j]!.getWorldPosition(w)
    const base = positions.length / 3
    for (const [dx, dy] of [
      [0, 0.02],
      [-0.02, -0.02],
      [0.02, -0.02],
    ] as const) {
      positions.push(w.x + dx, w.y + dy, w.z + 0.05)
      normals.push(0, 0, 1)
      uvs.push(0.5, 0.5)
      joints.push(j, 0, 0, 0)
      weights.push(1, 0, 0, 0)
    }
    indices.push(base, base + 1, base + 2)
  }
  const count = positions.length / 3
  const targets = UNITS.map((_, u) => {
    const d = new Float32Array(count * 3)
    // Each unit moves the head's triangle a little.
    const head = MAJOR_JOINTS.indexOf('Head') * 3
    for (let v = head; v < head + 3; v++) d[v * 3 + 1] = -0.005 * (u + 1)
    return { POSITION: accessor(d, 'VEC3', undefined, true) }
  })
  const attributes = {
    POSITION: accessor(new Float32Array(positions), 'VEC3', 34962, true),
    NORMAL: accessor(new Float32Array(normals), 'VEC3', 34962),
    TEXCOORD_0: accessor(new Float32Array(uvs), 'VEC2', 34962),
    JOINTS_0: accessor(new Uint16Array(joints), 'VEC4', 34962),
    WEIGHTS_0: accessor(new Float32Array(weights), 'VEC4', 34962),
  }
  const indexAccessor = accessor(new Uint16Array(indices), 'SCALAR', 34963)
  const inverse = new Float32Array(16 * objects.length)
  objects.forEach((o, i) =>
    inverse.set(new Matrix4().copy(o.matrixWorld).invert().elements, i * 16)
  )
  const ibm = accessor(inverse, 'MAT4')
  const image = bin.add(PNG_1X1)

  const r = (q: Quaternion): number[] => [q.x, q.y, q.z, q.w]
  const nodes: Array<Record<string, unknown>> = UE_JOINTS.map((row, i) => {
    const o = objects[i]!
    const children = UE_JOINTS.flatMap((c, k) =>
      c.parent === row.name ? [k] : []
    )
    const node: Record<string, unknown> = {
      name: jointName(row.name, naming),
      translation: o.position.toArray(),
      rotation: r(o.quaternion),
    }
    if (children.length > 0) node.children = children
    return node
  })
  const bodyNode = nodes.length
  nodes.push({ name: 'body', mesh: 0, skin: 0 })

  const extras: ExportExtras = {
    format: EXPORT_FORMAT,
    version: EXPORT_PROFILE_VERSION,
    generator: 'dramatis test/gate1/fixture.ts',
    naming,
    restPose: 't-pose',
    faceUnits: UNITS,
    character: 'Fixture',
    licences: [
      {
        asset: 'makehuman:base/hm08',
        title: 'MakeHuman hm08 base mesh',
        kind: 'base',
        licence: 'CC0-1.0',
        licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        source: 'https://github.com/makehumancommunity/makehuman',
        author: 'MakeHuman team',
      },
    ],
  }
  const bytes = bin.bytes()
  const glb: Glb = {
    json: {
      asset: {
        version: '2.0',
        generator: 'dramatis test fixture',
        copyright: 'MakeHuman hm08 base mesh: CC0-1.0',
        extras: { [EXTRAS_KEY]: extras },
      },
      scene: 0,
      scenes: [{ name: 'Fixture', nodes: [0, bodyNode] }],
      nodes,
      skins: [
        {
          name: 'skeleton',
          inverseBindMatrices: ibm,
          skeleton: 0,
          joints: UE_JOINTS.map((_, i) => i),
        },
      ],
      meshes: [
        {
          name: 'body',
          primitives: [
            { attributes, indices: indexAccessor, material: 0, targets },
          ],
          weights: UNITS.map(() => 0),
          extras: { targetNames: [...UNITS] },
        },
      ],
      materials: [
        {
          name: 'skin',
          pbrMetallicRoughness: {
            baseColorTexture: { index: 0 },
            metallicFactor: 0,
            roughnessFactor: 0.6,
          },
        },
      ],
      textures: [{ sampler: 0, source: 0 }],
      samplers: [{ magFilter: 9729, minFilter: 9987 }],
      images: [{ name: 'skin', bufferView: image, mimeType: 'image/png' }],
      accessors,
      bufferViews: bin.views,
      buffers: [{ byteLength: bytes.byteLength }],
    },
    bin: bytes,
  }
  options.mutate?.(glb)
  return writeGlb(glb.json, glb.bin)
}
