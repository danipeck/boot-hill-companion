import assert from 'node:assert/strict';
import test from 'node:test';
import { brawlProbability, continueHold, defaultBrawlOptions as defaults, resolveBrawl, rollBrawl, rollD10 } from './brawling';

function score(total: number, mode: 'punching' | 'grappling' = 'punching', changes = {}) {
  return resolveBrawl(mode, [1, 1], { ...defaults, modifier: total - 2, ...changes });
}

test('punching table boundaries and right-handed effects match rulebook p. 11', () => {
  const rows: [number, string, number, number][] = [
    [0, 'Miss', 0, 2], [2, 'Miss', 0, 2], [3, 'Miss', 0, 1], [4, 'Miss', 0, 1],
    [5, 'Miss', 0, 0], [7, 'Miss', 0, 0], [8, 'Blocked', 0, 0], [9, 'Blocked', 0, 0],
    [10, 'Glancing blow', 1, 0], [13, 'Glancing blow', 1, 0], [14, 'Jab', 2, 0],
    [15, 'Hook', 2, 0], [16, 'Combination', 4, -1], [17, 'Rabbit punch', 3, -1],
    [18, 'Uppercut', 3, -2], [19, 'Haymaker', 4, -3], [22, 'Haymaker', 4, -3],
  ];
  for (const [total, label, loss, modifier] of rows) {
    const result = score(total);
    assert.equal(result.label, label, `score ${total}`);
    assert.equal(result.opponentLoss, loss, `damage ${total}`);
    assert.equal(result.opponentModifier, modifier, `modifier ${total}`);
  }
});

test('a combination uses two free arms and left-handed effects reverse the columns', () => {
  assert.equal(score(16, 'punching', { rightFree: false }).opponentLoss, 2);
  assert.equal(score(16, 'punching', { held: 'left-arm' }).opponentLoss, 2);
  assert.equal(score(14, 'punching', { rightFree: false }).opponentLoss, 1);
  assert.equal(score(14, 'punching', { rightFree: false, dominantHand: 'left' }).opponentLoss, 2);
  assert.equal(score(19, 'punching', { held: 'right-arm' }).opponentLoss, 3);
  assert.equal(score(19, 'punching', { held: 'right-arm', dominantHand: 'left' }).opponentLoss, 4);
  assert.throws(() => score(15, 'punching', { held: 'bear-hug' }), /only a grapple/);
  assert.throws(() => score(15, 'punching', { leftFree: false, rightFree: false }), /free arm/);
  assert.throws(() => score(15, 'punching', { weapon: 'blunt', held: 'right-arm' }), /free arm/);
});

test('weapons adjust the roll and damage, while cutting weapons use the wound chart', () => {
  // Printed example: a roll of 14 with a revolver becomes 13, then deals 2.
  const gunButt = resolveBrawl('punching', [7, 7], { ...defaults, weapon: 'blunt' });
  assert.equal(gunButt.adjusted, 13); assert.equal(gunButt.label, 'Glancing blow'); assert.equal(gunButt.opponentLoss, 2);
  const chair = resolveBrawl('punching', [7, 8], { ...defaults, weapon: 'large' });
  assert.equal(chair.adjusted, 13); assert.equal(chair.opponentLoss, 3);
  const blade = resolveBrawl('punching', [7, 7], { ...defaults, weapon: 'cutting' }, [86, 41]);
  assert.equal(blade.opponentLoss, 0); assert.equal(blade.wound?.severity, 'Mortal');
  assert.equal(resolveBrawl('punching', [4, 4], { ...defaults, weapon: 'cutting' }).wound, null);
  assert.equal(resolveBrawl('punching', [8, 9], { ...defaults, weapon: 'blunt' }).opponentLoss, 3);
});

