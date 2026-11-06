import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EncounterPanel from './EncounterPanel';
import { HorseAdder, HorseCard } from './HorsePanel';
import MountedHitDetails from './MountedHitDetails';
import { WoundDetails } from './WoundResult';
import { sample } from './characters';
import { addCombatant, addHorse, adjustCombatant, adjustHorse, advancePhase, applyShotWounds, encounterTargets, newEncounter, readEncounter, removeCombatant, removeHorse, resolveHorseBolting, setHorseHeld, setHorseRider, settleHorse, shotTarget, undoEncounter, withDefaultTarget, writeEncounter, type ActionContext, type Encounter } from './encounter';
import { horseRemaining, horseStatus, horseStrength, parseHorse, rollHorseBolt, rollMountedHit } from './horses';
import { rollShot } from './misfires';
import { resolveWound, rollHitEffects } from './wounds';

function dice(...values: number[]) {
  let count = 0;
  return { draw: () => { assert.ok(count < values.length, 'unexpected extra die'); return values[count++]; }, count: () => count };
}
function fight() {
  let state = addCombatant(newEncounter('fight'), { ...sample, name: 'Ava' }, 'ava');
  state = addCombatant(state, { ...sample, name: 'Hetty' }, 'hetty');
  state = addHorse(state, 'Cinder', 30, 'cinder', 'hetty');
  return { ...state, actorId: 'ava', targetId: 'hetty' };
}
function context(state: Encounter, targetId = 'cinder'): ActionContext {
  return { encounterId: state.id, actorId: 'ava', targetId, turn: state.turn, phase: state.phase };
}
function injury(location = 90, severity = 40) {
  return rollHitEffects({ hit: true, weaponId: 'carbine', rangeIndex: 0, targetKind: 'horse' }, dice(location, severity).draw);
}

test('horse ratings are independent of human creation rolls and support the book’s Strength ranges', () => {
  assert.equal(horseStrength('Horse', () => { throw new Error('No die for the base rating'); }), 30);
  for (let roll = 1; roll <= 10; roll++) {
    assert.equal(horseStrength('Workhorse', () => roll), 30 + roll);
    assert.equal(horseStrength('Pony', () => roll), 30 - roll);
  }
  for (const invalid of [0, 11, 2.5, NaN]) assert.throws(() => horseStrength('Pony', () => invalid), /1–10/);
  const state = fight();
  assert.equal(state.horses![0].maxStrength, 30);
  assert.equal(state.members[1].maxStrength, 15);
  const changed = adjustHorse(state, 'cinder', 'Cinder', 40, 35, false);
  assert.equal(horseRemaining(changed.horses![0]), 35);
  assert.equal(changed.members[1].sheet.strength, '15');
  assert.equal(state.horses![0].maxStrength, 30);
  for (const value of [0, 100, 2.5, NaN]) assert.throws(() => addHorse(state, 'Horse', value, 'new'), /Strength/);
});

test('horse severity subtracts 20 without changing location, including low dice and fatal head boundary', () => {
  assert.equal(resolveWound(90, 60, 'horse').severity, 'Serious');
  assert.equal(resolveWound(90, 61, 'horse').severity, 'Mortal');
  assert.equal(resolveWound(90, 40, 'horse').severity, 'Light');
  assert.equal(resolveWound(90, 1, 'horse').severity, 'Light');
  for (let location = 1; location <= 100; location++) {
    for (let severity = 1; severity <= 100; severity++) {
      const horse = resolveWound(location, severity, 'horse');
      const equivalent = resolveWound(location, Math.max(1, severity - 20));
      assert.equal(horse.severity, equivalent.severity);
      assert.equal(horse.strengthLoss, equivalent.strengthLoss);
      assert.equal(horse.locationRoll, location); assert.equal(horse.severityRoll, severity);
      assert.equal(horse.severityModifier, -20);
      assert.ok(!horse.effects.some(effect => effect.includes('gun arm')));
    }
  }
  for (const [location, name] of [[1, 'Left rear leg'], [11, 'Right rear leg'], [21, 'Left foreleg'], [26, 'Right foreleg']] as const) assert.equal(resolveWound(location, 100, 'horse').location, name);
  assert.equal(resolveWound(26, 100).severityModifier, undefined);
  for (const value of [0, 101, NaN]) assert.throws(() => resolveWound(90, value, 'horse'), /1 to 100/);
});

