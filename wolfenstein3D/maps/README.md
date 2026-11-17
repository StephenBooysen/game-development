# Maps

Each `.map` file in this folder is one map. The game plays them in file-name order,
so start the name with a number: `01-cell-block.map`, `02-the-armory.map`, ...

To add a map, copy one of these files, give it a new number and edit it. Reload the
page in the browser to play it (no restart needed). `npm test` checks every map in
this folder: a closed outer wall, a reachable key and exit, and so on.

You can also draw a map in the map editor (`/editor.html`) and press
"Download .map file".

## The format

```
// Lines starting with two slashes are comments.
name: The Catacombs
facing: east
ceiling: #1f2a1d
floor: #4a3f30
ceiling texture: rock
floor texture: dirt

@@@@@@@@
@P...kX@
@@@@@@@@
```

Lines with a colon are settings. Every other line is one row of tiles, and all rows
must be the same width. Only the rows are required.

| Setting | Meaning | Default |
|---|---|---|
| `name` | Shown when the map starts | from the file name |
| `facing` | Which way the player looks at the start: `east`, `south`, `west` or `north` | `east` |
| `ceiling`, `floor` | Flat colours, like `#3a3a3a` | grey |
| `ceiling texture`, `floor texture` | Patterns from `public/floors.js`: `plaster`, `flagstone`, `panels`, `tiles`, `rock`, `dirt` | none |

## Tiles

| Tile | Meaning |
|---|---|
| `.` | Floor |
| `P` | Player start (exactly one) |
| `#` `=` `%` `&` `@` `F` | Walls: stone, blue stone, wood, brick, moss, stone with a banner |
| `X` | The exit switch |
| `D` | Door (put it between two walls) |
| `L` | Locked door: needs the gold key |
| `$` | Secret push-wall: looks like the wall next to it |
| `G` `R` `S` `B` `H` | Guard, patrolling guard, SS officer, boss, guard dog |
| `h` `f` `a` | First aid kit, hot meal, ammo |
| `m` `c` | Machine gun, chaingun |
| `k` `t` `u` | Gold key, treasure, extra life |
| `o` `i` `l` | Barrel, pillar (both block you), lamp |
