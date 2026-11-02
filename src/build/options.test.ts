import { describe, expect, test } from 'bun:test'
import type { Character } from 'tosijs-3d/character-file'
import type { HumanPack } from 'tosijs-3d/human-pack'
import { buildCharacter, exportCharacterGlb, writeCharacterGlb } from '.'
import type { BuiltCharacter } from '../contracts/built-character'
import type { NamingProfile, RestPose } from '../contracts/profile'
import { jointName } from '../contracts/profile'

/*
A MISTYPED EXPORT OPTION IS AN ERROR, pinned (reviews/0.1.0-pre-minor.md:
'T-Pose' was built in the source pose, 'UE' wrote Mixamo names). Each option
is checked before anything is built or written, so no pack is needed: with
the check gone, these calls fail on the empty pack or the empty built
character instead, with another message.
*/

const character: Character = {
  name: 'nobody',
  settings: {},
  cloth: {},
  tailor: [],
  garments: {},
}
const pack = {} as HumanPack
const built = { licences: [] } as unknown as BuiltCharacter

describe('export options', () => {
  test("restPose: 'T-Pose' is refused, naming the allowed values", async () => {
    const restPose = 'T-Pose' as RestPose
    const why = /restPose must be 't-pose' or 'source', not "T-Pose"/
    await expect(buildCharacter(character, pack, { restPose })).rejects.toThrow(
      why
    )
    await expect(
      exportCharacterGlb(character, pack, { restPose })
    ).rejects.toThrow(why)
  })

  test("naming: 'UE' is refused, naming the allowed values", async () => {
    const naming = 'UE' as NamingProfile
    const why = /naming must be 'ue' or 'mixamo', not "UE"/
    expect(() => writeCharacterGlb(built, { naming })).toThrow(why)
    await expect(
      exportCharacterGlb(character, pack, { naming })
    ).rejects.toThrow(why)
    expect(() => jointName('pelvis', naming)).toThrow(why)
  })
})
