// A structural check of a VRM 1.0 file's VRMC_vrm block against the
// VRMC_vrm 1.0 schema (the parts a loader depends on) and against the file
// itself: every node index points at the right kind of node, every morph
// bind at a real target, the humanoid's hierarchy is VRM's. One line per
// problem; empty means it passed. It is the VRM lane's own check, run on
// every export in the tests beside the Khronos validator (which does not
// read VRMC_vrm) and three-vrm (which reads it leniently).

import { type GltfJson, readGlb } from '../upstream/glb/glb-chunks'
import { VRM_BONE_NAMES, VRM_REQUIRED_BONES, vrmParents } from './humanoid'
import { VRMC_VRM } from './spec'

const PRESETS = new Set([
  'happy',
  'angry',
  'sad',
  'relaxed',
  'surprised',
  'aa',
  'ih',
  'ou',
  'ee',
  'oh',
  'blink',
  'blinkLeft',
  'blinkRight',
  'lookUp',
  'lookDown',
  'lookLeft',
  'lookRight',
  'neutral',
])
const OVERRIDES = new Set(['none', 'block', 'blend'])
const ENUMS: Record<string, readonly string[]> = {
  avatarPermission: ['onlyAuthor', 'onlySeparatelyLicensedPerson', 'everyone'],
  commercialUsage: ['personalNonProfit', 'personalProfit', 'corporation'],
  creditNotation: ['required', 'unnecessary'],
  modification: [
    'prohibited',
    'allowModification',
    'allowModificationRedistribution',
  ],
}
const FLAGS = [
  'allowExcessivelyViolentUsage',
  'allowExcessivelySexualUsage',
  'allowPoliticalOrReligiousUsage',
  'allowAntisocialOrHateUsage',
  'allowRedistribution',
]

/** What is wrong with a VRM 1.0 file, one line each; empty when nothing is. */
export function vrmProblems(bytes: Uint8Array): string[] {
  let json: GltfJson
  try {
    json = readGlb(bytes).json
  } catch (e) {
    return [String(e instanceof Error ? e.message : e)]
  }
  return vrmJsonProblems(json)
}

