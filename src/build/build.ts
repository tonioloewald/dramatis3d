// buildCharacter: a character file and the loaded pack to a BuiltCharacter,
// engine-free. Profile: site/docs/export-format.md. Lane: skinned-glb.
//
// What happens, in order (each step is tosijs-3d's, through its pure
// subpaths, unless it says otherwise):
//
// 1. The body is the pack morphed to the sliders, UAL's 65 joints placed in it
//    from MakeHuman's joint cubes and the skin bound by bone heat
//    (`humanBodyMaker`, human-rig).
// 2. Everything worn (clothes, hair, brows, beard, teeth, tongue) is fitted to
//    that body by its `.mhclo` binding (`fitProxy`, proxy-fit) over the body
//    clothes lie on (`smoothUnder`), and skinned with weights borrowed from
//    the skin it is bound to (`proxyWeights`).
// 3. Covered skin is removed and the rest tucked under (cover.ts).
// 4. The face units are baked as morphs: the pack's `expression/*` deltas, at
//    each mesh's vertices (`proxyDelta` for what is bound to the face).
// 5. Everything is skinned once into the T-pose and the skeleton takes UAL's
//    joint frames (pose.ts), then stood on the floor at the origin.
// 6. Materials are plain PBR: the skin's colour from the Monk scale
//    (`skinAlbedo`, skin-tone), each proxy's own texture.

import type { Character } from 'tosijs-3d/character-file'
import { vertexNormals } from 'tosijs-3d/hair-fit'
import type { HumanPack, HumanProxy } from 'tosijs-3d/human-pack'
import {
  drawnPositions,
  fitProxy,
  nearestWeights,
  proxyDelta,
  proxyWeights,
  smoothUnder,
  type VertexWeights,
} from 'tosijs-3d/proxy-fit'
import { skinAlbedo } from 'tosijs-3d/skin-tone'
import type {
  BuildOptions,
  BuiltCharacter,
  BuiltImage,
  BuiltJoint,
  BuiltMesh,
  BuiltMorph,
  BuiltSkin,
  MeshRole,
  PbrMaterial,
  Quat,
  Vec3,
} from '../contracts/built-character'
import { type LicenceEntry, UnlicensedAssetError } from '../contracts/licences'
import {
  FACE_UNITS,
  faceUnitTarget,
  type FaceUnitName,
  UE_JOINT_NAMES,
} from '../contracts/profile'
import { unitNormals } from '../upstream/glb/skinned-glb'
import { eyeAsset, eyePngUrl, eyeUvs, recolourEyePng } from '../upstream/eyes'
import { assetIds } from './assets'
import { coverSkin } from './cover'
import { humanBodyMaker } from './human-rig.js'
import { inverseRigid, qconj, qmul, qnormalize, qrotate, sub } from './math'
import {
  PARENTS,
  type Repose,
  skinTo,
  sourcePose,
  tPose,
  ualGlobalRest,
} from './pose'
import { option, REST_POSES } from './options'
import { MOUTH, readSettings, SLOTS, type Slot } from './settings'

/** What the build needs that is another lane's (wired at integration). */
export interface BuildDeps {
  /**
   * Every asset's licence entry for this character, base first; throws
   * `UnlicensedAssetError` for one it has none for. The contract's is
   * `characterLicences` (src/contracts/licences.ts).
   */
  licences: (character: Character, pack: HumanPack) => LicenceEntry[]
}

/** How far armour sits out from the body (tosijs-3d's character, metres). */
const ARMOUR_LIFT = 0.005
/** The order meshes go out in (export-format.md, "Nodes and meshes"). */
const MESH_ORDER: readonly MeshRole[] = [
  'body',
  'eyes',
  'eyelashes',
  'teeth',
  'tongue',
  'brows',
  'beard',
  'hair',
  'garment',
]
/** A delta smaller than this moves nothing (metres). */
const STILL = 1e-7

interface Part {
  name: string
  role: MeshRole
  asset: string
  positions: Float32Array
  triangles: Uint32Array
  uvs: Float32Array | null
  influences: VertexWeights
  /** Per face unit, the rest-pose delta per vertex. */
  deltas: Map<FaceUnitName, Float32Array>
  material: PbrMaterial
  /** The texture's URL, fetched and embedded. */
  texture?: string
  /**
   * A texture baked here from a fetched source (the eye art, recoloured),
   * embedded under its own licence id.
   */
  bake?: {
    key: string
    name: string
    url: string
    asset: string
    make: (fetched: Uint8Array) => Uint8Array
  }
}

