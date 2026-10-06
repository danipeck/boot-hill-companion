import assert from 'node:assert/strict';
import test from 'node:test';
import { continueHold, defaultBrawlOptions, resolveBrawl } from './brawling';
import { sample } from './characters';
import { addCombatant, adjustCombatant, advancePhase, applyBrawl, applyShotWounds, combatantsBySpeed, combatantSpeed, combatantStatus, encounterKey, newEncounter, readEncounter, releaseHold, remainingStrength, removeCombatant, trackedShootingModifiers, undoEncounter, updateActingSheet, withDefaultTarget, writeEncounter, type ActionContext, type Encounter } from './encounter';
import { resolveWound, type HitEffects } from './wounds';

function fight() {
  let state = addCombatant(newEncounter('fight'), { ...sample, name: 'Juan', strength: '13' }, 'juan');
  state = addCombatant(state, { ...sample, name: 'Sam', strength: '15' }, 'sam');
  return { ...state, actorId: 'juan', targetId: 'sam' };
}
function context(state: Encounter, actorId = 'juan', targetId = 'sam'): ActionContext {
  return { encounterId: state.id, turn: state.turn, phase: state.phase, actorId, targetId };
}
function hit(location: number, severity: number): HitEffects {
  const wound = resolveWound(location, severity);
  return { spreadRoll: null, spreadDie: null, wounds: [wound], totalStrengthLoss: wound.strengthLoss ?? 0, mortal: wound.severity === 'Mortal' };
}

test('Speed ordering compares sheet scores and modifiers on a common scale', () => {
  const base = fight().members[0];
  const members = [
    { ...base, id: 'slow', sheet: { ...base.sheet, abilities: { ...base.sheet.abilities, speed: '80' } } },
    { ...base, id: 'modifier', sheet: { ...base.sheet, mode: 'modifiers' as const, modifiers: { ...base.sheet.modifiers, speed: '15', braverySpeed: '-4', weaponSpeed: '-10' } } },
    { ...base, id: 'fast', sheet: { ...base.sheet, abilities: { ...base.sheet.abilities, speed: '96' } } },
    { ...base, id: 'score', sheet: { ...base.sheet, abilities: { ...base.sheet.abilities, speed: '90' } } },
  ];
  assert.deepEqual(combatantsBySpeed(members).map(member => member.id), ['fast', 'modifier', 'score', 'slow']);
  assert.deepEqual(members.map(member => member.id), ['slow', 'modifier', 'fast', 'score']);
  assert.equal(combatantSpeed(members[1]).label, 'Speed modifier +15');
  assert.equal(combatantSpeed(members[3]).label, 'Speed 90 (+12)');
});

test('Speed ties are stable, known percentile scores descend, and unfinished Speed sorts last', () => {
  const base = fight().members[0];
  const scored = (id: string, speed: string) => ({ ...base, id, sheet: { ...base.sheet, abilities: { ...base.sheet.abilities, speed } } });
  const modified = (id: string, speed: string) => ({ ...base, id, sheet: { ...base.sheet, mode: 'modifiers' as const, modifiers: { ...base.sheet.modifiers, speed } } });
  const members = [scored('blank', ''), scored('first-tie', '83'), modified('mod-tie', '12'), scored('higher-score', '90'), scored('second-tie', '83'), modified('negative', '-5'), scored('invalid', '101')];
  assert.deepEqual(combatantsBySpeed(members).map(member => member.id), ['higher-score', 'first-tie', 'second-tie', 'mod-tie', 'negative', 'blank', 'invalid']);
  assert.equal(combatantSpeed(members[0]).modifier, null);
  assert.equal(combatantSpeed(members[0]).label, 'Speed unset');
  assert.equal(combatantSpeed(modified('zero', '0')).label, 'Speed modifier +0');
});

test('editing Speed updates acting order without depending on unrelated unfinished stats', () => {
  const state = fight();
  const changed = state.members.map(member => ({ ...member, sheet: { ...member.sheet, abilities: { ...member.sheet.abilities, speed: member.id === 'juan' ? '20' : '90', gunAccuracy: '' } } }));
  assert.deepEqual(combatantsBySpeed(changed).map(member => member.id), ['sam', 'juan']);
  assert.deepEqual(combatantsBySpeed([]), []);
});

