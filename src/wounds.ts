import { rollPercentile, weaponProfiles } from './rules';

export type WoundSeverity = 'Light' | 'Serious' | 'Mortal';
export type Wound = {
  location: string;
  locationRoll: number;
  severityRoll: number;
  severity: WoundSeverity;
  strengthLoss: number | null;
  effects: string[];
};
export type HitEffects = {
  spreadRoll: number | null;
  spreadDie: number | null;
  wounds: Wound[];
  totalStrengthLoss: number;
  mortal: boolean;
};
export type HitContext = { hit: boolean; weaponId: string; rangeIndex: number };

// Boot Hill 2e, Wound Chart, p. 10 (also reference sheet p. 34).
// Thresholds are inclusive. Arms and abdomen cannot suffer a mortal wound.
const locations = [
  { max: 10, name: 'Left leg', kind: 'leg', light: 40, serious: 100 },
  { max: 20, name: 'Right leg', kind: 'leg', light: 40, serious: 100 },
  { max: 25, name: 'Left arm / hand', kind: 'arm', light: 75, serious: 100 },
  { max: 30, name: 'Right arm / hand', kind: 'arm', light: 75, serious: 100 },
  { max: 40, name: 'Right shoulder', kind: 'other', light: 40, serious: 90 },
  { max: 50, name: 'Left shoulder', kind: 'other', light: 40, serious: 90 },
  { max: 70, name: 'Abdomen / groin', kind: 'other', light: 80, serious: 100 },
  { max: 85, name: 'Chest', kind: 'other', light: 20, serious: 60 },
  { max: 100, name: 'Head', kind: 'other', light: 20, serious: 40 },
] as const;

function assertPercentile(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('Wound rolls must be whole numbers from 1 to 100.');
}

export function resolveWound(locationRoll: number, severityRoll: number): Wound {
  assertPercentile(locationRoll);
  assertPercentile(severityRoll);
  const location = locations.find(item => locationRoll <= item.max)!;
  const severity: WoundSeverity = severityRoll <= location.light ? 'Light' : severityRoll <= location.serious ? 'Serious' : 'Mortal';
  const effects: string[] = [];
  if (severity === 'Mortal') effects.push('Immediately fatal.');
  else {
    if (location.kind === 'leg') effects.push(severity === 'Light' ? 'Walk at half speed.' : 'Walk at quarter speed.');
    else if (severity === 'Serious') effects.push('Move at half speed, except walking.');
    if (location.kind === 'arm') effects.push(`If this is the gun arm: −${severity === 'Light' ? 25 : 50} to hit.`);
  }
  return { location: location.name, locationRoll, severityRoll, severity, strengthLoss: severity === 'Mortal' ? null : severity === 'Light' ? 3 : 7, effects };
}

// Shotgun / Scatter Gun Effects Table, p. 10. Columns: short, medium,
// long, extreme. A percentile roll's final digit is read as 1–10 (0 = 10).
const scatterTable = [
  [1, 1, 0, 0], [1, 1, 0, 0], [1, 1, 1, 0], [1, 1, 0, 0],
  [2, 1, 1, 1], [2, 1, 1, 1], [2, 1, 1, 1], [2, 1, 1, 1],
  [3, 2, 1, 1], [3, 2, 1, 1],
];
const shotgunTable = [
  [2, 1, 1, 0], [2, 1, 1, 0], [2, 1, 1, 1], [2, 2, 1, 1],
  [3, 2, 1, 1], [3, 2, 1, 1], [3, 2, 1, 1], [4, 2, 1, 1],
  [4, 3, 1, 1], [4, 3, 2, 1],
];

export function spreadWoundCount(weaponId: 'shotgun' | 'scatter', rangeIndex: number, percentile: number) {
  assertPercentile(percentile);
  if (!Number.isInteger(rangeIndex) || rangeIndex < 0 || rangeIndex > 3) throw new Error('Choose a valid range band.');
  const die = (percentile - 1) % 10 + 1;
  return { die, count: (weaponId === 'shotgun' ? shotgunTable : scatterTable)[die - 1][rangeIndex] };
}

export function rollHitEffects(context: HitContext, draw: () => number = rollPercentile): HitEffects {
  if (!context.hit) throw new Error('Wound results can only be rolled after a hit.');
  if (!weaponProfiles.some(weapon => weapon.id === context.weaponId)) throw new Error('Unknown weapon.');
  if (!Number.isInteger(context.rangeIndex) || context.rangeIndex < 0 || context.rangeIndex > 3) throw new Error('Choose a valid range band.');
  let spreadRoll: number | null = null;
  let spreadDie: number | null = null;
  let count = 1;
  if (context.weaponId === 'shotgun' || context.weaponId === 'scatter') {
    spreadRoll = draw();
    const spread = spreadWoundCount(context.weaponId, context.rangeIndex, spreadRoll);
    spreadDie = spread.die;
    count = spread.count;
  }
  const wounds = Array.from({ length: count }, () => resolveWound(draw(), draw()));
  return {
    spreadRoll, spreadDie, wounds,
    totalStrengthLoss: wounds.reduce((sum, wound) => sum + (wound.strengthLoss ?? 0), 0),
    mortal: wounds.some(wound => wound.severity === 'Mortal'),
  };
}

export function hitEffectsSummary(result: HitEffects) {
  if (!result.wounds.length) return 'No wounds';
  if (result.mortal) return `${result.wounds.length} wound${result.wounds.length === 1 ? '' : 's'} · mortal`;
  if (result.wounds.length === 1) return `${result.wounds[0].severity} · ${result.wounds[0].location} · −${result.totalStrengthLoss} Strength`;
  return `${result.wounds.length} wounds · −${result.totalStrengthLoss} Strength`;
}
