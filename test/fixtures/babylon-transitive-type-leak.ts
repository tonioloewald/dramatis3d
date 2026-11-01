// Deliberate failure case for src/no-babylon.test.ts: our own declarations are
// clean, but a type we expose comes from a module whose declarations import
// Babylon (tosijs-3d's rigged-body, the leak PLAN.md records). A three.js
// consumer's type-check would then need Babylon installed.
import type { RiggedBody } from 'tosijs-3d/rigged-body'
export const noBody = (): RiggedBody | null => null
