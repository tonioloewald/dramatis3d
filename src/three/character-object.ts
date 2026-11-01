// The three.js adapter (lane three): a BuiltCharacter as the scene graph a
// GLTFLoader gives for `writeCharacterGlb(built)`. Contract and its TSDoc:
// src/contracts/three-adapter.ts. Page: site/docs/dramatis-three.md.
//
// It reads only the contract shape (src/contracts/built-character.ts) and the
// profile's names, so it cannot drift from the GLB writer except where the
// writer drifts from the profile.

import {
  BufferAttribute,
  BufferGeometry,
  Bone,
  Color,
  DoubleSide,
  FrontSide,
  Group,
  LinearSRGBColorSpace,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  PropertyBinding,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Texture,
  type ColorSpace,
} from 'three'
import type {
  BuiltCharacter,
  BuiltImage,
  BuiltMesh,
  PbrMaterial,
} from '../contracts/built-character'
import { jointName, type FaceUnitName } from '../contracts/profile'
import type {
  CharacterObject,
  CharacterObjectOptions,
} from '../contracts/three-adapter'

/** What `updateCharacterObject` needs to remember about an object it made. */
interface State {
  bones: Bone[]
  /** The JSON of each material definition, to tell a changed one. */
  materialKeys: string[]
  materials: MeshStandardMaterial[]
  /** Keyed by image index and colour space. */
  textures: Map<string, Texture>
  images: BuiltImage[]
  disposed: boolean
}

const states = new WeakMap<CharacterObject, State>()

/** A node name as GLTFLoader writes it (PropertyBinding drops `:` and friends). */
const nodeName = (name: string): string =>
  PropertyBinding.sanitizeNodeName(name)

/**
 * The same thing the GLB writer writes, made directly: the scene graph a
 * GLTFLoader would give for `writeCharacterGlb(built)`, node names, bone
 * order, morph names and materials (MeshStandardMaterial, or
 * MeshPhysicalMaterial for sheen) included.
 *
 * The root `Group` holds the root bone and one `SkinnedMesh` per built mesh,
 * all bound to one `Skeleton` with the built inverse binds (bind matrix
 * identity: the meshes are untransformed, as the profile has them). Each
 * mesh's `morphTargetDictionary` maps face-unit names to morph indices, and
 * its morphs are relative deltas, as glTF stores them. Textures decode in
 * the background where `createImageBitmap` exists (browsers); elsewhere they
 * stay empty.
 */
export function characterObject(
  built: BuiltCharacter,
  options: CharacterObjectOptions = {}
): CharacterObject {
  const naming = options.naming ?? 'ue'
  const root = new Group()
  root.name = nodeName(built.name)

  const bones = built.skeleton.joints.map((joint) => {
    const bone = new Bone()
    bone.name = nodeName(jointName(joint.name, naming))
    return bone
  })
  built.skeleton.joints.forEach((joint, i) => {
    const bone = bones[i]!
    if (joint.parent < 0) root.add(bone)
    else bones[joint.parent]!.add(bone)
  })
  setRest(bones, built)
  const skeleton = new Skeleton(bones, inverseBinds(built))

  const state: State = {
    bones,
    materialKeys: [],
    materials: [],
    textures: new Map(),
    images: built.images,
    disposed: false,
  }
  syncMaterials(state, built)

  const meshes: SkinnedMesh[] = []
  const object: CharacterObject = {
    root,
    skeleton,
    meshes,
    setFaceUnit(unit: FaceUnitName, weight: number): void {
      const w = Math.min(1, Math.max(0, weight))
      for (const mesh of object.meshes) {
        const i = mesh.morphTargetDictionary?.[unit]
        if (i !== undefined && mesh.morphTargetInfluences)
          mesh.morphTargetInfluences[i] = w
      }
    },
    dispose(): void {
      if (state.disposed) return
      state.disposed = true
      for (const mesh of object.meshes) {
        mesh.geometry.dispose()
        mesh.removeFromParent()
      }
      for (const m of state.materials) m.dispose()
      for (const t of state.textures.values()) disposeTexture(t)
      state.textures.clear()
      skeleton.dispose()
    },
  }
  for (const def of built.meshes) {
    const mesh = makeMesh(def, state, skeleton)
    meshes.push(mesh)
    root.add(mesh)
  }
  states.set(object, state)
  return object
}

