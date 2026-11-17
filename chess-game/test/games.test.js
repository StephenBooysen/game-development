import test from 'node:test';
import assert from 'node:assert/strict';
import { fromFen, applyMove, legalMoves, notation, outcome } from '../public/chess.js';
import { findMove } from '../public/openings.js';
import { GAMES, getGame, gameMoves } from '../public/games.js';

/** Plays a whole game from the start; fails the test on the first illegal or mis-written move. */
function playThrough(game) {
  let state = fromFen();
  for (const { san, label } of gameMoves(game)) {
    const move = findMove(state, san);
    assert.ok(move, `${game.title}: ${label} is not legal`);
    assert.equal(notation(state, move, legalMoves(state)), san, `${game.title}: ${label} should be written exactly as the history writes it`);
    state = applyMove(state, move);
  }
  return state;
}

test('there are 13 legendary games with unique ids and everything the panel shows', () => {
  assert.equal(GAMES.length, 13);
  assert.equal(new Set(GAMES.map((g) => g.id)).size, GAMES.length);
  for (const game of GAMES) {
    for (const field of ['title', 'white', 'black', 'event', 'summary', 'ending']) assert.ok(game[field], `${game.id} needs ${field}`);
    assert.ok(Number.isInteger(game.year) && game.year > 1800, `${game.id} needs a year`);
    assert.match(game.result, /^(1-0|0-1|1\/2-1\/2)$/);
  }
  assert.equal(getGame('opera').white, 'Paul Morphy');
  assert.equal(getGame('missing'), undefined);
});

test('every legendary game is legal from the first move to the last', () => {
  for (const game of GAMES) playThrough(game);
});

test('games that end in mate finish in checkmate for the right side; the rest end in resignation', () => {
  for (const game of GAMES) {
    const end = outcome(playThrough(game));
    if (game.ending === 'Checkmate.') {
      assert.equal(end.reason, 'Checkmate', `${game.title} should end in checkmate`);
      assert.equal(end.winner, game.result === '1-0' ? 'w' : 'b', `${game.title}: wrong winner`);
    } else {
      assert.equal(end.over, false, `${game.title} should end in a resignation, not ${end.reason}`);
      assert.match(game.ending, /resigned\.$/);
    }
  }
});

test('every note belongs to a real move of its game, and every game has notes', () => {
  for (const game of GAMES) {
    const labels = new Set(gameMoves(game).map((m) => m.label));
    assert.ok(Object.keys(game.notes).length >= 4, `${game.title} should explain at least four key moves`);
    for (const [label, note] of Object.entries(game.notes)) {
      assert.ok(labels.has(label), `${game.title}: the note "${label}" does not match a move`);
      assert.ok(note.length > 10, `${game.title}: the note for ${label} is too short`);
    }
  }
});

test('gameMoves numbers the moves and attaches the notes', () => {
  const moves = gameMoves(getGame('opera'));
  assert.equal(moves.length, 33);
  assert.deepEqual(moves[0], { san: 'e4', label: '1.e4', note: '' });
  assert.equal(moves[5].label, '3...Bg4');
  assert.match(moves[5].note, /Pins the knight/);
  assert.equal(moves.at(-1).label, '17.Rd8#');
});
