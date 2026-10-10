import { normalizeCharacter, parseCharacter, type Character } from './characters';
import { type BrawlResult, type HoldKind } from './brawling';
import { resolveWound, type HitEffects, type Wound } from './wounds';
import { percentileResult, percentileValue, signed, speedAbilityModifier, weaponProfiles, weapons } from './rules';
import { parseEquipment, type Equipment } from './equipment';

export type Phase = 'shooting' | 'brawl-1' | 'brawl-2';
export const phaseNames: Record<Phase, string> = { shooting: 'Shooting', 'brawl-1': 'Brawling · round 1', 'brawl-2': 'Brawling · round 2' };
export type Combatant = {
  id: string; libraryId?: string; sheet: Character; maxStrength: number; loss: number; dead: boolean;
  wounds: Wound[]; hold: { kind: HoldKind; by: string } | null;
  modifier: number; nextModifier: number;
};
export type EncounterCore = {
  id: string; turn: number; phase: Phase; members: Combatant[];
  actorId: string; targetId: string; acted: string[]; applied: string[]; log: string[];
};
export type Encounter = EncounterCore & { version: 1; previous?: EncounterCore };
export type ActionContext = { encounterId: string; actorId: string; targetId: string; turn: number; phase: Phase };
export const encounterKey = 'boot-hill.shootout.v1';

