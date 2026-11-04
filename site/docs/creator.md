# Creator

<!--{"pin": "top", "order": 0, "description": "Make a character in the browser, then download it as a GLB, view it in three.js, or share it as a link."}-->

**Make a person, then take them anywhere.** Shape the body in the scene's
panel, name your character, and export it.

<dramatis-creator></dramatis-creator>

## Using it

- **Shape** the character in the scene's panel (the owl opens and closes
  it): body, ancestry, skin and eyes, face, hair and clothes. **Motion** sets
  them walking, dancing or standing still. Drag to turn the
  camera, scroll or pinch to zoom.
- **View in three.js** exports a GLB and opens it in Dramatis's three.js
  viewer in a new tab. The file goes to the viewer through this browser's
  storage, not over the network, and is deleted after a day.
- **View in Unity** does the same in the [Unity player](/unity/): Unity 6's
  Web player loads the export with glTFast, and you walk the character
  round, as in the three.js demo.
- **Download GLB** saves the same file. It follows the
  [export format](/export-format/): metres, Y-up, a UE-named skeleton (or
  Mixamo names, from the menu at the end of the toolbar) and the face's
  expressions as morph targets, with every asset's licence written inside.
- **Share link** makes a link that opens this character here. It holds the
  settings and nothing else, so it works without an account; the link is
  copied to the clipboard when the browser allows it.
- **Character** (in the panel) keeps characters in this browser: the one you
  are working on comes back when you return. **Save…** asks for a name and
  keeps it; **rename…** renames the saved one you picked. **Export character
  (.json)** saves a `tosijs-character` file, which **import character
  (.json)** reads back here or in tosijs-3d. (To open a GLB, use the
  [viewer](/viewer/) or the [demo](/demo/).)
- **[Walk them round](/demo/)**: the three.js demo offers every character
  saved in this browser, the one you are working on first.

When an export cannot be made, the line under the buttons says why, and
your character is kept.

There is no **VRM** button yet. The library makes VRM files
([VRM](/vrm/)); the creator does not offer it.

## What it is made of

Every asset the creator shows is CC0 (public domain), except the skin
tones, which are CC BY 4.0 and credited in every export:

| Asset | Source | Licence |
| --- | --- | --- |
| The body, its shapes, eyes, teeth, hair, brows, clothes | [MakeHuman](http://www.makehumancommunity.org) (hm08 and its system assets) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| More clothes: t-shirts, a sweater, a bodice top, wool trousers, cargo trousers, denim shorts, a dinner suit, a bodysuit, three pairs of shoes, gloves and a cloche hat | MakeHuman community authors (Margaret Toigo, Cortu, Elvaerwyn, Joel Palmius, MatCreator, Aethelraed_Unraed), from MakeHuman's asset packs, each checked one by one | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| The eye art (**eye art**: basic or anime), its iris recoloured | Tonio Loewald, original | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| More hairstyles and brows (not exportable yet) | [Quaternius](https://quaternius.com) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| The skin tones | [Monk Skin Tone Scale](https://skintone.google), by Dr. Ellis Monk and Google | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| The skeleton, and the preview's animations (the clips are not exported) | Quaternius' Universal Animation Library | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

MakeHuman's data is used as published; its code is not (Dramatis
reimplements what it needs from the file formats). An exported file lists
the assets it actually contains, each with its source and licence, in
`asset.extras.dramatis.licences`. The full list is on the
[licences page](/licences/).

The creator runs on [tosijs-3d](https://3d.tosijs.net)'s character system,
the same one as its [character builder](https://3d.tosijs.net/character-builder/),
which has the tailor and rig tools this page leaves out.

## Size

The page itself is small. The creator loads its 3D engine and the body data
when it opens: about 2.5 MB of script (compressed; the build fails past
2.6 MB), 1.5 MB of animation clips from this site, and about 19 MB of models
from `cdn.tosijs.net`, most of it a hair library the default character
doesn't wear. All of it is cached after the first visit. It works best on a desktop
or a recent flagship phone (it runs well on an iPhone 17 Pro). On a mid-range
phone over slow 4G that first visit takes well over a minute, and a repeat
visit about 9 s, so on a phone or tablet the creator says so while it loads.

## Known issues

- **Quaternius hairstyles and brows do not export yet.** The panel offers
  them (they are CC0), but **View in three.js**, **View in Unity** and **Download GLB** then
  stop with "Quaternius hair does not export yet". MakeHuman's hairstyles
  and brows (the default) export.
- **Layering is not checked yet.** Each garment was tested alone at the
  slider extremes, not in pairs: the wool trousers' waistband shows through
  the sweater's hem.
- The export is plainer than the scene: the skin is one colour (no lips),
  the lashes a dark card, and the creator's skin, hair and cloth shading
  stay behind. The eyes match: the creator paints the same eye art the
  export carries. [Export](/export/) lists what does not travel yet.
- The creator's bundle carries its own copy of tosijs beside the site's, so
  the console notes a few elements "already defined". It is harmless.
