# The extremes sweep

<!--{"parent": "docs", "order": 30, "description": "How Dramatis checks garments and hair on the most extreme bodies its sliders make: penetration, bone-length sanity and a contact sheet."}-->

A character creator is judged on its worst screenshot, so Dramatis checks the
worst bodies its sliders can make, with everything it can put on them
(PLAN.md, "No broken fits at the extremes"). `bun bin/extremes.ts` builds the
corner bodies, dresses each one in every garment and hairstyle alone, and
reports what pokes through, where the skeleton goes wrong, and which garments
hold up everywhere. The latest run is in
[`reports/extremes.md`](https://github.com/tonioloewald/dramatis3d/blob/main/reports/extremes.md),
with its numbers in `reports/extremes.json` and its contact sheet in
`reports/extremes-sheet.png`.

The sweep is general tosijs-3d work, built here first under
`src/upstream/extremes/` and bound for tosijs-3d (board task #3661). It is not
part of Dramatis's API.

## Which bodies

Every corner of all fourteen body sliders is 16,384 bodies; the sweep builds
133 of them:

- **64 macro corners:** gender, age, muscle, weight, height and proportions,
  each at both ends, at an even ancestry mix. MakeHuman blends these as
  corners (they do not add), so only the full product finds the bad
  combinations. Age runs from 25 to 90: children are out of scope.
- **24 ancestry bodies:** each pure ancestry on gender, weight and muscle
  extremes.
- **44 local-shape bodies:** bust size and firmness, waist, chest depth and
  pecs, each at each end, on thin and heavy women and men, plus all of them
  out at once.
- **The default body**, so a garment broken everywhere is told apart from one
  broken at the extremes.

`--quick` keeps the default and the 32 macro corners at age 25.

## What is measured

- **Penetration.** Each garment is fitted exactly as the creator fits it
  (tosijs-3d's proxy-fit over the body with its nipples smoothed, hats lifted
  12 mm, armour 5 mm); Quaternius' hairstyles are placed through hair-fit.
  Every fitted vertex goes through a signed-distance inside test against the
  bare skin: the nearest triangle, signed by its angle-weighted
  pseudo-normal, with a three-ray parity vote far from the skin so a hole in
  the mesh cannot turn a deep point inside out. A vertex is **visibly** inside
  when it is deeper than the creator tucks the skin there, by more than 1 mm.
  An item **fails** on a body when more than 0.2% of its vertices, and more
  than three, are visibly inside.
- **Bone-length sanity.** UAL's 65 joints fitted to each body
  (tosijs-3d's `humanRig`): no bone collapses or grows more than 2x against
  the default after height, left and right agree within 3%, the spine, legs
  and arms run downward in the rest pose, and no joint leaves the skin.
- **The worst cases,** drawn headless into a contact sheet: front and side,
  the body grey, the item blue, red where it shows through.

## Run it

```sh
bun bin/extremes.ts                    # the full sweep, about 40 minutes
bun bin/extremes.ts --quick --sheet    # 33 bodies and a contact sheet
bun bin/extremes.ts --only 'toigo_'    # only the matching items
bun bin/extremes.ts --from reports/extremes.json --sheet   # re-report a run
```

The pack and the hair library come from `../static-assets` when it is beside
the repo, otherwise from the CDN. Garment licences come from the MakeHuman
asset packs' own metadata (each pack's JSON, and the CC0 header of each
system asset); a garment with no licence found is listed as unchecked and is
never a wardrobe candidate.

## What it does not cover

Layering (two garments on one body), posed bodies (everything is at rest, so a
sleeve through a bent elbow is not seen), and Quaternius' brows. No skin is
tucked under hair, so a style modelled with an inner layer under the scalp
counts it.
