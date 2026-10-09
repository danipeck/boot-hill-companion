import assert from 'node:assert/strict';
import test from 'node:test';
import { exportCharacterJson, importCharacter, loadSaved, parseCharacter, readLibrary, sample, setPercentileRoll, type Character } from './characters';
import { addCombatant, combatantsBySpeed, combatantSpeed, newEncounter, readEncounter, updateActingSheet, writeEncounter } from './encounter';
import { createExtra, extraPresets, generateExtra } from './extras';
import { abilityModifiers, calculate, gunfightsFromRoll, strengthFromScore, weaponProfiles } from './rules';

function totals(character: Character, weaponId = character.loadout.weaponId) {
  const weapon = weaponProfiles.find(item => item.id === weaponId)!;
  const result = calculate(abilityModifiers(character.abilities, weapon.speed));
  return { speed: result.firstShot, accuracy: (weapon.attack === 'gun' ? result.gunHit : result.throwingHit) + weapon.bonus };
}

test('all presets have usable raw scores and respect the book\'s NPC ability ranges', () => {
  // p. 18 role categories mapped to p. 5 percentile bands. Strength and
  // Experience retain Astra's examples, including her experienced Sheriff.
  const roleRanges: Record<string, [number, number][]> = {
    'bank-teller': [[1, 100], [36, 85], [1, 100], [1, 100]],
    bartender: [[21, 90], [51, 95], [36, 95], [36, 100]],
    'bounty-hunter': [[66, 100], [66, 100], [51, 100], [81, 100]],
    'cavalry-trooper': [[1, 100], [51, 95], [1, 100], [1, 100]],
    cowboy: [[1, 100], [36, 98], [51, 95], [1, 100]],
    deputy: [[36, 90], [51, 95], [26, 75], [66, 98]],
    'deputy-us-marshal': [[66, 95], [66, 98], [51, 85], [81, 98]],
    detective: [[36, 95], [51, 95], [1, 100], [36, 100]],
    drifter: [[36, 95], [51, 95], [1, 100], [36, 100]],
    gambler: [[51, 100], [51, 100], [51, 95], [66, 100]],
    gunfighter: [[66, 95], [66, 98], [51, 85], [81, 98]],
    homesteader: [[6, 50], [1, 100], [1, 100], [1, 100]],
    indian: [[21, 95], [51, 100], [66, 100], [66, 98]],
    merchant: [[1, 50], [1, 100], [1, 100], [1, 100]],
    miner: [[11, 80], [36, 85], [1, 100], [36, 100]],
    'saloon-gal': [[6, 65], [1, 100], [1, 100], [1, 100]],
    sheriff: [[11, 80], [36, 85], [26, 75], [1, 100]],
    'stage-guard': [[11, 80], [36, 85], [26, 75], [1, 100]],
    'town-marshal': [[36, 90], [51, 95], [26, 75], [66, 98]],
  };
  assert.equal(extraPresets.length, 19);
  assert.equal(new Set(extraPresets.map(preset => preset.id)).size, 19);
  for (const preset of extraPresets) {
    const character = parseCharacter(createExtra(preset.id));
    assert.equal(character.mode, 'scores');
    assert.equal(character.strength, String(preset.strength));
    assert.equal(character.morale, character.abilities.bravery);
    assert.equal(character.abilities.gunfights, String(preset.experience));
    for (const [index, key] of ['speed', 'gunAccuracy', 'throwingAccuracy', 'bravery'].entries()) {
      const score = Number(character.abilities[key as keyof Character['abilities']]);
      const [min, max] = roleRanges[preset.id][index];
      assert.ok(score >= min && score <= max, `${preset.name}: ${key}`);
    }
    assert.notEqual(combatantSpeed(addCombatant(newEncounter('preset'), character, preset.id).members[0]).score, null);
  }
});