test('two combatants automatically target each other when the acting character changes', () => {
  const state = fight();
  assert.equal(withDefaultTarget({ ...state, targetId: '' }).targetId, 'sam');
  assert.equal(withDefaultTarget({ ...state, actorId: 'sam' }).targetId, 'juan');
  assert.equal(withDefaultTarget({ ...state, actorId: '', targetId: 'sam' }).targetId, '');
  const alone = addCombatant(newEncounter('solo'), { ...sample, strength: '13' }, 'solo');
  assert.equal(alone.targetId, '');
});

test('three or more combatants retain explicit target choices, including an untracked target', () => {
  const state = addCombatant(fight(), { ...sample, name: 'Rose', strength: '13' }, 'rose');
  assert.equal(withDefaultTarget({ ...state, targetId: 'rose' }).targetId, 'rose');
  assert.equal(withDefaultTarget({ ...state, targetId: '' }).targetId, '');
  assert.equal(withDefaultTarget({ ...state, targetId: 'juan' }).targetId, '');
  assert.equal(withDefaultTarget({ ...state, targetId: 'missing' }).targetId, '');
});

test('adding, removing, and undoing roster changes update the automatic target', () => {
  const first = addCombatant(newEncounter('add'), { ...sample, strength: '13' }, 'juan');
  const two = addCombatant(first, { ...sample, name: 'Sam', strength: '15' }, 'sam');
  assert.equal(two.targetId, 'sam');
  const three = addCombatant(two, { ...sample, name: 'Rose', strength: '13' }, 'rose');
  const removed = removeCombatant(three, 'sam');
  assert.equal(removed.targetId, 'rose');
  const restored = undoEncounter(removed);
  assert.equal(restored.members.length, 3);
  assert.equal(restored.targetId, 'sam');
  assert.equal(removeCombatant(two, 'sam').targetId, '');
  assert.equal(removeCombatant(two, 'juan').actorId, '');
});

test('older saved two-person shootouts acquire their default target on refresh', () => {
  const before = { ...fight(), targetId: '' };
  const restored = readEncounter({ getItem: () => JSON.stringify(before) }, 'fallback');
  assert.equal(restored.actorId, 'juan');
  assert.equal(restored.targetId, 'sam');
});

test('preferred weapon changes stay with their combatant through actor switches and refresh', () => {
  let state = addCombatant(newEncounter('weapons'), { ...sample, name: 'Juan', strength: '13', loadout: { weaponId: 'rifle', customSpeed: '5' } }, 'juan');
  state = addCombatant(state, { ...sample, name: 'Sam', strength: '15', loadout: { weaponId: 'shotgun', customSpeed: '5' } }, 'sam');
  const original = structuredClone(state);
  state = updateActingSheet(state, { ...state.members[0].sheet, loadout: { weaponId: 'bow', customSpeed: '5' } });
  state = withDefaultTarget({ ...state, actorId: 'sam' });
  assert.equal(state.members.find(member => member.id === state.actorId)!.sheet.loadout.weaponId, 'shotgun');
  state = updateActingSheet(state, { ...state.members[1].sheet, loadout: { weaponId: 'custom-gun', customSpeed: '-10' } });
  state = withDefaultTarget({ ...state, actorId: 'juan' });
  assert.equal(state.members.find(member => member.id === state.actorId)!.sheet.loadout.weaponId, 'bow');
  let json = '';
  writeEncounter({ setItem: (_key, value) => { json = value; } }, state);
  const restored = readEncounter({ getItem: () => json }, 'fallback');
  assert.deepEqual(restored.members.map(member => member.sheet.loadout), [{ weaponId: 'bow', customSpeed: '5' }, { weaponId: 'custom-gun', customSpeed: '-10' }]);
  assert.equal(original.members[0].sheet.loadout.weaponId, 'rifle');
  assert.equal(original.members[1].sheet.loadout.weaponId, 'shotgun');
  assert.equal(sample.loadout.weaponId, 'double-action');
});

