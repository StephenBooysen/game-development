import fs from 'node:fs/promises';
import path from 'node:path';

const SLOT_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function createSaveStore(dir) {
  const fileFor = (slot) => {
    if (!SLOT_RE.test(slot)) throw new Error('invalid slot name');
    return path.join(dir, `${slot}.json`);
  };

  const ensureDir = () => fs.mkdir(dir, { recursive: true });

  return {
    async read(slot) {
      try {
        return JSON.parse(await fs.readFile(fileFor(slot), 'utf8'));
      } catch (err) {
        if (err.code === 'ENOENT') return null;
        throw err;
      }
    },

    async write(slot, data) {
      if (!data || typeof data !== 'object') throw new Error('save payload must be an object');
      await ensureDir();
      const target = fileFor(slot);
      // Write to a temp file first so an interrupted write can't corrupt a save.
      const tmp = `${target}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data), 'utf8');
      await fs.rename(tmp, target);
    },

    async remove(slot) {
      try {
        await fs.unlink(fileFor(slot));
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    },

    async list() {
      try {
        const names = await fs.readdir(dir);
        const out = [];
        for (const name of names) {
          if (!name.endsWith('.json')) continue;
          const stat = await fs.stat(path.join(dir, name));
          out.push({ slot: name.replace(/\.json$/, ''), size: stat.size, modified: stat.mtime.toISOString() });
        }
        return out;
      } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
      }
    },
  };
}