test('the 60/40 mounted check works in both directions for every percentile result', () => {
  const state = fight();
  for (let roll = 1; roll <= 100; roll++) {
    const aimedRider = shotTarget(state, true, () => roll)!;
    assert.equal(aimedRider.id, roll <= 60 ? 'hetty' : 'cinder');
    assert.equal(aimedRider.targetKind, roll <= 60 ? undefined : 'horse');
    assert.equal(aimedRider.mountedHit!.intendedName, 'Hetty');
    assert.equal(aimedRider.mountedHit!.roll, roll);
    const aimedHorse = shotTarget({ ...state, targetId: 'cinder' }, true, () => roll)!;
    assert.equal(aimedHorse.id, roll <= 60 ? 'cinder' : 'hetty');
    assert.equal(aimedHorse.targetKind, roll <= 60 ? 'horse' : undefined);
    assert.equal(aimedHorse.mountedHit!.intendedName, 'Cinder');
  }
  for (const value of [0, 101, 1.5, NaN]) assert.throws(() => rollMountedHit(() => value), /1–100/);
});

test('misses, misfires, untracked targets and dismounted horses never roll interception', () => {
  const state = fight();
  const noDice = () => { throw new Error('Unneeded mounted die'); };
  assert.equal(shotTarget(state, false, noDice)!.mountedHit, undefined);
  const dud = rollShot('carbine', 'other-carbine', 100, 10, 0, () => 98);
  assert.equal(shotTarget(state, dud.hit, noDice)!.id, 'hetty');
  assert.equal(shotTarget({ ...state, targetId: '' }, true, noDice), null);
  const unmounted = setHorseRider(state, 'cinder', 'hetty', false);
  assert.equal(shotTarget(unmounted, true, noDice)!.mountedHit, undefined);
  assert.equal(shotTarget({ ...unmounted, targetId: 'cinder' }, true, noDice)!.targetKind, 'horse');
});

test('shotgun pellets share one mounted recipient and each horse wound uses its own severity adjustment', () => {
  const state = fight();
  const sequence = dice(61, 10, 90, 60, 90, 61, 26, 100, 1, 1);
  const recipient = shotTarget(state, true, sequence.draw)!;
  const result = rollHitEffects({ hit: true, weaponId: 'shotgun', rangeIndex: 0, targetKind: recipient.targetKind }, sequence.draw);
  assert.equal(recipient.id, 'cinder'); assert.equal(sequence.count(), 10);
  assert.equal(result.wounds.length, 4);
  assert.deepEqual(result.wounds.map(wound => wound.severity), ['Serious', 'Mortal', 'Serious', 'Light']);
  assert.equal(result.totalStrengthLoss, 17); assert.equal(result.mortal, true);
});

test('recorded recipients receive wounds once despite target changes, dismounting, or rider removal', () => {
  const original = fight();
  const recipient = shotTarget(original, true, () => 100)!;
  const recorded = context(original, recipient.id);
  let changed = setHorseRider(original, 'cinder', 'hetty', false);
  changed = { ...changed, targetId: 'ava', actorId: 'hetty' };
  changed = removeCombatant(changed, 'hetty');
  const result = injury(90, 60);
  const applied = applyShotWounds(changed, recorded, 'shot', result);
  assert.equal(applied.horses![0].loss, 7); assert.equal(applied.horses![0].wounds.length, 1);
  assert.equal(applied.members[0].loss, 0);
  assert.equal(applyShotWounds(applied, recorded, 'shot', result), applied);
  const undone = undoEncounter(applied);
  assert.equal(undone.horses![0].loss, 0); assert.ok(!undone.applied.includes('shot'));
  assert.equal(applyShotWounds(undone, recorded, 'shot', result).horses![0].loss, 7);
  assert.throws(() => applyShotWounds(removeHorse(changed, 'cinder'), recorded, 'missing', result), /different combatants/);
  assert.throws(() => applyShotWounds(newEncounter('other'), recorded, 'wrong-fight', result), /different shootout/);
});

test('aiming at the horse can wound its rider, including the shooter’s own mount', () => {
  const state = { ...fight(), targetId: 'cinder' };
  const recipient = shotTarget(state, true, () => 61)!;
  const wound = rollHitEffects({ hit: true, weaponId: 'carbine', rangeIndex: 0 }, dice(90, 41).draw);
  const applied = applyShotWounds(state, context(state, recipient.id), 'rider-hit', wound);
  assert.equal(applied.members[1].dead, true); assert.equal(applied.horses![0].dead, false);
  const ownMount = { ...state, actorId: 'hetty' };
  const ownRecipient = shotTarget(ownMount, true, () => 61)!;
  const ownHit = applyShotWounds(ownMount, { ...context(ownMount, ownRecipient.id), actorId: 'hetty' }, 'own-hit', wound);
  assert.equal(ownHit.members[1].dead, true);
});