/**
 * Bring an object `characterObject` made up to date with a newly built
 * character (a slider moved, a garment changed) without making a new one:
 * the root group, the bones and the skeleton stay the same objects, so the
 * scene, an `AnimationMixer` bound to the root and any references the caller
 * holds keep working. Bones take the new rest transforms and inverse binds;
 * a mesh whose name and vertex and index counts are unchanged has its
 * arrays rewritten in place, any other mesh is made anew (and the old one
 * disposed); materials and textures are remade only when they changed.
 * Face-unit weights carry over by name. `object.meshes` is updated in place,
 * in `built.meshes` order.
 *
 * The built character must have the same skeleton (the profile's 65 joints);
 * throws when the joint names or parents differ, or the object was disposed.
 * Under a playing `AnimationMixer`, the animated channels (rotations, and
 * `root`/`pelvis` translation) are the clip's; the new translations show on
 * every other joint at once.
 */
export function updateCharacterObject(
  object: CharacterObject,
  built: BuiltCharacter
): void {
  const state = states.get(object)
  if (state === undefined)
    throw new Error('updateCharacterObject: not made by characterObject')
  if (state.disposed) throw new Error('updateCharacterObject: disposed')
  const joints = built.skeleton.joints
  const sameSkeleton =
    joints.length === state.bones.length &&
    joints.every((j, i) => {
      const bone = state.bones[i]!
      const parent = j.parent < 0 ? object.root : state.bones[j.parent]
      return bone.parent === parent
    })
  if (!sameSkeleton)
    throw new Error(
      'updateCharacterObject: the skeleton changed; make a new characterObject'
    )
  setRest(state.bones, built)
  const inverses = inverseBinds(built)
  inverses.forEach((m, i) => object.skeleton.boneInverses[i]!.copy(m))

  syncMaterials(state, built)

  const old = new Map(object.meshes.map((m) => [m.name, m]))
  const next: SkinnedMesh[] = []
  for (const def of built.meshes) {
    const name = nodeName(def.name)
    const mesh = old.get(name)
    old.delete(name)
    if (mesh !== undefined && sameTopology(mesh.geometry, def)) {
      const weights = faceWeights(mesh)
      rewriteGeometry(mesh, def)
      mesh.material = state.materials[def.material]!
      restoreFaceWeights(mesh, weights)
      next.push(mesh)
    } else {
      const made = makeMesh(def, state, object.skeleton)
      if (mesh !== undefined) {
        restoreFaceWeights(made, faceWeights(mesh))
        mesh.geometry.dispose()
        mesh.removeFromParent()
      }
      object.root.add(made)
      next.push(made)
    }
  }
  for (const mesh of old.values()) {
    mesh.geometry.dispose()
    mesh.removeFromParent()
  }
  object.meshes.splice(0, object.meshes.length, ...next)
}

function setRest(bones: Bone[], built: BuiltCharacter): void {
  built.skeleton.joints.forEach((joint, i) => {
    const bone = bones[i]!
    bone.position.fromArray(joint.translation)
    bone.quaternion.fromArray(joint.rotation)
    bone.scale.set(1, 1, 1)
  })
}

function inverseBinds(built: BuiltCharacter): Matrix4[] {
  // glTF and three both store matrices column-major.
  return built.skeleton.joints.map((j) =>
    new Matrix4().fromArray(Array.from(j.inverseBind))
  )
}

function sameTopology(geometry: BufferGeometry, def: BuiltMesh): boolean {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const morphs = geometry.morphAttributes.position ?? []
  return (
    position.count * 3 === def.positions.length &&
    index !== null &&
    index.count === def.indices.length &&
    (geometry.getAttribute('uv') !== undefined) === (def.uvs !== null) &&
    morphs.length === def.morphs.length &&
    def.morphs.every((m, i) => morphs[i]!.name === m.name) &&
    (geometry.morphAttributes.normal !== undefined) ===
      def.morphs.some((m) => m.normals !== null)
  )
}

