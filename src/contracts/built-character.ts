// THE CORE/ADAPTER BOUNDARY. A built character is engine-free data: everything
// a runtime adapter (three.js, a GLB writer, later others) needs to put a
// character on screen, and nothing about how the creator drew it. The GLB
// writer and the three.js adapter both consume this one shape, so they cannot
// drift apart. Lane: skinned-glb (src/build/). Profile: site/docs/export-format.md.

import type { LicenceEntry } from './licences'
import type { FaceUnitName, RestPose } from './profile'

/** x, y, z. */
export type Vec3 = [number, number, number]
/** A unit quaternion, x, y, z, w (glTF's order). */
export type Quat = [number, number, number, number]

/**
 * THE FRAME every array in a built character is in, as glTF wants it:
 * metres, Y up, right-handed, the character facing +Z with its left on +X,
 * standing on y = 0 with the `root` joint on the floor under the pelvis.
 * Positions are in model space in the bind pose (`BuiltCharacter.restPose`),
 * never joint-relative.
 */
export interface BuiltCharacter {
  /** The character's name, from its file. */
  name: string
  /** The bind pose every mesh is skinned in. */
  restPose: RestPose
  /** The one skeleton every mesh is skinned to. */
  skeleton: BuiltSkeleton
  /** Body first, then the rest in a stable order (see `MeshRole`). */
  meshes: BuiltMesh[]
  /** Indexed by `BuiltMesh.material`. */
  materials: PbrMaterial[]
  /** Indexed by the texture slots of `PbrMaterial`. */
  images: BuiltImage[]
  /** The face units the meshes carry as morphs, in `FACE_UNITS` order. */
  faceUnits: FaceUnitName[]
  /** Every asset used, once each, base first. Never empty. */
  licences: LicenceEntry[]
}

/** The skeleton: `UE_JOINTS`, in that order, placed for this body. */
export interface BuiltSkeleton {
  joints: BuiltJoint[]
}

/**
 * One joint. Names are always the `ue` profile's here; the writer renames
 * on the way out (`ExportOptions.naming`).
 */
export interface BuiltJoint {
  /** A `UE_JOINT_NAMES` entry. */
  name: string
  /** Index of the parent in `BuiltSkeleton.joints`, or -1 for `root`. */
  parent: number
  /** Rest translation relative to the parent (metres). */
  translation: Vec3
  /**
   * Rest rotation relative to the parent. In the `t-pose` rest these are
   * UAL's own joint frames (bone along local +Y, as Blender exports them),
   * so UAL clips play by name.
   */
  rotation: Quat
  /** The model-space rest position (the same transform, accumulated). */
  position: Vec3
  /** Inverse bind matrix: 16 numbers, column-major, as glTF stores it. */
  inverseBind: Float32Array
}

/**
 * What a mesh is. The writer names nodes and meshes by role (and by asset
 * for garments and hair): see export-format.md, "Nodes and meshes".
 */
export type MeshRole =
  | 'body'
  | 'eyes'
  | 'eyelashes'
  | 'teeth'
  | 'tongue'
  | 'brows'
  | 'beard'
  | 'hair'
  | 'garment'

/** One skinned mesh: geometry baked to the character's shape, in the bind pose. */
export interface BuiltMesh {
  /**
   * Unique within the character, and the exported node and mesh name:
   * the role (`body`, `eyes`), or for garments `garment_<asset name>`
   * (`garment_toigo_harem_pants`). ASCII letters, digits and `_`.
   */
  name: string
  role: MeshRole
  /** The licence entry (`LicenceEntry.asset`) of what it was made from. */
  asset: string
  /** xyz per vertex, metres. */
  positions: Float32Array
  /** xyz per vertex, unit length. */
  normals: Float32Array
  /** uv per vertex (glTF's convention: v down from the top of the image), or null. */
  uvs: Float32Array | null
  /** Triangles, three indices each, counter-clockwise from outside. */
  indices: Uint32Array
  skin: BuiltSkin
  /**
   * Face units that move this mesh, in `FACE_UNITS` order (a subset of
   * `BuiltCharacter.faceUnits`; empty for a mesh the face does not move).
   */
  morphs: BuiltMorph[]
  /** Index into `BuiltCharacter.materials`. */
  material: number
}

