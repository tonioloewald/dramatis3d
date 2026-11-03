# Licences and share links

<!--{"parent": "docs", "order": 20, "description": "Every asset Dramatis ships, with its source and licence, the unchecked community assets it excludes, and how a character becomes a share link."}-->

Every asset Dramatis ships has a known licence, stated here and carried into
every export (`asset.extras.dramatis.licences`, see
[Export format](/export-format/)). The table below is written from the code
(`licenceManifest()` in `src/licences/`), so this page and the exporter cannot
disagree. A character that uses an asset with no entry cannot be exported:
`characterLicences` throws `UnlicensedAssetError` naming it.

## The rules

- **MakeHuman:** their bundled assets (base mesh, targets, skeleton, system
  clothes, hair, brows, eyes) are CC0 since 2020. Dramatis uses that data and
  reimplements the logic from the file formats; their code is AGPL and none of
  it is used.
- **Community assets** (made by MakeHuman users and distributed as asset
  packs) carry their own licences. Each one is checked by a person before it
  ships. Until then it is listed below as **unchecked** and is **excluded**:
  the creator does not offer it, and an export refuses it. What its pack
  declares is shown, but a declaration is not a check. Two of these packs are
  labelled CC0 but declare a CC BY asset inside, which is why.
- **Attribution:** an asset whose licence asks for credit (any CC BY) carries
  its credit line here and in every export.
- **Your own files** (a garment or a body you opened from disk) are yours.
  They do not export yet: a character wearing one is refused, with a message
  saying so. When they do, an export will list them with the licence
  `NOASSERTION` (Dramatis makes no claim about them), as `characterLicences`
  already does.

## Using the API

```javascript
import { licenceManifest, lookupLicence, characterLicences } from 'dramatis'

lookupLicence('makehuman:base/hm08').licence // 'CC0-1.0'
characterLicences(character, pack) // the entries one character needs, base first
```

Asset ids are `<source>:<kind>/<name>`, lower case and stable across releases.

## The manifest

<!-- manifest -->

**111 assets shipped**, every one listed here with its source and licence. **118 community assets** are in the packs but unchecked, so they are excluded (below).

### MakeHuman (core and system assets)

