import { rollPercentile } from './rules';
import { resolveWound, type Wound } from './wounds';

export type Horse = {
  id: string; name: string; maxStrength: number; loss: number; dead: boolean; wounds: Wound[];
  riderId: string | null; mounted: boolean; held: boolean;
  boltPending: boolean; bolting: boolean; lastBolt?: BoltResult;
};
export type BoltResult = { roll: number | null; chance: number; bolted: boolean };
export type MountedHit = { roll: number; intendedName: string; actualName: string };
export const horseStrengthTypes = ['Horse', 'Workhorse', 'Pony'] as const;

export function horseStrength(type: typeof horseStrengthTypes[number], drawD10 = () => (rollPercentile() - 1) % 10 + 1): number {
  if (type === 'Horse') return 30;
  if (type !== 'Workhorse' && type !== 'Pony') throw new Error('Choose a horse type.');
  const roll = drawD10();
  if (!Number.isInteger(roll) || roll < 1 || roll > 10) throw new Error('Horse Strength dice must be 1–10.');
  return 30 + (type === 'Workhorse' ? roll : -roll);
}
export function horseRemaining(horse: Horse) { return Math.max(0, horse.maxStrength - horse.loss); }
export function horseStanding(horse: Horse) { return !horse.dead && horseRemaining(horse) > 0; }
export function horseStatus(horse: Horse) { return horse.dead ? 'Dead' : !horseRemaining(horse) ? 'Unconscious' : horse.bolting ? 'Bolting' : 'Standing'; }
export function horseStrengthRating(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 99) throw new Error('Horse Strength must be a whole-number rating from 1 to 99.');
  return value;
}
export function rollMountedHit(draw: () => number = rollPercentile): { roll: number; intended: boolean } {
  const roll = draw();
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) throw new Error('Mounted hit dice must be 1–100.');
  return { roll, intended: roll <= 60 };
}
export function rollHorseBolt(controlled: boolean, modifier: number, draw: () => number = rollPercentile): BoltResult {
  if (!Number.isInteger(modifier) || Math.abs(modifier) > 100) throw new Error('Bolting adjustment must be a whole number from −100 to +100.');
  if (!controlled) return { roll: null, chance: 100, bolted: true };
  const chance = Math.max(0, Math.min(100, 40 + modifier));
  const roll = draw();
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) throw new Error('Bolting dice must be 1–100.');
  return { roll, chance, bolted: roll <= chance };
}
export function parseHorse(value: unknown): Horse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid horse.');
  const horse = value as Horse;
  if (typeof horse.id !== 'string' || !horse.id || typeof horse.name !== 'string' || !horse.name.trim() || horse.name.length > 80 || !Number.isSafeInteger(horse.loss) || horse.loss < 0 || typeof horse.dead !== 'boolean' || !Array.isArray(horse.wounds) || (horse.riderId !== null && typeof horse.riderId !== 'string') || !['mounted', 'held', 'boltPending', 'bolting'].every(key => typeof horse[key as keyof Horse] === 'boolean')) throw new Error('Invalid horse.');
  horseStrengthRating(horse.maxStrength);
  const wounds = horse.wounds.map(wound => resolveWound(wound.locationRoll, wound.severityRoll, 'horse'));
  let lastBolt: BoltResult | undefined;
  if (horse.lastBolt !== undefined) {
    const result = horse.lastBolt;
    if (!result || (result.roll !== null && (!Number.isInteger(result.roll) || result.roll < 1 || result.roll > 100)) || !Number.isInteger(result.chance) || result.chance < 0 || result.chance > 100 || typeof result.bolted !== 'boolean' || (result.roll === null && (result.chance !== 100 || !result.bolted)) || (result.roll !== null && result.bolted !== (result.roll <= result.chance))) throw new Error('Invalid bolting result.');
    lastBolt = { ...result };
  }
  const standing = horseStanding(horse);
  return { id: horse.id, name: horse.name, maxStrength: horse.maxStrength, loss: horse.loss, dead: horse.dead, wounds, riderId: horse.riderId, mounted: standing && horse.mounted, held: horse.held, boltPending: standing && horse.boltPending, bolting: standing && horse.bolting, ...(lastBolt ? { lastBolt } : {}) };
}
