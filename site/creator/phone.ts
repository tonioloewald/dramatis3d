// The creator's note for phones and tablets. Kept apart from actions.ts so the
// light half (element.ts, in the shared bundle) imports nothing heavy.

/** Shown while the creator loads on a phone or tablet: the first visit is a large download. */
export const PHONE_NOTE =
  'The creator is a large download the first time (about 20 MB). It works best on a desktop or a recent flagship phone.'

/** A phone or tablet: a narrow screen or a touch-only pointer. */
export function onSmallDevice(
  matchMedia?: (query: string) => { matches: boolean }
): boolean {
  if (!matchMedia) return false
  return matchMedia('(max-width: 700px), (hover: none) and (pointer: coarse)')
    .matches
}
