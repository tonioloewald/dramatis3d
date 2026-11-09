// Tonio's weapon library: where it is and what is in it (no imports, so the
// licence manifest can read it).

/** The library on the asset CDN (under `setAssetBase`, `assetUrl(WEAPONS_PATH, 2)`). */
export const WEAPONS_PATH = 'tonio/weapons-classic/weapons.glb'
/** Its full URL, as the licence entries cite it. */
export const WEAPONS_URL = `https://cdn.tosijs.net/${WEAPONS_PATH}`

/** The items in the library (checked against the file, 2026-11-09). */
export const WEAPONS = Object.freeze([
  'Assault Rifle',
  'Buckler',
  'Dagger',
  'Game Controller',
  'Hand and a Half',
  'Long Sword',
  'Pistol',
  'Plasma Blade',
  'Rocket Launcher',
  'Short Sword',
  'SMG',
  'Spear',
] as const)

/** An item's licence id. */
export const weaponAsset = (name: string) =>
  `tonio:weapon/${name.toLowerCase().replace(/\s+/g, '-')}`
