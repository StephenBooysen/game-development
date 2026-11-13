'use strict';

const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Runtime settings, all overridable from the environment (or a .env file).
 */
module.exports = {
  root: ROOT,
  port: Number(process.env.PORT) || 3100,
  dataDir: process.env.DATA_DIR || path.join(ROOT, '.application', 'data'),
  logDir: process.env.LOG_DIR || path.join(ROOT, '.application', 'logs'),
  /** Keys for the nooblyjs-core service APIs under /services/*. The game API doesn't use them. */
  apiKeys: (process.env.NOOBLYJS_API_KEYS || process.env.API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean),
  /**
   * The nooblyjs-core dashboards at /services need an admin login by default.
   * SERVICES_DASHBOARD=open opens them for local development (never in production).
   */
  servicesRequireLogin: !(process.env.SERVICES_DASHBOARD === 'open' && !isProduction),
  isProduction
};
