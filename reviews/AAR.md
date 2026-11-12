# After-action reports

Newest first; facts, not analysis (tosijs-coding-practices `practices/releasing.md`, step
10). 0.1.0 and 0.1.1 were not recorded when they shipped (2026-11-02) and are not
reconstructed here.

## 0.1.3 — 2026-11-12

- Went well: the pre-minor review BLOCKed on a real defect, `src/upstream/held-parts.ts`
  bundled into `dist/index.js` (B1). It cleared by adopting tosijs-3d 0.12.6's `heldParts`,
  and `src/no-upstream.test.ts` now makes it a check, not a memory. The four doc majors were
  fixed before the tag. The verify run's registry integrity matched the staged bytes
  (`sha512-c3V6SS51…`), and the consumer smoke test passed on the published copy.
- Didn't: the stage job's 60-minute approval window ran out again (09:03 to 10:03 UTC). After
  the owner approved, verify ran with `verify_only=true` (run 43292803026, success, 19:42 UTC).
- Surprised: adopting 0.12.6 grew the core from 75.8 to 82.5 KiB gzip, because its garment
  baking reaches a JPEG decoder. The ceiling went to 86 KiB, and #4060 asks upstream to load
  the decoder on demand.
- Friction: same as 0.1.2. The approval wait is longer than the stage window, so every
  release takes two runs. The review also found that new public API meant 0.2.0 by the
  rules; the owner chose a patch.
- Cycle: B1 → tosijs-3d 0.12.6 + guard (4839795) → STATUS CLEARED (b4192d3) → tag.

## 0.1.2 — 2026-11-02

- Went well: the release was the site's; the library was unchanged from 0.1.1, and publish
  went through the staged OIDC workflow.
- Didn't: the stage job timed out waiting for the owner's npm 2FA approval; after the
  approval the workflow was re-run with `verify_only=true` (success, 18:02 UTC).
- Surprised: the first run ended with build and stage green, verify skipped, and npm's
  `latest` still 0.1.1: a release can look done while it is waiting on a person.
- Friction: an agent can't publish; every npm release waits on the owner's 2FA.
- Cycle: none.
