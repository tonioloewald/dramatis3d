// Deliberate failure case for src/no-babylon.test.ts: our own declarations are
// clean, but a type we expose comes from a module whose declarations import
// Babylon (./babylon-typed-dep, standing in for tosijs-3d's rigged-body as it
// was up to 0.11.6). A three.js consumer's type-check would then need Babylon
// installed.
import type { LeakyBody } from './babylon-typed-dep'
export const noBody = (): LeakyBody | null => null