test('editing a weapon preserves wounds, Strength loss, and round progress', () => {
  let state = fight();
  state = applyShotWounds(state, context(state, 'sam', 'juan'), 'wounded-actor', hit(1, 1));
  state = advancePhase(state);
  const before = state.members[0];
  const changed = updateActingSheet(state, { ...before.sheet, loadout: { weaponId: 'scatter', customSpeed: '8' } });
  assert.equal(changed.members[0].loss, 3);
  assert.deepEqual(changed.members[0].wounds, before.wounds);
  assert.equal(changed.members[0].maxStrength, before.maxStrength);
  assert.equal(changed.phase, state.phase);
  assert.deepEqual(changed.applied, state.applied);
  assert.equal(changed.members[1], state.members[1]);
  const noActor = { ...state, actorId: '' };
  assert.equal(updateActingSheet(noActor, sample), noActor);
});

test('turns follow shooting, two brawling rounds, then the next shooting turn', () => {
  let state = fight();
  for (let turn = 1; turn <= 3; turn++) {
    assert.equal(state.turn, turn); assert.equal(state.phase, 'shooting');
    state = advancePhase(state); assert.equal(state.phase, 'brawl-1'); assert.equal(state.turn, turn);
    state = advancePhase(state); assert.equal(state.phase, 'brawl-2'); assert.equal(state.turn, turn);
    state = advancePhase(state);
  }
  assert.equal(state.turn, 4);
});

test('gun wounds accumulate once on the recorded target, with knockout distinct from death', () => {
  const before = fight();
  let state = applyShotWounds(before, context(before), 'shot-1', hit(49, 72));
  assert.equal(remainingStrength(state.members[1]), 8);
  assert.equal(state.members[1].wounds.length, 1);
  assert.equal(state.members[0].loss, 0);
  assert.deepEqual(applyShotWounds(state, context(before), 'shot-1', hit(49, 72)), state);
  state = applyShotWounds(state, context(before), 'shot-2', hit(49, 72));
  state = applyShotWounds(state, context(before), 'shot-3', hit(1, 1));
  assert.equal(combatantStatus(state.members[1]), 'Unconscious');
  assert.equal(state.members[1].dead, false);
  state = applyShotWounds(state, context(before), 'shot-4', hit(86, 41));
  assert.equal(combatantStatus(state.members[1]), 'Dead');
  assert.equal(before.members[1].loss, 0);
  assert.equal(sample.strength, undefined);
});

test('shotgun zero-wound and multiple-wound results retain their table effects', () => {
  const before = fight();
  const zero = applyShotWounds(before, context(before), 'zero', { spreadRoll: 1, spreadDie: 1, wounds: [], totalStrengthLoss: 0, mortal: false });
  assert.equal(zero.members[1].loss, 0); assert.ok(zero.applied.includes('zero'));
  const wounds = [resolveWound(1, 1), resolveWound(49, 72)];
  const next = applyShotWounds(zero, context(before), 'multiple', { spreadRoll: 2, spreadDie: 2, wounds, totalStrengthLoss: 10, mortal: false });
  assert.equal(next.members[1].loss, 10); assert.equal(next.members[1].wounds.length, 2);
});

test('printed example: head lock applies next round, escape causes no damage, and combination deals four', () => {
  let state = advancePhase(fight());
  const headLock = resolveBrawl('grappling', [9, 9], defaultBrawlOptions);
  state = applyBrawl(state, context(state), 'head-lock', headLock, null);
  assert.equal(state.members[1].loss, 4); assert.equal(state.members[1].nextModifier, -2); assert.equal(state.members[1].modifier, 0);
  state = advancePhase(state);
  assert.equal(state.members[1].modifier, -2); assert.equal(state.members[1].nextModifier, 0);
  const escape = resolveBrawl('grappling', [2, 3], { ...defaultBrawlOptions, held: 'head-lock', modifier: -2 });
  state = applyBrawl(state, context(state, 'sam', 'juan'), 'escape', escape, 'head-lock');
  assert.equal(state.members[1].hold, null); assert.equal(state.members[0].loss, 0);
  const punch = resolveBrawl('punching', [8, 8], defaultBrawlOptions);
  state = applyBrawl(state, context(state), 'combination', punch, null);
  assert.equal(state.members[1].loss, 8);
  state = advancePhase(state);
  assert.equal(state.members[1].modifier * 10, -10);
  state = advancePhase(state); assert.equal(state.members[1].modifier, -1);
});

