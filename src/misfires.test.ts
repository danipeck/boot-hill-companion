import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MisfireDetails, { ShotOutcome } from './MisfireDetails';
import EncounterPanel from './EncounterPanel';
import App from './App';
import { exportCharacterJson, importCharacter, parseCharacter, readLibrary, sample, saveDraft, writeLibrary } from './characters';
import { addCombatant, adjustCombatant, advancePhase, applyMisfire, combatantStatus, jammedWeapon, newEncounter, readEncounter, startClearingJam, trackedShootingModifiers, undoEncounter, updateActingSheet, writeEncounter, type Encounter, type MisfireContext } from './encounter';
import { defaultMisfireProfile, misfireProfiles, rollMisfire, rollShot, shotDie, shotLabel, type MisfireProfileId } from './misfires';
import { weaponProfiles } from './rules';

function dice(...values: number[]) {
  let count = 0;
  return { draw: () => { assert.ok(count < values.length, 'unexpected extra die'); return values[count++]; }, count: () => count };
}
function fight() {
  const first = addCombatant(newEncounter('fight'), { ...sample, name: 'Hetty', loadout: { weaponId: 'carbine', customSpeed: '5' } }, 'hetty');
  return addCombatant(first, { ...sample, name: 'Stranger' }, 'stranger');
}
function context(state: Encounter): MisfireContext {
  return { encounterId: state.id, actorId: 'hetty', turn: state.turn, phase: state.phase };
}
function fullTurn(state: Encounter) { return advancePhase(advancePhase(advancePhase(state))); }
const jam = () => rollMisfire('other-carbine', () => 100);
const explosion = (location = 26, severity = 1) => rollMisfire('cap-ball', dice(100, 50, location, severity).draw);

test('all 100 results match every row of the supplied misfire table', () => {
  const rows: [MisfireProfileId, number, number, 'explosion' | 'jam' | null][] = [
    ['derringer', 98, 100, null], ['cap-ball', 95, 99, 'explosion'],
    ['revolver', 99, 100, null], ['shotgun', 99, 100, null],
    ['civil-war-carbine', 95, 97, 'jam'], ['civil-war-rifle', 95, 97, 'jam'],
    ['other-rifle', 97, 98, 'jam'], ['other-carbine', 97, 98, 'jam'],
    ['buffalo', 98, 100, null], ['army', 98, 100, null],
  ];
  assert.equal(rows.length, misfireProfiles.length);
  for (const [id, safe, dud, failure] of rows) {
    for (let roll = 1; roll <= 100; roll++) {
      const sequence = dice(roll, 51);
      const result = rollMisfire(id, sequence.draw);
      assert.equal(result.outcome, roll <= safe ? 'ready' : roll <= dud ? 'dud' : failure, `${id}: ${roll}`);
      assert.equal(result.roll, roll);
      assert.equal(sequence.count(), result.outcome === 'explosion' ? 2 : 1);
    }
  }
});

test('every standard firearm defaults to its matching table', () => {
  const expected: Record<string, MisfireProfileId> = {
    'double-action': 'revolver', 'single-action': 'revolver', 'fast-draw': 'revolver',
    'long-barrel': 'revolver', 'cap-ball': 'cap-ball', derringer: 'derringer',
    rifle: 'other-rifle', carbine: 'other-carbine', buffalo: 'buffalo',
    shotgun: 'shotgun', scatter: 'shotgun', 'custom-gun': 'revolver',
  };
  for (const weapon of weaponProfiles.filter(item => item.attack === 'gun')) assert.equal(defaultMisfireProfile(weapon.id), expected[weapon.id]);
});

test('explosion injury is 50% inclusive and uses one location/severity wound', () => {
  const injured = explosion();
  assert.equal(injured.injuryRoll, 50);
  assert.equal(injured.injury!.wounds.length, 1);
  assert.equal(injured.injury!.totalStrengthLoss, 3);
  assert.equal(injured.injury!.spreadDie, null);
  assert.equal(injured.injury!.wounds[0].locationRoll, 26);
  assert.equal(injured.injury!.wounds[0].severityRoll, 1);
  assert.equal(explosion(86, 41).injury!.mortal, true);
  assert.equal(rollMisfire('cap-ball', dice(100, 51).draw).injury, null);
});