test('only surviving non-leg horse wounds require bolting, and a zero-wound spread does not', () => {
  const state = fight();
  for (let location = 1; location <= 100; location++) {
    const applied = applyShotWounds(state, context(state), 'hit', injury(location, 1));
    assert.equal(applied.horses![0].boltPending, location > 30);
  }
  const fatal = applyShotWounds(state, context(state), 'fatal', injury(90, 61));
  assert.equal(horseStatus(fatal.horses![0]), 'Dead'); assert.equal(fatal.horses![0].boltPending, false);
  assert.equal(fatal.horses![0].mounted, false);
  const depleted = adjustHorse(state, 'cinder', 'Cinder', 30, 3, false);
  const knockedOut = applyShotWounds(depleted, context(depleted), 'ko', injury(90, 1));
  assert.equal(horseStatus(knockedOut.horses![0]), 'Unconscious'); assert.equal(knockedOut.horses![0].boltPending, false);
  assert.equal(knockedOut.horses![0].mounted, false);
  const empty = rollHitEffects({ hit: true, weaponId: 'scatter', rangeIndex: 3, targetKind: 'horse' }, () => 1);
  assert.equal(applyShotWounds(state, context(state), 'no-pellets', empty).horses![0].boltPending, false);
});

test('ridden or held bolting uses the inclusive 40% check and referee adjustment', () => {
  assert.equal(rollHorseBolt(true, 0, () => 40).bolted, true);
  assert.equal(rollHorseBolt(true, 0, () => 41).bolted, false);
  assert.equal(rollHorseBolt(true, 10, () => 50).bolted, true);
  assert.equal(rollHorseBolt(true, -10, () => 31).bolted, false);
  assert.equal(rollHorseBolt(true, -100, () => 1).bolted, false);
  assert.equal(rollHorseBolt(true, 100, () => 100).bolted, true);
  assert.deepEqual(rollHorseBolt(false, 0, () => { throw new Error('No control roll'); }), { roll: null, chance: 100, bolted: true });
  for (const modifier of [NaN, 101, 1.5]) assert.throws(() => rollHorseBolt(true, modifier), /adjustment/);
  const state = applyShotWounds(fight(), context(fight()), 'hit', injury());
  const bolted = resolveHorseBolting(state, 'cinder', 0, () => 40);
  assert.equal(bolted.horses![0].bolting, true); assert.equal(bolted.horses![0].mounted, true);
  assert.equal(bolted.horses![0].boltPending, false);
  assert.match(bolted.log[0], /random direction/);
  assert.throws(() => resolveHorseBolting(bolted, 'cinder', 0), /no pending/);
  assert.equal(undoEncounter(bolted).horses![0].boltPending, true);
  assert.equal(settleHorse(bolted, 'cinder').horses![0].bolting, false);
  const unmounted = setHorseHeld(setHorseRider(state, 'cinder', null, false), 'cinder', true);
  assert.equal(resolveHorseBolting(unmounted, 'cinder', 0, () => 41).horses![0].bolting, false);
  const loose = setHorseHeld(unmounted, 'cinder', false);
  assert.equal(resolveHorseBolting(loose, 'cinder', 0, () => { throw new Error('No control die'); }).horses![0].bolting, true);
});

test('mounting validates living horse and rider, prevents duplicate mounts, and preserves dismounted links', () => {
  const state = fight();
  assert.throws(() => addHorse(state, 'Second mount', 30, 'second', 'hetty'), /already mounted/);
  const second = addHorse(state, 'Spare', 35, 'spare');
  assert.throws(() => setHorseRider(second, 'spare', 'hetty', true), /only mount one/);
  const dismounted = setHorseRider(state, 'cinder', 'hetty', false);
  assert.equal(dismounted.horses![0].riderId, 'hetty'); assert.equal(dismounted.horses![0].mounted, false);
  assert.equal(setHorseRider(dismounted, 'cinder', 'hetty', true).horses![0].mounted, true);
  assert.throws(() => setHorseRider(dismounted, 'cinder', 'missing', true), /existing rider/);
  assert.throws(() => setHorseRider(adjustCombatant(dismounted, 'hetty', 0, false), 'cinder', 'hetty', true), /standing/);
  assert.throws(() => setHorseRider(adjustHorse(dismounted, 'cinder', 'Cinder', 30, 0, false), 'cinder', 'hetty', true), /standing/);
  assert.throws(() => addHorse(state, '', 30, 'empty'), /name/);
  assert.throws(() => addHorse(state, 'Other', 30, 'hetty'), /already in use/);
  assert.throws(() => addCombatant(state, sample, 'cinder'), /already in/);
});

