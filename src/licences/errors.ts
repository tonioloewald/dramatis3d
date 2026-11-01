// Lives here, not in the contract, so the contract can re-export the lane's
// module without an import cycle. src/contracts/licences.ts re-exports it.

/** Thrown when a character uses an asset the manifest has no entry for. */
export class UnlicensedAssetError extends Error {
  readonly asset: string
  constructor(asset: string) {
    super(`no licence entry for asset ${asset}: it cannot be shipped`)
    this.name = 'UnlicensedAssetError'
    this.asset = asset
  }
}
