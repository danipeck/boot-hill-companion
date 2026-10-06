import { rollPercentile } from './rules';
import { resolveWound, type Wound } from './wounds';

export type CombatMode = 'shooting' | 'punching' | 'grappling';
export type HoldKind = 'left-arm' | 'right-arm' | 'head-lock' | 'bear-hug';
export const holdNames: Record<HoldKind, string> = {
  'left-arm': 'Left arm lock', 'right-arm': 'Right arm lock', 'head-lock': 'Head lock', 'bear-hug': 'Bear hug',
};
export type BrawlOptions = {
  modifier: number; held: HoldKind | null; leftFree: boolean; rightFree: boolean;
  hand: 'left' | 'right'; dominantHand: 'left' | 'right'; weapon: 'fists' | 'blunt' | 'large' | 'cutting';
};
export const defaultBrawlOptions: BrawlOptions = {
  modifier: 0, held: null, leftFree: true, rightFree: true, hand: 'right', dominantHand: 'right', weapon: 'fists',
};
export type BrawlResult = {
  mode: 'punching' | 'grappling'; dice: number[]; modifier: number; adjusted: number | null;
  label: string; opponentLoss: number; selfLoss: number;
  opponentModifier: number; selfModifier: number; hold: HoldKind | null;
  breakHold: boolean; wound: Wound | null; notes: string[];
};

export function rollD10(draw: () => number = rollPercentile) {
  const value = draw();
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('Dice must be whole numbers from 1 to 100.');
  return value % 10 || 10;
}

