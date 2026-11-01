# Dramatis core

<!--{"parent": "docs", "order": 1}-->

The engine-free core API: no DOM, no Babylon, no three.js. Everything here runs
under plain Bun or Node and in any browser bundle.

Dramatis keeps **one character file**, `tosijs-character`, and reads and writes
it through tosijs-3d's `character-file` module. This entry re-exports that
module rather than wrapping it, so there is one implementation and one format.

```ts
import { writeCharacter, readCharacter, CHARACTER_FORMAT } from 'dramatis'
```

This entry is thin on purpose for now. What grows here is what Dramatis itself
owns (export options, the licence manifest, share links), never a copy of
tosijs-3d's character system.
