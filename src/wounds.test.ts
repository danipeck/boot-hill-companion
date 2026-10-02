import assert from 'node:assert/strict';
import test from 'node:test';
import { hitEffectsSummary, resolveWound, rollHitEffects, spreadWoundCount } from './wounds';

function dice(values: number[]) {
  let count = 0;
  return { draw: () => { assert.ok(count < values.length, 'No extra dice should be rolled'); return values[count++]; }, calls: () => count };
}

test('matches the printed rulebook example: 49 / 72 is a serious left-shoulder wound', () => {
  const wound = resolveWound(49, 72);
  assert.equal(wound.location, 'Left shoulder');
  assert.equal(wound.severity, 'Serious');
  assert.equal(wound.strengthLoss, 7);
  assert.deepEqual(wound.effects, ['Move at half speed, except walking.']);
});

test('location ranges include the correct boundary values and treat 100 as head', () => {
  const examples: [number, string][] = [
    [1, 'Left leg'], [10, 'Left leg'], [11, 'Right leg'], [20, 'Right leg'],
    [21, 'Left arm / hand'], [25, 'Left arm / hand'], [26, 'Right arm / hand'], [30, 'Right arm / hand'],
    [31, 'Right shoulder'], [40, 'Right shoulder'], [41, 'Left shoulder'], [50, 'Left shoulder'],
    [51, 'Abdomen / groin'], [70, 'Abdomen / groin'], [71, 'Chest'], [85, 'Chest'], [86, 'Head'], [100, 'Head'],
  ];
  for (const [roll, location] of examples) assert.equal(resolveWound(roll, 1).location, location);
});

test('severity thresholds are inclusive and mortality depends on location', () => {
  const examples: [number, number, string][] = [
    [1, 40, 'Light'], [1, 41, 'Serious'], [1, 100, 'Serious'],
    [21, 75, 'Light'], [21, 76, 'Serious'], [21, 100, 'Serious'],
    [31, 40, 'Light'], [31, 41, 'Serious'], [31, 90, 'Serious'], [31, 91, 'Mortal'],
    [51, 80, 'Light'], [51, 81, 'Serious'], [51, 100, 'Serious'],
    [71, 20, 'Light'], [71, 21, 'Serious'], [71, 60, 'Serious'], [71, 61, 'Mortal'],
    [86, 20, 'Light'], [86, 21, 'Serious'], [86, 40, 'Serious'], [86, 41, 'Mortal'], [100, 100, 'Mortal'],
  ];
  for (const [location, severity, expected] of examples) assert.equal(resolveWound(location, severity).severity, expected, `${location}/${severity}`);
});

test('all 10,000 percentile pairs match the printed chart probability totals', () => {
  const counts = { Light: 0, Serious: 0, Mortal: 0 };
  for (let location = 1; location <= 100; location++) {
    for (let severity = 1; severity <= 100; severity++) counts[resolveWound(location, severity).severity]++;
  }
  assert.deepEqual(counts, { Light: 4550, Serious: 3750, Mortal: 1700 });
});

test('shows leg movement restrictions and conditional gun-arm penalties', () => {
  assert.deepEqual(resolveWound(1, 40).effects, ['Walk at half speed.']);
  assert.deepEqual(resolveWound(20, 41).effects, ['Walk at quarter speed.']);
  assert.deepEqual(resolveWound(25, 75).effects, ['If this is the gun arm: −25 to hit.']);
  assert.deepEqual(resolveWound(30, 76).effects, ['Move at half speed, except walking.', 'If this is the gun arm: −50 to hit.']);
  assert.equal(resolveWound(86, 41).strengthLoss, null);
  assert.deepEqual(resolveWound(86, 41).effects, ['Immediately fatal.']);
});

test('each ordinary firearm or thrown hit rolls location and severity once', () => {
  for (const weaponId of ['double-action', 'rifle', 'knife', 'bow', 'custom-gun', 'custom-throw']) {
    const rolls = dice([49, 72]);
    const result = rollHitEffects({ hit: true, weaponId, rangeIndex: 2 }, rolls.draw);
    assert.equal(rolls.calls(), 2);
    assert.equal(result.wounds.length, 1);
    assert.equal(result.totalStrengthLoss, 7);
    assert.equal(result.spreadRoll, null);
    assert.equal(result.mortal, false);
  }
});

test('never rolls injuries for a miss or invalid shot context', () => {
  const rolls = dice([]);
  assert.throws(() => rollHitEffects({ hit: false, weaponId: 'shotgun', rangeIndex: 0 }, rolls.draw), /after a hit/);
  assert.throws(() => rollHitEffects({ hit: true, weaponId: 'unknown', rangeIndex: 0 }, rolls.draw), /Unknown weapon/);
  for (const rangeIndex of [-1, 4, 1.5, NaN]) assert.throws(() => rollHitEffects({ hit: true, weaponId: 'knife', rangeIndex }, rolls.draw), /valid range/);
  assert.equal(rolls.calls(), 0);
});