test('horse targets participate in automatic selection, while brawling retains human targets', () => {
  let state = addCombatant(newEncounter('solo'), sample, 'ava');
  state = addHorse(state, 'Cinder', 30, 'cinder');
  assert.equal(state.targetId, 'cinder');
  assert.equal(encounterTargets(state)[0].kind, 'horse');
  const brawl = withDefaultTarget(advancePhase(state));
  assert.equal(encounterTargets(brawl).length, 0); assert.equal(brawl.targetId, '');
  const full = fight();
  assert.equal(withDefaultTarget({ ...full, targetId: '' }).targetId, '');
  const removed = removeHorse(full, 'cinder');
  assert.equal(removed.targetId, 'hetty');
  assert.equal(undoEncounter(removed).horses!.length, 1);
  const noRider = removeCombatant(full, 'hetty');
  assert.equal(noRider.horses![0].riderId, null); assert.equal(noRider.horses![0].mounted, false);
  assert.equal(noRider.targetId, 'cinder');
  assert.equal(undoEncounter(noRider).horses![0].mounted, true);
});

test('horses round-trip through saved shootouts with raw wound dice, mounted links, held status and bolting', () => {
  let state = applyShotWounds(fight(), context(fight()), 'hit', injury(90, 60));
  state = resolveHorseBolting(state, 'cinder', -10, () => 20);
  state = setHorseHeld(state, 'cinder', true);
  state = { ...state, targetId: 'cinder' };
  let json = '';
  writeEncounter({ setItem: (_key, value) => { json = value; } }, state);
  const restored = readEncounter({ getItem: () => json }, 'fallback');
  const { previous: _undo, ...expected } = state;
  assert.deepEqual(restored, expected);
  assert.equal(restored.horses![0].wounds[0].severity, 'Serious');
  assert.equal(restored.targetId, 'cinder');
  const dirty = JSON.parse(json);
  dirty.horses[0].wounds[0].severity = 'Mortal'; dirty.horses[0].wounds[0].severityModifier = 99;
  assert.equal(readEncounter({ getItem: () => JSON.stringify(dirty) }, 'fallback').horses![0].wounds[0].severityModifier, -20);
  const old = { ...fight(), horses: undefined, targetId: 'hetty' };
  assert.equal(readEncounter({ getItem: () => JSON.stringify(old) }, 'fallback').horses, undefined);
  for (const override of [{ maxStrength: 0 }, { loss: -1 }, { mounted: 'yes' }, { lastBolt: { roll: 50, chance: 40, bolted: true } }, { id: 'ava' }]) {
    const invalid = { ...state, horses: [{ ...state.horses![0], ...override }] };
    assert.equal(readEncounter({ getItem: () => JSON.stringify(invalid) }, 'fallback').id, 'fallback');
  }
  const orphan = parseHorse({ ...state.horses![0], dead: true, boltPending: true });
  assert.equal(orphan.mounted, false); assert.equal(orphan.boltPending, false);
});

test('horse UI shows ratings and mounted controls without putting horses in acting-character order', () => {
  const state = fight();
  const props = { encounter: state, current: sample, saved: [], activeId: null, error: '', storageError: '', onChange() {}, onError() {}, onAdvance() {}, onReset() {}, onActor() {}, onTarget() {} };
  const html = renderToStaticMarkup(React.createElement(EncounterPanel, props));
  const acting = html.match(/<select[\s\S]*?<\/select>/)![0];
  assert.ok(!acting.includes('Cinder')); assert.match(html, /Cinder \(horse\)/);
  assert.match(html, /30 \/ 30 Strength/); assert.match(html, /Dismount/); assert.match(html, /Add horse/);
  const adder = renderToStaticMarkup(React.createElement(HorseAdder, { ...props, onClose() {} }));
  assert.match(adder, /Strength rating/); assert.match(adder, /value="30"/); assert.ok(!adder.includes('percentile'));
  const wounded = applyShotWounds(state, context(state), 'hit', injury(90, 60));
  const horseHtml = renderToStaticMarkup(React.createElement(HorseCard, { ...props, encounter: wounded, horse: wounded.horses![0] }));
  assert.match(horseHtml, /Check for bolting/); assert.match(horseHtml, /base chance 40%/); assert.match(horseHtml, /− 20 =/);
  const detail = renderToStaticMarkup(React.createElement(MountedHitDetails, { result: { roll: 61, intendedName: 'Hetty', actualName: 'Cinder' } }));
  assert.match(detail, /Cinder takes the hit/);
  const woundHtml = renderToStaticMarkup(React.createElement(WoundDetails, { result: injury(26, 100) }));
  assert.match(woundHtml, /Right foreleg/); assert.ok(!woundHtml.includes('gun arm'));
});
