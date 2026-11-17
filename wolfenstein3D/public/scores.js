// The high-score table: the ten best runs, kept in the browser between visits.
import { KEYS, readJson, writeJson } from './storage.js';

/** How many scores the table keeps. */
export const MAX_SCORES = 10;

/**
 * Adds a run to the table. `entry` is { score, time, difficulty, maps, escaped, date }.
 * Higher scores come first; with equal scores, the faster run wins.
 * Returns { scores, rank }: the new table and the run's place in it (1 = best),
 * or rank 0 if it did not make the table.
 */
export function addScore(scores, entry) {
  const all = [...scores, entry].sort((a, b) => b.score - a.score || a.time - b.time);
  const kept = all.slice(0, MAX_SCORES);
  return { scores: kept, rank: kept.indexOf(entry) + 1 };
}

/** The saved table (an empty list the first time). */
export function loadScores(storage) {
  const scores = readJson(storage, KEYS.scores, []);
  return Array.isArray(scores) ? scores.filter((entry) => Number.isFinite(entry?.score)) : [];
}

/** Adds a run to the saved table and stores it. Returns its rank (0 = not in the table). */
export function recordScore(storage, entry) {
  const { scores, rank } = addScore(loadScores(storage), entry);
  writeJson(storage, KEYS.scores, scores);
  return rank;
}

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** One line of text per score, for the high-score screen. */
export function scoreLines(scores) {
  return scores.map((entry, index) => {
    const how = entry.escaped ? 'escaped' : `reached map ${entry.maps}`;
    return `${index + 1}. ${entry.score} pts / ${clock(entry.time)} / ${entry.difficulty} / ${how} / ${entry.date}`;
  });
}
