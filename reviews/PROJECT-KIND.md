# What kind of thing Dramatis is

Lens 0 of the review (tosijs-coding-practices `practices/review.md`, "What KIND of thing is
this?"): recorded once, revisited when the project's nature changes. Written 2026-11-03,
after 0.1.2.

Dramatis is four kinds of thing at once, and the obligations compose.

## A published library

`dramatis` and `dramatis/three` are on npm (since 0.1.0), and tosijs-3d-ensemble depends
on them. The API is a promise: a rename breaks callers who trusted it first (#3684 was
settled by documenting the naming rule, not renaming). The engine-free entries must never
reach Babylon (`src/no-babylon.test.ts`, entries taken from package.json's exports), and
their size is capped (`src/size.test.ts`).

## A definer of file formats

Three formats leave the site and outlive any release: the GLB export profile and its
`asset.extras.dramatis` block (`site/docs/export-format.md`, versioned), the share link
(`#c=1.…`, versioned), and, through tosijs-3d, the `tosijs-character` file. Like a
language's semantics, a format is a contract with files that already exist: a reader must
keep opening old files, and a change that alters what an existing file means is a breaking
change even when no code signature moves. Paid features never touch a format.

## A carrier of licence claims

Every asset a character uses is stated on the site and written into every export. A wrong
claim is not a local bug: it is copied into each file a user makes and passes on, like a
codegen defect into every consumer's output. So every shipped asset has a known licence,
community assets are checked one by one, AGPL-headed files are refused, and MakeHuman's
code (AGPL) is reimplemented from the formats, never copied. A URL-loaded file's licence
claims are labelled as that file's own (#3664).

## A hosted web app that takes input from strangers

The creator, viewer, demo and Unity player run on dramatis.tosijs.net with no accounts:
characters live in the visitor's browser. What a page reads from outside (`#c=`,
`?handoff=`, `?glb=`, an imported character file) is a closed, capped list with
hostile-input tests per entry (`src/contracts/doors.ts`). Because it runs on phones, its
first-visit cost is budgeted in CI (`tools/perf/phone.test.ts`).
