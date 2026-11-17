// A tiny static server. The game itself runs entirely in the browser:
// Express only hands out the files in public/.
import express from 'express';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/** The Express app, exported so tests can start it on a random port. */
export const app = express();

app.disable('x-powered-by');
app.use((_req, res, next) => {
  // Every script and style comes from this server, and all artwork is drawn in code,
  // so the Content Security Policy can forbid anything loaded from elsewhere.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  next();
});
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// The maps live in maps/, one .map text file each. The browser cannot list a folder,
// so the server does it: maps/index.json is the file names in play order. It is read
// on every request, so a new or edited map shows up with a page reload.
const mapsDir = path.join(root, 'maps');
app.get('/maps/index.json', async (_req, res) => {
  try {
    const names = (await readdir(mapsDir)).filter((name) => name.endsWith('.map')).sort();
    res.set('Cache-Control', 'no-store').json(names);
  } catch (error) {
    res.status(500).json({ error: `Could not read the maps folder: ${error.message}` });
  }
});
app.use('/maps', express.static(mapsDir, {
  cacheControl: false,
  setHeaders: (res) => res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }),
}));
// Only public/ is served, so server.js, the tests and node_modules stay private.
app.use(express.static(path.join(root, 'public')));

// Start listening only when run directly (`node server.js`), not when a test imports this file.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`Castle Noobenstein is ready at http://localhost:${port}`);
  });
  server.on('error', (error) => {
    console.error(`Could not start the server: ${error.message}`);
    process.exitCode = 1;
  });
}
