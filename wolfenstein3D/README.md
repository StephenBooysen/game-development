# Castle Noobenstein

A Wolfenstein 3D style shooter that runs in the browser, served by a small Express app.
It uses the same trick as the 1992 original, **ray casting**, with a classic first-person
view, a centred crosshair and animated weapons. The camera always stays at your soldier's eyes.

There are no image or sound files and no libraries besides Express. Every wall texture,
sprite and sound effect is generated in code.

## Run it

```
npm install
npm start        # http://localhost:3000  (PORT=4000 npm start for another port)
npm test         # offline tests, no browser needed
```

## The level

One level made of three maps, joined by elevators. Health, bullets, guns and lives carry over.

1. **Cell Block**: break out of your cell, find the machine gun in the storage room and
   the gold key in the officers' room, then unlock the way to the elevator.
2. **The Armory**: tougher officers, a chaingun to find, and a boss guarding the exit.
3. **The Catacombs**: mossy tunnels full of guard dogs.

Every map hides one secret room behind a wall that looks like any other. The title screen
can also start you on map 2 or 3, choose the difficulty, show the high scores and open the
map editor.

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Move and sidestep |
| Mouse, `←` `→` | Turn (click the game to capture the mouse, `Esc` to release it) |
| Click, `Space` | Fire |
| `E` | Open doors, push secret walls, press the elevator switch |
| `Shift` | Run (guards find a running target harder to hit) |
| `1` `2` `3` `4`, `Q`, wheel | Knife, pistol, machine gun, chaingun / next weapon |
| `M` / `N` / `P` | Minimap / sound / pause |

## What is in it

- **Interface**: olive-and-gold mission briefing, keyboard field manual, sector status, and a high-contrast HUD with a health gauge and critical-health warning. Menus scroll on smaller screens.
- **First-person only**: centred aiming and a visible held weapon; no camera toggle. Switching away from the window pauses play.

- **Difficulty**: easy (fewer enemies, weaker shots, slower to notice you), normal or hard. Your choice is remembered.
- **Lives**: you start with 3. Dying restarts the map with what you entered it with, minus a life. The blue orb is an extra life (it also refills health and adds 25 bullets).
- **Secret push-walls**: press `E` against the right wall and it slides back two tiles. The end-of-map stats count the secrets you found.
- **Saving**: save from the pause menu, continue from the title screen. One save slot, kept in the browser.
- **High scores**: the ten best runs, kept in the browser.
- **Look and feel**: textured floors and ceilings, a weapon that sways as you walk and kicks when it fires, and a red glow on the side of the screen a hit came from.
- **Weapons**: knife (silent, no bullets), pistol, machine gun, chaingun. The guns share one pool of bullets (99 at most).
- **Pickups**: first aid kits (+25), hot meals (+10), ammo boxes (+8), clips dropped by guards (+4), guns, treasure (+500 points) and the gold key. Health you do not need is left on the floor.
- **Enemies**: guards, SS officers (faster, fire bursts, drop a machine gun), guard dogs (fast, bite, no gun) and a boss.
- **Doors** slide open and close by themselves; one per map is locked.

### How the guards think

Each guard is a small *state machine*: it is always in exactly one state, and each state
has its own rules for when to move to another.

```
stand / patrol --(sees you, or hears a shot)--> chase --> aim --> fire --> chase ...
                                    any state --(hit)--> pain --> chase
```

Dogs use a smaller machine with no gun and no flinching:

```
stand / patrol --> chase --(close enough)--> bite --> chase ...
```

A bite only lands if you are still in reach when the jaws close, so backing away works.

- **Seeing**: a ray is cast from the guard to you. If no wall or closed door is in the way,
  and you are in front of the guard (or right next to it), it notices you. So you can sneak
  up behind a guard with the knife.
- **Hearing**: a gunshot alerts every idle guard within 9 steps, measured along the corridors.
- **Chasing**: one breadth-first search from your tile gives every tile its walking distance
  to you. Each guard simply steps to the neighbouring tile with the smaller number, opening
  doors on the way. One search serves all guards.
- **Shooting**: the chance to hit drops with distance and when you run. Ducking behind a wall
  while a guard is aiming makes it miss.

## How the code is organised

