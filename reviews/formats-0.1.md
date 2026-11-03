# The public formats, reviewed as API

2026-11-03, for #3690 (pre-minor completeness gap 9): the share link and the GLB export
profile, against tosijs-coding-practices `practices/state-and-schema.md` ("Version every
format that outlives the process") and CLAUDE.md's one-character-file invariant. Dramatis at
25ee543 plus this change.

## The share link (`#c=1.<payload>`)

- **Versioned:** yes, the `1.` before the payload. A newer link is refused with a message
  that says so ("newer than this page reads; open it on the current site").
- **Version 0:** no link without a marker was ever made, but `c=0.` used to be read as
  version 1. Now refused ("was never written"), with a test.
- **One character file:** holds. The payload is a `tosijs-character` document, deflated and
  base64url'd: the link is a wrapper, not a second format. The document's own `format` and
  `version` are checked by tosijs-3d's `readCharacter`, which refuses a newer one.
- **Bounded:** an 8,000-character budget, checked before decoding, and a capped inflate
  (hostile-input tests in `src/share/share.test.ts`, door `#c=` in
  `src/contracts/doors.ts`).
- **What the link leaves out** (garments of the user's own, tailor outlines, file bodies) is
  reported in `dropped`, not lost silently.

## The export profile (`asset.extras.dramatis`)

- **Versioned:** `format: 'dramatis-export'`, `version: 1`, and `generator:
  'dramatis@<version>'` for which writer made it.
- **Strict reader:** `checkExportExtras` accepts only version 1 and only the 59 known face
  units, so adding a unit is a breaking change for any reader that checks. This was not
  written down: `site/docs/export-format.md` now has a **Versions** section saying what
  raises the version (joints, face units, required fields, the default rest pose) and what
  doesn't (optional extras a version 1 reader can ignore).
- **Reading a newer file:** report it invalid, don't guess, but still show the licence
  entries (the viewer does, since #3664).
- **v0:** every Dramatis export since 0.1.0 has carried the block; a GLB without it is "not
  a Dramatis export", which is what readers already say.

## Not a migration hook

`src/build/version.ts` is the generator stamp (`DRAMATIS_VERSION`, pinned to package.json by
a test), not a migration. Character-file migration belongs to tosijs-3d's `readCharacter`;
an export is written once and never migrated, so its version is for readers only.

## Left open

None that blocks: both formats are versioned, refuse what they don't know, and now say
what changes them.
