'use strict';

/**
 * Void Merchant: a turn-based space trading game.
 *
 * The server is an Express app wired up through nooblyjs-core's ServiceRegistry:
 *   - logging (file)      game events and errors, in .application/logs
 *   - dataservice (file)  saved games and the hall of fame, in .application/data
 *   - caching (memory)    active games, read cache-aside
 * Game rules live in src/; the browser client is static files in public/.
 */

const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');

if (fs.existsSync(path.join(__dirname, '.env')) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(path.join(__dirname, '.env'));
}

const express = require('express');
const helmet = require('helmet');
const serviceRegistry = require('nooblyjs-core');
const { helmetCspOption } = require('nooblyjs-core/src/shared/utils/contentSecurityPolicy');
const defaults = require('./src/config');
const { GameService } = require('./src/game/GameService');
const { createGameRoutes } = require('./src/routes/gameRoutes');

/**
 * Builds the Express app and its services.
 * @param {Partial<typeof defaults>} [overrides] config overrides (tests use a temp dataDir)
 * @return {Promise<{app: express.Express, games: GameService, logger: Object, config: Object}>}
 */
async function createApp(overrides = {}) {
  const config = { ...defaults, ...overrides };
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.logDir, { recursive: true });

  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);
  app.use(helmet({ contentSecurityPolicy: helmetCspOption() }));
  app.use(express.json({ limit: '32kb' }));

  const eventEmitter = new EventEmitter();
  serviceRegistry.initialize(app, eventEmitter, {
    logDir: config.logDir,
    dataDir: config.dataDir,
    security: {
      apiKeyAuth: { apiKeys: config.apiKeys, requireApiKey: config.apiKeys.length > 0 },
      servicesAuth: { requireLogin: config.servicesRequireLogin }
    }
  });

  const logger = serviceRegistry.logger(config.logToConsole ? 'memory' : 'file', { logDir: config.logDir });
  const cache = serviceRegistry.cache('memory');
  const dataService = serviceRegistry.dataService('file', { dataDir: config.dataDir });

  const games = new GameService({ dataService, cache, logger });
  await games.init();

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api', createGameRoutes({ games, logger, eventEmitter }));
  app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

  return { app, games, logger, config };
}

if (require.main === module) {
  createApp()
    .then(({ app, logger, config }) => {
      app.listen(config.port, () => {
        const url = `http://localhost:${config.port}`;
        logger.info(`[app] Void Merchant running at ${url}`);
        console.log(`\n  Void Merchant running at  ${url}\n`);
      });
    })
    .catch((err) => {
      console.error('Failed to start Void Merchant:', err);
      process.exit(1);
    });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason instanceof Error ? reason.stack : reason);
  });
}

module.exports = { createApp };
