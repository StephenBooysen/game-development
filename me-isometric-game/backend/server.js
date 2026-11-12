import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSaveStore } from './save-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;

const app = express();
const saves = createSaveStore(path.join(ROOT, 'data'));

app.use(express.json({ limit: '4mb' }));

// GLB/GLTF need explicit mime types for some Chrome/dev-tool paths, and the
// asset packs are large enough that caching them is worth it.
express.static.mime.define({ 'model/gltf-binary': ['glb'] });
express.static.mime.define({ 'model/gltf+json': ['gltf'] });

app.use(
  express.static(PUBLIC_DIR, {
    setHeaders(res, filePath) {
      if (/[\\/](assets|vendor)[\\/]/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      } else {
        // Source and markup change constantly during development.
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get('/api/save/:slot', async (req, res) => {
  try {
    const data = await saves.read(req.params.slot);
    if (!data) return res.status(404).json({ error: 'no save in that slot' });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/save/:slot', async (req, res) => {
  try {
    await saves.write(req.params.slot, req.body);
    res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/save/:slot', async (req, res) => {
  try {
    await saves.remove(req.params.slot);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/saves', async (_req, res) => {
  res.json(await saves.list());
});

app.listen(PORT, () => {
  console.log(`\n  Harvest Hollow running at  http://localhost:${PORT}\n`);
});