test('changing weapons adjusts combat totals and leaves raw abilities and acting order alone', () => {
  const character = createExtra('bartender');
  const before = structuredClone(character.abilities);
  const withScatter = totals(character);
  const withRevolver = totals(character, 'double-action');
  assert.equal(withScatter.accuracy - withRevolver.accuracy, 20);
  assert.equal(withRevolver.speed - withScatter.speed, 5);
  assert.deepEqual(character.abilities, before);
  const state = addCombatant(addCombatant(newEncounter('order'), character, 'bartender'), createExtra('gunfighter'), 'gunfighter');
  const changed = state.members.map(member => ({ ...member, sheet: { ...member.sheet, loadout: { weaponId: 'buffalo', customSpeed: '-10' } } }));
  assert.deepEqual(combatantsBySpeed(state.members).map(member => member.id), ['gunfighter', 'bartender']);
  assert.deepEqual(combatantsBySpeed(changed).map(member => member.id), ['gunfighter', 'bartender']);
  assert.equal(combatantSpeed(state.members[0]).label, 'Speed 55 (+6)');
});

test('both gun and bow accuracy come from genuine ability scores', () => {
  const character = createExtra('indian');
  assert.equal(character.loadout.weaponId, 'bow');
  assert.equal(totals(character).accuracy, 70);
  assert.equal(totals(character, 'double-action').accuracy, 62);
  assert.equal(character.abilities.throwingAccuracy, '90');
});

test('custom extras use six independent NPC creation rolls, including Strength and Experience tables', () => {
  const values = [5, 15, 25, 83, 98, 95];
  let calls = 0;
  const character = generateExtra('  Rose  ', () => values[calls++]);
  assert.equal(calls, 6);
  assert.deepEqual(character.abilities, { speed: '5', gunAccuracy: '15', throwingAccuracy: '25', bravery: '98', gunfights: '6' });
  assert.equal(character.strength, '16');
  assert.equal(character.morale, '98');
  assert.equal(character.name, 'Rose');
  assert.equal(character.loadout.weaponId, 'double-action');
  assert.equal(parseCharacter(character).mode, 'scores');
  // Low rolls stay low for NPCs; the player-only creation boosts are absent.
  assert.equal(character.abilities.speed, '5');
  assert.equal(generateExtra(undefined, () => 100).strength, '20');
  assert.equal(generateExtra(undefined, () => 100).abilities.gunfights, '11');
  for (const invalid of [0, 101, 1.5, NaN]) assert.throws(() => generateExtra('Bad dice', () => invalid), /creation rolls/);
});

test('Strength and starting Experience boundaries match the printed creation chart', () => {
  const strengthCounts = Array.from({ length: 100 }, (_, index) => strengthFromScore(index + 1)).reduce<Record<number, number>>((counts, rating) => ({ ...counts, [rating]: (counts[rating] ?? 0) + 1 }), {});
  assert.deepEqual(strengthCounts, { 8: 2, 9: 3, 10: 5, 11: 7, 12: 8, 13: 15, 14: 20, 15: 15, 16: 8, 17: 7, 18: 5, 19: 3, 20: 2 });
  const experienceCounts = Array.from({ length: 100 }, (_, index) => gunfightsFromRoll(index + 1)).reduce<Record<number, number>>((counts, fights) => ({ ...counts, [fights]: (counts[fights] ?? 0) + 1 }), {});
  assert.deepEqual(experienceCounts, { 0: 40, 1: 20, 2: 15, 3: 10, 4: 5, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1 });
});

test('new extras have independent scores and can be renamed without changing a preset', () => {
  const first = createExtra('gunfighter', '  Rose  ');
  const second = createExtra('gunfighter');
  first.abilities.speed = '1'; first.loadout.weaponId = 'shotgun';
  assert.equal(first.name, 'Rose'); assert.equal(first.modifiers.name, 'Rose');
  assert.equal(second.name, 'Gunfighter'); assert.equal(second.abilities.speed, '93');
  assert.equal(second.loadout.weaponId, 'fast-draw');
  assert.throws(() => createExtra('unknown'), /preset/);
  const random = generateExtra('Sam', () => 30);
  const another = generateExtra('Sam', () => 80);
  assert.equal(random.abilities.speed, '30'); assert.equal(another.abilities.speed, '80');
});