| File | Job |
| --- | --- |
| `server.js` | Express: serves `public/` and the `maps/` folder, and nothing else |
| `maps/*.map` | The maps, one text file each (see `maps/README.md`) |
| `public/maps.js` | Loads the `.map` files and turns a map into game data; the tile list |
| `public/map-file.js` | Reads and writes the `.map` text format |
| `public/raycast.js` | Casting one ray across the grid (used for drawing, sight and bullets), plus sliding walls |
| `public/game.js` | All the rules: movement, weapons, pickups, doors, secret walls, lives, difficulty, guard and dog AI |
| `public/render.js` | Drawing a frame: floor and ceiling, walls, sprites, crosshair, status bar |
| `public/floors.js` | Floor and ceiling patterns, made as raw pixel arrays |
| `public/textures.js` | The artwork, painted from coloured rectangles |
| `public/storage.js` | Keeping things in the browser's `localStorage` |
| `public/scores.js` | The high-score table |
| `public/savegame.js` | Turning a game into text and back |
| `public/editor.html`, `editor.js` | The map editor page |
| `public/editor-core.js` | The editor's rules: painting tiles and checking that a map can be played |
| `public/sound.js` | Sound effects from the Web Audio API |
| `public/input.js` | Keys held and pressed, turned into "what the player wants" |
| `public/app.js` | Browser glue: events, menu screens and the game loop |

`game.js` never touches the screen, keyboard or speakers. It only changes a plain `state`
object and notes what happened in `state.events`. That is why the rules can be tested in
Node, and why `app.js` can stay small: each frame it reads the input, calls `step()`, plays
the sounds for the new events and asks the renderer to draw.

### Ray casting in three sentences

The map is a flat grid, and the 3D picture is a trick. For each of the 480 screen columns one
ray is sent out from the camera until it hits a wall; the further it travelled, the shorter
the slice of wall drawn in that column. Sprites (guards, items) are flat pictures scaled by
their distance and hidden wherever a wall is nearer.

### Floor casting

Walls are drawn column by column, but floors and ceilings are drawn **row by row**. Every pixel
in one screen row of floor is the same distance away (the row just under the horizon is far,
the bottom row is at your feet), so for each row the renderer works out that distance, finds
the spot on the floor under the left edge of the screen, and steps evenly across to the right
edge, reading the floor pattern as it goes. The pixels are written straight into an `ImageData`
block and put on the canvas in one go, because 120,000 separate drawing calls would be far too slow.

### Secret walls

A pushed wall leaves the grid and becomes a "mover": a 1x1 box at an in-between position
that slides one tile at a time. The ray caster checks movers separately with a ray-box test
and keeps whichever hit is nearer. When the wall stops, it goes back into the grid as an
ordinary wall.

### Saving

Everything about a game in progress is one plain `state` object, so saving is mostly
`JSON.stringify(state)`. The exceptions are handled in `savegame.js`: JavaScript `Map`s
(doors, secrets) are written as lists and rebuilt, and the random-number function is put
back when loading.

### Making maps

Open **http://localhost:3000/editor.html** (or "Map editor" on the title screen). Pick a tile
on the right, then click or drag on the grid; right-click erases. The editor checks your map
as you go and **Play this map** opens it in the game. The text box shows the map as a
`.map` file, and **Download .map file** saves it.

Every map is a text file in the `maps/` folder, played in file-name order. To add a map,
save it there as e.g. `04-my-map.map` and reload the page. To change a map, edit its file.
The format is explained in `maps/README.md`. `#` `=` `%` `&` `@` are walls, `D` a door, `L` the
locked door, `$` a secret push-wall, `X` the exit switch, `P` you, `G` `R` `S` `B` `H` enemies
(`H` is a dog) and lower-case letters are items (the full list is at the top of the file).
`npm test` then checks that the map is closed in, that the key can be reached before the
locked door, and that the exit can be reached.

## Good to know

- The drawing code is tested with a stand-in canvas that records calls, so the tests prove it
  runs without errors, not that it looks right. Play it in a real browser to judge the look and feel.
- The balance (guard accuracy, damage, how much ammo lies around) is a first guess. The
  numbers are in the `WEAPONS` and `ENEMY_TYPES` tables at the top of `public/game.js`.
- High scores, the saved game, the difficulty and your editor map are kept in this browser's
  `localStorage`. Clearing the site's data removes them.
- There are no touch controls: it needs a keyboard.