test('misfires fail even a guaranteed hit and never roll a hit die', () => {
  for (const [weapon, profile, rolls, label] of [
    ['derringer', 'derringer', [99], 'Dud round'],
    ['carbine', 'other-carbine', [100], 'Jammed shell'],
    ['cap-ball', 'cap-ball', [100, 51], 'Explosion'],
    ['cap-ball', 'cap-ball', [100, 50, 1, 1], 'Explosion'],
  ] as const) {
    const sequence = dice(...rolls);
    const result = rollShot(weapon, profile, 100, 10, 20, sequence.draw);
    assert.equal(result.hit, false); assert.equal(result.roll, null);
    assert.equal(result.chance, 130); assert.equal(shotDie(result), rolls[0]);
    assert.equal(shotLabel(result), label); assert.equal(sequence.count(), rolls.length);
  }
});

test('ordinary attacks have an independent hit die and preserve hit thresholds', () => {
  for (const [base, range, situation, hitRoll, hit] of [[50, 10, -5, 55, true], [50, 10, -5, 56, false], [0, 0, 0, 1, false], [100, 10, 0, 100, true]] as const) {
    const sequence = dice(98, hitRoll);
    const result = rollShot('derringer', 'derringer', base, range, situation, sequence.draw);
    assert.equal(result.misfire, null); assert.equal(result.roll, hitRoll);
    assert.equal(result.hit, hit); assert.equal(sequence.count(), 2); assert.equal(shotDie(result), hitRoll);
  }
  assert.equal(rollShot('custom-gun', 'civil-war-rifle', 50, 0, 0, () => 98).misfire!.outcome, 'jam');
});

test('thrown and launched weapons skip the misfire check', () => {
  for (const weapon of weaponProfiles.filter(item => item.attack === 'throw')) {
    const sequence = dice(100);
    const result = rollShot(weapon.id, 'cap-ball', 100, 0, 0, sequence.draw);
    assert.equal(result.misfire, null); assert.equal(result.hit, true); assert.equal(sequence.count(), 1);
  }
});

test('invalid dice, profiles, weapons, and modifiers fail before resolving an attack', () => {
  for (const value of [0, 101, 1.5, NaN]) assert.throws(() => rollMisfire('revolver', () => value), /1–100/);
  assert.throws(() => rollMisfire('wrong' as MisfireProfileId), /valid misfire table/);
  assert.throws(() => rollShot('unknown', 'revolver', 50, 0, 0), /Unknown weapon/);
  assert.throws(() => rollShot('carbine', 'other-carbine', NaN, 0, 0), /whole numbers/);
});

test('chosen tables survive character import/export and the saved library', () => {
  const character = { ...sample, loadout: { weaponId: 'custom-gun', customSpeed: '-10', misfireProfile: 'civil-war-rifle' as const } };
  assert.deepEqual(importCharacter(readLibrary({ getItem: () => null }), exportCharacterJson(character), 'imported').draft.loadout, character.loadout);
  assert.deepEqual(parseCharacter(sample).loadout, sample.loadout);
  assert.throws(() => parseCharacter({ ...character, loadout: { ...character.loadout, misfireProfile: 'wrong' } }), /valid misfire table/);
  let stored = '';
  const storage = { getItem: () => stored || null, setItem: (_key: string, value: string) => { stored = value; } };
  const initial = readLibrary(storage);
  const saved = saveDraft({ ...initial, draft: character }, 'custom');
  writeLibrary(storage, saved);
  assert.deepEqual(readLibrary(storage).draft.loadout, character.loadout);
  assert.ok(readLibrary(storage).characters.some(item => item.character.loadout.misfireProfile === 'civil-war-rifle'));
});

test('jam applies once to the recorded shooter and weapon despite actor or weapon switches', () => {
  const before = fight();
  const changed = { ...before, actorId: 'stranger', targetId: 'hetty' };
  const state = applyMisfire(changed, context(before), 'jam', 'carbine', jam());
  assert.ok(jammedWeapon(state.members[0], 'carbine', 1));
  assert.equal(jammedWeapon(state.members[1], 'carbine', 1), null);
  assert.equal(jammedWeapon(state.members[0], 'rifle', 1), null);
  assert.equal(applyMisfire(state, context(before), 'jam', 'carbine', jam()), state);
  const switched = updateActingSheet({ ...state, actorId: 'hetty' }, { ...state.members[0].sheet, loadout: { weaponId: 'knife', customSpeed: '5' } });
  assert.ok(jammedWeapon(switched.members[0], 'carbine', 1));
  assert.equal(before.members[0].weaponJams, undefined);
});