function legacyGunfighter(): Character {
  return {
    name: 'Rose', strength: '15', morale: '93', mode: 'modifiers',
    abilities: { speed: '', gunAccuracy: '', throwingAccuracy: '', bravery: '', gunfights: '6' },
    modifiers: { name: 'Rose', speed: '19', braverySpeed: '0', weaponSpeed: '10', gunAccuracy: '28', throwingAccuracy: '0', braveryAccuracy: '0', experience: '2' },
    loadout: { weaponId: 'shotgun', customSpeed: '-5' },
  };
}

test('old blank-score presets gain book-based scores without losing names, weapon choices or wound tracking', () => {
  for (const mode of ['modifiers', 'scores'] as const) {
    const legacy = { ...legacyGunfighter(), mode };
    const upgraded = parseCharacter(legacy);
    assert.equal(upgraded.mode, 'scores'); assert.equal(upgraded.abilities.speed, '93');
    assert.equal(upgraded.name, 'Rose'); assert.equal(upgraded.strength, '15');
    assert.deepEqual(upgraded.loadout, legacy.loadout);
    // Seed the old serialized form directly rather than normalizing it first.
    const member = addCombatant(newEncounter('old'), createExtra('gunfighter'), 'rose').members[0];
    const encounter = { ...newEncounter('old'), turn: 3, phase: 'brawl-1', actorId: 'rose', members: [{ ...member, sheet: legacy, maxStrength: 15, loss: 7, modifier: -2, nextModifier: -1 }] };
    const restored = readEncounter({ getItem: () => JSON.stringify(encounter) }, 'fallback');
    assert.equal(restored.members[0].sheet.abilities.speed, '93');
    assert.equal(restored.members[0].loss, 7); assert.equal(restored.members[0].maxStrength, 15);
    assert.equal(restored.members[0].modifier, -2); assert.equal(restored.members[0].nextModifier, -1);
    assert.equal(restored.turn, 3); assert.equal(restored.phase, 'brawl-1');
    const library = readLibrary({ getItem: () => JSON.stringify({ version: 1, draft: legacy, activeId: 'rose', characters: [{ id: 'rose', character: legacy }] }) });
    assert.equal(library.draft.abilities.speed, '93');
    assert.equal(library.characters[0].character.abilities.speed, '93');
  }
  assert.deepEqual(parseCharacter(sample), { ...sample, modifiers: { ...sample.modifiers, name: sample.name } });
  const partiallyEdited = { ...legacyGunfighter(), abilities: { ...legacyGunfighter().abilities, speed: '88' } };
  assert.equal(parseCharacter(partiallyEdited, false).abilities.speed, '88');
  const editedModifiers = { ...legacyGunfighter(), modifiers: { ...legacyGunfighter().modifiers, speed: '12' } };
  assert.equal(parseCharacter(editedModifiers, false).mode, 'modifiers');
});

test('presets and random extras survive editing, refresh, and JSON save/load', () => {
  for (const character of [createExtra('cavalry-trooper', 'Pat'), generateExtra('Pat', () => 50)]) {
    let encounter = addCombatant(newEncounter('extras'), character, 'pat');
    encounter = addCombatant(encounter, createExtra('cavalry-trooper'), 'another-trooper');
    const edited = setPercentileRoll(setPercentileRoll(encounter.members[0].sheet, 'strength', '65'), 'bravery', '70');
    encounter = updateActingSheet(encounter, { ...edited, loadout: { weaponId: 'shotgun', customSpeed: '-5' } });
    let json = '';
    writeEncounter({ setItem: (_key, value) => { json = value; } }, encounter);
    const restored = readEncounter({ getItem: () => json }, 'fallback');
    assert.equal(restored.members[0].sheet.abilities.bravery, '70');
    assert.equal(restored.members[0].maxStrength, 15);
    assert.equal(restored.members[0].sheet.loadout.weaponId, 'shotgun');
    assert.equal(restored.members[1].sheet.abilities.bravery, '50');
    assert.equal(restored.members[1].sheet.loadout.weaponId, 'carbine');
    const library = importCharacter(readLibrary({ getItem: () => null }), exportCharacterJson(restored.members[0].sheet), 'saved-pat');
    assert.deepEqual(loadSaved(library, 'saved-pat').draft, restored.members[0].sheet);
  }
});
