// Boot Hill, second edition: ability tables p. 5, base numbers pp. 6–7,
// and hit determination p. 9. All inputs here are sheet modifiers.
export const statKeys = ['speed', 'braverySpeed', 'weaponSpeed', 'gunAccuracy', 'throwingAccuracy', 'braveryAccuracy', 'experience'] as const;
export type StatKey = typeof statKeys[number];
export type Sheet = Record<StatKey, number>;
export type SheetForm = Record<StatKey, string> & { name: string };
export type Attack = 'gun' | 'throw';

export const initialSheet: SheetForm = {
  name: '', speed: '0', braverySpeed: '0', weaponSpeed: '5',
  gunAccuracy: '0', throwingAccuracy: '0', braveryAccuracy: '0', experience: '-10',
};

export const weapons = [
  { label: 'Very slow', value: -10 }, { label: 'Slow', value: -5 },
  { label: 'Below average', value: 0 }, { label: 'Average', value: 5 },
  { label: 'Fast', value: 8 }, { label: 'Very fast', value: 10 },
];
export const ranges = [
  { label: 'Short', value: 10 }, { label: 'Medium', value: 0 },
  { label: 'Long', value: -15 }, { label: 'Extreme', value: -25 },
];
export function signed(value: number) { return value >= 0 ? `+${value}` : `${value}`; }

export function parseSheet(form: SheetForm): Sheet {
  const sheet = {} as Sheet;
  for (const key of statKeys) {
    const raw = form[key];
    const value = Number(raw);
    if (raw.trim() === '' || !Number.isInteger(value) || value < -100 || value > 100) {
      throw new Error('Enter a whole-number modifier between −100 and +100 in each field.');
    }
    sheet[key] = value;
  }
  if (!weapons.some(w => w.value === sheet.weaponSpeed)) throw new Error('Choose a weapon speed.');
  return sheet;
}

export function calculate(sheet: Sheet) {
  for (const key of statKeys) {
    if (!Number.isInteger(sheet[key]) || Math.abs(sheet[key]) > 100) throw new Error('Invalid sheet modifier.');
  }
  return {
    firstShot: sheet.speed + sheet.braverySpeed + sheet.weaponSpeed,
    gunHit: 50 + sheet.gunAccuracy + sheet.braveryAccuracy + sheet.experience,
    throwingHit: 50 + sheet.throwingAccuracy + sheet.braveryAccuracy + sheet.experience,
  };
}

export function resolveHit(roll: number, base: number, range: number, situational: number) {
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) throw new Error('Percentile rolls must be 1–100.');
  if (![base, range, situational].every(Number.isInteger)) throw new Error('Modifiers must be whole numbers.');
  const chance = base + range + situational;
  // No automatic success/failure or criticals are added to the printed rules.
  return { roll, chance, hit: roll <= chance };
}

export function rollPercentile() {
  // Rejection sampling keeps all 100 results equally likely.
  const values = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 100) * 100;
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % 100 + 1;
}

// Final percentile scores from the character sheet, after character creation
// and survival adjustments. Experience is the number of previous gunfights.
export type AbilityForm = Record<'speed' | 'gunAccuracy' | 'throwingAccuracy' | 'bravery' | 'gunfights', string>;
export const percentileStats = ['speed', 'gunAccuracy', 'throwingAccuracy', 'strength', 'bravery', 'experience'] as const;
export type PercentileStat = typeof percentileStats[number];
export type PercentileResult = { score: number; description: string; value: number; accuracy?: number };

const speedTable = [[5, -5], [10, -2], [20, 0], [35, 2], [50, 4], [65, 6], [80, 9], [90, 12], [95, 15], [96, 18], [97, 19], [98, 20], [99, 21], [100, 22]];
const accuracyTable = [[5, -9], [15, -6], [25, -3], [35, 0], [50, 2], [65, 5], [75, 7], [85, 10], [95, 15], [98, 18], [100, 20]];
const braveryTable = [[10, -4, -6], [20, -2, -3], [35, 0, 0], [65, 1, 3], [80, 2, 6], [90, 3, 10], [98, 4, 15], [100, 5, 15]];
const experienceTable = [-10, -5, -5, 0, 0, 2, 2, 6, 6, 8, 8, 10];
const strengthTable = [[2, 8], [5, 9], [10, 10], [17, 11], [25, 12], [40, 13], [60, 14], [75, 15], [83, 16], [90, 17], [95, 18], [98, 19], [100, 20]];
const startingExperienceTable = [[40, 0], [60, 1], [75, 2], [85, 3], [90, 4], [93, 5], [95, 6], [96, 7], [97, 8], [98, 9], [99, 10], [100, 11]];
const speedDescriptions = ['Slow', 'Below Average', 'Average', 'Above Average', 'Quick', 'Very Quick', 'Fast', 'Very Fast', 'Lightning', 'Greased Lightning', 'Greased Lightning', 'Greased Lightning', 'Greased Lightning', 'Greased Lightning'];
const accuracyDescriptions = ['Very Poor', 'Poor', 'Below Average', 'Average', 'Above Average', 'Fair', 'Good', 'Very Good', 'Excellent', 'Crack Shot', 'Deadeye'];
const strengthDescriptions = ['Feeble', 'Puny', 'Frail', 'Weakling', 'Sickly', 'Average', 'Above Average', 'Sturdy', 'Hardy', 'Strong', 'Very Strong', 'Powerful', 'Mighty'];
const braveryDescriptions = ['Coward', 'Cowardly', 'Average', 'Above Average', 'Brave', 'Very Brave', 'Fearless', 'Foolhardy'];