/**
 * Skin influences, four per vertex (glTF's JOINTS_0 / WEIGHTS_0). Weights
 * are renormalised to sum to 1 (a vertex with no weight at all goes wholly
 * to the pelvis); unused slots have weight 0 and joint 0.
 */
export interface BuiltSkin {
  /** Joint indices into `BuiltSkeleton.joints`, 4 per vertex. */
  joints: Uint16Array
  /** 4 per vertex, each vertex's summing to 1. */
  weights: Float32Array
}

/** A face unit as a morph target: what it adds to each vertex at weight 1. */
export interface BuiltMorph {
  name: FaceUnitName
  /** xyz delta per vertex (metres), the mesh's vertex count long. */
  positions: Float32Array
  /** xyz normal delta per vertex, or null to let engines recompute. */
  normals: Float32Array | null
}

/** A glTF texture reference: an image and the uv set (always 0 here). */
export interface TextureRef {
  /** Index into `BuiltCharacter.images`. */
  image: number
}

/**
 * Plain glTF metallic-roughness PBR, plus `KHR_materials_sheen` for fabric.
 * The creator's shading plugins (skin scatter, hair highlights) do not
 * travel. The profile has what they compute baked into these textures; the
 * writer does not bake yet (the skin is a flat colour, garments keep their
 * own textures). Colours are linear.
 */
export interface PbrMaterial {
  name: string
  /** Linear RGBA, multiplying `baseColorTexture`. */
  baseColorFactor: [number, number, number, number]
  /** sRGB colour, alpha in A. */
  baseColorTexture?: TextureRef
  metallicFactor: number
  roughnessFactor: number
  /** Roughness in G, metalness in B (glTF's packing). */
  metallicRoughnessTexture?: TextureRef
  /** Tangent space, OpenGL convention (+Y up), as glTF has it. */
  normalTexture?: TextureRef & { scale: number }
  occlusionTexture?: TextureRef & { strength: number }
  alphaMode: 'OPAQUE' | 'MASK' | 'BLEND'
  /** Only for `MASK`. */
  alphaCutoff?: number
  doubleSided: boolean
  /** KHR_materials_sheen, for cloth. */
  sheen?: {
    colorFactor: [number, number, number]
    roughnessFactor: number
  }
}

/** An image as it goes in the file. */
export interface BuiltImage {
  name: string
  mimeType: 'image/png' | 'image/jpeg'
  bytes: Uint8Array
  /** The licence entry of the asset it came from or was baked from. */
  asset: string
}

/** How `buildCharacter` reads its assets and what it bakes. */
export interface BuildOptions {
  /** The bind pose. Default `t-pose`. */
  restPose?: RestPose
  /**
   * Which face units become morphs: true for all of `FACE_UNITS` the pack
   * has (the default), false for none, or a list.
   */
  faceUnits?: boolean | readonly FaceUnitName[]
  /**
   * Fetches what the pack does not carry (Quaternius hair GLBs, textures),
   * by URL. Default `fetch`.
   */
  fetch?: (url: string) => Promise<ArrayBuffer>
}

/**
 * Build a character from its file and the loaded pack: the body morphed to
 * its sliders, UAL's skeleton placed in it and posed to the rest pose,
 * skinned (max 4 influences), covered skin removed, each worn proxy and the
 * hair fitted and skinned to the same skeleton, the face units baked as
 * morphs, materials as plain PBR, and the licence entries collected.
 *
 * Not yet: the skin is one flat colour (no baked albedo, lips or stubble)
 * and the eyes plain white. Throws for what does not export yet: Quaternius
 * hair and brows, garments of the character's own, bodies other than
 * MakeHuman's.
 *
 * Throws `UnlicensedAssetError` (licences.ts) when the character uses an
 * asset the manifest has no entry for.
 */
// Implemented by lane skinned-glb (src/build/), same signature and doc.
export { buildCharacter } from '../build'