test('jams never clear on their own; clearing takes exactly three full turns', () => {
  let state = applyMisfire(fight(), context(fight()), 'jam', 'carbine', jam());
  state = fullTurn(fullTurn(state));
  assert.ok(jammedWeapon(state.members[0], 'carbine', 3));
  state = startClearingJam(state, 'hetty', 'carbine');
  assert.equal(state.members[0].weaponJams!.carbine.clearAtTurn, 6);
  assert.equal(startClearingJam(state, 'hetty', 'carbine'), state);
  for (let turn = 3; turn < 6; turn++) {
    assert.equal(state.turn, turn); assert.ok(jammedWeapon(state.members[0], 'carbine', turn));
    state = advancePhase(state); assert.ok(jammedWeapon(state.members[0], 'carbine', turn));
    state = advancePhase(state); assert.ok(jammedWeapon(state.members[0], 'carbine', turn));
    state = advancePhase(state);
  }
  assert.equal(state.turn, 6); assert.equal(jammedWeapon(state.members[0], 'carbine', 6), null);
  assert.deepEqual(state.members[0].weaponJams, {});
  const undone = undoEncounter(state);
  assert.ok(jammedWeapon(undone.members[0], 'carbine', 5));
});

test('jam save/load and Undo preserve clearing progress and restore result eligibility', () => {
  const before = fight();
  const jammed = applyMisfire(before, context(before), 'jam', 'carbine', jam());
  assert.equal(undoEncounter(jammed).members[0].weaponJams, undefined);
  assert.ok(!undoEncounter(jammed).applied.includes('jam'));
  assert.ok(applyMisfire(undoEncounter(jammed), context(before), 'jam', 'carbine', jam()).members[0].weaponJams);
  const clearing = startClearingJam(jammed, 'hetty', 'carbine');
  assert.equal(undoEncounter(clearing).members[0].weaponJams!.carbine.clearAtTurn, null);
  let stored = '';
  writeEncounter({ setItem: (_key, value) => { stored = value; } }, fullTurn(clearing));
  const restored = readEncounter({ getItem: () => stored }, 'fallback');
  assert.equal(restored.turn, 2); assert.equal(restored.members[0].weaponJams!.carbine.clearAtTurn, 4);
  assert.equal(fullTurn(fullTurn(restored)).members[0].weaponJams!.carbine, undefined);
  assert.equal(readEncounter({ getItem: () => JSON.stringify(before) }, 'fallback').members[0].weaponJams, undefined);
  for (const weaponJams of [[], null, { bow: { clearAtTurn: null } }, { carbine: { clearAtTurn: -1 } }, { carbine: {} }]) {
    const invalid = { ...before, members: [{ ...before.members[0], weaponJams }] };
    assert.equal(readEncounter({ getItem: () => JSON.stringify(invalid) }, 'fallback').id, 'fallback');
  }
});

test('explosion wounds the shooter without requiring a target and updates combat penalties', () => {
  const first = fight();
  const solo = { ...first, members: [first.members[0]], actorId: '', targetId: '' };
  const injured = applyMisfire(solo, context(first), 'explosion', 'cap-ball', explosion());
  assert.equal(injured.members[0].loss, 3); assert.equal(injured.members[0].wounds.length, 1);
  assert.equal(trackedShootingModifiers(injured.members[0], 'right').arm, -25);
  assert.equal(applyMisfire(injured, context(first), 'explosion', 'cap-ball', explosion()), injured);
  assert.equal(undoEncounter(injured).members[0].loss, 0);
  const fatal = applyMisfire(first, context(first), 'fatal', 'cap-ball', explosion(86, 41));
  assert.equal(combatantStatus(fatal.members[0]), 'Dead'); assert.equal(fatal.members[1].loss, 0);
  const lowStrength = adjustCombatant(first, 'hetty', 3, false);
  assert.equal(combatantStatus(applyMisfire(lowStrength, context(first), 'ko', 'cap-ball', explosion()).members[0]), 'Unconscious');
});