test('grappling chart distinguishes self-damage, holds, and opponent effects', () => {
  const rows: [number, string, number, number, number, number, string | null][] = [
    [0, 'Opponent knees you', 0, 4, 0, -4, null], [1, 'Opponent knees you', 0, 4, 0, -4, null],
    [2, 'Opponent gouges you', 0, 1, 0, -2, null], [3, 'Opponent gouges you', 0, 1, 0, -2, null],
    [4, 'No hold', 0, 0, 2, 0, null], [5, 'No hold', 0, 0, 2, 0, null],
    [6, 'No hold', 0, 0, 1, 0, null], [7, 'No hold', 0, 0, 1, 0, null],
    [8, 'No hold', 0, 0, 0, 0, null], [9, 'No hold', 0, 0, 0, 0, null],
    [10, 'Left arm lock', 2, 0, -1, 0, 'left-arm'], [11, 'Left arm lock', 2, 0, -1, 0, 'left-arm'],
    [12, 'Right arm lock', 2, 0, -1, 0, 'right-arm'], [13, 'Right arm lock', 2, 0, -1, 0, 'right-arm'],
    [14, 'Elbow smash', 2, 0, -1, 0, null], [15, 'Throw', 2, 0, -2, 0, null], [16, 'Throw', 2, 0, -2, 0, null],
    [17, 'Kick', 3, 0, -1, 0, null], [18, 'Head lock', 4, 0, -2, 0, 'head-lock'],
    [19, 'Bear hug', 1, 0, -4, 0, 'bear-hug'], [22, 'Bear hug', 1, 0, -4, 0, 'bear-hug'],
  ];
  for (const [total, label, opponentLoss, selfLoss, opponentModifier, selfModifier, hold] of rows) {
    const result = score(total, 'grappling');
    assert.deepEqual([result.label, result.opponentLoss, result.selfLoss, result.opponentModifier, result.selfModifier, result.hold], [label, opponentLoss, selfLoss, opponentModifier, selfModifier, hold], `score ${total}`);
  }
});

test('held characters escape only at 3 or less or 15–16, without damage', () => {
  for (const held of ['left-arm', 'right-arm', 'head-lock', 'bear-hug'] as const) {
    for (let total = 0; total <= 22; total++) {
      const result = score(total, 'grappling', { held });
      assert.equal(result.breakHold, total <= 3 || total === 15 || total === 16, `${held}, score ${total}`);
      assert.deepEqual([result.selfLoss, result.opponentLoss, result.selfModifier, result.opponentModifier, result.hold], [0, 0, 0, 0, null]);
    }
  }
});

test('probability uses two independent d10s, with the correct escape and hit odds', () => {
  assert.equal(brawlProbability('punching', defaults), 64);
  assert.equal(brawlProbability('grappling', defaults), 64);
  assert.equal(brawlProbability('grappling', { ...defaults, held: 'head-lock' }), 14);
  const counts: Record<number, number> = {};
  for (let roll = 1; roll <= 100; roll++) { const die = rollD10(() => roll); counts[die] = (counts[die] || 0) + 1; }
  assert.deepEqual(Object.values(counts), Array(10).fill(10));
  assert.equal(rollD10(() => 100), 10);
});

test('rolling consumes two dice, plus location/severity only for cutting hits', () => {
  for (const [weapon, values, expected] of [['fists', [7, 7], 2], ['cutting', [7, 7, 49, 72], 4], ['cutting', [1, 1], 2]] as const) {
    let calls = 0;
    const result = rollBrawl('punching', { ...defaults, weapon }, () => values[calls++]);
    assert.equal(calls, expected);
    if (expected === 4) assert.equal(result.wound?.location, 'Left shoulder');
  }
  assert.equal(continueHold('head-lock').opponentLoss, 4);
  assert.deepEqual(continueHold('bear-hug').dice, []);
  assert.throws(() => rollD10(() => 0), /whole numbers/);
  assert.throws(() => resolveBrawl('grappling', [1, 11], defaults), /1–10/);
  assert.throws(() => score(2, 'punching', { modifier: NaN }), /modifiers/);
});
