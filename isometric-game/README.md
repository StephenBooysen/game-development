# Two Worlds

Two isometric games on one engine, in native JavaScript and three.js. No build
step, no framework — the browser loads ES modules straight from `public/`.

```bash
npm install
npm start          # http://localhost:3000
npm test           # headless check of the shared game logic
```

The start screen offers both. Each keeps its own save.

| | |
| --- | --- |
| **Harvest Hollow** 🌾 | A little farm at the edge of the woods. Till the soil, sow the seeds, and watch four seasons turn over a valley plot. |
| **Mare Copernicus** 🌘 | A one-operator mining claim on the near side. Survey the seams, sink your rigs, and keep them powered through a fortnight of night. |

## Playing

| Input | Does |
| --- | --- |
| Left click | Use the held tool / item on the tile under the cursor (hold to drag-paint) |
| Right click | Walk there (A* around obstacles) |
| `W` `A` `S` `D` | Walk, relative to how the world currently faces |
| `Shift` | Run (costs a little stamina) |
| `1`–`8` | Pick a hotbar slot · `Shift`+wheel cycles |
| Wheel | Zoom · `Q` / `E` rotate a quarter turn · middle-drag pans |
| `I` `B` `J` `Tab` `Esc` | Pack · store · guide · map · menu |
| `F` `M` | Fullscreen · mute |

Both games are the same game underneath, which is the point of them:

| Harvest Hollow | Mare Copernicus |
| --- | --- |
| Hoe a bed | Scan a seam |
| Sow a seed | Deploy a drill rig |
| Water it daily | Charge it each cycle |
| Rain waters everything | A solar flare charges everything |
| Nothing grows in winter | Nothing extracts through the Long Night |
| Chop a tree, break a rock | Cut an ice spire, split a boulder |
| Plant an orchard | Sink a deep-core well |
| Ship at the bin, paid at dawn | Load the launcher, settles next sol |
| Sleep in the cabin | Turn in at the airlock |

A crop or a rig only advances on a day it got what it needed, so neglect stalls
it rather than killing it. One that never went short comes in at ★ quality.

## Layout

```
backend/          express static host + JSON save slots
test/             headless run of the shared logic against both games' tables
public/
  index.html      lobby, loading, HUD and modals — one set of markup, both games
  styles/ui.css   the "painted enamel" skin; each game restates the tokens
  src/
    core/         engine, isometric camera rig, input, asset library, rng
    shared/       the game: grid, terrain, props, sky, weather, pathing,
                  state, growth, actions, player, audio, HUD, panels, saves,
                  and the session that runs a world from boot to save
    games/
      registry.js the shelf — id, blurb and a loader per game
      harvest/    config, items, vocab, rules, worldgen
      lunar/      config, items, vocab, rules, worldgen
    main.js       the lobby, and the only file that knows two games exist
  assets/models/  Kenney kits — nature, town, survival, food, characters
  vendor/three/   pinned three.js build + addons
```

`src/core` knows nothing about either game. `src/shared` knows nothing about
crops or ore — it works in neutral terms (a tile is *prepared*, a plot has
*charge*) and reads a game's tables for the rest. `src/games/<id>` is data plus
one worldgen class.

Adding a third game is a directory and a line in `registry.js`.

### What a game supplies

Its tables (`rules.js`), its scenery (`world.js`), its wording (`vocab.js`), its
palette and noises (`config.js`, `index.js`). Everything with logic in it —
inventory, economy, the clock, the night pass, collision, pathing, saving — is
shared. Two conventions carry most of the weight:

- **Verbs.** A held item declares `tool: 'prepare' | 'charge' | 'fell' | 'break'
  | 'clear'`; a world object declares the one it answers to. `shared/actions.js`
  dispatches on that and nothing else, so a hoe and a survey scanner are the
  same code path.
- **Upgrades are data.** An entry carries an `effect` — `{ wide: 'charge' }`,
  `{ reserve: 40 }`, `{ speed: 1.2 }` — and `shared/state.js` adds them up.
  Buying a bigger tank never needs a new branch.

`shared/` imports no three.js and touches no DOM, so `npm test` drives the whole
loop headlessly against the real tables — 214 checks over both games, including
a save round-trip and the legacy save format.

## Notes on the art

The kits are Kenney's (CC0). Four things about them are worth knowing:

- **Nature-kit models are multi-material and untextured.** Instancing needs one
  material, so `AssetLibrary.toInstanceSource()` bakes each part's colour into a
  vertex-colour attribute and merges — one draw call per model, right colours.
- **Their `baseColorFactor` values are sRGB**, though glTF defines that field as
  linear. Read literally the whole pack renders as washed-out pastel, so each
  game's `KIT_COLORS` re-grades the twenty material names the pack uses. This is
  also how one rock kit serves both games: the Moon pushes `grass`/`dirt`/`stone`
  to basalt greys, and takes over the accent names (`colorRed`, `woodInner`,
  `colorYellow`) as its ores. Which model carries which material is checked, not
  guessed.
- **Textured kits can't be re-graded that way** — every model in them samples one
  shared atlas, and a colour multiply can darken but never desaturate, so the
  survival kit's timber merely turns maroon. `AssetLibrary.gradeTexture()` grades
  the atlas itself on a canvas instead, once per kit, which is what turns the
  survival pack into the Moon's anodised metal.
- **The survival kit is authored at half the town kit's scale**, with wall panels
  on the −Z face rather than +X. Copernicus places its structures at `scale: 2`
  and rotates 0 / π/2 / π / −π/2 for back / left / front / right.

### One thing that doesn't work

The camera is orthographic and pitched down, so every ray through the scene is
parallel and points below the horizontal. Nothing above the horizon can ever be
looked at — the sky dome only ever shows its lower hemisphere. An Earth hanging
over the mare was built and then removed for this reason; the starfield in
`shared/sky.js` has never been visible either. The dome still earns its place as
the background colour and as the single source of the sun vector the whole
lighting rig reads from. Moving the rig to a perspective camera is the only way
to put anything in the sky.

## Saves

`PUT/GET/DELETE /api/save/:slot` writes `data/<slot>.json` via a temp file and
rename, so an interrupted write can't corrupt a run. Harvest Hollow uses the
`farm` slot and Mare Copernicus uses `lunar`. Every save is mirrored to
`localStorage` and reads fall back to it. Only what the player changed is
stored — the scenery regenerates from the seed.

Farms saved before the two games were split apart still load: the old field
names (`water`, `tilled`, `moisture`, `crops`, `chopped`, `mined`) are accepted
alongside the neutral ones.
