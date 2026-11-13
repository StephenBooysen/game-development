'use strict';

const { createGame } = require('./newGame');
const actions = require('./actions');
const { buildView, summaryView } = require('./view');
const { makeRng } = require('../engine/random');
const { ClientError } = require('./errors');

const GAMES = 'games';
const HALL_OF_FAME = 'halloffame';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs games on top of nooblyjs-core services:
 * the data service stores game files and the hall of fame, the cache keeps
 * active games hot, and the logger records what happens.
 */
class GameService {
  /**
   * @param {{dataService: Object, cache: Object, logger: Object, random?: function(): number}} deps
   */
  constructor({ dataService, cache, logger, random = Math.random }) {
    this.dataService = dataService;
    this.cache = cache;
    this.logger = logger;
    this.rng = makeRng(random);
    this.locks = new Map();
  }

  /** Creates the data containers, keeping any saved by an earlier run. Call at startup. */
  async init() {
    await this.ensureContainer(GAMES);
    await this.ensureContainer(HALL_OF_FAME);
  }

  /**
   * Creates a container unless it already exists. The data service throws
   * "Container '<name>' already exists." on a restart, which is expected.
   * @param {string} name
   * @private
   */
  async ensureContainer(name) {
    try {
      await this.dataService.createContainer(name);
    } catch (err) {
      if (!/already exists/i.test(err && err.message)) throw err;
    }
  }

  /**
   * Registers a new commander and returns the game view.
   * @param {{name: string, difficulty: string, skills: Object}} input
   * @return {Promise<Object>}
   */
  async create(input) {
    const game = createGame(input, this.rng);
    const id = await this.dataService.add(GAMES, game);
    game.id = id;
    await this.dataService.update(GAMES, id, game);
    await this.cache.put(cacheKey(id), structuredClone(game));
    this.logger?.info(`[GameService] New commander ${game.name}`, { gameId: id, difficulty: game.difficulty });
    return buildView(game);
  }

  /**
   * The full view of a game.
   * @param {string} id
   * @return {Promise<Object>}
   */
  async view(id) {
    return buildView(await this.load(id));
  }

  /**
   * A short summary (for the title screen), or null if the game doesn't exist.
   * @param {string} id
   * @return {Promise<Object|null>}
   */
  async summary(id) {
    if (!UUID.test(String(id))) return null;
    const game = await this.find(id);
    return game ? summaryView(game) : null;
  }

  /**
   * Applies a player action under a per-game lock, saves, and returns the new view.
   * @param {string} id
   * @param {string} name action name (see ./actions)
   * @param {Object} input
   * @return {Promise<{game: Object, notice: (Object|null)}>}
   */
  async act(id, name, input = {}) {
    const action = actions[name];
    if (!action) throw new ClientError(404, 'Unknown action.');
    return this.withLock(id, async () => {
      const game = await this.load(id);
      const result = action(game, input, this.rng) || {};
      game.updatedAt = new Date().toISOString();
      if (game.status === 'over' && !game.over.recorded) {
        await this.recordHallOfFame(game);
        game.over.recorded = true;
      }
      await this.save(game);
      if (name !== 'buy' && name !== 'sell') {
        this.logger?.info(`[GameService] ${name}`, { gameId: id, day: game.day, status: game.status });
      }
      return { game: buildView(game), notice: result.notice || null };
    });
  }

  /**
   * Top hall-of-fame entries, best first.
   * @param {number} [limit=10]
   * @return {Promise<Array<Object>>}
   */
  async hallOfFame(limit = 10) {
    const entries = await this.dataService.listAll(HALL_OF_FAME);
    return (entries || [])
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((e) => ({ gameId: e.gameId, name: e.name, ending: e.ending, score: e.score, day: e.day, difficulty: e.difficulty, at: e.at }));
  }

  async recordHallOfFame(game) {
    await this.dataService.add(HALL_OF_FAME, {
      gameId: game.id,
      name: game.name,
      ending: game.over.tag,
      score: game.over.score,
      day: game.day,
      difficulty: game.difficulty,
      at: new Date().toISOString()
    });
    this.logger?.info(`[GameService] Game over for ${game.name}`, { gameId: game.id, ending: game.over.ending, score: game.over.score });
  }

  /** Loads a game, or throws 404. Returns a private copy that is safe to mutate. */
  async load(id) {
    if (!UUID.test(String(id))) throw new ClientError(404, 'Game not found.');
    const game = await this.find(id);
    if (!game) throw new ClientError(404, 'Game not found.');
    return game;
  }

  /** Cache-aside read: memory cache first, then the data service. */
  async find(id) {
    const cached = await this.cache.get(cacheKey(id));
    if (cached) return structuredClone(cached);
    const stored = await this.dataService.getByUuid(GAMES, id);
    if (!stored) return null;
    await this.cache.put(cacheKey(id), structuredClone(stored));
    return structuredClone(stored);
  }

  async save(game) {
    await this.dataService.update(GAMES, game.id, game);
    await this.cache.put(cacheKey(game.id), structuredClone(game));
  }

  /** Serialises actions on one game so rapid clicks can't race each other. */
  async withLock(id, fn) {
    const previous = this.locks.get(id) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    const tail = previous.then(() => current);
    this.locks.set(id, tail);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(id) === tail) this.locks.delete(id);
    }
  }
}

function cacheKey(id) {
  return `game:${id}`;
}

module.exports = { GameService };