const flipV = (uvs: Float32Array): Float32Array => {
  const out = new Float32Array(uvs.length)
  for (let i = 0; i < uvs.length; i += 2) {
    out[i] = uvs[i]!
    out[i + 1] = 1 - uvs[i + 1]!
  }
  return out
}

const pick = (
  full: ArrayLike<number>,
  vertices: ArrayLike<number>
): Float32Array => {
  const out = new Float32Array(vertices.length * 3)
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]! * 3
    out[i * 3] = full[v]!
    out[i * 3 + 1] = full[v + 1]!
    out[i * 3 + 2] = full[v + 2]!
  }
  return out
}

const pickWeights = (
  w: VertexWeights,
  vertices: ArrayLike<number>
): VertexWeights => {
  const indices = new Float32Array(vertices.length * 4)
  const weights = new Float32Array(vertices.length * 4)
  for (let i = 0; i < vertices.length; i++)
    for (let k = 0; k < 4; k++) {
      indices[i * 4 + k] = w.indices[vertices[i]! * 4 + k]!
      weights[i * 4 + k] = w.weights[vertices[i]! * 4 + k]!
    }
  return { indices, weights }
}

const moves = (d: Float32Array): boolean => {
  for (let i = 0; i < d.length; i++) if (Math.abs(d[i]!) > STILL) return true
  return false
}

/** The face units the options ask for that the pack has, in FACE_UNITS order. */
export function wantedUnits(
  pack: Pick<HumanPack, 'has'>,
  option: BuildOptions['faceUnits'] = true
): FaceUnitName[] {
  if (option === false) return []
  const asked = option === true ? FACE_UNITS : option
  const set = new Set<string>(asked)
  for (const u of set)
    if (!(FACE_UNITS as readonly string[]).includes(u))
      throw new Error(`buildCharacter: ${u} is not a face unit`)
  return FACE_UNITS.filter((u) => set.has(u) && pack.has(faceUnitTarget(u)))
}

/** Each unit's movement of every pack vertex (xyz), metres. */
async function faceDeltas(
  pack: HumanPack,
  units: readonly FaceUnitName[]
): Promise<Map<FaceUnitName, Float32Array>> {
  const n = pack.manifest.vertexCount
  const out = new Map<FaceUnitName, Float32Array>()
  await Promise.all(
    units.map(async (u) => {
      const t = await pack.target(faceUnitTarget(u))
      const d = new Float32Array(n * 3)
      if (t.indices === null) {
        for (let i = 0; i < n * 3; i++) d[i] = t.deltas[i]! * t.step
      } else {
        for (let k = 0; k < t.indices.length; k++) {
          const v = t.indices[k]! * 3
          d[v] = t.deltas[k * 3]! * t.step
          d[v + 1] = t.deltas[k * 3 + 1]! * t.step
          d[v + 2] = t.deltas[k * 3 + 2]! * t.step
        }
      }
      out.set(u, d)
    })
  )
  return out
}

/** A mesh name: ASCII letters, digits and `_`. */
export function meshName(s: string): string {
  return s.replace(/[^A-Za-z0-9_]/g, '_')
}

const linearColour = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  const lin = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return [
    lin(((n >> 16) & 255) / 255),
    lin(((n >> 8) & 255) / 255),
    lin((n & 255) / 255),
  ]
}

const plain = (
  name: string,
  rgb: readonly [number, number, number],
  roughness: number
): PbrMaterial => ({
  name,
  baseColorFactor: [rgb[0], rgb[1], rgb[2], 1],
  metallicFactor: 0,
  roughnessFactor: roughness,
  alphaMode: 'OPAQUE',
  doubleSided: false,
})

/** A proxy's material: its own texture (or the slot's colourway), plain PBR. */
function proxyMaterial(
  name: string,
  proxy: HumanProxy,
  look: string | undefined
): { material: PbrMaterial; texture?: string } {
  const alt = look !== undefined ? proxy.material.looks?.[look] : undefined
  const texture = alt?.diffuse ?? proxy.material.diffuse
  const cut = proxy.material.alpha && texture !== undefined
  const material: PbrMaterial = {
    name,
    baseColorFactor: [1, 1, 1, 1],
    metallicFactor: 0,
    // tosijs-3d's proxyMaterial: cloth 0.8, hair and the rest 0.72.
    roughnessFactor: proxy.category === 'clothes' ? 0.8 : 0.72,
    // Lenses are see-through, so blended; hair cards are cut out.
    alphaMode: cut ? (proxy.slot === 'glasses' ? 'BLEND' : 'MASK') : 'OPAQUE',
    ...(cut && proxy.slot !== 'glasses' ? { alphaCutoff: 0.4 } : {}),
    doubleSided: proxy.material.twoSided,
  }
  return texture !== undefined ? { material, texture } : { material }
}