function makeMesh(
  def: BuiltMesh,
  state: State,
  skeleton: Skeleton
): SkinnedMesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(def.positions.slice(), 3)
  )
  geometry.setAttribute('normal', new BufferAttribute(def.normals.slice(), 3))
  if (def.uvs !== null)
    geometry.setAttribute('uv', new BufferAttribute(def.uvs.slice(), 2))
  geometry.setAttribute(
    'skinIndex',
    new BufferAttribute(def.skin.joints.slice(), 4)
  )
  geometry.setAttribute(
    'skinWeight',
    new BufferAttribute(def.skin.weights.slice(), 4)
  )
  geometry.setIndex(new BufferAttribute(def.indices.slice(), 1))
  if (def.morphs.length > 0) {
    geometry.morphTargetsRelative = true
    geometry.morphAttributes.position = def.morphs.map((m) => {
      const a = new BufferAttribute(m.positions.slice(), 3)
      a.name = m.name
      return a
    })
    if (def.morphs.some((m) => m.normals !== null))
      geometry.morphAttributes.normal = def.morphs.map((m) => {
        const a = new BufferAttribute(
          m.normals?.slice() ?? new Float32Array(m.positions.length),
          3
        )
        a.name = m.name
        return a
      })
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  const mesh = new SkinnedMesh(geometry, state.materials[def.material]!)
  mesh.name = nodeName(def.name)
  // updateMorphTargets fills morphTargetDictionary from the attribute names,
  // as GLTFLoader does from extras.targetNames.
  mesh.updateMorphTargets()
  mesh.bind(skeleton, new Matrix4())
  return mesh
}

function rewriteGeometry(mesh: SkinnedMesh, def: BuiltMesh): void {
  const g = mesh.geometry
  const put = (name: string, data: ArrayLike<number>): void => {
    const a = g.getAttribute(name) as BufferAttribute
    ;(a.array as Float32Array | Uint16Array).set(data)
    a.needsUpdate = true
  }
  put('position', def.positions)
  put('normal', def.normals)
  if (def.uvs !== null) put('uv', def.uvs)
  put('skinIndex', def.skin.joints)
  put('skinWeight', def.skin.weights)
  const index = g.getIndex()!
  ;(index.array as Uint32Array).set(def.indices)
  index.needsUpdate = true
  def.morphs.forEach((m, i) => {
    const p = g.morphAttributes.position![i] as BufferAttribute
    ;(p.array as Float32Array).set(m.positions)
    p.needsUpdate = true
    const n = g.morphAttributes.normal?.[i] as BufferAttribute | undefined
    if (n !== undefined) {
      if (m.normals !== null) (n.array as Float32Array).set(m.normals)
      else (n.array as Float32Array).fill(0)
      n.needsUpdate = true
    }
  })
  g.computeBoundingBox()
  g.computeBoundingSphere()
  // SkinnedMesh caches its own (posed) bounds; drop them so culling sees the new shape.
  // three's types say non-null, but null is the constructor's value and
  // means "compute on next use" (Frustum.intersectsObject does).
  ;(mesh as { boundingBox: unknown }).boundingBox = null
  ;(mesh as { boundingSphere: unknown }).boundingSphere = null
}

function faceWeights(mesh: SkinnedMesh): Map<string, number> {
  const out = new Map<string, number>()
  const dict = mesh.morphTargetDictionary ?? {}
  for (const [name, i] of Object.entries(dict))
    out.set(name, mesh.morphTargetInfluences?.[i] ?? 0)
  return out
}

function restoreFaceWeights(
  mesh: SkinnedMesh,
  weights: Map<string, number>
): void {
  const dict = mesh.morphTargetDictionary ?? {}
  for (const [name, w] of weights) {
    const i = dict[name]
    if (i !== undefined && mesh.morphTargetInfluences)
      mesh.morphTargetInfluences[i] = w
  }
}

// --- materials -------------------------------------------------------------