// Boot Hill 2e pp. 10–11. Add two single percentile dice (two d10s).
// Left/right columns are printed for a right-handed character.
export function resolveBrawl(mode: 'punching' | 'grappling', dice: [number, number], options: BrawlOptions, woundDice: [number, number] = [1, 1]): BrawlResult {
  if (dice.some(die => !Number.isInteger(die) || die < 1 || die > 10)) throw new Error('Brawling dice must be 1–10.');
  if (!Number.isInteger(options.modifier) || Math.abs(options.modifier) > 20) throw new Error('Brawling modifiers must be whole numbers from −20 to +20.');
  const weaponModifier = mode === 'punching' ? options.weapon === 'large' ? -2 : options.weapon === 'fists' ? 0 : -1 : 0;
  const modifier = options.modifier + weaponModifier;
  const adjusted = dice[0] + dice[1] + modifier;
  const result: BrawlResult = { mode, dice, modifier, adjusted, label: '', opponentLoss: 0, selfLoss: 0, opponentModifier: 0, selfModifier: 0, hold: null, breakHold: false, wound: null, notes: [] };
  if (mode === 'punching') {
    const leftFree = options.leftFree && options.held !== 'left-arm';
    const rightFree = options.rightFree && options.held !== 'right-arm';
    if (options.held === 'bear-hug') throw new Error('A bear hug allows only a grapple to escape.');
    if (options.weapon === 'fists' ? !leftFree && !rightFree : options.hand === 'left' ? !leftFree : !rightFree) throw new Error('You need a free arm for this punch or weapon.');
    if (adjusted <= 7) {
      result.label = 'Miss';
      result.opponentModifier = adjusted <= 2 ? 2 : adjusted <= 4 ? 1 : 0;
    } else if (adjusted <= 9) result.label = 'Blocked';
    else {
      const strongHand = options.dominantHand === 'right' ? rightFree : leftFree;
      const useStrongHand = options.weapon === 'fists' ? strongHand : options.hand === options.dominantHand;
      if (adjusted <= 13) { result.label = 'Glancing blow'; result.opponentLoss = 1; }
      else if (adjusted === 14) { result.label = 'Jab'; result.opponentLoss = useStrongHand ? 2 : 1; }
      else if (adjusted === 15) { result.label = 'Hook'; result.opponentLoss = 2; }
      else if (adjusted === 16) {
        result.label = 'Combination';
        result.opponentLoss = options.weapon === 'fists' && leftFree && rightFree ? 4 : 2;
        result.opponentModifier = -1;
      } else if (adjusted === 17) { result.label = 'Rabbit punch'; result.opponentLoss = useStrongHand ? 3 : 2; result.opponentModifier = -1; }
      else if (adjusted === 18) { result.label = 'Uppercut'; result.opponentLoss = useStrongHand ? 3 : 2; result.opponentModifier = -2; }
      else { result.label = 'Haymaker'; result.opponentLoss = useStrongHand ? 4 : 3; result.opponentModifier = -3; }
      if (options.weapon === 'cutting') {
        result.wound = resolveWound(...woundDice);
        result.opponentLoss = 0;
        result.notes.push('Cutting weapon: use the wound chart instead of punch Strength damage.');
      } else if (options.weapon !== 'fists') result.opponentLoss += options.weapon === 'large' ? 2 : 1;
    }
  } else if (options.held) {
    // Held characters can only escape on 3 or less, or on 15–16.
    result.breakHold = adjusted <= 3 || adjusted === 15 || adjusted === 16;
    result.label = result.breakHold ? 'Hold broken' : 'Hold continues';
    result.notes.push(result.breakHold ? 'Escape without inflicting damage.' : 'No effect while held.');
  } else if (adjusted <= 3) {
    result.label = adjusted <= 1 ? 'Opponent knees you' : 'Opponent gouges you';
    result.selfLoss = adjusted <= 1 ? 4 : 1;
    result.selfModifier = adjusted <= 1 ? -4 : -2;
  } else if (adjusted <= 9) {
    result.label = 'No hold';
    result.opponentModifier = adjusted <= 5 ? 2 : adjusted <= 7 ? 1 : 0;
  } else if (adjusted <= 13) {
    result.hold = adjusted <= 11 ? 'left-arm' : 'right-arm';
    result.label = holdNames[result.hold]; result.opponentLoss = 2; result.opponentModifier = -1;
  } else if (adjusted === 14) { result.label = 'Elbow smash'; result.opponentLoss = 2; result.opponentModifier = -1; }
  else if (adjusted <= 16) { result.label = 'Throw'; result.opponentLoss = 2; result.opponentModifier = -2; }
  else if (adjusted === 17) { result.label = 'Kick'; result.opponentLoss = 3; result.opponentModifier = -1; }
  else if (adjusted === 18) { result.hold = 'head-lock'; result.label = holdNames[result.hold]; result.opponentLoss = 4; result.opponentModifier = -2; }
  else { result.hold = 'bear-hug'; result.label = holdNames[result.hold]; result.opponentLoss = 1; result.opponentModifier = -4; }
  return result;
}

export function rollBrawl(mode: 'punching' | 'grappling', options: BrawlOptions, draw: () => number = rollPercentile): BrawlResult {
  const dice: [number, number] = [rollD10(draw), rollD10(draw)];
  const result = resolveBrawl(mode, dice, options);
  if (result.wound) result.wound = resolveWound(draw(), draw());
  return result;
}

export function continueHold(kind: HoldKind): BrawlResult {
  const effects = { 'left-arm': [2, -1], 'right-arm': [2, -1], 'head-lock': [4, -2], 'bear-hug': [1, -4] } as const;
  return { mode: 'grappling', dice: [], modifier: 0, adjusted: null, label: `Continue ${holdNames[kind].toLowerCase()}`, opponentLoss: effects[kind][0], selfLoss: 0, opponentModifier: effects[kind][1], selfModifier: 0, hold: kind, breakHold: false, wound: null, notes: ['An existing hold continues without another dice roll.'] };
}

export function brawlProbability(mode: 'punching' | 'grappling', options: BrawlOptions) {
  let successes = 0;
  for (let first = 1; first <= 10; first++) for (let second = 1; second <= 10; second++) {
    const result = resolveBrawl(mode, [first, second], options);
    if (options.held && mode === 'grappling' ? result.breakHold : result.opponentLoss > 0 || result.wound || result.hold) successes++;
  }
  return successes;
}