const roleOf = (proxy: HumanProxy, key: string): MeshRole => {
  if (key === 'teeth' || key === 'tongue' || key === 'hair' || key === 'brows')
    return key
  if (key === 'beard' || key === 'moustache') return 'beard'
  if (proxy.category === 'clothes') return 'garment'
  return 'garment'
}

const mimeOf = (bytes: Uint8Array): BuiltImage['mimeType'] => {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  throw new Error('buildCharacter: a texture is neither PNG nor JPEG')
}

const defaultFetch = async (url: string): Promise<ArrayBuffer> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`buildCharacter: ${url} → ${res.status}`)
  return res.arrayBuffer()
}

/** One worn proxy: what it is worn as (`garment`, `hair`, ... `tongue`). */
export interface Worn {
  key: 'garment' | 'hair' | 'brows' | 'beard' | 'moustache' | 'teeth' | 'tongue'
  name: string
  slot?: Slot
}

/**
 * The pack proxies a character wears, in the profile's mesh order (garments
 * by asset name, then hair, brows, beard, moustache, teeth, tongue). Throws
 * for a body or a piece that does not export yet.
 */
export function wornBy(
  character: Character,
  pack: Pick<HumanPack, 'manifest'>
): Worn[] {
  const s = readSettings(character)
  if (s.source !== 'MakeHuman')
    throw new Error(
      `buildCharacter: only MakeHuman bodies export yet, not ${s.source}`
    )
  const proxies = pack.manifest.proxies ?? {}
  const worn: Worn[] = []
  for (const slot of SLOTS) {
    const name = s.slots[slot]
    if (name === undefined) continue
    if (proxies[name] === undefined)
      throw new Error(
        character.garments?.[name] !== undefined
          ? `buildCharacter: ${name} is a garment of the character's own, which does not export yet`
          : `buildCharacter: the pack has no ${name} (worn as ${slot})`
      )
    worn.push({ key: 'garment', name, slot })
  }
  worn.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  for (const key of ['hair', 'brows', 'beard', 'moustache'] as const) {
    const name = s[key]
    if (name === null) continue
    if (proxies[name] === undefined)
      throw new Error(
        `buildCharacter: the pack has no ${name} (as ${key}); Quaternius hair does not export yet`
      )
    worn.push({ key, name })
  }
  for (const key of ['teeth', 'tongue'] as const)
    if (proxies[MOUTH[key]] !== undefined) worn.push({ key, name: MOUTH[key] })
  return worn
}

/**
 * Every asset id a build of this character puts in the file, base first:
 * the base, the skin-tone scale, the eyes and lashes, each worn proxy.
 */
export function assetsUsed(
  character: Character,
  pack: Pick<HumanPack, 'manifest'>
): string[] {
  const ids = assetIds(pack)
  return [
    ids.base,
    ids.skinTone,
    ...(pack.manifest.parts?.eyes ? [ids.part('eyes')] : []),
    ...(pack.manifest.parts?.eyelashes ? [ids.part('eyelashes')] : []),
    ...wornBy(character, pack).map((w) => ids.proxy(w.name)),
  ]
}

/**
 * `buildCharacter` with the other lanes' pieces passed in (`deps`), so the
 * build runs before they land; the contract's `buildCharacter` passes the
 * contract's own.
 */