function syncMaterials(state: State, built: BuiltCharacter): void {
  const imagesChanged =
    state.images.length !== built.images.length ||
    state.images.some((img, i) => img.bytes !== built.images[i]!.bytes)
  if (imagesChanged) {
    for (const t of state.textures.values()) disposeTexture(t)
    state.textures.clear()
    state.images = built.images
  }
  const keys = built.materials.map((m) => JSON.stringify(m))
  built.materials.forEach((def, i) => {
    if (!imagesChanged && state.materialKeys[i] === keys[i]) return
    const fresh = makeMaterial(def, state)
    const old = state.materials[i]
    if (old !== undefined) {
      // Keep the object (meshes hold it) when the class matches; else swap.
      if (old.type === fresh.type) {
        old.copy(fresh)
        old.needsUpdate = true
        fresh.dispose()
        return
      }
      old.dispose()
    }
    state.materials[i] = fresh
  })
  for (const m of state.materials.splice(built.materials.length)) m.dispose()
  state.materialKeys = keys
}

function makeMaterial(def: PbrMaterial, state: State): MeshStandardMaterial {
  const m =
    def.sheen !== undefined
      ? new MeshPhysicalMaterial()
      : new MeshStandardMaterial()
  m.name = def.name
  const [r, g, b, a] = def.baseColorFactor
  m.color = new Color().setRGB(r, g, b, LinearSRGBColorSpace)
  m.opacity = a
  m.metalness = def.metallicFactor
  m.roughness = def.roughnessFactor
  m.side = def.doubleSided ? DoubleSide : FrontSide
  if (def.alphaMode === 'BLEND') {
    m.transparent = true
    m.depthWrite = false
  } else if (def.alphaMode === 'MASK') {
    m.alphaTest = def.alphaCutoff ?? 0.5
  }
  if (def.baseColorTexture)
    m.map = texture(state, def.baseColorTexture.image, SRGBColorSpace)
  if (def.metallicRoughnessTexture) {
    const t = texture(state, def.metallicRoughnessTexture.image, NoColorSpace)
    m.roughnessMap = t
    m.metalnessMap = t
  }
  if (def.normalTexture) {
    m.normalMap = texture(state, def.normalTexture.image, NoColorSpace)
    // As GLTFLoader does for a mesh without tangents (glTF's +Y-up normal
    // maps in three's derivative tangent frame): flip y.
    m.normalScale.set(def.normalTexture.scale, -def.normalTexture.scale)
  }
  if (def.occlusionTexture) {
    m.aoMap = texture(state, def.occlusionTexture.image, NoColorSpace)
    m.aoMapIntensity = def.occlusionTexture.strength
  }
  if (def.sheen !== undefined && m instanceof MeshPhysicalMaterial) {
    m.sheen = 1
    const [sr, sg, sb] = def.sheen.colorFactor
    m.sheenColor = new Color().setRGB(sr, sg, sb, LinearSRGBColorSpace)
    m.sheenRoughness = def.sheen.roughnessFactor
  }
  return m
}

function texture(state: State, image: number, space: ColorSpace): Texture {
  const key = `${image}:${space}`
  const cached = state.textures.get(key)
  if (cached !== undefined) return cached
  const def = state.images[image]
  if (def === undefined) throw new RangeError(`no image ${image}`)
  const t = new Texture()
  t.name = def.name
  t.flipY = false // glTF's uv convention
  t.colorSpace = space
  state.textures.set(key, t)
  if (typeof createImageBitmap === 'function') {
    const bytes = def.bytes.slice()
    createImageBitmap(new Blob([bytes], { type: def.mimeType }), {
      imageOrientation: 'none',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    })
      .then((bitmap) => {
        if (state.textures.get(key) !== t) return bitmap.close()
        t.image = bitmap
        t.needsUpdate = true
      })
      .catch((error: unknown) => {
        console.warn(`dramatis/three: image ${def.name} did not decode`, error)
      })
  }
  return t
}

function disposeTexture(t: Texture): void {
  const image: unknown = t.image
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)
    image.close()
  t.dispose()
}
