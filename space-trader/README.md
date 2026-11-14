# Void Merchant

A turn-based space trading game for the browser. Buy low, sell high, survive pirates on the lanes between eight star systems, and retire rich before the bank catches up with you.

The server runs on [nooblyjs-core](../../nooblyjs-core), installed as an npm package. Game rules and the REST API live in `src/`. The browser client (HTML, CSS and vanilla JavaScript modules) lives in `public/`. The UI follows the *Space Trader* design canvas.

## Run it

```bash
npm install
npm start          # http://localhost:3100
npm run dev        # restarts when src/ or app.js change
npm test           # engine + API tests (node:test, no extra dependencies)
```

Requires Node 18 or newer.

### nooblyjs-core dependency

`package.json` points at the local checkout: `"nooblyjs-core": "file:../../nooblyjs-core"`. npm 9 and later **copies** a `file:` package into `node_modules` rather than linking it, so after changing nooblyjs-core, run `npm install` here again to pick up the change.

## How it uses nooblyjs-core

`app.js` calls `serviceRegistry.initialize(app, eventEmitter, options)`, then asks the registry for:

| Service | Provider | Used for |
|---|---|---|
| `logging` | `file` | Game events and errors, in `.application/logs` |
| `dataservice` | `file` | Saved games (`games` container) and the hall of fame (`halloffame`), in `.application/data` |
| `caching` | `memory` | Active games, read cache-aside in front of the data service |

It also reuses the core's helpers: `helmetCspOption` for the Content Security Policy, `validate` for request validation, `ClientError` and `sendSafeError` for client-safe errors.

The core also mounts its service dashboards at `/services`. They need an admin login. For local development only, set `SERVICES_DASHBOARD=open` to open them (ignored when `NODE_ENV=production`).

## Project layout

```
app.js                  Express app + nooblyjs-core wiring (createApp)
src/
  config.js             Port, data and log folders, env settings
  data/                 Static game data: goods, systems, ships, equipment, rules, flavour text
  engine/               Pure rules: market, ship stats, galaxy, bank, combat, encounters, world tick
  game/
    newGame.js          Builds and validates a new commander
    actions/            Player actions (trade, shipyard, bank, travel/encounters, endings)
    view.js             Turns game state into what the client draws (hides unscanned contacts)
    GameService.js      Persistence, cache, per-game locking, hall of fame
  routes/gameRoutes.js  REST API under /api
public/
  index.html            Single page shell
  css/                  base (tokens), components, screens
  js/                   router, store, API client, components/, screens/ (one per design artboard)
test/                   engine.test.js, api.test.js
```

The server is authoritative: the browser sends actions and redraws from the view the server returns. No game rules run in the client.

## API

All endpoints are JSON under `/api`.

| Method | Path | Body |
|---|---|---|
| GET | `/setup` | Difficulties, skill rules, starter ship |
| GET | `/halloffame` | Top 10 finished games |
| POST | `/games` | `{ name, difficulty, skills: { navigation, battle, trading } }` |
| POST | `/games/restore` | `{ state }` (restores saved game from client localStorage) |
| GET | `/games/:id` | Full game view |
| GET | `/games/:id/summary` | Short summary for the title screen |
| POST | `/games/:id/market/buy` · `/market/sell` | `{ good, qty }` |
| POST | `/games/:id/shipyard/refuel` · `/shipyard/repair` | `{ amount? }` (omit to fill) |
| POST | `/games/:id/shipyard/ship` | `{ ship }` |
| POST | `/games/:id/shipyard/equipment` | `{ item }` |
| DELETE | `/games/:id/shipyard/equipment/:item` | Sells a fitted item |
| POST | `/games/:id/bank/borrow` | `{ amount, term }` (term 10, 20 or 40 days) |
| POST | `/games/:id/bank/repay` | `{ amount }` (credits or `"all"`) |
| POST | `/games/:id/travel` | `{ to }` |
| POST | `/games/:id/travel/contact` | `{ action: scan \| hail \| evade \| abort }` |
| POST | `/games/:id/travel/arrive` | Finish the jump |
| POST | `/games/:id/encounter` | `{ action: attack \| flee \| pay \| surrender }` |
| POST | `/games/:id/combat` | `{ action: fire \| evade \| shield \| flee }` |
| POST | `/games/:id/trader` | `{ action: accept \| decline \| attack \| leave, offer? }` |
| POST | `/games/:id/loot` | `{ take: [lootId, …] }` then resumes the jump |
| POST | `/games/:id/retire` | Ends the game |

Action responses are `{ game, notice }`. Errors are `{ error }` with 400 (bad move or input), 404 (unknown game) or 409 (not possible in the current state).

## Game rules in brief

- **Commander**: 18 skill points across Navigation, Battle and Trading (1 to 10 each). Difficulty sets starting credits, interest, pirate strength and score multiplier.
- **Markets**: each system's economy, tech level and current events set its prices. Prices drift daily. Buying pushes a price up, selling pushes it down. Contraband trades only on black markets (Ostara, Thrane), and customs may confiscate it when you dock.
- **Galaxy map**: selecting a system lists every good with the buy price here, the sell price there and the profit per tonne, plus the most profitable load you can afford. Prices there come from your last visit or a trader's tip, or are the system's typical prices if you have neither.
- **Travel**: fuel equals distance in parsecs, and a jump takes about a day per 3 parsecs. Days only pass in warp.
- **Encounters**: lane danger (and rumoured pirate activity) sets the odds. Contacts stay unidentified until you scan, hail or fail to evade them.
- **Combat**: fire, evade, boost shields or flee. Each win adds Battle experience. Pirates carry bounties.
- **Bank**: simple daily interest. Overdue loans bring bounty hunters, and 10 days overdue means seizure.
- **Score**: final worth plus 300 per pirate beaten, times the difficulty and ending multipliers (retired ×1, out of business ×0.8, destroyed ×0.6, seized ×0.4).
