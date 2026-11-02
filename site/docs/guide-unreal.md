# Unreal Engine 5

<!--{"parent": "docs", "order": 24}-->

**Not yet verified in Unreal.** Unreal 5 is spike 1's secondary target;
this page is the procedure to run and record, written before anyone has
run it (`reports/spike-1.md`).

## Why it should be easy

The skeleton uses **UE mannequin names** as Quaternius' Universal
Animation Library spells them (`root`, `pelvis`, `spine_01..03`, `neck_01`,
`Head`, `clavicle_l`, `upperarm_l`, ...). That is the UE4 mannequin's
layout. UE5's Manny has two more spine joints (`spine_04`, `spine_05`) and
different proportions, so UE5 animations still go through the IK
Retargeter, but its auto-mapping recognises the names.

## Import (UE 5.3 or later, Interchange)

1. Drag the `.glb` into the Content Browser. Unreal's Interchange glTF
   importer opens.
2. Mesh: **Skeletal Mesh** on; **Import Morph Targets** on; **Create new
   skeleton** (the first time; later Dramatis characters can share it,
   since every export has the same 65 joints).
3. Leave scale at 1: glTF is in metres and Interchange converts to
   centimetres and to Z-up.
4. Import. Check:
   - the Skeleton has 65 bones, `root` at the top, with the names above;
   - the Skeletal Mesh has all the parts as sections or as separate
     skeletal meshes, depending on the import's *Combine* setting;
   - **Morph Targets** lists the 59 face units (`JawDrop`, ...);
   - the character stands on the floor, facing +X (Unreal's forward) or
     +Y; record which.

## A third-party animation

**UAL directly.** Import `UAL1.glb` (Quaternius, CC0) the same way,
choosing the Dramatis skeleton as its skeleton (or importing its own and
marking the two **Compatible Skeletons** in the Skeleton editor). The
joints and their rest frames are the same, so its clips should play on the
character with no retargeting. Record whether the root's -90° X rotation
(UAL's, which the export copies) comes through without a turn.

**UE5 Manny clips.** Make an IK Rig for the Dramatis skeleton (*Auto Create
Retarget Chains*, then *Auto Create IK*, in 5.4+), and an IK Retargeter from
`IK_Mannequin` to it. Export a few Manny animations (walk, idle) and check
the feet stay on the floor.

## What to record

For the report, per step: what ran, what had to be changed by hand (that
is a failure of "no manual fixes"), and a screenshot of the walk at mid
stride with clothing.