test('every spread result matches the supplied effects table, with zero read as ten', () => {
  // Rows transcribed from the supplied rulebook image; columns are short,
  // medium, long, extreme. Check all percentile values against that source.
  const printedRows = [
    { scatter: [1, 1, 0, 0], shotgun: [1, 1, 1, 0] },
    { scatter: [1, 1, 0, 0], shotgun: [2, 1, 1, 0] },
    { scatter: [1, 1, 1, 0], shotgun: [2, 1, 1, 1] },
    { scatter: [1, 1, 1, 0], shotgun: [2, 1, 1, 1] },
    { scatter: [2, 1, 1, 1], shotgun: [3, 2, 1, 1] },
    { scatter: [2, 1, 1, 1], shotgun: [3, 2, 1, 1] },
    { scatter: [2, 1, 1, 1], shotgun: [3, 2, 1, 1] },
    { scatter: [2, 1, 1, 1], shotgun: [4, 2, 1, 1] },
    { scatter: [3, 2, 1, 1], shotgun: [4, 3, 1, 1] },
    { scatter: [3, 2, 1, 1], shotgun: [4, 3, 2, 1] },
  ];
  for (const weapon of ['scatter', 'shotgun'] as const) {
    for (let range = 0; range < 4; range++) {
      for (let roll = 1; roll <= 100; roll++) {
        const die = roll % 10 || 10;
        assert.deepEqual(spreadWoundCount(weapon, range, roll),
          { die, count: printedRows[die - 1][weapon][range] },
          `${weapon}, range ${range}, percentile ${roll}`);
      }
    }
  }
});

test('shotgun and scatter-gun wound distributions match each printed range column', () => {
  const expected = {
    scatter: [{ 1: 40, 2: 40, 3: 20 }, { 1: 80, 2: 20 }, { 0: 20, 1: 80 }, { 0: 40, 1: 60 }],
    shotgun: [{ 1: 10, 2: 30, 3: 30, 4: 30 }, { 1: 40, 2: 40, 3: 20 }, { 1: 90, 2: 10 }, { 0: 20, 1: 80 }],
  };
  for (const weapon of ['scatter', 'shotgun'] as const) {
    for (let range = 0; range < 4; range++) {
      const counts: Record<number, number> = {};
      for (let roll = 1; roll <= 100; roll++) {
        const { count } = spreadWoundCount(weapon, range, roll);
        counts[count] = (counts[count] ?? 0) + 1;
      }
      assert.deepEqual(counts, expected[weapon][range], `${weapon}, range ${range}`);
    }
  }
  assert.deepEqual(spreadWoundCount('shotgun', 0, 100), { die: 10, count: 4 });
  assert.deepEqual(spreadWoundCount('scatter', 2, 34), { die: 4, count: 1 });
});

test('zero-wound spread results stop without rolling location or severity', () => {
  for (const weaponId of ['shotgun', 'scatter']) {
    const rolls = dice([22]);
    const result = rollHitEffects({ hit: true, weaponId, rangeIndex: 3 }, rolls.draw);
    assert.equal(rolls.calls(), 1);
    assert.equal(result.spreadRoll, 22);
    assert.equal(result.spreadDie, 2);
    assert.deepEqual(result.wounds, []);
    assert.equal(result.totalStrengthLoss, 0);
    assert.equal(result.mortal, false);
    assert.equal(hitEffectsSummary(result), 'No wounds');
  }
});

test('multiple shotgun wounds get independent rolls and cumulative Strength loss', () => {
  const rolls = dice([10, 21, 75, 26, 76, 51, 80, 71, 60]);
  const result = rollHitEffects({ hit: true, weaponId: 'shotgun', rangeIndex: 0 }, rolls.draw);
  assert.equal(rolls.calls(), 9);
  assert.deepEqual(result.wounds.map(wound => wound.strengthLoss), [3, 7, 3, 7]);
  assert.equal(result.totalStrengthLoss, 20);
  assert.equal(result.mortal, false);
  assert.equal(hitEffectsSummary(result), '4 wounds · −20 Strength');
});

test('a mortal wound is immediately fatal even among several light wounds', () => {
  const rolls = dice([9, 1, 1, 11, 1, 86, 41]);
  const result = rollHitEffects({ hit: true, weaponId: 'scatter', rangeIndex: 0 }, rolls.draw);
  assert.equal(result.wounds.length, 3);
  assert.equal(result.mortal, true);
  assert.equal(result.totalStrengthLoss, 6);
  assert.equal(hitEffectsSummary(result), '3 wounds · mortal');
});

test('wound and spread dice reject invalid values rather than producing bad injuries', () => {
  for (const invalid of [0, 101, 1.5, NaN, Infinity]) {
    assert.throws(() => resolveWound(invalid, 1), /whole numbers/);
    assert.throws(() => resolveWound(1, invalid), /whole numbers/);
    assert.throws(() => spreadWoundCount('shotgun', 0, invalid), /whole numbers/);
  }
});
