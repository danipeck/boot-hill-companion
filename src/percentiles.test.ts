import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CharacterStats, { characterStatReadout } from './CharacterStats';
import { blankCharacter, exportCharacterJson, importCharacter, normalizeCharacter, parseCharacter, readLibrary, sample, setPercentileRoll } from './characters';
import { addCombatant, adjustCombatant, combatantSpeed, newEncounter, readEncounter, updateActingSheet, writeEncounter } from './encounter';
import { createExtra, extraPresets, generateExtra } from './extras';
import { abilityModifiers, calculate, percentileResult, percentileStats, percentileValue, type PercentileStat } from './rules';

test('every percentile band matches the supplied Speed, accuracy, Strength, Bravery and Experience charts', () => {
  const bands: { stat: PercentileStat; rows: [number, number, number, string, number?][] }[] = [
    { stat: 'speed', rows: [[1, 5, -5, 'Slow'], [6, 10, -2, 'Below Average'], [11, 20, 0, 'Average'], [21, 35, 2, 'Above Average'], [36, 50, 4, 'Quick'], [51, 65, 6, 'Very Quick'], [66, 80, 9, 'Fast'], [81, 90, 12, 'Very Fast'], [91, 95, 15, 'Lightning'], [96, 96, 18, 'Greased Lightning'], [97, 97, 19, 'Greased Lightning'], [98, 98, 20, 'Greased Lightning'], [99, 99, 21, 'Greased Lightning'], [100, 100, 22, 'Greased Lightning']] },
    ...(['gunAccuracy', 'throwingAccuracy'] as const).map(stat => ({ stat, rows: [[1, 5, -9, 'Very Poor'], [6, 15, -6, 'Poor'], [16, 25, -3, 'Below Average'], [26, 35, 0, 'Average'], [36, 50, 2, 'Above Average'], [51, 65, 5, 'Fair'], [66, 75, 7, 'Good'], [76, 85, 10, 'Very Good'], [86, 95, 15, 'Excellent'], [96, 98, 18, 'Crack Shot'], [99, 100, 20, 'Deadeye']] as [number, number, number, string][] })),
    { stat: 'strength', rows: [[1, 2, 8, 'Feeble'], [3, 5, 9, 'Puny'], [6, 10, 10, 'Frail'], [11, 17, 11, 'Weakling'], [18, 25, 12, 'Sickly'], [26, 40, 13, 'Average'], [41, 60, 14, 'Above Average'], [61, 75, 15, 'Sturdy'], [76, 83, 16, 'Hardy'], [84, 90, 17, 'Strong'], [91, 95, 18, 'Very Strong'], [96, 98, 19, 'Powerful'], [99, 100, 20, 'Mighty']] },
    { stat: 'bravery', rows: [[1, 10, -4, 'Coward', -6], [11, 20, -2, 'Cowardly', -3], [21, 35, 0, 'Average', 0], [36, 65, 1, 'Above Average', 3], [66, 80, 2, 'Brave', 6], [81, 90, 3, 'Very Brave', 10], [91, 98, 4, 'Fearless', 15], [99, 100, 5, 'Foolhardy', 15]] },
    { stat: 'experience', rows: [[1, 40, 0, 'None', -10], [41, 60, 1, '1 gunfight', -5], [61, 75, 2, '2 gunfights', -5], [76, 85, 3, '3 gunfights', 0], [86, 90, 4, '4 gunfights', 0], [91, 93, 5, '5 gunfights', 2], [94, 95, 6, '6 gunfights', 2], [96, 96, 7, '7 gunfights', 6], [97, 97, 8, '8 gunfights', 6], [98, 98, 9, '9 gunfights', 8], [99, 99, 10, '10 gunfights', 8], [100, 100, 11, '11 or more gunfights', 10]] },
  ];
  for (const { stat, rows } of bands) {
    let covered = 0;
    for (const [min, max, value, description, accuracy] of rows) {
      for (let roll = min; roll <= max; roll++) {
        assert.deepEqual(percentileResult(stat, String(roll)), { score: roll, value, description, ...(accuracy !== undefined ? { accuracy } : {}) }, `${stat} roll ${roll}`);
        covered++;
      }
    }
    assert.equal(covered, 100);
  }
});

function filledCharacter() {
  let character = blankCharacter('Rose');
  for (const [key, value] of Object.entries({ speed: '96', gunAccuracy: '98', throwingAccuracy: '15', strength: '83', bravery: '98', experience: '95' })) {
    character = setPercentileRoll(character, key as PercentileStat, value);
  }
  return character;
}

test('percentile inputs drive gameplay, and Strength and Experience are derived rather than entered as ratings', () => {
  const character = filledCharacter();
  assert.equal(character.strength, '16'); assert.equal(character.abilities.gunfights, '6');
  const modifiers = abilityModifiers(character.abilities, 5);
  assert.deepEqual(calculate(modifiers), { firstShot: 27, gunHit: 85, throwingHit: 61 });
  assert.equal(characterStatReadout(character, 'strength'), 'Hardy · Strength 16');
  assert.equal(characterStatReadout(character, 'experience'), '6 gunfights · Accuracy +2');
  const html = renderToStaticMarkup(React.createElement(CharacterStats, { character, onChange() {} }));
  assert.equal((html.match(/<input /g) ?? []).length, 6);
  assert.equal((html.match(/<output /g) ?? []).length, 6);
  for (const key of percentileStats) assert.match(html, new RegExp(`id="roll-${key}"`));
  assert.match(html, /Hardy · Strength 16/); assert.match(html, /6 gunfights · Accuracy \+2/);
  for (const oldId of ['strength-rating', 'score-gunfights', 'mod-speed', 'extra-experience']) assert.ok(!html.includes(`id="${oldId}"`));
});