export function newEncounter(id: string): Encounter {
  return { version: 1, id, turn: 1, phase: 'shooting', members: [], actorId: '', targetId: '', acted: [], applied: [], log: [] };
}
export function withDefaultTarget(encounter: Encounter): Encounter {
  const actor = encounter.members.find(member => member.id === encounter.actorId);
  const targets = actor ? encounter.members.filter(member => member.id !== actor.id) : [];
  const targetId = targets.length === 1 ? targets[0].id : targets.some(member => member.id === encounter.targetId) ? encounter.targetId : '';
  return targetId === encounter.targetId ? encounter : { ...encounter, targetId };
}
export function updateActingSheet(encounter: Encounter, sheet: Character): Encounter {
  const actor = encounter.members.find(member => member.id === encounter.actorId);
  if (!actor) return encounter;
  sheet = normalizeCharacter(sheet);
  let maxStrength = actor.maxStrength;
  try { maxStrength = strengthRating(sheet.strength); } catch { /* Keep the rating while an input is unfinished. */ }
  return { ...encounter, members: encounter.members.map(member => member.id === actor.id ? { ...member, sheet, maxStrength } : member) };
}
export function updateCombatantEquipment(encounter: Encounter, libraryId: string | null, equipment: Equipment): Encounter {
  if (!libraryId) return encounter;
  const update = (members: Combatant[]) => members.map(member => (member.libraryId || member.id) === libraryId ? { ...member, sheet: { ...member.sheet, equipment: parseEquipment(equipment) } } : member);
  // Undoing combat must not undo a purchase or restore an older cash balance.
  return { ...encounter, members: update(encounter.members), ...(encounter.previous ? { previous: { ...encounter.previous, members: update(encounter.previous.members) } } : {}) };
}
export function strengthRating(value: string | undefined): number {
  if (!value?.trim() || !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 99) throw new Error('Enter a Strength rating from 1 to 99 before adding this character. Use the rating, usually 8–20, rather than the percentile score.');
  return Number(value);
}
export function remainingStrength(member: Combatant) { return Math.max(0, member.maxStrength - member.loss); }
export function combatantStatus(member: Combatant) { return member.dead ? 'Dead' : remainingStrength(member) === 0 ? 'Unconscious' : 'Standing'; }
export function canAct(member: Combatant) { return combatantStatus(member) === 'Standing'; }
export function combatantSpeed(member: Combatant): { modifier: number | null; score: number | null; label: string } {
  const scores = member.sheet.mode === 'scores';
  const raw = scores ? member.sheet.abilities.speed : member.sheet.modifiers.speed;
  let value = Number(raw);
  if (scores) { try { value = percentileValue(raw); } catch { value = NaN; } }
  if (raw.trim() && Number.isInteger(value)) {
    if (scores && value >= 1 && value <= 100) {
      const modifier = speedAbilityModifier(value);
      return { modifier, score: value, label: `Speed ${value} (${signed(modifier)})` };
    }
    if (!scores && value >= -100 && value <= 100) return { modifier: value, score: null, label: `Speed modifier ${signed(value)}` };
  }
  return { modifier: null, score: null, label: 'Speed unset' };
}
export function combatantsBySpeed(members: readonly Combatant[]): Combatant[] {
  // Compare the shared ability scale. Within a tied modifier, known sheet
  // scores descend; modifier-only sheets have no percentile score to infer.
  return members.map(member => ({ member, speed: combatantSpeed(member) })).sort((first, second) => {
    if (first.speed.modifier === null) return second.speed.modifier === null ? 0 : 1;
    if (second.speed.modifier === null) return -1;
    return second.speed.modifier - first.speed.modifier || (second.speed.score ?? -1) - (first.speed.score ?? -1);
  }).map(item => item.member);
}
export function combatantFirstShot(member: Combatant, adjustment = 0): { score: number | null; label: string } {
  try {
    const speed = combatantSpeed(member).modifier;
    if (speed === null) throw new Error('Missing Speed');
    const sheet = member.sheet;
    const bravery = sheet.mode === 'scores' ? percentileResult('bravery', sheet.abilities.bravery).value : Number(sheet.modifiers.braverySpeed);
    if (sheet.mode === 'modifiers' && (!sheet.modifiers.braverySpeed.trim() || !Number.isInteger(bravery) || Math.abs(bravery) > 100)) throw new Error('Invalid Bravery');
    const weapon = weaponProfiles.find(item => item.id === sheet.loadout.weaponId);
    if (!weapon) throw new Error('Unknown weapon');
    const weaponSpeed = weapon.ranges ? weapon.speed : Number(sheet.loadout.customSpeed);
    if (!weapon.ranges && (!sheet.loadout.customSpeed.trim() || !weapons.some(item => item.value === weaponSpeed))) throw new Error('Invalid weapon speed');
    if (!Number.isInteger(adjustment)) throw new Error('Invalid adjustment');
    const score = speed + bravery + weaponSpeed + trackedShootingModifiers(member, 'right').wound + adjustment;
    return { score, label: `First shot ${signed(score)}` };
  } catch { return { score: null, label: 'First shot —' }; }
}
export function combatantsByFirstShot(members: readonly Combatant[], adjustments: Readonly<Record<string, number>> = {}): Combatant[] {
  return members.map(member => ({ member, score: combatantFirstShot(member, adjustments[member.id] ?? 0).score })).sort((first, second) => {
    if (first.score === null) return second.score === null ? 0 : 1;
    if (second.score === null) return -1;
    // Equal totals act simultaneously; retain roster order for those ties.
    return second.score - first.score;
  }).map(item => item.member);
}
export function trackedShootingModifiers(member: Combatant, gunHand: 'left' | 'right') {
  const woundLoss = member.wounds.reduce((sum, wound) => sum + (wound.strengthLoss ?? 0), 0);
  const wound = woundLoss === 0 ? 0 : woundLoss >= member.maxStrength / 2 ? -20 : -5;
  const location = `${gunHand === 'right' ? 'Right' : 'Left'} arm / hand`;
  const arm = member.wounds.filter(injury => injury.location === location).reduce((penalty, injury) => Math.min(penalty, injury.severity === 'Serious' ? -50 : injury.severity === 'Light' ? -25 : 0), 0);
  return { wound, arm, brawling: member.modifier * 10 };
}