export function percentileValue(raw: string): number {
  const value = raw.trim() === '00' ? 100 : Number(raw);
  if (!/^\d{1,3}$/.test(raw.trim()) || !Number.isInteger(value) || value < 1 || value > 100) throw new Error('Enter a percentile roll from 1 to 100 (00 means 100).');
  return value;
}

// Ability tables p. 5. Values here are displayed and used in combat; the
// editable inputs remain percentile rolls for all six character stats.
export function percentileResult(stat: PercentileStat, raw: string): PercentileResult {
  const score = percentileValue(raw);
  if (stat === 'experience') {
    const value = gunfightsFromRoll(score);
    return { score, value, description: value === 0 ? 'None' : value === 11 ? '11 or more gunfights' : `${value} gunfight${value === 1 ? '' : 's'}`, accuracy: experienceModifier(value) };
  }
  const table = stat === 'speed' ? speedTable : stat === 'strength' ? strengthTable : stat === 'bravery' ? braveryTable : accuracyTable;
  const descriptions = stat === 'speed' ? speedDescriptions : stat === 'strength' ? strengthDescriptions : stat === 'bravery' ? braveryDescriptions : accuracyDescriptions;
  const index = table.findIndex(row => score <= row[0]);
  return { score, description: descriptions[index], value: table[index][1], ...(stat === 'bravery' ? { accuracy: table[index][2] } : {}) };
}

// Choose compatible rolls for fixed NPC presets whose Strength and
// Experience were supplied as ratings. These are representative NPC rolls.
export function presetStrengthRoll(rating: number): number {
  const index = strengthTable.findIndex(row => row[1] === rating);
  if (index < 0) throw new Error('NPC Strength ratings must be 8–20.');
  return Math.floor(((index ? strengthTable[index - 1][0] + 1 : 1) + strengthTable[index][0]) / 2);
}
export function presetExperienceRoll(gunfights: number): number {
  const index = startingExperienceTable.findIndex(row => row[1] === gunfights);
  if (index < 0) throw new Error('Starting NPC Experience must be 0–11 gunfights.');
  return Math.floor(((index ? startingExperienceTable[index - 1][0] + 1 : 1) + startingExperienceTable[index][0]) / 2);
}

// Character creation, p. 5: Strength is a rating; Experience is a gunfight
// count. NPCs use the ordinary rolls, without the player-only initial boosts.
export function strengthFromScore(score: number): number {
  if (!Number.isInteger(score) || score < 1 || score > 100) throw new Error('Strength rolls must be whole numbers from 1 to 100.');
  return strengthTable.find(row => score <= row[0])![1];
}
export function gunfightsFromRoll(roll: number): number {
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) throw new Error('Experience rolls must be whole numbers from 1 to 100.');
  return startingExperienceTable.find(row => roll <= row[0])![1];
}

export function experienceModifier(gunfights: number): number {
  if (!Number.isInteger(gunfights) || gunfights < 0 || gunfights > 999) throw new Error('Gunfights must be a whole number from 0 to 999.');
  return experienceTable[Math.min(gunfights, 11)];
}

export function speedAbilityModifier(score: number): number {
  if (!Number.isInteger(score) || score < 1 || score > 100) throw new Error('Speed scores must be whole numbers from 1 to 100.');
  return speedTable.find(row => score <= row[0])![1];
}

export function abilityModifiers(form: AbilityForm, weaponSpeed: number): Sheet {
  const scores = {} as Record<keyof AbilityForm, number>;
  for (const key of ['speed', 'gunAccuracy', 'throwingAccuracy', 'bravery', 'gunfights'] as const) {
    let value = Number(form[key]);
    if (key !== 'gunfights') {
      try { value = percentileValue(form[key]); }
      catch { throw new Error('Sheet scores must be whole numbers from 1 to 100 (00 is 100).'); }
    }
    const min = key === 'gunfights' ? 0 : 1;
    const max = key === 'gunfights' ? 999 : 100;
    if (form[key].trim() === '' || !Number.isInteger(value) || value < min || value > max) {
      throw new Error(key === 'gunfights' ? 'Gunfights must be a whole number from 0 to 999.' : 'Sheet scores must be whole numbers from 1 to 100 (00 is 100).');
    }
    scores[key] = value;
  }
  const bravery = braveryTable.find(row => scores.bravery <= row[0])!;
  return {
    speed: speedAbilityModifier(scores.speed),
    gunAccuracy: accuracyTable.find(row => scores.gunAccuracy <= row[0])![1],
    throwingAccuracy: accuracyTable.find(row => scores.throwingAccuracy <= row[0])![1],
    braverySpeed: bravery[1], braveryAccuracy: bravery[2],
    experience: experienceModifier(scores.gunfights), weaponSpeed,
  };
}