export async function buildCharacterWith(
  character: Character,
  pack: HumanPack,
  options: BuildOptions,
  deps: BuildDeps
): Promise<BuiltCharacter> {
  const restPose = option(
    'buildCharacter',
    'restPose',
    options.restPose,
    REST_POSES,
    't-pose'
  )
  const s = readSettings(character)
  const ids = assetIds(pack)
  const worn = wornBy(character, pack)

  // Licences first: nothing is built from an asset that cannot ship.
  const licences = deps.licences(character, pack)
  const licensed = new Set(licences.map((e) => e.asset))
  if (licences[0]?.kind !== 'base')
    throw new Error(
      'buildCharacter: the licence entries do not start with the base'
    )
  for (const a of assetsUsed(character, pack))
    if (!licensed.has(a)) throw new UnlicensedAssetError(a)

  const units = wantedUnits(pack, options.faceUnits)
  const [maker, nipples, eyePart, lashPart, wearing, deltas] =
    await Promise.all([
      humanBodyMaker(pack, s.body),
      pack.region('nipples'),
      pack.part('eyes'),
      pack.part('eyelashes'),
      Promise.all(
        worn.map(async (w) => {
          const p = await pack.proxy(w.name)
          if (p === null)
            throw new Error(`buildCharacter: the pack has no ${w.name}`)
          return p
        })
      ),
      faceDeltas(pack, units),
    ])
  const body = maker.first
  const rig = body.rig
  if (rig.joints.map((j) => j.name).join() !== UE_JOINT_NAMES.join())
    throw new Error('buildCharacter: the rig is not the profile skeleton')
  const full = body.full
  const skin = body.skin

  // Weights for every pack vertex: proxies bind to helpers too.
  const known = new Int32Array(pack.manifest.vertexCount).fill(-1)
  skin.vertices.forEach((v, i) => {
    known[v] = i
  })
  const allWeights = nearestWeights(full, known, maker.weights)
  const clothBody = nipples ? smoothUnder(full, pack.triangles, nipples) : full

  const parts: Part[] = []

  // THE BODY, covered skin removed.
  {
    const rest = skin.positions(full)
    const normals = vertexNormals(rest, skin.triangles)
    const drawn = new Map<string, Float32Array>()
    wearing.forEach((p) => {
      if (p.category === 'clothes')
        drawn.set(p.name, drawnPositions(p, fitProxy(p, clothBody)))
    })
    const covered = coverSkin(
      rest,
      normals,
      skin.triangles,
      skin.vertices,
      wearing,
      drawn
    )
    const tone = skinAlbedo(s.tone, s.redness)
    parts.push({
      name: 'body',
      role: 'body',
      asset: ids.base,
      positions: covered.positions,
      triangles: covered.triangles,
      uvs: null,
      influences: {
        indices: maker.weights.indices,
        weights: maker.weights.weights,
      },
      deltas: new Map(
        units.map((u) => [u, pick(deltas.get(u)!, skin.vertices)])
      ),
      material: plain('body', [tone.r, tone.g, tone.b], 0.55),
    })
  }

  // THE EYES ride the head; the lashes are skin.
  const headIndex = UE_JOINT_NAMES.indexOf('Head')
  if (eyePart !== null) {
    const n = eyePart.vertices.length
    const indices = new Float32Array(n * 4)
    const weights = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      indices[i * 4] = headIndex
      weights[i * 4] = 1
    }
    parts.push({
      name: 'eyes',
      role: 'eyes',
      asset: ids.part('eyes'),
      positions: pick(full, eyePart.vertices),
      triangles: eyePart.triangles,
      // Mapped onto a one-eye picture, the iris straight ahead.
      uvs: eyeUvs(pick(full, eyePart.vertices)),
      influences: { indices, weights },
      deltas: new Map(
        units.map((u) => [u, pick(deltas.get(u)!, eyePart.vertices)])
      ),
      material: plain('eyes', [1, 1, 1], 0.15),
      bake: {
        key: `eye:${s.eyeStyle}:${s.irisColour}`,
        name: `eye_${s.eyeStyle}`,
        url: eyePngUrl(s.eyeStyle),
        asset: eyeAsset(s.eyeStyle),
        make: (art) => recolourEyePng(art, s.irisColour),
      },
    })
  }
  if (lashPart !== null)
    parts.push({
      name: 'eyelashes',
      role: 'eyelashes',
      asset: ids.part('eyelashes'),
      positions: pick(full, lashPart.vertices),
      triangles: lashPart.triangles,
      uvs: null,
      influences: pickWeights(allWeights, lashPart.vertices),
      deltas: new Map(
        units.map((u) => [u, pick(deltas.get(u)!, lashPart.vertices)])
      ),
      material: plain('eyelashes', linearColour('#1d140f'), 0.6),
    })

  // WHAT IT WEARS, fitted and skinned to the same skeleton.
  wearing.forEach((proxy, i) => {
    const w = worn[i]!
    const role = roleOf(proxy, w.key)
    const name =
      role === 'garment'
        ? meshName(`garment_${proxy.name}`)
        : w.key === 'moustache'
        ? 'moustache'
        : role
    const positions = drawnPositions(proxy, fitProxy(proxy, clothBody))
    if (w.slot === 'armour') {
      const n = vertexNormals(positions, proxy.triangles)
      for (let k = 0; k < positions.length; k++)
        positions[k] = positions[k]! + n[k]! * ARMOUR_LIFT
    }
    const look = w.slot !== undefined ? s.looks[w.slot] : undefined
    const m = proxyMaterial(name, proxy, look)
    parts.push({
      name,
      role,
      asset: ids.proxy(proxy.name),
      positions,
      triangles: proxy.triangles,
      uvs: m.texture !== undefined ? flipV(proxy.uvs) : null,
      influences: proxyWeights(proxy, allWeights),
      deltas: new Map(units.map((u) => [u, proxyDelta(proxy, deltas.get(u)!)])),
      material: m.material,
      ...(m.texture !== undefined ? { texture: m.texture } : {}),
    })
  })

  // The profile's mesh order: body, eyes, lashes, teeth, tongue, brows,
  // beard (then a moustache), hair, garments by asset name (sorted above).
  const rank = (p: Part): number =>
    p.name === 'moustache'
      ? MESH_ORDER.indexOf('beard') + 0.5
      : MESH_ORDER.indexOf(p.role)
  parts.sort((a, b) => rank(a) - rank(b))

  // THE REST POSE: the T-pose with UAL's frames, or the body's own.
  const restJoints: Vec3[] = rig.joints.map((j) => [
    j.position.x,
    j.position.y,
    j.position.z,
  ])
  const ual = ualGlobalRest()
  const pose: Repose =
    restPose === 't-pose' ? tPose(restJoints, ual) : sourcePose(restJoints)

  // The floor: the lowest point of the posed skin, covered or not (shoes
  // remove the soles).
  const bare = skinTo(
    skin.positions(full),
    { joints: maker.weights.indices, weights: maker.weights.weights },
    restJoints,
    pose
  )
  let floor = Infinity
  for (let i = 1; i < bare.positions.length; i += 3)
    floor = Math.min(floor, bare.positions[i]!)
  const pelvis = pose.positions[UE_JOINT_NAMES.indexOf('pelvis')]!
  const origin: Vec3 = [pelvis[0], floor, pelvis[2]]

  const meshes: BuiltMesh[] = []
  const materials: PbrMaterial[] = []
  const images: BuiltImage[] = []
  const imageFor = new Map<string, number>()
  const fetcher = options.fetch ?? defaultFetch
  const textured = await Promise.all(
    parts.map(async (p) =>
      p.bake !== undefined
        ? p.bake.make(new Uint8Array(await fetcher(p.bake.url)))
        : p.texture === undefined
        ? null
        : new Uint8Array(await fetcher(p.texture))
    )
  )
  const present = new Set<FaceUnitName>()
  parts.forEach((p, pi) => {
    const unitList = units.filter((u) => moves(p.deltas.get(u)!))
    const posed = skinTo(
      p.positions,
      { joints: p.influences.indices, weights: p.influences.weights },
      restJoints,
      pose,
      unitList.map((u) => p.deltas.get(u)!)
    )
    for (let i = 0; i < posed.positions.length; i += 3) {
      posed.positions[i] = posed.positions[i]! - origin[0]
      posed.positions[i + 1] = posed.positions[i + 1]! - origin[1]
      posed.positions[i + 2] = posed.positions[i + 2]! - origin[2]
    }
    const c = compact(p.triangles, posed.positions.length / 3)
    const positions = gather(posed.positions, c.used, 3)
    const indices = c.triangles
    const morphs: BuiltMorph[] = []
    unitList.forEach((u, k) => {
      const d = gather(posed.vectors[k]!, c.used, 3)
      if (!moves(d)) return
      present.add(u)
      morphs.push({ name: u, positions: d, normals: null })
    })
    const skinned = builtSkin(
      gather(p.influences.indices, c.used, 4),
      gather(p.influences.weights, c.used, 4)
    )
    const material = materials.length
    let mat = p.material
    const bytes = textured[pi]
    if (p.bake !== undefined && bytes != null) {
      let image = imageFor.get(p.bake.key)
      if (image === undefined) {
        images.push({
          name: meshName(p.bake.name),
          mimeType: 'image/png',
          bytes,
          asset: p.bake.asset,
        })
        image = images.length - 1
        imageFor.set(p.bake.key, image)
      }
      mat = { ...mat, baseColorTexture: { image } }
    } else if (bytes != null && p.texture !== undefined) {
      let image = imageFor.get(p.texture)
      if (image === undefined) {
        images.push({
          name: meshName(
            p.texture
              .slice(p.texture.lastIndexOf('/') + 1)
              .replace(/\.\w+$/, '')
          ),
          mimeType: mimeOf(bytes),
          bytes,
          asset: p.asset,
        })
        image = images.length - 1
        imageFor.set(p.texture, image)
      }
      mat = { ...mat, baseColorTexture: { image } }
    }
    materials.push(mat)
    meshes.push({
      name: p.name,
      role: p.role,
      asset: p.asset,
      positions,
      normals: unitNormals(vertexNormals(positions, indices)),
      uvs:
        p.uvs !== null && mat.baseColorTexture
          ? gather(p.uvs, c.used, 2)
          : null,
      indices,
      skin: skinned,
      morphs,
      material,
    })
  })

  // THE SKELETON: posed positions, UAL's frames (re-aimed for `source`).
  const frames: Quat[] = ual.rotations.map((g, i) =>
    restPose === 't-pose' ? g : qnormalize(qmul(qconj(pose.turn[i]!), g))
  )
  const positions: Vec3[] = pose.positions.map((p, i) =>
    i === 0 ? [0, 0, 0] : sub(p, origin)
  )
  const joints: BuiltJoint[] = UE_JOINT_NAMES.map((name, i) => {
    const p = PARENTS[i]!
    const g = frames[i]!
    const translation: Vec3 =
      p < 0
        ? positions[i]!
        : qrotate(qconj(frames[p]!), sub(positions[i]!, positions[p]!))
    const rotation = p < 0 ? g : qnormalize(qmul(qconj(frames[p]!), g))
    return {
      name,
      parent: p,
      translation,
      rotation,
      position: positions[i]!,
      inverseBind: inverseRigid(g, positions[i]!),
    }
  })

  const faceUnits = units.filter((u) => present.has(u))
  return {
    name: character.name,
    restPose,
    skeleton: { joints },
    meshes,
    materials,
    images,
    faceUnits,
    licences,
  }
}