test('00 is treated as 100, invalid drafts show no stale derived values, and saves reject bad rolls', () => {
  let character = filledCharacter();
  for (const key of percentileStats) character = setPercentileRoll(character, key, '00');
  assert.equal(percentileValue('00'), 100); assert.equal(character.strength, '20');
  assert.equal(character.abilities.gunfights, '11'); assert.equal(character.modifiers.speed, '22');
  assert.equal(combatantSpeed(addCombatant(newEncounter('00'), character, 'rose').members[0]).score, 100);
  for (const value of ['', '0', '-1', '101', '1.5', 'abc', '1e2']) {
    assert.throws(() => percentileValue(value), /percentile roll/);
    const invalid = setPercentileRoll(character, 'strength', value);
    assert.equal(invalid.strength, ''); assert.equal(characterStatReadout(invalid, 'strength'), '—');
    assert.throws(() => exportCharacterJson(invalid), /percentile roll/);
    const missingExperience = setPercentileRoll(character, 'experience', value);
    assert.equal(missingExperience.abilities.gunfights, ''); assert.equal(missingExperience.modifiers.experience, '');
    assert.throws(() => exportCharacterJson(missingExperience), /percentile roll/);
  }
});

test('saved/imported rolls are the source of derived stats, even if cached ratings were edited', () => {
  const character = filledCharacter();
  const imported = importCharacter(readLibrary({ getItem: () => null }), JSON.stringify({ ...character, strength: '99', abilities: { ...character.abilities, gunfights: '999' }, modifiers: { ...character.modifiers, speed: '99', experience: '99' } }), 'rose').draft;
  assert.equal(imported.strength, '16'); assert.equal(imported.abilities.gunfights, '6');
  assert.equal(imported.modifiers.speed, '18'); assert.equal(imported.modifiers.experience, '2');
  assert.deepEqual(imported.percentiles, { strength: '83', experience: '95' });
  const restored = parseCharacter(JSON.parse(exportCharacterJson(imported)));
  assert.deepEqual(restored, imported);
});

test('old sheets retain their recorded ratings without inventing the missing rolls', () => {
  const character = parseCharacter({ ...sample, percentiles: undefined, strength: '17', abilities: { ...sample.abilities, gunfights: '15' } });
  assert.equal(character.percentiles, undefined); assert.equal(character.strength, '17'); assert.equal(character.abilities.gunfights, '15');
  assert.match(characterStatReadout(character, 'strength'), /Strength 17 · recorded rating/);
  assert.match(characterStatReadout(character, 'experience'), /15 previous gunfights · Accuracy \+10/);
  const withStrength = setPercentileRoll(character, 'strength', '50');
  assert.equal(withStrength.strength, '14'); assert.equal(withStrength.abilities.gunfights, '15');
  const withExperience = setPercentileRoll(withStrength, 'experience', '60');
  assert.equal(withExperience.abilities.gunfights, '1'); assert.equal(withExperience.modifiers.experience, '-5');
  const legacyModifiers = { ...character, mode: 'modifiers' as const };
  const html = renderToStaticMarkup(React.createElement(CharacterStats, { character: legacyModifiers, onChange() {} }));
  assert.ok(!html.includes('<input')); assert.match(html, /Enter percentile rolls/);
});

test('raw Strength changes update encounter capacity while preserving wounds and working weapon choices', () => {
  const character = filledCharacter();
  let encounter = addCombatant(newEncounter('ratings'), character, 'rose');
  encounter = adjustCombatant(encounter, 'rose', 9, false); // 7 Strength lost.
  const changed = setPercentileRoll({ ...character, loadout: { weaponId: 'shotgun', customSpeed: '-5' } }, 'strength', '99');
  encounter = updateActingSheet(encounter, changed);
  assert.equal(encounter.members[0].maxStrength, 20); assert.equal(encounter.members[0].loss, 7);
  const unfinished = setPercentileRoll(changed, 'strength', '');
  assert.equal(updateActingSheet(encounter, unfinished).members[0].maxStrength, 20);
  let json = '';
  writeEncounter({ setItem(_key, value) { json = value; } }, encounter);
  const restored = readEncounter({ getItem: () => json }, 'fallback');
  assert.equal(restored.members[0].maxStrength, 20); assert.equal(restored.members[0].loss, 7);
  assert.equal(restored.members[0].sheet.percentiles?.strength, '99');
  assert.equal(restored.members[0].sheet.loadout.weaponId, 'shotgun');
});

test('presets have compatible percentile rolls and random extras keep the actual six creation rolls', () => {
  for (const preset of extraPresets) {
    const character = normalizeCharacter(createExtra(preset.id));
    assert.equal(character.strength, String(preset.strength));
    assert.equal(character.abilities.gunfights, String(preset.experience));
    assert.ok(character.percentiles?.strength); assert.ok(character.percentiles?.experience);
  }
  const rolls = [81, 75, 26, 83, 91, 95];
  let index = 0;
  const random = generateExtra('Sam', () => rolls[index++]);
  assert.equal(index, 6); assert.deepEqual(random.percentiles, { strength: '83', experience: '95' });
  assert.equal(random.abilities.speed, '81'); assert.equal(random.abilities.gunAccuracy, '75');
  assert.equal(random.abilities.throwingAccuracy, '26'); assert.equal(random.abilities.bravery, '91');
});