export type WeaponProfile = { id: string; name: string; attack: Attack; speed: number; bonus: number; ranges: [number, number, number, number] | null };
// Weapons chart p. 8. Ranges are map spaces / tabletop inches, not yards.
export const weaponProfiles: WeaponProfile[] = [
  { id: 'double-action', name: 'Double action revolver', attack: 'gun', speed: 5, bonus: 0, ranges: [4, 10, 20, 40] },
  { id: 'single-action', name: 'Single action revolver', attack: 'gun', speed: 8, bonus: 0, ranges: [4, 10, 20, 40] },
  { id: 'fast-draw', name: 'Fast draw revolver', attack: 'gun', speed: 10, bonus: 0, ranges: [3, 7, 15, 30] },
  { id: 'long-barrel', name: 'Long barrel revolver', attack: 'gun', speed: 0, bonus: 0, ranges: [6, 12, 25, 45] },
  { id: 'cap-ball', name: 'Cap & ball revolver', attack: 'gun', speed: 0, bonus: 0, ranges: [3, 7, 12, 26] },
  { id: 'derringer', name: 'Derringer', attack: 'gun', speed: 5, bonus: 0, ranges: [1, 3, 6, 10] },
  { id: 'rifle', name: 'Repeating rifle', attack: 'gun', speed: -5, bonus: 0, ranges: [20, 40, 80, 200] },
  { id: 'carbine', name: 'Repeating carbine', attack: 'gun', speed: -5, bonus: 0, ranges: [10, 20, 40, 100] },
  { id: 'buffalo', name: 'Buffalo rifle', attack: 'gun', speed: -10, bonus: 0, ranges: [30, 60, 120, 300] },
  { id: 'shotgun', name: 'Shotgun', attack: 'gun', speed: -5, bonus: 10, ranges: [6, 12, 18, 36] },
  { id: 'scatter', name: 'Scatter gun', attack: 'gun', speed: 0, bonus: 20, ranges: [2, 4, 8, 15] },
  { id: 'knife', name: 'Knife / tomahawk', attack: 'throw', speed: 5, bonus: 0, ranges: [1, 2, 3, 4] },
  { id: 'bow', name: 'Bow', attack: 'throw', speed: 0, bonus: 0, ranges: [7, 18, 30, 50] },
  { id: 'lance', name: 'Lance', attack: 'throw', speed: 0, bonus: 0, ranges: [2, 5, 10, 15] },
  { id: 'custom-gun', name: 'Custom firearm', attack: 'gun', speed: 5, bonus: 0, ranges: null },
  { id: 'custom-throw', name: 'Custom thrown / launched weapon', attack: 'throw', speed: 5, bonus: 0, ranges: null },
];

export const conditions = [
  { id: 'hip', label: 'Hipshooting', speed: 5, accuracy: -10 },
  { id: 'obscured', label: 'Target obscured', speed: 0, accuracy: -10 },
  { id: 'rest', label: 'Weapon at rest', speed: 0, accuracy: 10 },
  { id: 'wrong-hand', label: 'Wrong hand', speed: 0, accuracy: -10 },
  { id: 'two-guns', label: 'Two pistols', speed: -3, accuracy: -30 },
] as const;

export const shooterMovement = [
  { label: 'Stationary', speed: 0, accuracy: 0 },
  { label: 'Walking', speed: 0, accuracy: -5 },
  { label: 'Crawling', speed: 0, accuracy: -10 },
  { label: 'Running', speed: -20, accuracy: -20 },
  { label: 'Running & dodging', speed: -20, accuracy: -30 },
  { label: 'Mounted, walking', speed: -10, accuracy: -5 },
  { label: 'Mounted, trotting', speed: -10, accuracy: -15 },
  { label: 'Mounted, galloping', speed: -10, accuracy: -25 },
];
export const targetMovement = [
  { label: 'Stationary', accuracy: 0 }, { label: 'Walking / crawling', accuracy: -5 },
  { label: 'Running / trotting', accuracy: -10 }, { label: 'Galloping', accuracy: -15 },
  { label: 'Running & dodging', accuracy: -20 },
];

export function probability(chance: number) { return Math.max(0, Math.min(100, chance)); }
