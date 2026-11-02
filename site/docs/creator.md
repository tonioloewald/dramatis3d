# Creator

<!--{"pin": "top", "order": 0}-->

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
- **Download GLB** saves the same file. It follows the
  [export format](/export-format/): metres, Y-up, a UE-named skeleton (or
  Mixamo names, from the menu at the end of the toolbar) and the face's
  expressions as morph targets, with every asset's licence written inside.
- **Share link** makes a link that opens this character here. It holds the
  settings and nothing else, so it works without an account; the link is
  copied to the clipboard when the browser allows it.
- **Character** (in the panel) keeps characters in this browser: the one you
  are working on comes back when you return, and **save** keeps named ones.
  **Export character file** saves a `tosijs-character` file, which
  **import** reads back here or in tosijs-3d.

Some of this is still being built. When a part is not there yet the toolbar
says so in a line under the buttons, and your character is kept.

## What it is made of

Every asset the creator shows is CC0 (public domain):

| Asset | Source | Licence |
| --- | --- | --- |
| The body, its shapes, eyes, teeth, brows, clothes | [MakeHuman](http://www.makehumancommunity.org) (hm08 and its system assets) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Hairstyles | [Quaternius](https://quaternius.com) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| The preview's animations (not exported) | Quaternius' Universal Animation Library | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

MakeHuman's data is used as published; its code is not (Dramatis
reimplements what it needs from the file formats). An exported file lists
the assets it actually contains, each with its source and licence, in
`asset.extras.dramatis.licences`.

The creator runs on [tosijs-3d](https://3d.tosijs.net)'s character system,
the same one as its [character builder](https://3d.tosijs.net/character-builder/),
which has the tailor and rig tools this page leaves out.

## Size

The page itself is small. The creator loads its 3D engine and the body data
when it opens: about 2.5 MB of script (compressed) and a few MB of models
from `cdn.tosijs.net`, cached after the first visit.

## Known issues

- The creator's bundle carries its own copy of tosijs beside the site's, so
  the console notes a few elements "already defined". It is harmless.
- Babylon forgets every material plugin when its last engine is disposed,
  and tosijs-3d registers its skin, hair and cloth shading once, at import.
  The creator keeps an idle engine alive so it can be opened again after
  navigating away. The proper fix belongs in tosijs-3d.
