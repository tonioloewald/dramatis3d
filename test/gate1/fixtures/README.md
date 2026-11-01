# gate-1 fixtures

- `ual-walk.glb`: the `Walk_Loop` clip from Quaternius' Universal Animation
  Library (`UAL1.glb`), with UAL's armature at its rest pose and no mesh.
  **CC0 1.0** (https://quaternius.com; https://creativecommons.org/publicdomain/zero/1.0/).
  Cut by `bun test/gate1/make-ual-clip.ts <UAL1.glb>`, channels and keys
  copied unchanged. UAL1.glb is in static-assets, `assets/quaternius/`.

The bad fixtures are made in code (`../fixture.ts`, broken per test in
`../fixtures.test.ts`), so each is the good one with exactly one thing wrong.
