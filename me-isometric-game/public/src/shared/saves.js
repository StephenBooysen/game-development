/**
 * Thin client for the save API in backend/server.js, one store per game.
 *
 * The server is the record of truth, but a run shouldn't be lost because the
 * dev server was restarted mid-session, so every write is mirrored to
 * localStorage and reads fall back to it.
 */

export const SAVE_VERSION = 2;

const KEY = (slot) => `iso-games:${slot}`;

/**
 * @param {string} slot server slot name — also the localStorage key
 * @param {string[]} [legacyKeys] older localStorage keys to fall back to
 */
export function makeSaveStore(slot, legacyKeys = []) {
  return {
    slot,

    async write(payload) {
      const body = { ...payload, v: SAVE_VERSION, slot, savedAt: new Date().toISOString() };
      let local = null;
      try {
        local = JSON.stringify(body);
        localStorage.setItem(KEY(slot), local);
      } catch {
        // Quota or private mode — the server copy still stands.
      }

      const res = await fetch(`/api/save/${slot}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: local ?? JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      return res.json();
    },

    async read() {
      try {
        const res = await fetch(`/api/save/${slot}`);
        if (res.ok) return await res.json();
        if (res.status !== 404) throw new Error(`load failed (${res.status})`);
      } catch {
        // Fall through to the local mirror.
      }
      for (const key of [KEY(slot), ...legacyKeys]) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) return JSON.parse(raw);
        } catch { /* try the next one */ }
      }
      return null;
    },

    async exists() {
      const data = await this.read();
      return !!(data && data.state);
    },

    async clear() {
      for (const key of [KEY(slot), ...legacyKeys]) {
        try { localStorage.removeItem(key); } catch { /* nothing to clear */ }
      }
      try {
        await fetch(`/api/save/${slot}`, { method: 'DELETE' });
      } catch { /* offline is fine */ }
    },
  };
}
