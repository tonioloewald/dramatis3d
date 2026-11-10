// The gate-1 checks, one function each, so the harness runs them on every
// export (gate1.test.ts) and the fixtures prove each can fail
// (fixtures.test.ts). Each returns the problems it found, one line each:
// empty means the check passed. The profile is site/docs/export-format.md.

import { validateBytes } from 'gltf-validator'
import {
  AnimationClip,
  AnimationMixer,
  Bone,
  type Object3D,
  PropertyBinding,
  Quaternion,
  SkinnedMesh,
  Vector3,
} from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  checkExportExtras,
  EXTRAS_KEY,
  FACE_UNITS,
  jointName,
  MAJOR_JOINTS,
  type NamingProfile,
  UE_JOINTS,
} from '../../src/contracts/profile'
import { characterClip } from '../../src/three/clip'
import { readGlb, type Glb } from 'tosijs-3d/glb-chunks'

/** The Khronos validator's report, errors only (warnings and infos are allowed). */
export async function validatorErrors(bytes: Uint8Array): Promise<string[]> {
  let report: Awaited<ReturnType<typeof validateBytes>>
  try {
    report = await validateBytes(bytes, { maxIssues: 200 })
  } catch (e) {
    return [`validator could not read the file: ${String(e)}`]
  }
  return report.issues.messages
    .filter((m) => m.severity === 0)
    .map((m) => `${m.code} at ${m.pointer ?? '(file)'}: ${m.message}`)
}

/** The naming the file declares (`asset.extras.dramatis.naming`), `ue` when absent. */
export function declaredNaming(glb: Glb): NamingProfile {
  const n = glb.json.asset?.extras?.[EXTRAS_KEY]?.naming
  return n === 'mixamo' ? 'mixamo' : 'ue'
}

/** A held item's socket joint (export-format.md, "A held item"). */
const SOCKET = /^weapon_[rl]$/

/**
 * The skeleton is the profile's: one skin (every skinned mesh uses it) whose
 * joints are the profile's 65 under the declared naming, in profile order,
 * with the profile's parents.
 */
export function skeletonProblems(glb: Glb): string[] {
  const j = glb.json
  const naming = declaredNaming(glb)
  const problems: string[] = []
  const skins: Array<{ joints: number[] }> = j.skins ?? []
  if (skins.length !== 1)
    problems.push(`expected 1 skin, found ${skins.length}`)
  const skin = skins[0]
  if (skin === undefined) return problems
  const nodes: Array<{
    name?: string
    children?: number[]
    skin?: number
    mesh?: number
  }> = j.nodes ?? []
  const all = skin.joints.map((i) => nodes[i]?.name ?? `(node ${i} unnamed)`)
  // A held item's socket (#3909) may follow the profile's joints, once, as
  // the skin's last joint, under its hand; heldProblems checks the hand.
  const names = all.filter(
    (n, k) =>
      !(k === UE_JOINTS.length && k === all.length - 1 && SOCKET.test(n))
  )
  const expected = UE_JOINTS.map((r) => jointName(r.name, naming))
  const have = new Set(names)
  const want = new Set(expected)
  for (const e of expected)
    if (!have.has(e)) problems.push(`missing joint ${e}`)
  for (const n of names)
    if (!want.has(n)) problems.push(`joint not in the profile: ${n}`)
  if (problems.length === 0 && names.join() !== expected.join())
    problems.push('joints are not in profile order')
  // Parents, by name.
  const parentOf = new Map<number, number>()
  nodes.forEach((n, i) => n.children?.forEach((c) => parentOf.set(c, i)))
  const byName = new Map(skin.joints.map((i) => [nodes[i]?.name, i]))
  for (const row of UE_JOINTS) {
    const name = jointName(row.name, naming)
    const index = byName.get(name)
    if (index === undefined) continue
    const parent = parentOf.get(index)
    const parentName = parent === undefined ? null : nodes[parent]?.name ?? null
    if (row.parent === null) {
      if (parent !== undefined && skin.joints.includes(parent))
        problems.push(`${name} should have no joint parent, has ${parentName}`)
    } else if (parentName !== jointName(row.parent, naming)) {
      problems.push(
        `${name}'s parent is ${parentName}, not ${jointName(
          row.parent,
          naming
        )}`
      )
    }
  }
  nodes.forEach((n, i) => {
    if (n.mesh !== undefined && n.skin !== undefined && n.skin !== 0)
      problems.push(
        `node ${n.name ?? i} uses skin ${n.skin}, not the one skeleton`
      )
  })
  return problems
}

