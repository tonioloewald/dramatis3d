# Eye textures (Tonio Loewald, CC0)

Original art by Tonio Loewald, dedicated to the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

| File | What |
| --- | --- |
| `basic-eye.svg` | A naturalistic eye: sclera, iris in three browns, darkening, pupil |
| `anime-eye.svg` | The same layout with a larger pupil and two glints |

Layout (both): 256 × 256, the iris a disc of radius 48 centred at (128, 128),
the sclera filling the square. The export maps each eyeball onto it with
the iris straight ahead (`src/upstream/eyes/eye-uv.ts`) and recolours the
iris's browns to the character's eye colour (`recolour.ts`).

`bun bin/eye-textures.ts` renders them to the PNGs the export embeds
(`src/upstream/eyes/textures.ts`); run it after changing either SVG.
