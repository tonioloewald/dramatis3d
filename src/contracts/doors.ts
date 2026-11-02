// THE ENTRY DOORS: every input a site page takes from outside, by URL or by a
// file the visitor picks. A closed set (practices/review.md "Closed set"):
// src/contracts/doors.test.ts fails on a page that reads its URL somewhere
// not listed here, and on a door whose hostile-input tests are missing.
//
// Each door is capped and refuses garbage before it is parsed:
//   #c=        the share link's budget, and a capped inflate (src/share)
//   ?handoff=  an id over HANDOFF_ID_MAX is refused before IndexedDB
//   ?glb=      fetchGlb stops at GLB_MAX_BYTES; three/glTFast parse the rest
//   file       CHARACTER_FILE_MAX, then readCharacter (tosijs-3d)

export interface EntryDoor {
  /** How the door is written: `#c=`, `?glb=`, or a menu item for a file. */
  door: string
  /** The pages (source files) that read it. */
  pages: string[]
  /** The test file whose tests are named `hostile <door>: …`. */
  tests: string
}

export const ENTRY_DOORS: readonly EntryDoor[] = [
  {
    door: '#c=',
    pages: ['site/creator/app.ts'],
    tests: 'src/share/share.test.ts',
  },
  {
    door: '?handoff=',
    pages: ['site/viewer/main.ts', 'site/demo/main.ts', 'site/unity/main.ts'],
    tests: 'site/creator/creator.test.ts',
  },
  {
    door: '?glb=',
    pages: [
      'site/viewer/main.ts',
      'site/demo/main.ts',
      'site/unity/main.ts',
      'samples/three-glb/main.ts',
    ],
    tests: 'site/viewer/viewer.test.ts',
  },
  {
    door: 'import character (.json)',
    pages: ['site/creator/app.ts'],
    tests: 'site/creator/creator.test.ts',
  },
]