test('holds can be continued without dice, released, or broken by another action', () => {
  let state = advancePhase(fight());
  state = applyBrawl(state, context(state), 'hold', resolveBrawl('grappling', [9, 9], defaultBrawlOptions), null);
  state = advancePhase(state);
  const continued = applyBrawl(state, context(state), 'continue', continueHold('head-lock'), null);
  assert.equal(continued.members[1].loss, 8); assert.equal(continued.members[1].hold?.kind, 'head-lock');
  assert.equal(releaseHold(continued, 'juan').members[1].hold, null);
  const punch = applyBrawl(state, context(state), 'punch', resolveBrawl('punching', [7, 7], defaultBrawlOptions), null);
  assert.equal(punch.members[1].hold, null);
  assert.equal(removeCombatant(continued, 'juan').members[0].hold, null);
  const down = adjustCombatant(continued, 'juan', 0, false);
  assert.equal(down.members[1].hold, null);
});

test('gouges damage the acting character and queue their own penalty', () => {
  const before = advancePhase(fight());
  const next = applyBrawl(before, context(before), 'gouge', resolveBrawl('grappling', [1, 1], defaultBrawlOptions), null);
  assert.equal(next.members[0].loss, 1); assert.equal(next.members[0].nextModifier, -2); assert.equal(next.members[1].loss, 0);
});

test('prevent duplicate actions, old-round brawls, stale holds, and cross-fight wounds', () => {
  const state = advancePhase(fight());
  const punch = resolveBrawl('punching', [7, 7], defaultBrawlOptions);
  const applied = applyBrawl(state, context(state), 'punch', punch, null);
  assert.deepEqual(applyBrawl(applied, context(state), 'punch', punch, null), applied);
  assert.throws(() => applyBrawl(applied, context(state), 'second-punch', punch, null), /already acted/);
  assert.throws(() => applyBrawl(advancePhase(state), context(state), 'old', punch, null), /during the round/);
  assert.throws(() => applyBrawl(state, context(state), 'stale', punch, 'head-lock'), /hold changed/);
  assert.throws(() => applyShotWounds(newEncounter('other'), context(state), 'shot', hit(1, 1)), /different shootout/);
  assert.throws(() => applyShotWounds(removeCombatant(state, 'sam'), context(state), 'shot', hit(1, 1)), /different combatants/);
  assert.throws(() => applyBrawl(adjustCombatant(state, 'juan', 0, false), context(state), 'down', punch, null), /cannot act/);
});

test('undo restores damage, holds, action eligibility, and applied-result protection', () => {
  const before = advancePhase(fight());
  const result = resolveBrawl('grappling', [9, 9], defaultBrawlOptions);
  const applied = applyBrawl(before, context(before), 'hold', result, null);
  const undone = undoEncounter(applied);
  assert.equal(undone.members[1].loss, 0); assert.equal(undone.members[1].hold, null);
  assert.deepEqual(undone.acted, []); assert.deepEqual(undone.applied, []);
  assert.equal(applyBrawl(undone, context(undone), 'hold', result, null).members[1].loss, 4);
  assert.equal(undoEncounter(advancePhase(before)).phase, before.phase);
});

test('shootouts round-trip through local storage including statuses and holds', () => {
  let state = advancePhase(fight());
  state = applyBrawl(state, context(state), 'head', resolveBrawl('grappling', [9, 9], defaultBrawlOptions), null);
  let json = '';
  writeEncounter({ setItem: (key, value) => { assert.equal(key, encounterKey); json = value; } }, state);
  const restored = readEncounter({ getItem: () => json }, 'fallback');
  const { previous: _previous, ...withoutUndo } = state;
  assert.deepEqual(restored, withoutUndo);
  assert.equal(readEncounter({ getItem: () => '{broken' }, 'fallback').id, 'fallback');
  const broken = JSON.parse(json); broken.members[0].loss = -5;
  assert.equal(readEncounter({ getItem: () => JSON.stringify(broken) }, 'fallback').members.length, 0);
  assert.equal(readEncounter({ getItem: () => { throw new Error('blocked'); } }, 'fallback').turn, 1);
  assert.throws(() => writeEncounter({ setItem: () => { throw new Error('full'); } }, state), /full/);
});