/** The vertices `triangles` use, and the triangles re-indexed onto them. */
function compact(
  triangles: ArrayLike<number>,
  count: number
): { used: number[]; triangles: Uint32Array } {
  const map = new Int32Array(count).fill(-1)
  const used: number[] = []
  const out = new Uint32Array(triangles.length)
  for (let i = 0; i < triangles.length; i++) {
    const v = triangles[i]!
    if (map[v]! < 0) {
      map[v] = used.length
      used.push(v)
    }
    out[i] = map[v]!
  }
  return { used, triangles: out }
}

function gather(
  a: ArrayLike<number>,
  used: readonly number[],
  size: number
): Float32Array {
  const out = new Float32Array(used.length * size)
  used.forEach((v, i) => {
    for (let k = 0; k < size; k++) out[i * size + k] = a[v * size + k]!
  })
  return out
}

/**
 * Influences as `BuiltSkin` promises them: four per vertex, each vertex's
 * weights summing to 1, unused slots joint 0 weight 0. A vertex with no
 * weight at all goes wholly to the pelvis. (Not the writer's
 * `normaliseInfluences`: that one sorts and rounds, and the writer runs it
 * again, so the committed samples would change by a float32 ulp.) Internal;
 * exported for the tests.
 */
export function builtSkin(
  indices: ArrayLike<number>,
  weights: ArrayLike<number>
): BuiltSkin {
  const n = weights.length / 4
  const j = new Uint16Array(n * 4)
  const w = new Float32Array(n * 4)
  for (let v = 0; v < n * 4; v += 4) {
    let sum = 0
    for (let k = 0; k < 4; k++) {
      const x = weights[v + k]!
      if (x > 0 && Number.isFinite(x)) {
        j[v + k] = indices[v + k]!
        w[v + k] = x
        sum += w[v + k]!
      }
    }
    if (sum > 0) for (let k = 0; k < 4; k++) w[v + k] = w[v + k]! / sum
    else {
      j[v] = PELVIS
      w[v] = 1
    }
  }
  return { joints: j, weights: w }
}

const PELVIS = UE_JOINT_NAMES.indexOf('pelvis')
