# The Unity Web player (built, then committed)

`bun tools/engines/unity.ts --web` builds `samples/unity` for the Web and
copies the result here (`Build/player.*`). The site ships this folder at
`/unity/player/`; site/unity/main.ts loads it. Until it is built, /unity/
says so and points at the three.js demo.
