import test from 'node:test';
import assert from 'node:assert/strict';
import { readInput, GAME_KEYS } from '../public/input.js';
import { Sound } from '../public/sound.js';
import { fakeAudio } from './helpers.js';

const input = (held = [], pressed = [], extra = {}) => readInput({ held: new Set(held), pressed: new Set(pressed), ...extra });

test('W A S D and the arrow keys move and turn', () => {
  assert.equal(input(['KeyW']).forward, 1);
  assert.equal(input(['ArrowDown']).forward, -1);
  assert.equal(input(['KeyW', 'KeyS']).forward, 0, 'opposite keys cancel out');
  assert.equal(input(['KeyD']).strafe, 1);
  assert.equal(input(['KeyA']).strafe, -1);
  assert.equal(input(['ArrowLeft']).turn, -1);
  assert.equal(input(['ShiftLeft']).run, true);
});

test('fire is held, while use and weapon changes happen once per press', () => {
  assert.equal(input(['Space']).fire, true);
  assert.equal(input([], [], { mouseFire: true }).fire, true);
  assert.equal(input(['KeyE']).use, false, 'holding E does not keep using');
  assert.equal(input(['KeyE'], ['KeyE']).use, true);
  assert.equal(input([], ['Digit3']).weapon, 'machinegun');
  assert.equal(input([], ['KeyQ']).nextWeapon, true);
  assert.equal(input().weapon, null);
  assert.equal(input([], [], { look: 0.2 }).look, 0.2);
});

test('the keys the game uses do not include browser shortcuts', () => {
  assert.ok(GAME_KEYS.has('Space') && GAME_KEYS.has('KeyW') && GAME_KEYS.has('Digit4'));
  assert.ok(!GAME_KEYS.has('F5') && !GAME_KEYS.has('Tab') && !GAME_KEYS.has('ControlLeft'));
});

test('V is no longer a game control', () => {
  assert.equal(GAME_KEYS.has('KeyV'), false);
  assert.deepEqual(input([], ['KeyV']), input());
});

test('every game event that has a sound plays without errors', () => {
  const audio = fakeAudio();
  const sound = new Sound(() => audio);
  sound.unlock();
  const events = [
    ...['knife', 'pistol', 'machinegun', 'chaingun'].map((weapon) => ({ type: 'fire', weapon })),
    { type: 'enemyFire', enemy: 'guard', dist: 3 },
    { type: 'hurt' }, { type: 'die' }, { type: 'enemyPain' }, { type: 'enemyDie', enemy: 'boss' },
    { type: 'alert', enemy: 'ss' }, { type: 'pickup', kind: 'key' }, { type: 'door' },
    { type: 'locked' }, { type: 'switch' }, { type: 'exit' },
    { type: 'alert', enemy: 'dog' }, { type: 'bite' }, { type: 'enemyDie', enemy: 'dog' },
    { type: 'secret' }, { type: 'pickup', kind: 'oneup' },
  ];
  for (const event of events) {
    const before = audio.started;
    sound.play(event);
    assert.ok(audio.started > before, event.type);
  }
  sound.play({ type: 'nothing' }); // an event with no sound is simply ignored
});

test('sound stays silent before it is unlocked, when muted, and when the browser has none', () => {
  const audio = fakeAudio();
  const sound = new Sound(() => audio);
  sound.play({ type: 'door' });
  assert.equal(audio.started, 0, 'not unlocked yet');
  sound.unlock();
  assert.equal(sound.toggle(), false);
  sound.play({ type: 'door' });
  assert.equal(audio.started, 0, 'muted');
  assert.equal(sound.toggle(), true);
  sound.play({ type: 'door' });
  assert.equal(audio.started, 1);

  const none = new Sound(() => null);
  none.unlock();
  none.play({ type: 'door' });
});