test('stale or invalid misfires and clearing actions cannot change the tracker', () => {
  const state = fight();
  assert.throws(() => applyMisfire(newEncounter('other'), context(state), 'jam', 'carbine', jam()), /different shootout/);
  assert.throws(() => applyMisfire(fullTurn(state), context(state), 'jam', 'carbine', jam()), /shooting turn/);
  assert.throws(() => applyMisfire(advancePhase(state), context(state), 'jam', 'carbine', jam()), /shooting turn/);
  assert.throws(() => applyMisfire(adjustCombatant(state, 'hetty', 0, false), context(state), 'jam', 'carbine', jam()), /cannot act/);
  assert.throws(() => applyMisfire(state, context(state), 'jam', 'knife', jam()), /Only firearms/);
  const jammed = applyMisfire(state, context(state), 'jam', 'carbine', jam());
  assert.throws(() => applyMisfire(jammed, context(state), 'another', 'carbine', jam()), /already jammed/);
  assert.throws(() => startClearingJam(advancePhase(jammed), 'hetty', 'carbine'), /shooting phase/);
  assert.throws(() => startClearingJam(adjustCombatant(jammed, 'hetty', 0, false), 'hetty', 'carbine'), /standing/);
  assert.throws(() => startClearingJam(state, 'hetty', 'carbine'), /not jammed/);
  assert.equal(applyMisfire(state, context(state), 'dud', 'carbine', rollMisfire('other-carbine', () => 98)), state);
});

test('misfire displays label the actual die, injury, and clearing countdown clearly', () => {
  const shot = rollShot('carbine', 'other-carbine', 100, 0, 0, () => 100);
  const html = renderToStaticMarkup(React.createElement(ShotOutcome, { result: shot }));
  assert.match(html, /Jammed shell/); assert.match(html, /Misfire d100/); assert.match(html, /attack failed/);
  assert.ok(!html.includes('against'));
  const injury = renderToStaticMarkup(React.createElement(MisfireDetails, { result: explosion(), shooter: 'Hetty' }));
  assert.match(injury, /Hetty/); assert.match(injury, /injury d100/); assert.match(injury, /Light/);
  const state = applyMisfire(fight(), context(fight()), 'jam', 'carbine', jam());
  const props = { encounter: state, current: state.members[0].sheet, saved: [], activeId: null, error: '', storageError: '', onChange() {}, onError() {}, onAdvance() {}, onReset() {}, onActor() {}, onTarget() {} };
  const jammedHtml = renderToStaticMarkup(React.createElement(EncounterPanel, props));
  assert.match(jammedHtml, /Repeating carbine · jammed/); assert.match(jammedHtml, /Start clearing \(3 turns\)/);
  const clearingHtml = renderToStaticMarkup(React.createElement(EncounterPanel, { ...props, encounter: fullTurn(startClearingJam(state, 'hetty', 'carbine')) }));
  assert.match(clearingHtml, /2 turns left · ready turn 4/);
});

test('the combat page blocks a jammed weapon, allows another weapon, and skips throwing tables', () => {
  const globals = ['document', 'window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset: { theme: 'dark' } } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { pathname: '/' } } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    let state = applyMisfire(fight(), context(fight()), 'jam', 'carbine', jam());
    const page = () => {
      writeEncounter(storage, state);
      const library = readLibrary({ getItem: () => null });
      writeLibrary(storage, { ...library, draft: state.members[0].sheet });
      return renderToStaticMarkup(React.createElement(App));
    };
    let html = page();
    assert.match(html, /This weapon is jammed/);
    assert.match(html.match(/<section class="shot-card card">[\s\S]*?<\/section>/)![0], /class="roll-button" disabled=""/);
    assert.match(html, /Hit chance is before the separate misfire check/);
    state = startClearingJam(state, 'hetty', 'carbine');
    html = page();
    assert.match(html, /being cleared and will be ready on turn 4/);
    for (const weaponId of ['rifle', 'knife']) {
      state = updateActingSheet(state, { ...state.members[0].sheet, loadout: { weaponId, customSpeed: '5' } });
      html = page();
      assert.ok(!html.match(/<section class="shot-card card">[\s\S]*?<\/section>/)![0].includes('class="roll-button" disabled=""'));
      assert.equal(html.includes('class="misfire-table"'), weaponId === 'rifle');
    }
  } finally {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
