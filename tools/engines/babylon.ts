// Spike 1, Babylon.js: load every export with Babylon's own glTF loader
// (@babylonjs/loaders) on a NullEngine under Bun, and check what it builds:
// one skeleton with the profile's bones, every mesh skinned to it, the face
// units as morph targets, and UAL's Walk_Loop (loaded from UAL's own file
// with the same loader) playing on the skeleton's bones by name.
//
//   bun tools/engines/babylon.ts [--json] [file.glb ...]
//
// The NullEngine has no GPU: Babylon's skinning runs in shaders, so the
// deformed vertices are computed here on the CPU from Babylon's own bone
// matrices (Bone.getSkinMatrix() is not used: the formula is written out).
// Textures are not decoded (no image decoder under Bun).
//
// This is a dev tool: Babylon is a devDependency and this file is outside
// every public entry, so the no-Babylon guard is unaffected.

import '@babylonjs/loaders/glTF'
import {
  AbstractMesh,
  FreeCamera,
  type AnimationGroup,
  Logger,
  Matrix,
  Mesh,
  NullEngine,
  Quaternion,
  Scene,
  type Skeleton,
  SceneLoader,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core'
import { readFileSync } from 'node:fs'
import { MAJOR_JOINTS, jointName } from '../../src/contracts/profile'
import {
  type Check,
  type CharacterResult,
  EXTREMITIES,
  exportsToCheck,
  profileExpectations,
  report,
  TURNING,
  UAL_CLIP,
} from './common'

const VERSION: string = (
  require('@babylonjs/core/package.json') as { version: string }
).version

interface Loaded {
  scene: Scene
  meshes: AbstractMesh[]
  skeletons: Skeleton[]
  groups: AnimationGroup[]
}

function dataUrl(bytes: Uint8Array): string {
  return `data:model/gltf-binary;base64,${Buffer.from(bytes).toString(
    'base64'
  )}`
}

async function load(engine: NullEngine, bytes: Uint8Array): Promise<Loaded> {
  const scene = new Scene(engine)
  new FreeCamera('camera', new Vector3(0, 1, 3), scene)
  const r = await SceneLoader.ImportMeshAsync(
    '',
    '',
    dataUrl(bytes),
    scene,
    undefined,
    '.glb'
  )
  return {
    scene,
    meshes: r.meshes,
    skeletons: r.skeletons,
    groups: r.animationGroups,
  }
}

const ok = (check: string, problems: string[], evidence: string[]): Check => ({
  check,
  ok: problems.length === 0,
  evidence: [...evidence, ...problems.slice(0, 8)],
})

/** CPU linear-blend skinning of one vertex with Babylon's bone matrices. */
function skinVertex(
  mesh: Mesh,
  skeleton: Skeleton,
  v: number,
  pos: Float32Array,
  idx: ArrayLike<number>,
  w: Float32Array
): Vector3 {
  const p = new Vector3(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!)
  const out = Vector3.Zero()
  for (let k = 0; k < 4; k++) {
    const weight = w[v * 4 + k]!
    if (weight === 0) continue
    const bone = skeleton.bones[idx[v * 4 + k]!]!
    // Babylon: final = bone.getAbsoluteInverseBindMatrix() * bone.getFinalMatrix().
    const m = bone
      .getAbsoluteInverseBindMatrix()
      .multiply(bone.getFinalMatrix())
    out.addInPlace(Vector3.TransformCoordinates(p, m).scale(weight))
  }
  // Into world space: the skeleton's meshes share the skeleton's frame.
  return out
}

export async function checkOne(
  engine: NullEngine,
  file: string,
  bytes: Uint8Array,
  clipBytes: Uint8Array,
  naming: 'ue' | 'mixamo',
  faceUnits: string[]
): Promise<CharacterResult> {
  const checks: Check[] = []
  let c: Loaded
  try {
    c = await load(engine, bytes)
  } catch (e) {
    checks.push(ok('load', [`glTF loader failed: ${String(e)}`], []))
    return { file, naming, checks }
  }
  const meshes = c.meshes.filter(
    (m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0
  )
  checks.push(
    ok('load', meshes.length === 0 ? ['no meshes'] : [], [
      `${meshes.length} meshes: ${meshes.map((m) => m.name).join(', ')}; ${
        c.skeletons.length
      } skeleton(s)`,
    ])
  )
  const exp = profileExpectations()

  // Skeleton
  const sp: string[] = []
  if (c.skeletons.length !== 1)
    sp.push(`${c.skeletons.length} skeletons, expected 1`)
  const skel = c.skeletons[0]
  if (skel === undefined) {
    checks.push(ok('skeleton', sp, []))
    return { file, naming, checks }
  }
  const boneByName = new Map(skel.bones.map((b) => [b.name, b]))
  if (skel.bones.length !== exp.joints.length)
    sp.push(`${skel.bones.length} bones, expected ${exp.joints.length}`)
  for (const j of exp.joints) {
    const name = jointName(j.name, naming)
    const b = boneByName.get(name)
    if (b === undefined) {
      sp.push(`no bone ${name}`)
      continue
    }
    const parent = b.getParent()?.name ?? null
    const want = j.parent === null ? null : jointName(j.parent, naming)
    if (parent !== want)
      sp.push(`${name}'s parent is ${parent}, expected ${want}`)
  }
  checks.push(
    ok('skeleton', sp, [`${skel.bones.length} bones, names as in the file`])
  )

  // Skins
  const kp: string[] = []
  for (const m of meshes) {
    if (m.skeleton !== skel) kp.push(`${m.name} is not skinned to the skeleton`)
    if (!m.isVerticesDataPresent(VertexBuffer.MatricesIndicesKind))
      kp.push(`${m.name} has no joint indices`)
  }
  checks.push(ok('skins', kp, [`${meshes.length} meshes share one skeleton`]))

  // Rest-pose skinning on the CPU with Babylon's matrices.
  c.scene.render(false, true)
  skel.prepare()
  const body = meshes.find((m) => m.name === 'body')
  const rp: string[] = []
  let drift = 0
  let restBody: Vector3[] = []
  let bodyData:
    | {
        pos: Float32Array
        idx: ArrayLike<number>
        w: Float32Array
        world: Matrix
      }
    | undefined
  if (body === undefined) rp.push('no body mesh')
  else {
    const pos = body.getVerticesData(VertexBuffer.PositionKind) as Float32Array
    const idx = body.getVerticesData(VertexBuffer.MatricesIndicesKind)!
    const w = body.getVerticesData(
      VertexBuffer.MatricesWeightsKind
    ) as Float32Array
    const world = body.computeWorldMatrix(true)
    bodyData = { pos, idx, w, world }
    const n = pos.length / 3
    for (let v = 0; v < n; v += Math.max(1, Math.floor(n / 2000))) {
      const s = skinVertex(body, skel, v, pos, idx, w)
      const p = new Vector3(pos[v * 3]!, pos[v * 3 + 1]!, pos[v * 3 + 2]!)
      drift = Math.max(drift, s.subtract(p).length())
    }
    if (drift > 0.0005)
      rp.push(
        `rest-pose skinning moves the body by ${(drift * 1000).toFixed(2)} mm`
      )
    restBody = []
  }
  checks.push(
    ok('rest-skinning', rp, [
      `worst rest-pose drift ${(drift * 1000).toFixed(4)} mm (body, sampled)`,
    ])
  )

  // Morph targets
  const mp: string[] = []
  const seen = new Set<string>()
  const ev: string[] = []
  for (const m of meshes) {
    const mgr = m.morphTargetManager
    if (mgr === null || mgr.numTargets === 0) continue
    ev.push(`${m.name}: ${mgr.numTargets}`)
    for (let i = 0; i < mgr.numTargets; i++) {
      const t = mgr.getTarget(i)
      seen.add(t.name)
      if (!faceUnits.includes(t.name))
        mp.push(`${m.name}: target ${t.name} is not a face unit`)
    }
  }
  for (const u of faceUnits)
    if (!seen.has(u)) mp.push(`face unit ${u} is on no mesh`)
  let jaw = 0
  const jd = body?.morphTargetManager?.getTargetByName('JawDrop')
  if (body !== undefined && jd) {
    const base = body.getVerticesData(VertexBuffer.PositionKind) as Float32Array
    const moved = jd.getPositions()!
    for (let i = 0; i < base.length; i += 3)
      jaw = Math.max(
        jaw,
        Math.hypot(
          moved[i]! - base[i]!,
          moved[i + 1]! - base[i + 1]!,
          moved[i + 2]! - base[i + 2]!
        )
      )
  }
  if (jaw < 0.002)
    mp.push(`JawDrop moves the body by ${(jaw * 1000).toFixed(2)} mm`)
  checks.push(
    ok('morphs', mp, [
      `${seen.size} distinct face units (file declares ${
        faceUnits.length
      }); JawDrop moves the body up to ${(jaw * 1000).toFixed(1)} mm`,
      `targets per mesh: ${ev.join(', ')}`,
    ])
  )

  // Materials
  const mats = meshes.map(
    (m) => `${m.name}: ${m.material?.getClassName() ?? 'none'}`
  )
  checks.push(
    ok(
      'materials',
      meshes
        .filter((m) => m.material === null)
        .map((m) => `${m.name} has no material`),
      [mats.join(', ')]
    )
  )

  // The clip: UAL's own file through the same loader, its group retargeted
  // to the character's bones by name (rotations on all, positions on root
  // and pelvis only), as a Babylon user would with AnimationGroup.clone.
  const cp: string[] = []
  let clip: Loaded
  try {
    clip = await load(engine, clipBytes)
  } catch (e) {
    checks.push(ok('clip', [`could not load the clip: ${String(e)}`], []))
    return { file, naming, checks }
  }
  const src = clip.groups[0]
  if (src === undefined) {
    checks.push(ok('clip', ['the clip file has no animation group'], []))
    return { file, naming, checks }
  }
  // Babylon animates the transform nodes the loader links to each bone.
  const nodeFor = (ue: string) =>
    boneByName.get(jointName(ue, naming))?.getTransformNode() ?? null
  const bound = new Set<string>()
  const walk = src.clone('walk', (old) =>
    nodeFor((old as { name: string }).name)
  )
  // Drop what the profile says not to play.
  for (const ta of [...walk.targetedAnimations]) {
    const prop = ta.animation.targetProperty
    const target = ta.target as { name?: string } | null
    const name = target?.name ?? ''
    const isRootish =
      name === jointName('root', naming) || name === jointName('pelvis', naming)
    const keep =
      prop === 'rotationQuaternion' || (prop === 'position' && isRootish)
    if (target === null || !keep) walk.removeTargetedAnimation(ta.animation)
    else bound.add(name)
  }
  for (const ue of MAJOR_JOINTS)
    if (!bound.has(jointName(ue, naming)))
      cp.push(`${ue}: the clip has no track for it`)
  const tn = (ue: string) => nodeFor(ue)!
  c.scene.render(false, true)
  const restQ = new Map<string, Quaternion>()
  const restP = new Map<string, Vector3>()
  for (const ue of new Set([...MAJOR_JOINTS, ...EXTREMITIES])) {
    const n = tn(ue)
    if (n === null) continue
    n.computeWorldMatrix(true)
    restQ.set(ue, n.rotationQuaternion!.clone())
    restP.set(ue, n.getAbsolutePosition().clone())
  }
  // Hand vertices, CPU-skinned.
  const handBone = boneByName.get(jointName('hand_l', naming))!
  const handIndex = skel.bones.indexOf(handBone)
  const handVerts: number[] = []
  if (bodyData !== undefined) {
    const { idx, w } = bodyData
    const scored: Array<[number, number]> = []
    for (let v = 0; v < bodyData.pos.length / 3; v++)
      for (let k = 0; k < 4; k++)
        if (idx[v * 4 + k] === handIndex && w[v * 4 + k]! > 0)
          scored.push([w[v * 4 + k]!, v])
    scored.sort((a, b) => b[0] - a[0])
    for (const [, v] of scored.slice(0, 50)) handVerts.push(v)
  }
  const restV = new Map<number, Vector3>()
  if (bodyData !== undefined && body !== undefined) {
    skel.prepare()
    for (const v of handVerts)
      restV.set(
        v,
        skinVertex(body, skel, v, bodyData.pos, bodyData.idx, bodyData.w)
      )
  }
  const turn = new Map<string, number>()
  const travel = new Map<string, number>()
  let vtravel = 0
  walk.start(true)
  const from = walk.from
  const to = walk.to
  for (let k = 0; k <= 12; k++) {
    walk.goToFrame(from + ((to - from) * k) / 12)
    c.scene.render(false, true)
    for (const [ue, q] of restQ) {
      const n = tn(ue)
      n.computeWorldMatrix(true)
      const d = Quaternion.Dot(n.rotationQuaternion!, q)
      turn.set(
        ue,
        Math.max(turn.get(ue) ?? 0, 2 * Math.acos(Math.min(1, Math.abs(d))))
      )
      travel.set(
        ue,
        Math.max(
          travel.get(ue) ?? 0,
          n.getAbsolutePosition().subtract(restP.get(ue)!).length()
        )
      )
    }
    if (bodyData !== undefined && body !== undefined) {
      skel.prepare()
      for (const v of handVerts) {
        const p = skinVertex(
          body,
          skel,
          v,
          bodyData.pos,
          bodyData.idx,
          bodyData.w
        )
        vtravel = Math.max(vtravel, p.subtract(restV.get(v)!).length())
      }
    }
  }
  walk.stop()
  for (const ue of TURNING)
    if ((turn.get(ue) ?? 0) < (0.5 * Math.PI) / 180)
      cp.push(`${ue}: the clip does not turn it`)
  for (const ue of EXTREMITIES)
    if ((travel.get(ue) ?? 0) < 0.01)
      cp.push(`${ue} travels ${((travel.get(ue) ?? 0) * 100).toFixed(1)} cm`)
  if (vtravel < 0.01)
    cp.push(
      `hand vertices travel ${(vtravel * 100).toFixed(
        1
      )} cm: the skin does not follow`
    )
  checks.push(
    ok('clip', cp, [
      `${src.name}: ${walk.targetedAnimations.length} of ${src.targetedAnimations.length} animations kept, frames ${from}-${to}`,
      `travel (cm): ${EXTREMITIES.map(
        (u) => `${u} ${((travel.get(u) ?? 0) * 100).toFixed(1)}`
      ).join(', ')}`,
      `turn (deg): ${TURNING.map(
        (u) => `${u} ${(((turn.get(u) ?? 0) * 180) / Math.PI).toFixed(1)}`
      ).join(', ')}`,
      `${
        handVerts.length
      } body vertices most weighted to hand_l travel up to ${(
        vtravel * 100
      ).toFixed(1)} cm (CPU-skinned with Babylon's bone matrices)`,
    ])
  )
  c.scene.dispose()
  clip.scene.dispose()
  void restBody
  return { file, naming, checks }
}

export interface BabylonRun {
  engine: 'babylon'
  version: string
  ran: boolean
  characters: CharacterResult[]
  log: string[]
}

export async function runBabylon(paths: string[] = []): Promise<BabylonRun> {
  const log: string[] = []
  Logger.LogLevels = Logger.WarningLogLevel | Logger.ErrorLogLevel
  Logger.OnNewCacheEntry = (entry) => {
    log.push(entry.replace(/<[^>]+>/g, '').trim())
  }
  ensureImageStandIn()
  const engine = new NullEngine()
  const clip = new Uint8Array(readFileSync(UAL_CLIP))
  const characters: CharacterResult[] = []
  for (const e of exportsToCheck(paths))
    characters.push(
      await checkOne(
        engine,
        e.file,
        new Uint8Array(readFileSync(e.path)),
        clip,
        e.naming,
        e.faceUnits
      )
    )
  engine.dispose()
  return {
    engine: 'babylon',
    version: VERSION,
    ran: characters.length > 0,
    characters,
    log,
  }
}

/** Babylon decodes textures through createImageBitmap or Image; neither exists under Bun. */
function ensureImageStandIn(): void {
  const g = globalThis as Record<string, unknown>
  if (typeof g.createImageBitmap !== 'function')
    g.createImageBitmap = async () => ({ width: 1, height: 1, close() {} })
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const r = await runBabylon(args.filter((a) => a !== '--json'))
  if (json) console.log(JSON.stringify(r, null, 2))
  else {
    if (r.log.length > 0) {
      const counts = new Map<string, number>()
      for (const l of r.log) counts.set(l, (counts.get(l) ?? 0) + 1)
      console.log('Babylon log (warnings and errors, counted):')
      for (const [l, n] of counts) console.log(`  ${n} x ${l.slice(0, 200)}`)
    }
    report(`Babylon.js ${r.version} (NullEngine)`, r.characters)
  }
  if (!r.ran) process.exit(2)
  process.exit(r.characters.some((c) => c.checks.some((k) => !k.ok)) ? 1 : 0)
}
