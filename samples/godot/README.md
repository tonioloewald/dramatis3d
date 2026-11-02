# samples/godot

A Godot 4.5 project: a Dramatis export walking with Quaternius' UAL
`Walk_Loop` (CC0), and the headless check spike 1 runs on every export
(`reports/spike-1.md`).

```sh
bun tools/engines/godot.ts                         # import + check, headless
bun tools/engines/godot.ts --render reports/spike-1 # also render a frame each
```

The runner copies `samples/out/*.glb` into `characters/`, runs
`Godot --headless --import`, then `Godot --headless --script
res://scripts/check.gd`, which writes its results as JSON for the runner to
print. `GODOT=/path/to/Godot` overrides the binary.

To look: run the command above once (it fills `characters/`), open the
project in Godot 4.5 and press Play. `main.tscn` walks the first character;
`Godot --path samples/godot -- long-hair.glb` picks another.

| Path | What |
| --- | --- |
| `scripts/main.gd` | The sample: the default glTF import of a character, UAL's clip pointed at its `Skeleton3D` by bone name. This is all a Godot user needs. |
| `scripts/check.gd` | The check: skeleton, axes, skins, rest skinning (CPU), blend shapes, materials, and the clip moving bones and skin. |
| `animations/ual-walk.glb` | UAL `Walk_Loop`, cut from `UAL1.glb` (Quaternius, **CC0 1.0**). The same file as `test/gate1/fixtures/ual-walk.glb`. |
| `animations/ual-walk.glb.import` | One non-default setting: `remove_immutable_tracks=false`, so tracks that hold a joint still are kept (see the guide). |

Nothing in a character's import is changed from Godot's defaults.
