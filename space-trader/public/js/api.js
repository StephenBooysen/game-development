// Thin client for the game's REST API (/api). Errors carry the server's message.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new ApiError(message.replace(/^Invalid request: /, ''), res.status);
  }
  return data;
}

export const api = {
  setup: () => request('GET', '/setup'),
  hallOfFame: () => request('GET', '/halloffame'),
  createGame: (input) => request('POST', '/games', input),
  restoreGame: (state) => request('POST', '/games/restore', { state }),
  game: (id) => request('GET', `/games/${encodeURIComponent(id)}`),
  summary: (id) => request('GET', `/games/${encodeURIComponent(id)}/summary`),
  /** POST (or DELETE) to an action route under /games/:id. */
  act: (id, path, body = {}, method = 'POST') => request(method, `/games/${encodeURIComponent(id)}${path}`, method === 'DELETE' ? undefined : body)
};
