# After-action reports

Newest first; facts, not analysis (tosijs-coding-practices `practices/releasing.md`, step
10). 0.1.0 and 0.1.1 were not recorded when they shipped (2026-11-02) and are not
reconstructed here.

## 0.1.2 — 2026-11-02

- Went well: the release was the site's; the library was unchanged from 0.1.1, and publish
  went through the staged OIDC workflow.
- Didn't: the stage job timed out waiting for the owner's npm 2FA approval; after the
  approval the workflow was re-run with `verify_only=true` (success, 18:02 UTC).
- Surprised: the first run ended with build and stage green, verify skipped, and npm's
  `latest` still 0.1.1: a release can look done while it is waiting on a person.
- Friction: an agent can't publish; every npm release waits on the owner's 2FA.
- Cycle: none.