/**
 * Morph targets are named per the profile: every mesh with targets names
 * them in `mesh.extras.targetNames`, one per target, each a face unit,
 * unique, in `FACE_UNITS` order; and the units across all meshes are exactly
 * the ones `asset.extras.dramatis.faceUnits` declares.
 */
export function morphProblems(glb: Glb): string[] {
  const problems: string[] = []
  const order = new Map<string, number>(FACE_UNITS.map((u, i) => [u, i]))
  const seen = new Set<string>()
  const meshes: Array<{
    name?: string
    extras?: { targetNames?: unknown }
    primitives: Array<{ targets?: unknown[] }>
  }> = glb.json.meshes ?? []
  meshes.forEach((mesh, m) => {
    const label = mesh.name ?? `mesh ${m}`
    const counts = mesh.primitives.map((p) => p.targets?.length ?? 0)
    const count = Math.max(0, ...counts)
    if (count === 0) return
    if (counts.some((c) => c !== count))
      problems.push(`${label}: primitives have different target counts`)
    const names = mesh.extras?.targetNames
    if (!Array.isArray(names)) {
      problems.push(
        `${label}: ${count} morph targets but no extras.targetNames`
      )
      return
    }
    if (names.length !== count)
      problems.push(`${label}: ${count} targets, ${names.length} targetNames`)
    let last = -1
    const local = new Set<string>()
    for (const n of names) {
      const at = typeof n === 'string' ? order.get(n) : undefined
      if (at === undefined) {
        problems.push(`${label}: target ${String(n)} is not a face unit`)
        continue
      }
      if (local.has(n)) problems.push(`${label}: target ${n} twice`)
      if (at < last)
        problems.push(`${label}: target ${n} out of FACE_UNITS order`)
      last = at
      local.add(n)
      seen.add(n)
    }
  })
  const declared = glb.json.asset?.extras?.[EXTRAS_KEY]?.faceUnits
  if (!Array.isArray(declared)) {
    problems.push('asset.extras.dramatis.faceUnits is missing')
  } else {
    for (const u of declared)
      if (!seen.has(u)) problems.push(`declared face unit ${u} is on no mesh`)
    for (const u of seen)
      if (!declared.includes(u)) problems.push(`face unit ${u} is not declared`)
  }
  return problems
}

/** `asset.extras.dramatis` matches the schema and carries licence entries. */
export function licenceProblems(glb: Glb): string[] {
  return checkExportExtras(glb.json.asset?.extras?.[EXTRAS_KEY])
}

/*
three's loaders reach for browser globals: images decode through
createImageBitmap (or an <img>), neither of which bun has. Under bun the
harness stands in a createImageBitmap that answers with an empty 1x1 bitmap,
so a texture's image is fetched and handed over but its PIXELS ARE NOT
DECODED here. The validator checks that the images are well formed.
*/
function ensureImageStandIn(): void {
  const g = globalThis as Record<string, unknown>
  if (typeof g.createImageBitmap === 'function') return
  g.createImageBitmap = async () => ({ width: 1, height: 1, close() {} })
}

/** Load with three's GLTFLoader under bun; throws what the loader throws. */
export async function loadWithThree(bytes: Uint8Array): Promise<GLTF> {
  ensureImageStandIn()
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  return new GLTFLoader().parseAsync(buffer, '')
}

/** The loader check as problems: empty when it loads with a skinned mesh in it. */
export async function threeProblems(bytes: Uint8Array): Promise<string[]> {
  let gltf: GLTF
  try {
    gltf = await loadWithThree(bytes)
  } catch (e) {
    return [`GLTFLoader failed: ${e instanceof Error ? e.message : String(e)}`]
  }
  let skinned = 0
  gltf.scene.traverse((o) => {
    if (o instanceof SkinnedMesh) skinned++
  })
  return skinned === 0 ? ['GLTFLoader gave no SkinnedMesh'] : []
}

/** Joints whose world position must move during the clip, and by how much (metres). */
const EXTREMITIES = ['Head', 'hand_l', 'hand_r', 'foot_l', 'foot_r']
const MIN_TRAVEL = 0.01
/**
 * Joints whose local rotation must turn during the clip, by more than
 * MIN_TURN: the limbs. Every major joint must BIND; not every one moves in
 * every clip (UAL's walk holds spine_01 at one rotation throughout).
 */