| Asset | What | Kind | Licence | Author | Source |
| --- | --- | --- | --- | --- | --- |
| `makehuman:base/hm08` | MakeHuman hm08 base mesh, its macro and detail targets, joint helpers and skeleton (modified) | base | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data) |
| `makehuman:expression/face-poseunits` | MakeHuman face pose units (baked into the 59 face units) (modified) | other | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/poseunits) |
| `makehuman:part/eyes` | MakeHuman low-poly eyes (modified) | eyes | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/eyes/low-poly) |
| `makehuman:part/eyelashes` | MakeHuman eyelashes (the base mesh's eyelash helpers) (modified) | eyelashes | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/3dobjs) |
| `makehuman:proxy/afro01` | MakeHuman afro01 (hair) (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/bob01` | MakeHuman bob01 (hair) (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/bob02` | MakeHuman bob02 (hair) (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/braid01` | MakeHuman braid01 (hair) (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/eyebrow001` | MakeHuman eyebrow001 (eyebrows) (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/eyebrow002` | MakeHuman eyebrow002 (eyebrows) (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/eyebrow003` | MakeHuman eyebrow003 (eyebrows) (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/eyebrow004` | MakeHuman eyebrow004 (eyebrows) (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/eyebrow005` | MakeHuman eyebrow005 (eyebrows) (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/eyebrow006` | MakeHuman eyebrow006 (eyebrows) (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/eyebrow007` | MakeHuman eyebrow007 (eyebrows) (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/eyebrow008` | MakeHuman eyebrow008 (eyebrows) (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/eyebrow009` | MakeHuman eyebrow009 (eyebrows) (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/eyebrow010` | MakeHuman eyebrow010 (eyebrows) (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/eyebrow011` | MakeHuman eyebrow011 (eyebrows) (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/eyebrow012` | MakeHuman eyebrow012 (eyebrows) (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/fedora01` | MakeHuman fedora01 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/fedora_cocked` | MakeHuman fedora_cocked (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/female_casualsuit01` | MakeHuman female_casualsuit01 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/female_casualsuit02` | MakeHuman female_casualsuit02 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/female_elegantsuit01` | MakeHuman female_elegantsuit01 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/female_sportsuit01` | MakeHuman female_sportsuit01 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/long01` | MakeHuman long01 (hair) (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/male_casualsuit01` | MakeHuman male_casualsuit01 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/male_casualsuit02` | MakeHuman male_casualsuit02 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/male_casualsuit03` | MakeHuman male_casualsuit03 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/male_casualsuit04` | MakeHuman male_casualsuit04 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/male_casualsuit05` | MakeHuman male_casualsuit05 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/male_casualsuit06` | MakeHuman male_casualsuit06 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/male_elegantsuit01` | MakeHuman male_elegantsuit01 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/male_worksuit01` | MakeHuman male_worksuit01 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/ponytail01` | MakeHuman ponytail01 (hair) (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/shoes01` | MakeHuman shoes01 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/shoes02` | MakeHuman shoes02 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/shoes03` | MakeHuman shoes03 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/shoes04` | MakeHuman shoes04 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/shoes05` | MakeHuman shoes05 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/shoes06` | MakeHuman shoes06 (clothes) (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/short01` | MakeHuman short01 (hair) (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/short02` | MakeHuman short02 (hair) (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/short03` | MakeHuman short03 (hair) (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/short04` | MakeHuman short04 (hair) (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/teeth_base` | MakeHuman teeth_base (teeth) (modified) | teeth | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/tongue01` | MakeHuman tongue01 (tongue) (modified) | tongue | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MakeHuman (makehumancommunity.org) | [source](https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip) |
| `makehuman:proxy/elvs_crude_t-shirt_male` | elvs_crude_t-shirt_male by Elvaerwyn (top), from MakeHuman's shirts01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Elvaerwyn | [source](https://static.makehumancommunity.org/assets/assetpacks/shirts01.html) |
| `makehuman:proxy/joepal_crude_t-shirt_female` | joepal_crude_t-shirt_female by Joel Palmius (top), from MakeHuman's shirts01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Joel Palmius | [source](https://static.makehumancommunity.org/assets/assetpacks/shirts01.html) |
| `makehuman:proxy/toigo_bodice-style_top` | toigo_bodice-style_top by MargaretToigo (top), from MakeHuman's shirts01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MargaretToigo | [source](https://static.makehumancommunity.org/assets/assetpacks/shirts01.html) |
| `makehuman:proxy/toigo_fisherman_sweater` | toigo_fisherman_sweater by MargaretToigo (top), from MakeHuman's shirts01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MargaretToigo | [source](https://static.makehumancommunity.org/assets/assetpacks/shirts01.html) |
| `makehuman:proxy/toigo_wool_pants` | toigo_wool_pants by MargaretToigo (bottom), from MakeHuman's pants01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MargaretToigo | [source](https://static.makehumancommunity.org/assets/assetpacks/pants01.html) |
| `makehuman:proxy/cortu_cargo_pants` | cortu_cargo_pants by Cortu (bottom), from MakeHuman's pants01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Cortu | [source](https://static.makehumancommunity.org/assets/assetpacks/pants01.html) |
| `makehuman:proxy/cortu_jeans_shorts` | cortu_jeans_shorts by Cortu (bottom), from MakeHuman's pants01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Cortu | [source](https://static.makehumancommunity.org/assets/assetpacks/pants01.html) |
| `makehuman:proxy/toigo_suit_with_dinner_jacket` | toigo_suit_with_dinner_jacket by MargaretToigo (outfit), from MakeHuman's suits01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MargaretToigo | [source](https://static.makehumancommunity.org/assets/assetpacks/suits01.html) |
| `makehuman:proxy/matcreator_mc-bodysuit-2021` | matcreator_mc-bodysuit-2021 by MatCreator (bodysuit), from MakeHuman's suits02 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MatCreator | [source](https://static.makehumancommunity.org/assets/assetpacks/suits02.html) |
| `makehuman:proxy/toigo_flats` | toigo_flats by MargaretToigo (shoes), from MakeHuman's shoes01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MargaretToigo | [source](https://static.makehumancommunity.org/assets/assetpacks/shoes01.html) |
| `makehuman:proxy/cortu_t-bar` | cortu_t-bar by Cortu (shoes), from MakeHuman's shoes01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Cortu | [source](https://static.makehumancommunity.org/assets/assetpacks/shoes01.html) |
| `makehuman:proxy/toigo_mj_cloth_shoes` | toigo_mj_cloth_shoes by MargaretToigo (shoes), from MakeHuman's shoes01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MargaretToigo | [source](https://static.makehumancommunity.org/assets/assetpacks/shoes01.html) |
| `makehuman:proxy/toigo_gloves_short` | toigo_gloves_short by MargaretToigo (gloves), from MakeHuman's gloves01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | MargaretToigo | [source](https://static.makehumancommunity.org/assets/assetpacks/gloves01.html) |
| `makehuman:proxy/aethelraed_unraed_cloche_hat` | aethelraed_unraed_cloche_hat by Aethelraed_Unraed (hat), from MakeHuman's hats01 asset pack (modified) | garment | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Aethelraed_Unraed | [source](https://static.makehumancommunity.org/assets/assetpacks/hats01.html) |

### Monk Skin Tone Scale

| Asset | What | Kind | Licence | Author | Source |
| --- | --- | --- | --- | --- | --- |
| `monk:skin-tone/monk-skin-tone-scale` | Monk Skin Tone Scale (the ten tones the skin dial runs through) (modified) | skin-tone | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | Dr. Ellis Monk and Google | [source](https://skintone.google) |

> **Credit:** Monk Skin Tone Scale by Dr. Ellis Monk and Google (https://skintone.google), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Dramatis interpolates between its ten tones.

### tonio

| Asset | What | Kind | Licence | Author | Source |
| --- | --- | --- | --- | --- | --- |
| `tonio:eye/basic` | Eye texture, basic (the iris recoloured to the character's) (modified) | texture | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Tonio Loewald | [source](https://cdn.tosijs.net/tonio/eyes/basic-eye.svg) |
| `tonio:eye/anime` | Eye texture, anime (the iris recoloured to the character's) (modified) | texture | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Tonio Loewald | [source](https://cdn.tosijs.net/tonio/eyes/anime-eye.svg) |

### Quaternius

| Asset | What | Kind | Licence | Author | Source |
| --- | --- | --- | --- | --- | --- |
| `quaternius:skeleton/ual` | Universal Animation Library's 65-joint skeleton: names, hierarchy and joint frames (every export's skeleton) | other | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalanimationlibrary.html) |
| `quaternius:animation/ual1` | Universal Animation Library, volume 1 (animation clips) (modified) | animation | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalanimationlibrary.html) |
| `quaternius:hair/eyebrows_female` | Quaternius Eyebrows_Female, with its hair textures (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/eyebrows_regular` | Quaternius Eyebrows_Regular, with its hair textures (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/eyebrows_regular_teen` | Quaternius Eyebrows_Regular_Teen, with its hair textures (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/eyebrows_teen` | Quaternius Eyebrows_Teen, with its hair textures (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/eyebrows_thick` | Quaternius Eyebrows_Thick, with its hair textures (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/eyebrows_thick_teen` | Quaternius Eyebrows_Thick_Teen, with its hair textures (modified) | brows | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_balding` | Quaternius Hair_Balding, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_balding_teen` | Quaternius Hair_Balding_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_beard` | Quaternius Hair_Beard, with its hair textures (modified) | beard | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_beard_teen` | Quaternius Hair_Beard_Teen, with its hair textures (modified) | beard | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_bob` | Quaternius Hair_Bob, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_bob_teen` | Quaternius Hair_Bob_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_buns` | Quaternius Hair_Buns, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_buns_teen` | Quaternius Hair_Buns_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_buzzed` | Quaternius Hair_Buzzed, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_buzzedfemale` | Quaternius Hair_BuzzedFemale, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_buzzedfemale_teen` | Quaternius Hair_BuzzedFemale_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_buzzed_teen` | Quaternius Hair_Buzzed_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_dreads` | Quaternius Hair_Dreads, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_dreads_teen` | Quaternius Hair_Dreads_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_long` | Quaternius Hair_Long, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_longdreads` | Quaternius Hair_LongDreads, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_longdreads_teen` | Quaternius Hair_LongDreads_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_long_teen` | Quaternius Hair_Long_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_mohawk` | Quaternius Hair_Mohawk, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_mohawk_teen` | Quaternius Hair_Mohawk_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_moustache` | Quaternius Hair_Moustache, with its hair textures (modified) | beard | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_moustache_teen` | Quaternius Hair_Moustache_Teen, with its hair textures (modified) | beard | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_muttonchops` | Quaternius Hair_MuttonChops, with its hair textures (modified) | beard | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_muttonchops_teen` | Quaternius Hair_MuttonChops_Teen, with its hair textures (modified) | beard | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_ponytail` | Quaternius Hair_Ponytail, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_ponytail_2` | Quaternius Hair_Ponytail_2, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_ponytail_2_teen` | Quaternius Hair_Ponytail_2_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_ponytail_teen` | Quaternius Hair_Ponytail_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_simpleparted` | Quaternius Hair_SimpleParted, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_simpleparted_teen` | Quaternius Hair_SimpleParted_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_slickback` | Quaternius Hair_SlickBack, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/hair_slickback_teen` | Quaternius Hair_SlickBack_Teen, with its hair textures (modified) | hair | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/reference_head_female` | Quaternius Reference_Head_Female (the head the hair is fitted from) (modified) | other | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:hair/reference_head_male` | Quaternius Reference_Head_Male (the head the hair is fitted from) (modified) | other | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:base/superhero_male` | Quaternius Superhero_Male_FullBody (a body besides MakeHuman) | base | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |
| `quaternius:base/superhero_female` | Quaternius Superhero_Female_FullBody (a body besides MakeHuman) | base | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Quaternius | [source](https://quaternius.com/packs/universalbasecharacters.html) |

### Blender Studio

| Asset | What | Kind | Licence | Author | Source |
| --- | --- | --- | --- | --- | --- |
| `blender:base/body-female-realistic` | Blender Human Base Meshes v1.4.1, realistic female body (a body besides MakeHuman) (modified) | base | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Blender Studio and community contributors (Blender Foundation) | [source](https://www.blender.org/download/demo-files/#assets) |
| `blender:base/body-male-realistic` | Blender Human Base Meshes v1.4.1, realistic male body (a body besides MakeHuman) (modified) | base | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Blender Studio and community contributors (Blender Foundation) | [source](https://www.blender.org/download/demo-files/#assets) |

### Community assets: unchecked, excluded

What each one's pack declares is shown as declared, not as checked. None of these ships or exports until a person has checked it and it moves into the manifest.

| Asset | Kind | Pack | Declared licence | Declared author | Page |
| --- | --- | --- | --- | --- | --- |
| `makehuman:proxy/cortu_floppy_overknee_shoes` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | Cortu | [page](http://www.makehumancommunity.org/node/2803) |
| `makehuman:proxy/culturalibre_doc_ock_glasses` | garment | [glasses01](https://files.makehumancommunity.org/asset_packs/glasses01/glasses01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2378) |
| `makehuman:proxy/culturalibre_faun_beard` | beard | [bodyparts05](https://files.makehumancommunity.org/asset_packs/bodyparts05/bodyparts05_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2356) |
| `makehuman:proxy/culturalibre_hero-heroine_gloves_1` | garment | [gloves01](https://files.makehumancommunity.org/asset_packs/gloves01/gloves01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2074) |
| `makehuman:proxy/culturalibre_hero-heroine_gloves_2` | garment | [gloves01](https://files.makehumancommunity.org/asset_packs/gloves01/gloves01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2093) |
| `makehuman:proxy/culturalibre_hero-heroine_gloves_3` | garment | [gloves01](https://files.makehumancommunity.org/asset_packs/gloves01/gloves01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2193) |
| `makehuman:proxy/culturalibre_hero-heroine_gloves_4` | garment | [gloves01](https://files.makehumancommunity.org/asset_packs/gloves01/gloves01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2333) |
| `makehuman:proxy/culturalibre_hero-heroine_gloves_5` | garment | [gloves01](https://files.makehumancommunity.org/asset_packs/gloves01/gloves01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2401) |
| `makehuman:proxy/culturalibre_hero-heroine_hood_1` | garment | [masks01](https://files.makehumancommunity.org/asset_packs/masks01/masks01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2100) |
| `makehuman:proxy/culturalibre_hero-heroine_hood_2` | garment | [masks01](https://files.makehumancommunity.org/asset_packs/masks01/masks01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2309) |
| `makehuman:proxy/culturalibre_hero_boots_1` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2081) |
| `makehuman:proxy/culturalibre_hero_boots_2` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2132) |
| `makehuman:proxy/culturalibre_hero_boots_3` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2138) |
| `makehuman:proxy/culturalibre_hero_boots_4` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2167) |
| `makehuman:proxy/culturalibre_hero_boots_5` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2424) |
| `makehuman:proxy/culturalibre_hero_mask_1` | garment | [masks01](https://files.makehumancommunity.org/asset_packs/masks01/masks01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2055) |
| `makehuman:proxy/culturalibre_hero_mask_2` | garment | [masks01](https://files.makehumancommunity.org/asset_packs/masks01/masks01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2049) |
| `makehuman:proxy/culturalibre_hero_mask_3` | garment | [masks01](https://files.makehumancommunity.org/asset_packs/masks01/masks01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2202) |
| `makehuman:proxy/culturalibre_hero_mask_4` | garment | [masks01](https://files.makehumancommunity.org/asset_packs/masks01/masks01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2220) |
| `makehuman:proxy/culturalibre_hero_mask_5` | garment | [masks01](https://files.makehumancommunity.org/asset_packs/masks01/masks01_cc0.zip) | CC-BY | culturalibre | [page](http://www.makehumancommunity.org/node/2396) |
| `makehuman:proxy/culturalibre_hero_suit_1` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2061) |
| `makehuman:proxy/culturalibre_hero_suit_2` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2292) |
| `makehuman:proxy/culturalibre_hero_suit_3` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2308) |
| `makehuman:proxy/culturalibre_heroine_boots_1` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2155) |
| `makehuman:proxy/culturalibre_heroine_boots_2` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2181) |
| `makehuman:proxy/culturalibre_heroine_boots_3` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2187) |
| `makehuman:proxy/culturalibre_heroine_boots_4` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC-BY | culturalibre | [page](http://www.makehumancommunity.org/node/2464) |
| `makehuman:proxy/culturalibre_heroine_mask_1` | garment | [masks01](https://files.makehumancommunity.org/asset_packs/masks01/masks01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2474) |
| `makehuman:proxy/culturalibre_heroine_suit_2` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2317) |
| `makehuman:proxy/culturalibre_male_boots` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2548) |
| `makehuman:proxy/culturalibre_motorcycle_helmet` | garment | [hats02](https://files.makehumancommunity.org/asset_packs/hats02/hats02_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2025) |
| `makehuman:proxy/culturalibre_skull_helmet` | garment | [hats02](https://files.makehumancommunity.org/asset_packs/hats02/hats02_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2349) |
| `makehuman:proxy/culturalibre_warrior_helmet` | garment | [hats02](https://files.makehumancommunity.org/asset_packs/hats02/hats02_cc0.zip) | CC0 | culturalibre | [page](http://www.makehumancommunity.org/node/2351) |
| `makehuman:proxy/donitz_monk_robe` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | Donitz | [page](http://www.makehumancommunity.org/node/3238) |
| `makehuman:proxy/donitz_monk_robe_hood` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | Donitz | [page](http://www.makehumancommunity.org/node/3235) |
| `makehuman:proxy/donitz_monk_robe_hood_down` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | Donitz | [page](http://www.makehumancommunity.org/node/3236) |
| `makehuman:proxy/donitz_monk_robe_hood_off` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | Donitz | [page](http://www.makehumancommunity.org/node/3237) |
| `makehuman:proxy/ews_3d_glasses` | garment | [glasses01](https://files.makehumancommunity.org/asset_packs/glasses01/glasses01_cc0.zip) | CC0 | EWS | [page](http://www.makehumancommunity.org/node/1233) |
| `makehuman:proxy/frankyaye_glasses_library_male` | garment | [glasses01](https://files.makehumancommunity.org/asset_packs/glasses01/glasses01_cc0.zip) | CC0 | frankyaye | [page](http://www.makehumancommunity.org/node/153) |
| `makehuman:proxy/frankyaye_mini_skirt_01` | garment | [skirts01](https://files.makehumancommunity.org/asset_packs/skirts01/skirts01_cc0.zip) | CC0 | frankyaye | [page](http://www.makehumancommunity.org/node/129) |
| `makehuman:proxy/frankyaye_mini_skirt_02` | garment | [skirts01](https://files.makehumancommunity.org/asset_packs/skirts01/skirts01_cc0.zip) | CC0 | frankyaye | [page](http://www.makehumancommunity.org/node/131) |
| `makehuman:proxy/green_tomato_rei_ayanami` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | green_tomato | [page](http://www.makehumancommunity.org/node/3239) |
| `makehuman:proxy/green_tomato_yoko_tsuno` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | green_tomato | [page](http://www.makehumancommunity.org/node/3228) |
| `makehuman:proxy/grinsegold_beard_sigmund_wip` | beard | [bodyparts05](https://files.makehumancommunity.org/asset_packs/bodyparts05/bodyparts05_cc0.zip) | CC0 | grinsegold | [page](http://www.makehumancommunity.org/node/877) |
| `makehuman:proxy/grinsegold_corinthian_helmet` | garment | [hats02](https://files.makehumancommunity.org/asset_packs/hats02/hats02_cc0.zip) | CC0 | grinsegold | [page](http://www.makehumancommunity.org/node/667) |
| `makehuman:proxy/grinsegold_female_pirate_boots` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | grinsegold | [page](http://www.makehumancommunity.org/node/211) |
| `makehuman:proxy/grinsegold_uncle_joshis_hat` | garment | [hats01](https://files.makehumancommunity.org/asset_packs/hats01/hats01_cc0.zip) | CC0 | grinsegold | [page](http://www.makehumancommunity.org/node/193) |
| `makehuman:proxy/javherre_casco_caballero_templario_templar_knight_helmet` | garment | [hats02](https://files.makehumancommunity.org/asset_packs/hats02/hats02_cc0.zip) | CC0 | javherre | [page](http://www.makehumancommunity.org/node/2014) |
| `makehuman:proxy/joachip_cyborg_suit` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | joachip | [page](http://www.makehumancommunity.org/node/3204) |
| `makehuman:proxy/joepal_medical_mouth_protection` | garment | [masks01](https://files.makehumancommunity.org/asset_packs/masks01/masks01_cc0.zip) | CC0 | Joel Palmius | [page](http://www.makehumancommunity.org/node/2369) |
| `makehuman:proxy/joepal_xmas_cap` | garment | [hats01](https://files.makehumancommunity.org/asset_packs/hats01/hats01_cc0.zip) | CC0 | Joel Palmius | [page](http://www.makehumancommunity.org/node/520) |
| `makehuman:proxy/jujube_bag_on_head` | garment | [hats01](https://files.makehumancommunity.org/asset_packs/hats01/hats01_cc0.zip) | CC0 | jujube | [page](http://www.makehumancommunity.org/node/578) |
| `makehuman:proxy/jujube_newsboy_cap` | garment | [hats01](https://files.makehumancommunity.org/asset_packs/hats01/hats01_cc0.zip) | CC0 | jujube | [page](http://www.makehumancommunity.org/node/78) |
| `makehuman:proxy/kwnet_at_optical_glasses` | garment | [glasses01](https://files.makehumancommunity.org/asset_packs/glasses01/glasses01_cc0.zip) | CC0 | kwnet_at | [page](http://www.makehumancommunity.org/node/928) |
| `makehuman:proxy/learning_mma_fighting_gloves` | garment | [gloves01](https://files.makehumancommunity.org/asset_packs/gloves01/gloves01_cc0.zip) | CC0 | learning | [page](http://www.makehumancommunity.org/node/95) |
| `makehuman:proxy/matcreator_mc-scifi-armor_guardian` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | MatCreator | [page](http://www.makehumancommunity.org/node/2880) |
| `makehuman:proxy/matcreator_mc-scifi-armor_helios` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | MatCreator | [page](http://www.makehumancommunity.org/node/2881) |
| `makehuman:proxy/matcreator_mc-scifi-armor_jupiter7` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | MatCreator | [page](http://www.makehumancommunity.org/node/2882) |
| `makehuman:proxy/matcreator_mc-skinsuit_2022` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | MatCreator | [page](http://www.makehumancommunity.org/node/2991) |
| `makehuman:proxy/mrgreaterthan_m1_helmet` | garment | [hats02](https://files.makehumancommunity.org/asset_packs/hats02/hats02_cc0.zip) | CC0 | MrGreaterThan | [page](http://www.makehumancommunity.org/node/2697) |
| `makehuman:proxy/namuhekam_male_polo_shirt` | garment | [shirts01](https://files.makehumancommunity.org/asset_packs/shirts01/shirts01_cc0.zip) | CC0 | namuhekam | [page](http://www.makehumancommunity.org/node/2909) |
| `makehuman:proxy/rehmanpolanski_beard_viking` | beard | [bodyparts05](https://files.makehumancommunity.org/asset_packs/bodyparts05/bodyparts05_cc0.zip) | CC0 | RehmanPolanski | [page](http://www.makehumancommunity.org/node/2614) |
| `makehuman:proxy/rehmanpolanski_moustache_viking` | beard | [bodyparts05](https://files.makehumancommunity.org/asset_packs/bodyparts05/bodyparts05_cc0.zip) | CC0 | RehmanPolanski | [page](http://www.makehumancommunity.org/node/2615) |
| `makehuman:proxy/rehmanpolanski_viking_boots` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | RehmanPolanski | [page](http://www.makehumancommunity.org/node/2619) |
| `makehuman:proxy/rehmanpolanski_viking_pants` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | RehmanPolanski | [page](http://www.makehumancommunity.org/node/2618) |
| `makehuman:proxy/rehmanpolanski_viking_tunic` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | RehmanPolanski | [page](http://www.makehumancommunity.org/node/2617) |
| `makehuman:proxy/scailman_gogo_platform_boots` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | scailman | [page](http://www.makehumancommunity.org/node/1467) |
| `makehuman:proxy/scailman_semitransparent_water_boots` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | scailman | [page](http://www.makehumancommunity.org/node/1778) |
| `makehuman:proxy/skalldyrssuppe_tube_top_funky_colors` | garment | [shirts01](https://files.makehumancommunity.org/asset_packs/shirts01/shirts01_cc0.zip) | CC0 | skalldyrssuppe | [page](http://www.makehumancommunity.org/node/975) |
| `makehuman:proxy/slayer227_spider-gwen` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | Slayer227 | [page](http://www.makehumancommunity.org/node/2977) |
| `makehuman:proxy/spamrakuen_sagerfrogs_glasses_01` | garment | [glasses01](https://files.makehumancommunity.org/asset_packs/glasses01/glasses01_cc0.zip) | CC0 | spamrakuen | [page](http://www.makehumancommunity.org/node/3331) |
| `makehuman:proxy/spamrakuen_sagerfrogs_glasses_02` | garment | [glasses01](https://files.makehumancommunity.org/asset_packs/glasses01/glasses01_cc0.zip) | CC0 | spamrakuen | [page](http://www.makehumancommunity.org/node/3332) |
| `makehuman:proxy/spamrakuen_sagerfrogs_glasses_03` | garment | [glasses01](https://files.makehumancommunity.org/asset_packs/glasses01/glasses01_cc0.zip) | CC0 | spamrakuen | [page](http://www.makehumancommunity.org/node/3333) |
| `makehuman:proxy/spamrakuen_sagerfrogs_glasses_04` | garment | [glasses01](https://files.makehumancommunity.org/asset_packs/glasses01/glasses01_cc0.zip) | CC0 | spamrakuen | [page](http://www.makehumancommunity.org/node/3334) |
| `makehuman:proxy/spamrakuen_tbm_glasses_frames_01` | garment | [glasses01](https://files.makehumancommunity.org/asset_packs/glasses01/glasses01_cc0.zip) | CC0 | spamrakuen | [page](http://www.makehumancommunity.org/node/3330) |
| `makehuman:proxy/thegreatengineer_galactic_warrior_uniform` | garment | [suits02](https://files.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip) | CC0 | TheGreatEngineer | [page](http://www.makehumancommunity.org/node/2884) |
| `makehuman:proxy/toigo_ankle_boots_female` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1738) |
| `makehuman:proxy/toigo_ankle_boots_male` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1743) |
| `makehuman:proxy/toigo_ballet_flats` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1734) |
| `makehuman:proxy/toigo_ballet_flats_with_bows` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1735) |
| `makehuman:proxy/toigo_ballet_flats_with_flowers` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1736) |
| `makehuman:proxy/toigo_basic_tucked_t-shirt` | garment | [shirts01](https://files.makehumancommunity.org/asset_packs/shirts01/shirts01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1203) |
| `makehuman:proxy/toigo_camisole_top` | garment | [shirts01](https://files.makehumancommunity.org/asset_packs/shirts01/shirts01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1726) |
| `makehuman:proxy/toigo_female_double-breasted_suit` | garment | [suits01](https://files.makehumancommunity.org/asset_packs/suits01/suits01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1742) |
| `makehuman:proxy/toigo_female_suit` | garment | [suits01](https://files.makehumancommunity.org/asset_packs/suits01/suits01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1324) |
| `makehuman:proxy/toigo_female_suit_2` | garment | [suits01](https://files.makehumancommunity.org/asset_packs/suits01/suits01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1739) |
| `makehuman:proxy/toigo_gloves_long` | garment | [gloves01](https://files.makehumancommunity.org/asset_packs/gloves01/gloves01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1850) |
| `makehuman:proxy/toigo_gloves_medium` | garment | [gloves01](https://files.makehumancommunity.org/asset_packs/gloves01/gloves01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1851) |
| `makehuman:proxy/toigo_harem_pants` | garment | [pants01](https://files.makehumancommunity.org/asset_packs/pants01/pants01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1728) |
| `makehuman:proxy/toigo_keyhole_tank_top` | garment | [shirts01](https://files.makehumancommunity.org/asset_packs/shirts01/shirts01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1606) |
| `makehuman:proxy/toigo_long_full_skirt` | garment | [skirts01](https://files.makehumancommunity.org/asset_packs/skirts01/skirts01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1727) |
| `makehuman:proxy/toigo_male_double-breasted_suit` | garment | [suits01](https://files.makehumancommunity.org/asset_packs/suits01/suits01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1740) |
| `makehuman:proxy/toigo_male_suit_3` | garment | [suits01](https://files.makehumancommunity.org/asset_packs/suits01/suits01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1733) |
| `makehuman:proxy/toigo_male_suit_tie_and_jacket` | garment | [suits01](https://files.makehumancommunity.org/asset_packs/suits01/suits01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1265) |
| `makehuman:proxy/toigo_round_glasses_leopard` | garment | [glasses01](https://files.makehumancommunity.org/asset_packs/glasses01/glasses01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1070) |
| `makehuman:proxy/toigo_skirt_with_lace_ruffle` | garment | [skirts01](https://files.makehumancommunity.org/asset_packs/skirts01/skirts01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1731) |
| `makehuman:proxy/toigo_stiletto_booties` | garment | [shoes01](https://files.makehumancommunity.org/asset_packs/shoes01/shoes01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1694) |
| `makehuman:proxy/toigo_suit_with_jacket_and_bowtie` | garment | [suits01](https://files.makehumancommunity.org/asset_packs/suits01/suits01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1317) |
| `makehuman:proxy/toigo_tiered_mini_skirt` | garment | [skirts01](https://files.makehumancommunity.org/asset_packs/skirts01/skirts01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1668) |
| `makehuman:proxy/toigo_tiered_skirt` | garment | [skirts01](https://files.makehumancommunity.org/asset_packs/skirts01/skirts01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1641) |
| `makehuman:proxy/toigo_turtleneck_halter_top` | garment | [shirts01](https://files.makehumancommunity.org/asset_packs/shirts01/shirts01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1642) |
| `makehuman:proxy/wdg_scruffy_beard` | beard | [bodyparts05](https://files.makehumancommunity.org/asset_packs/bodyparts05/bodyparts05_cc0.zip) | CC0 | WDG | [page](http://www.makehumancommunity.org/node/1769) |
| `makehuman:look/male_casualsuit01/khaki` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/996) |
| `makehuman:look/male_casualsuit01/purple_shirt` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/999) |
| `makehuman:look/male_casualsuit01/purple_shirt_with_black_jeans` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/998) |
| `makehuman:look/male_casualsuit01/red_shirt_with_black_jeans` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/997) |
| `makehuman:look/male_casualsuit01/teal_shirt_with_black_jeans` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1001) |
| `makehuman:look/male_casualsuit01/white_shirt` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1002) |
| `makehuman:look/male_casualsuit01/yellow_shirt` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/1004) |
| `makehuman:look/male_elegantsuit01/blue_pinstripe_with_paisley_tie` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/990) |
| `makehuman:look/male_elegantsuit01/blue_with_red_striped_tie` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/983) |
| `makehuman:look/male_elegantsuit01/brown` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/984) |
| `makehuman:look/male_elegantsuit01/burgundy` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/985) |
| `makehuman:look/male_elegantsuit01/eggplant` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/986) |
| `makehuman:look/male_elegantsuit01/gray` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/987) |
| `makehuman:look/male_elegantsuit01/gray_pinstripe_with_paisley_tie` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/989) |
| `makehuman:look/male_elegantsuit01/olive` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/988) |
| `makehuman:look/male_elegantsuit01/teal` | texture | [clothes_materials01](https://files.makehumancommunity.org/asset_packs/system_clothes_materials01/system_clothes_materials01_cc0.zip) | CC0 | MargaretToigo | [page](http://www.makehumancommunity.org/node/991) |

<!-- /manifest -->

### The site itself

Not part of any character, and never exported: the creator's floor
(`site/static/creator-ground.svg`) is tosijs-3d's `tosi-warhol-testgrid.svg`,
toned down, under tosijs-3d's licence (Apache-2.0, Tonio Loewald). The
Dramatis icon (`site/static/icon.svg`, `favicon.svg`, `logo.svg`, and `apple-touch-icon.png` rendered
from it) is Tonio Loewald's, and so is the home page's engraving of a stage
company (`site/static/art/`).

## Keeping it true

`src/licences/packs.ts` is a snapshot of every asset the creator's packs
reference (MakeHuman's hm08 pack, its looks and parts, and Quaternius's hair
library), written by `bun src/licences/scan-packs.ts` from a static-assets
checkout. The tests fail when:

- an asset in the snapshot is neither in the manifest nor listed as an
  unchecked community asset;
- the pack the creator loads (static-assets, else the CDN) references an
  asset the snapshot lacks;
- this page is out of date (`bun src/licences/write-page.ts` rewrites it).

## Share links

A share link is the whole character in the URL: its
[character file](/dramatis-core/) (`tosijs-character`, JSON) compressed with
raw DEFLATE (fflate, level 9), written base64url, in the fragment:

```
https://dramatis.tosijs.net/creator/#c=1.<payload>
```

The fragment never reaches a server, so a shared character is never uploaded
anywhere. Reading one runs the file through tosijs-3d's `readCharacter`, which
is versioned and migrates an older file forward: a setting the page does not
have is skipped, one of the wrong type keeps its default, and each is listed
in `warnings`.

```javascript
import { BUILD_SETTINGS, encodeShareLink, decodeShareLink } from 'dramatis'

const { url, dropped } = encodeShareLink(character)
const { character, warnings } = decodeShareLink(location.href, {
  settings: BUILD_SETTINGS,
})
```

**What a link leaves out**, because the bytes do not fit in a URL: garments
of your own, the tailor's outlines in progress, and a body opened from a file.
Each is listed in `dropped`; save the character as a file to keep them. A
link that does carry them (it was not made here) has them skipped on read.

**What is refused:** anything that is not `c=<version>.<base64url>`, a link
version newer than the page, bytes that are not DEFLATE, a payload that
inflates past 256 KB (a deflate bomb is stopped before it is parsed), text
that is not UTF-8 JSON, and a document that `readCharacter` refuses.

### How long a link is (measured)

Measured by `src/share/share.test.ts` at tosijs-3d 0.11.6, with every setting
the character builder has:

| Character | JSON | Link |
| --- | --- | --- |
| Typical: sliders moved, four garments, fabric recipes | 2,441 bytes | 1,004 characters |
| Everything worn: all ten slots, beard and moustache, each slot recoloured | | 1,268 characters |

The **budget is 8,000 characters**, fragment included (`SHARE_LINK_BUDGET`).
A character over it is an error, never a truncated link. The test pins that
by filling a character with incompressible settings until it passes the
budget. A real character reaches it only through large per-mesh rig recipes
or surface choices on a body besides MakeHuman's; then save it as a file.

Not measured here: how long a URL each browser, chat app or QR reader
accepts. The budget is the contract's choice; a check on real clients is
still to do.