function checkpoint(encounter: Encounter, message: string): Encounter {
  const { previous: _previous, version: _version, ...core } = encounter;
  return { ...encounter, previous: structuredClone(core), log: [message, ...encounter.log].slice(0, 100) };
}
function freeInactiveHolds(members: Combatant[]) {
  return members.map(member => member.hold && (!canAct(member) || !members.some(holder => holder.id === member.hold!.by && canAct(holder))) ? { ...member, hold: null } : member);
}
export function addCombatant(encounter: Encounter, sheet: Character, id: string): Encounter {
  if (encounter.members.some(member => member.id === id || member.libraryId === id)) throw new Error('That combatant is already in the shootout.');
  sheet = normalizeCharacter(sheet);
  const maxStrength = strengthRating(sheet.strength);
  const member: Combatant = { id, sheet: parseCharacter(sheet, false), maxStrength, loss: 0, dead: false, wounds: [], hold: null, modifier: 0, nextModifier: 0 };
  const next = checkpoint(encounter, `${sheet.name || 'Unnamed gunslinger'} joined the shootout.`);
  return withDefaultTarget({ ...next, members: [...next.members, member], actorId: next.actorId || id });
}
export function removeCombatant(encounter: Encounter, id: string): Encounter {
  const member = encounter.members.find(item => item.id === id);
  if (!member) return encounter;
  const next = checkpoint(encounter, `${member.sheet.name} left the shootout.`);
  return withDefaultTarget({ ...next, members: freeInactiveHolds(next.members.filter(item => item.id !== id)), actorId: next.actorId === id ? '' : next.actorId, targetId: next.targetId === id ? '' : next.targetId, acted: next.acted.filter(item => item !== id) });
}
export function advancePhase(encounter: Encounter): Encounter {
  const phase: Phase = encounter.phase === 'shooting' ? 'brawl-1' : encounter.phase === 'brawl-1' ? 'brawl-2' : 'shooting';
  const turn = encounter.turn + (phase === 'shooting' ? 1 : 0);
  const next = checkpoint(encounter, `Turn ${turn} · ${phaseNames[phase]}.`);
  // Round-two effects also modify the intervening shooting phase (×10%)
  // and remain applicable to round one of the next brawl.
  return { ...next, turn, phase, acted: [], members: next.members.map(member => encounter.phase === 'shooting' ? member : { ...member, modifier: member.nextModifier, nextModifier: 0 }) };
}
export function undoEncounter(encounter: Encounter): Encounter {
  return encounter.previous ? withDefaultTarget({ version: 1, ...structuredClone(encounter.previous) }) : encounter;
}
export function adjustCombatant(encounter: Encounter, id: string, remaining: number, dead: boolean): Encounter {
  const member = encounter.members.find(item => item.id === id);
  if (!member) throw new Error('That combatant is no longer in the shootout.');
  if (!Number.isInteger(remaining) || remaining < 0 || remaining > member.maxStrength) throw new Error(`Current Strength must be 0–${member.maxStrength}.`);
  const next = checkpoint(encounter, `Adjusted ${member.sheet.name}: ${remaining}/${member.maxStrength} Strength${dead ? ', dead' : ''}.`);
  return { ...next, members: freeInactiveHolds(next.members.map(item => item.id === id ? { ...item, loss: item.maxStrength - remaining, dead } : item)) };
}
function actionMembers(encounter: Encounter, context: ActionContext) {
  if (context.encounterId !== encounter.id) throw new Error('This result belongs to a different shootout.');
  const actor = encounter.members.find(member => member.id === context.actorId);
  const target = encounter.members.find(member => member.id === context.targetId);
  if (!actor || !target || actor.id === target.id) throw new Error('Choose two different combatants in this shootout.');
  return { actor, target };
}
export function applyShotWounds(encounter: Encounter, context: ActionContext, actionId: string, result: HitEffects): Encounter {
  if (encounter.applied.includes(actionId)) return encounter;
  const { target } = actionMembers(encounter, context);
  const next = checkpoint(encounter, `Turn ${context.turn} · ${target.sheet.name}: ${result.wounds.length} gun/throwing wound(s)${result.mortal ? ', mortal' : `, −${result.totalStrengthLoss} Strength`}.`);
  return { ...next, applied: [...next.applied, actionId], members: freeInactiveHolds(next.members.map(member => member.id === target.id ? { ...member, loss: member.loss + result.totalStrengthLoss, dead: member.dead || result.mortal, wounds: [...member.wounds, ...result.wounds] } : member)) };
}
export function applyBrawl(encounter: Encounter, context: ActionContext, actionId: string, result: BrawlResult, expectedHold: HoldKind | null): Encounter {
  if (encounter.applied.includes(actionId)) return encounter;
  const { actor, target } = actionMembers(encounter, context);
  if (encounter.phase === 'shooting' || context.phase !== encounter.phase || context.turn !== encounter.turn) throw new Error('Apply this brawling result during the round in which it was rolled.');
  if (!canAct(actor)) throw new Error('An unconscious or dead combatant cannot act.');
  if (encounter.acted.includes(actor.id)) throw new Error('This combatant has already acted this brawling round.');
  if ((actor.hold?.kind ?? null) !== expectedHold) throw new Error('The hold changed after this roll. Roll again using the current hold.');
  if (actor.hold && actor.hold.by !== target.id) throw new Error('An escape must be directed at the character holding you.');
  if (result.dice.length === 0 && (!target.hold || target.hold.by !== actor.id || target.hold.kind !== result.hold)) throw new Error('That hold is no longer active.');
  if (result.hold && target.hold && target.hold.by !== actor.id) throw new Error('The target is already held by another combatant. Release that hold first.');
  const next = checkpoint(encounter, `Turn ${context.turn} · ${phaseNames[context.phase]} · ${actor.sheet.name} → ${target.sheet.name}: ${result.label}.`);
  const opponentLoss = result.opponentLoss + (result.wound?.strengthLoss ?? 0);
  const members = next.members.map(member => {
    // Choosing another action releases a hold the actor was maintaining.
    let hold = member.hold?.by === actor.id && !(member.id === target.id && result.hold) ? null : member.hold;
    if (member.id === actor.id && result.breakHold) hold = null;
    if (member.id === target.id && result.hold) hold = { kind: result.hold, by: actor.id };
    if (member.id === actor.id) return { ...member, hold, loss: member.loss + result.selfLoss, nextModifier: member.nextModifier + result.selfModifier };
    if (member.id === target.id) return { ...member, hold, loss: member.loss + opponentLoss, nextModifier: member.nextModifier + result.opponentModifier, dead: member.dead || result.wound?.severity === 'Mortal', wounds: result.wound ? [...member.wounds, result.wound] : member.wounds };
    return { ...member, hold };
  });
  return { ...next, members: freeInactiveHolds(members), acted: [...next.acted, actor.id], applied: [...next.applied, actionId] };
}
export function releaseHold(encounter: Encounter, holderId: string): Encounter {
  const held = encounter.members.find(member => member.hold?.by === holderId);
  if (!held) return encounter;
  const next = checkpoint(encounter, `Released the hold on ${held.sheet.name}.`);
  return { ...next, members: next.members.map(member => member.hold?.by === holderId ? { ...member, hold: null } : member) };
}