const TURNING = MAJOR_JOINTS.filter((j) =>
  /^(upperarm|lowerarm|thigh|calf)_/.test(j)
)
const MIN_TURN = (0.5 * Math.PI) / 180

/** A bone's rest height above the floor, from a scene at rest; null when absent. */
function restHeight(root: Object3D, name: string): number | null {
  const node = PropertyBinding.findNode(root, name) as Object3D | null
  if (!node) return null
  root.updateMatrixWorld(true)
  return node.getWorldPosition(new Vector3()).y
}

/**
 * The clip as played on a profile export: `characterClip` (the public
 * dramatis/three function, Profile "Playing UAL clips") under the export's
 * naming, its root and pelvis translations scaled by the hips' rest height
 * over the clip skeleton's, as the viewer's `fitClip` does. Both scenes at
 * rest.
 */
export function clipOnExport(
  clip: AnimationClip,
  character: Object3D,
  source: Object3D,
  naming: NamingProfile
): AnimationClip {
  const ours = restHeight(
    character,
    PropertyBinding.sanitizeNodeName(jointName('pelvis', naming))
  )
  const theirs = restHeight(source, 'pelvis')
  const translationScale =
    ours !== null && theirs !== null && theirs > 0 ? ours / theirs : 1
  return characterClip(clip, { naming, translationScale })
}

/**
 * A third-party CC0 UAL clip binds by name to every major joint of the
 * export's skinned skeleton and moves them: the clip has a track for each
 * and it lands on a bone of the skinned mesh, the limbs turn, and the head,
 * hands and feet travel.
 */
export async function clipProblems(
  bytes: Uint8Array,
  clipBytes: Uint8Array
): Promise<string[]> {
  let character: GLTF
  let source: GLTF
  try {
    character = await loadWithThree(bytes)
    source = await loadWithThree(clipBytes)
  } catch (e) {
    return [`could not load: ${e instanceof Error ? e.message : String(e)}`]
  }
  const raw = source.animations[0]
  if (raw === undefined) return ['the clip file has no animation']
  const naming = declaredNaming(readGlb(bytes))
  const clip = clipOnExport(raw, character.scene, source.scene, naming)
  return playProblems(character, clip, naming)
}

/**
 * The clips an export carries itself (#3908), each as three plays it: its
 * licence is one of the file's entries, and it binds to the major joints and
 * moves them as UAL's Walk_Loop does. A file with none has no problems.
 */
export async function embeddedClipProblems(
  bytes: Uint8Array
): Promise<string[]> {
  const glb = readGlb(bytes)
  const animations: any[] = glb.json.animations ?? []
  if (animations.length === 0) return []
  const listed = new Set(
    (glb.json.asset?.extras?.dramatis?.licences ?? []).map((l: any) => l.asset)
  )
  const problems: string[] = []
  for (const a of animations) {
    const licence = a.extras?.dramatis?.licence
    if (!licence) problems.push(`${a.name}: no licence in its extras`)
    else if (!listed.has(licence))
      problems.push(`${a.name}: its licence ${licence} is not among the file's`)
  }
  let character: GLTF
  try {
    character = await loadWithThree(bytes)
  } catch (e) {
    return [`could not load: ${e instanceof Error ? e.message : String(e)}`]
  }
  const naming = declaredNaming(glb)
  for (const clip of character.animations)
    problems.push(
      ...(await playProblems(character, clip, naming)).map(
        (p) => `${clip.name}: ${p}`
      )
    )
  return problems
}