test('Strength ratings are required for roster entry, while old sheets remain usable', () => {
  const empty = newEncounter('empty');
  for (const strength of [undefined, '', '0', '100', '2.5', 'oops']) assert.throws(() => addCombatant(empty, { ...sample, strength }, 'new'), /Strength rating/);
  const state = fight();
  assert.throws(() => addCombatant(state, { ...sample, strength: '13' }, 'juan'), /already/);
  assert.throws(() => adjustCombatant(state, 'juan', 14, false), /0–13/);
  assert.equal(combatantStatus(adjustCombatant(state, 'juan', 13, true).members[0]), 'Dead');
});

test('changing the selected target cannot redirect a recorded shot result', () => {
  const before = fight();
  const shot = context(before);
  const changed = { ...before, actorId: 'sam', targetId: 'juan' };
  const next = applyShotWounds(changed, shot, 'recorded-target', hit(1, 1));
  assert.equal(next.members[0].loss, 0);
  assert.equal(next.members[1].loss, 3);
});

test('tracked wound, gun-arm, and previous-brawl penalties use the correct columns', () => {
  const state = fight();
  const member = state.members[1];
  assert.deepEqual(trackedShootingModifiers(member, 'right'), { wound: 0, arm: 0, brawling: 0 });
  const light = { ...member, wounds: [resolveWound(26, 1)], modifier: -2 };
  assert.deepEqual(trackedShootingModifiers(light, 'right'), { wound: -5, arm: -25, brawling: -20 });
  assert.deepEqual(trackedShootingModifiers(light, 'left'), { wound: -5, arm: 0, brawling: -20 });
  const serious = { ...member, wounds: [resolveWound(26, 100), resolveWound(49, 72)] };
  assert.deepEqual(trackedShootingModifiers(serious, 'right'), { wound: -20, arm: -50, brawling: 0 });
  assert.deepEqual(trackedShootingModifiers({ ...member, loss: 8 }, 'right'), { wound: 0, arm: 0, brawling: 0 });
});

test('cutting brawl wounds can be mortal, while depleted punching Strength only knocks out', () => {
  const before = advancePhase(fight());
  const wounded = adjustCombatant(before, 'sam', 1, false);
  const punch = resolveBrawl('punching', [7, 7], defaultBrawlOptions);
  assert.equal(combatantStatus(applyBrawl(wounded, context(wounded), 'punch-ko', punch, null).members[1]), 'Unconscious');
  const knife = resolveBrawl('punching', [7, 7], { ...defaultBrawlOptions, weapon: 'cutting' }, [86, 41]);
  const next = applyBrawl(before, context(before), 'knife', knife, null);
  assert.equal(combatantStatus(next.members[1]), 'Dead');
  assert.equal(next.members[1].wounds[0].severity, 'Mortal');
});

test('continuing a hold after an escape or targeting someone else is rejected', () => {
  let state = advancePhase(fight());
  state = applyBrawl(state, context(state), 'held', resolveBrawl('grappling', [9, 9], defaultBrawlOptions), null);
  state = advancePhase(state);
  state = applyBrawl(state, context(state, 'sam', 'juan'), 'escaped', resolveBrawl('grappling', [2, 3], { ...defaultBrawlOptions, modifier: -2, held: 'head-lock' }), 'head-lock');
  assert.throws(() => applyBrawl(state, context(state), 'late-continue', continueHold('head-lock'), null), /no longer active/);
  const held = advancePhase(applyBrawl(advancePhase(fight()), context(advancePhase(fight())), 'hold', resolveBrawl('grappling', [9, 9], defaultBrawlOptions), null));
  const withExtra = addCombatant(held, { ...sample, strength: '13', name: 'Rose' }, 'rose');
  assert.throws(() => applyBrawl(withExtra, context(withExtra, 'sam', 'rose'), 'wrong-holder', resolveBrawl('grappling', [1, 1], { ...defaultBrawlOptions, held: 'head-lock' }), 'head-lock'), /holding you/);
});