// Save only encounter data; character-library snapshots stay independent.
export function writeEncounter(storage: Pick<Storage, 'setItem'>, encounter: Encounter) { storage.setItem(encounterKey, JSON.stringify(encounter)); }
export function readEncounter(storage: Pick<Storage, 'getItem'>, fallbackId: string): Encounter {
  try {
    const raw = storage.getItem(encounterKey);
    if (!raw) return newEncounter(fallbackId);
    const value = JSON.parse(raw) as Encounter;
    if (value.version !== 1 || typeof value.id !== 'string' || !value.id || !Number.isInteger(value.turn) || value.turn < 1 || !['shooting', 'brawl-1', 'brawl-2'].includes(value.phase) || !Array.isArray(value.members) || value.members.length > 100) throw new Error('Invalid shootout');
    const ids = new Set<string>();
    const members = value.members.map(member => {
      if (!member || typeof member.id !== 'string' || !member.id || ids.has(member.id) || !Number.isInteger(member.loss) || member.loss < 0 || !Number.isInteger(member.maxStrength) || member.maxStrength < 1 || member.maxStrength > 99 || typeof member.dead !== 'boolean' || !Array.isArray(member.wounds) || ![member.modifier, member.nextModifier].every(Number.isInteger)) throw new Error('Invalid combatant');
      ids.add(member.id);
      if (member.libraryId !== undefined && typeof member.libraryId !== 'string') throw new Error('Invalid saved character');
      if (member.hold && (member.hold.by === member.id || typeof member.hold.by !== 'string' || !['left-arm', 'right-arm', 'head-lock', 'bear-hug'].includes(member.hold.kind))) throw new Error('Invalid hold');
      const wounds = member.wounds.map(wound => {
        // Reconstruct validated effects from recorded dice rather than trusting JSON.
        return resolveWound(wound.locationRoll, wound.severityRoll);
      });
      return { ...member, sheet: parseCharacter(member.sheet, false), wounds };
    });
    const strings = (items: unknown): string[] => Array.isArray(items) && items.every(item => typeof item === 'string') ? items : [];
    return withDefaultTarget({ version: 1, id: value.id, turn: value.turn, phase: value.phase, members: freeInactiveHolds(members), actorId: ids.has(value.actorId) ? value.actorId : '', targetId: ids.has(value.targetId) ? value.targetId : '', acted: strings(value.acted).filter(id => ids.has(id)), applied: strings(value.applied), log: strings(value.log).slice(0, 100) });
  } catch { return newEncounter(fallbackId); }
}