/** `vrmProblems` on parsed glTF JSON. */
export function vrmJsonProblems(json: GltfJson): string[] {
  const problems: string[] = []
  const used: unknown = json.extensionsUsed
  if (!Array.isArray(used) || !used.includes(VRMC_VRM))
    problems.push('extensionsUsed does not list VRMC_vrm')
  if (Array.isArray(json.extensionsRequired) && json.extensionsRequired.length)
    problems.push(
      `extensionsRequired is not empty: ${json.extensionsRequired.join(', ')}`
    )
  const vrm = json.extensions?.[VRMC_VRM]
  if (vrm === null || typeof vrm !== 'object')
    return [...problems, 'no extensions.VRMC_vrm']
  if (vrm.specVersion !== '1.0') problems.push('specVersion is not 1.0')

  const nodes: Array<{ name?: string; mesh?: number; children?: number[] }> =
    json.nodes ?? []
  const meshes: Array<{ primitives: Array<{ targets?: unknown[] }> }> =
    json.meshes ?? []

  // meta
  const meta = vrm.meta
  if (meta === null || typeof meta !== 'object') problems.push('no meta')
  else {
    if (typeof meta.name !== 'string' || meta.name === '')
      problems.push('meta.name is missing')
    if (
      !Array.isArray(meta.authors) ||
      meta.authors.length === 0 ||
      meta.authors.some((a: unknown) => typeof a !== 'string' || a === '')
    )
      problems.push('meta.authors is not a list of names')
    if (typeof meta.licenseUrl !== 'string' || meta.licenseUrl === '')
      problems.push('meta.licenseUrl is missing')
    for (const [key, allowed] of Object.entries(ENUMS))
      if (meta[key] !== undefined && !allowed.includes(meta[key]))
        problems.push(`meta.${key} is not one of ${allowed.join(', ')}`)
    for (const key of FLAGS)
      if (meta[key] !== undefined && typeof meta[key] !== 'boolean')
        problems.push(`meta.${key} is not a boolean`)
    for (const key of [
      'copyrightInformation',
      'contactInformation',
      'thirdPartyLicenses',
      'otherLicenseUrl',
      'version',
    ])
      if (meta[key] !== undefined && typeof meta[key] !== 'string')
        problems.push(`meta.${key} is not a string`)
    if (
      meta.references !== undefined &&
      (!Array.isArray(meta.references) ||
        meta.references.some((r: unknown) => typeof r !== 'string'))
    )
      problems.push('meta.references is not a list of strings')
  }

  // humanoid
  const bones: Record<string, { node?: unknown }> | undefined =
    vrm.humanoid?.humanBones
  if (bones === undefined || typeof bones !== 'object')
    problems.push('no humanoid.humanBones')
  else {
    const nodeOf = new Map<string, number>()
    const seen = new Map<number, string>()
    for (const [bone, value] of Object.entries(bones)) {
      if (!VRM_BONE_NAMES.has(bone)) {
        problems.push(`humanBones.${bone} is not a VRM 1.0 bone`)
        continue
      }
      const node = value?.node
      if (
        typeof node !== 'number' ||
        !Number.isInteger(node) ||
        nodes[node] === undefined
      ) {
        problems.push(`humanBones.${bone}.node is not a node`)
        continue
      }
      const other = seen.get(node)
      if (other !== undefined)
        problems.push(`humanBones.${bone} and ${other} share node ${node}`)
      seen.set(node, bone)
      nodeOf.set(bone, node)
    }
    for (const bone of VRM_REQUIRED_BONES)
      if (!nodeOf.has(bone)) problems.push(`humanBones lacks ${bone}`)
    // Hierarchy: a bone's nearest mapped ancestor is its nearest mapped VRM parent.
    const parent = new Map<number, number>()
    nodes.forEach((n, i) => n.children?.forEach((c) => parent.set(c, i)))
    for (const [bone, node] of nodeOf) {
      const want = vrmParents(bone).find((b) => nodeOf.has(b))
      let p = parent.get(node)
      while (p !== undefined && !seen.has(p)) p = parent.get(p)
      const got = p === undefined ? undefined : seen.get(p)
      if (got !== want)
        problems.push(
          `humanBones.${bone}'s nearest human ancestor is ${
            got ?? 'none'
          }, VRM wants ${want ?? 'none'}`
        )
    }
  }

  // expressions
  const preset: Record<string, unknown> = vrm.expressions?.preset ?? {}
  for (const [name, value] of Object.entries(preset)) {
    if (!PRESETS.has(name)) {
      problems.push(`expressions.preset.${name} is not a VRM preset`)
      continue
    }
    const e = value as Record<string, unknown>
    for (const key of ['overrideBlink', 'overrideLookAt', 'overrideMouth'])
      if (e[key] !== undefined && !OVERRIDES.has(e[key] as string))
        problems.push(`${name}.${key} is not none, block or blend`)
    if (e.isBinary !== undefined && typeof e.isBinary !== 'boolean')
      problems.push(`${name}.isBinary is not a boolean`)
    const binds = (e.morphTargetBinds ?? []) as Array<{
      node?: number
      index?: number
      weight?: number
    }>
    if (!Array.isArray(binds)) {
      problems.push(`${name}.morphTargetBinds is not a list`)
      continue
    }
    binds.forEach((b, k) => {
      const at = `${name}.morphTargetBinds[${k}]`
      const n = typeof b.node === 'number' ? nodes[b.node] : undefined
      if (n === undefined || n.mesh === undefined) {
        problems.push(`${at}.node is not a mesh node`)
        return
      }
      const targets = Math.max(
        0,
        ...(meshes[n.mesh]?.primitives ?? []).map((p) => p.targets?.length ?? 0)
      )
      if (
        typeof b.index !== 'number' ||
        !Number.isInteger(b.index) ||
        b.index < 0 ||
        b.index >= targets
      )
        problems.push(`${at}.index is not one of ${n.name}'s targets`)
      if (typeof b.weight !== 'number' || !(b.weight >= 0 && b.weight <= 1))
        problems.push(`${at}.weight is not in [0, 1]`)
    })
  }

  // lookAt
  const look = vrm.lookAt
  if (look !== undefined) {
    if (look.type !== undefined && !['bone', 'expression'].includes(look.type))
      problems.push('lookAt.type is not bone or expression')
    if (
      look.offsetFromHeadBone !== undefined &&
      (!Array.isArray(look.offsetFromHeadBone) ||
        look.offsetFromHeadBone.length !== 3 ||
        look.offsetFromHeadBone.some((x: unknown) => typeof x !== 'number'))
    )
      problems.push('lookAt.offsetFromHeadBone is not three numbers')
    for (const key of [
      'rangeMapHorizontalInner',
      'rangeMapHorizontalOuter',
      'rangeMapVerticalDown',
      'rangeMapVerticalUp',
    ]) {
      const r = look[key]
      if (r === undefined) continue
      if (!(typeof r.inputMaxValue === 'number' && r.inputMaxValue >= 0))
        problems.push(`lookAt.${key}.inputMaxValue is not >= 0`)
      if (!(typeof r.outputScale === 'number' && r.outputScale >= 0))
        problems.push(`lookAt.${key}.outputScale is not >= 0`)
    }
    if (look.type === 'expression')
      for (const p of ['lookUp', 'lookDown', 'lookLeft', 'lookRight'])
        if (preset[p] === undefined)
          problems.push(`lookAt is by expression but there is no ${p}`)
  }
  return problems
}