/** A clip played on a loaded export: what doesn't bind, turn or travel. */
async function playProblems(
  character: GLTF,
  clip: AnimationClip,
  naming: NamingProfile
): Promise<string[]> {
  const scene = character.scene
  const bones = new Set<Object3D>()
  scene.traverse((o) => {
    if (o instanceof SkinnedMesh) for (const b of o.skeleton.bones) bones.add(b)
  })
  const problems: string[] = []
  const nodeFor = (ue: string): Object3D | undefined => {
    const name = PropertyBinding.sanitizeNodeName(jointName(ue, naming))
    const node = PropertyBinding.findNode(scene, name) as Object3D | null
    return node ?? undefined
  }
  const bound = new Set(
    clip.tracks.map((t) => PropertyBinding.parseTrackName(t.name).nodeName)
  )
  for (const ue of MAJOR_JOINTS) {
    const node = nodeFor(ue)
    const name = PropertyBinding.sanitizeNodeName(jointName(ue, naming))
    if (node === undefined) problems.push(`${ue}: no node named ${name}`)
    else if (!(node instanceof Bone) || !bones.has(node))
      problems.push(`${ue}: ${name} is not a bone of the skinned mesh`)
    else if (!bound.has(name))
      problems.push(`${ue}: the clip has no track for it`)
  }
  if (problems.length > 0) return problems

  scene.updateMatrixWorld(true)
  const rest = new Map<string, { q: Quaternion; p: Vector3 }>()
  for (const ue of new Set([...MAJOR_JOINTS, ...EXTREMITIES])) {
    const node = nodeFor(ue)!
    rest.set(ue, {
      q: node.quaternion.clone(),
      p: node.getWorldPosition(new Vector3()),
    })
  }
  const turn = new Map<string, number>()
  const travel = new Map<string, number>()
  const mixer = new AnimationMixer(scene)
  mixer.clipAction(clip).play()
  const steps = 12
  for (let k = 0; k <= steps; k++) {
    mixer.setTime((clip.duration * k) / steps)
    scene.updateMatrixWorld(true)
    for (const [ue, r] of rest) {
      const node = nodeFor(ue)!
      turn.set(ue, Math.max(turn.get(ue) ?? 0, node.quaternion.angleTo(r.q)))
      const p = node.getWorldPosition(new Vector3())
      travel.set(ue, Math.max(travel.get(ue) ?? 0, p.distanceTo(r.p)))
    }
  }
  mixer.stopAllAction()
  for (const ue of TURNING)
    if ((turn.get(ue) ?? 0) < MIN_TURN)
      problems.push(`${ue}: the clip does not turn it`)
  for (const ue of EXTREMITIES)
    if ((travel.get(ue) ?? 0) < MIN_TRAVEL)
      problems.push(
        `${ue}: travels ${((travel.get(ue) ?? 0) * 100).toFixed(1)} cm, under ${
          MIN_TRAVEL * 100
        } cm`
      )
  return problems
}

/**
 * A held item (#3909), when there is one: its socket joint (`weapon_r` or
 * `weapon_l`) is the skin's last, a child of its hand, within a hand's
 * reach of it; the `held` mesh is skinned to it alone and names a licence
 * the file lists. A file with no socket has nothing to check.
 */
export function heldProblems(glb: Glb): string[] {
  const j = glb.json
  const nodes: any[] = j.nodes ?? []
  const skin: { joints: number[] } | undefined = j.skins?.[0]
  if (!skin) return []
  const at = skin.joints.findIndex((i) => SOCKET.test(nodes[i]?.name ?? ''))
  const heldMesh = (j.meshes ?? []).findIndex((m: any) => m.name === 'held')
  if (at < 0)
    return heldMesh < 0 ? [] : ['a held mesh but no socket joint for it']
  const problems: string[] = []
  const node = nodes[skin.joints[at]!]
  if (at !== skin.joints.length - 1)
    problems.push(`${node.name} is not the skin's last joint`)
  const side = node.name.endsWith('_l') ? 'l' : 'r'
  const hand = jointName(`hand_${side}`, declaredNaming(glb))
  const parent = nodes.findIndex((n) => n.children?.includes(skin.joints[at]!))
  if (nodes[parent]?.name !== hand)
    problems.push(
      `${node.name}'s parent is ${nodes[parent]?.name}, not ${hand}`
    )
  const t: number[] = node.translation ?? [0, 0, 0]
  if (Math.hypot(t[0]!, t[1]!, t[2]!) > 0.25)
    problems.push(
      `${node.name} is ${Math.hypot(t[0]!, t[1]!, t[2]!).toFixed(
        2
      )} m from the hand`
    )
  if (heldMesh < 0) return problems
  const mesh = j.meshes[heldMesh]
  const listed = new Set(
    (j.asset?.extras?.dramatis?.licences ?? []).map((l: any) => l.asset)
  )
  const licence = mesh.extras?.dramatis?.licence
  if (!licence) problems.push('the held mesh names no licence')
  else if (!listed.has(licence))
    problems.push(`the held mesh's licence ${licence} is not among the file's`)
  const node2 = nodes.findIndex((n) => n.mesh === heldMesh)
  if (node2 < 0 || nodes[node2].skin !== 0)
    problems.push('the held mesh is not on the skin')
  return problems
}
