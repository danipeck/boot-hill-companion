import { type Character } from './characters';
import { abilityModifiers, experienceModifier, gunfightsFromRoll, rollPercentile, strengthFromScore, weaponProfiles, type AbilityForm, type SheetForm } from './rules';

type RawAbilities = { speed: number; gunAccuracy: number; throwingAccuracy: number; bravery: number };
export type ExtraPreset = {
  id: string; name: string; weaponId: string; strength: number; experience: number; abilities: RawAbilities;
};

// Representative raw scores within the Miscellaneous Characters Chart's
// role ranges (p. 18), guided by Astra's roster. These are chosen NPC sheets,
// not an exact reconstruction of her precomputed combat totals. Her Strength,
// Experience and weapons are retained; Bravery follows her morale entries
// except the Gambler, raised into the book's Brave-or-better range.
export const extraPresets: readonly ExtraPreset[] = [
  { id: 'bank-teller', name: 'Bank Teller', weaponId: 'derringer', strength: 13, experience: 1, abilities: { speed: 55, gunAccuracy: 60, throwingAccuracy: 50, bravery: 50 } },
  { id: 'bartender', name: 'Bartender', weaponId: 'scatter', strength: 14, experience: 2, abilities: { speed: 55, gunAccuracy: 70, throwingAccuracy: 60, bravery: 91 } },
  { id: 'bounty-hunter', name: 'Bounty Hunter', weaponId: 'fast-draw', strength: 14, experience: 6, abilities: { speed: 93, gunAccuracy: 85, throwingAccuracy: 65, bravery: 91 } },
  { id: 'cavalry-trooper', name: 'Cavalry Trooper', weaponId: 'carbine', strength: 14, experience: 2, abilities: { speed: 55, gunAccuracy: 70, throwingAccuracy: 50, bravery: 50 } },
  { id: 'cowboy', name: 'Cowboy', weaponId: 'single-action', strength: 14, experience: 1, abilities: { speed: 55, gunAccuracy: 80, throwingAccuracy: 60, bravery: 50 } },
  { id: 'deputy', name: 'Deputy', weaponId: 'single-action', strength: 14, experience: 3, abilities: { speed: 75, gunAccuracy: 85, throwingAccuracy: 60, bravery: 82 } },
  { id: 'deputy-us-marshal', name: 'Deputy US Marshal', weaponId: 'fast-draw', strength: 17, experience: 6, abilities: { speed: 93, gunAccuracy: 90, throwingAccuracy: 70, bravery: 93 } },
  { id: 'detective', name: 'Detective', weaponId: 'single-action', strength: 14, experience: 3, abilities: { speed: 75, gunAccuracy: 80, throwingAccuracy: 50, bravery: 51 } },
  { id: 'drifter', name: 'Drifter', weaponId: 'single-action', strength: 14, experience: 3, abilities: { speed: 75, gunAccuracy: 80, throwingAccuracy: 50, bravery: 51 } },
  { id: 'gambler', name: 'Gambler', weaponId: 'derringer', strength: 13, experience: 2, abilities: { speed: 85, gunAccuracy: 80, throwingAccuracy: 70, bravery: 70 } },
  { id: 'gunfighter', name: 'Gunfighter', weaponId: 'fast-draw', strength: 17, experience: 6, abilities: { speed: 93, gunAccuracy: 90, throwingAccuracy: 70, bravery: 93 } },
  { id: 'homesteader', name: 'Homesteader', weaponId: 'rifle', strength: 14, experience: 0, abilities: { speed: 30, gunAccuracy: 65, throwingAccuracy: 50, bravery: 50 } },
  { id: 'indian', name: 'Indian', weaponId: 'bow', strength: 14, experience: 2, abilities: { speed: 75, gunAccuracy: 70, throwingAccuracy: 90, bravery: 82 } },
  { id: 'merchant', name: 'Merchant', weaponId: 'shotgun', strength: 13, experience: 0, abilities: { speed: 15, gunAccuracy: 65, throwingAccuracy: 50, bravery: 50 } },
  { id: 'miner', name: 'Miner', weaponId: 'shotgun', strength: 14, experience: 1, abilities: { speed: 55, gunAccuracy: 70, throwingAccuracy: 50, bravery: 68 } },
  { id: 'saloon-gal', name: 'Saloon Gal', weaponId: 'derringer', strength: 11, experience: 1, abilities: { speed: 30, gunAccuracy: 65, throwingAccuracy: 50, bravery: 50 } },
  { id: 'sheriff', name: 'Sheriff', weaponId: 'fast-draw', strength: 15, experience: 5, abilities: { speed: 80, gunAccuracy: 85, throwingAccuracy: 65, bravery: 90 } },
  { id: 'stage-guard', name: 'Stage Guard', weaponId: 'shotgun', strength: 14, experience: 2, abilities: { speed: 55, gunAccuracy: 65, throwingAccuracy: 55, bravery: 50 } },
  { id: 'town-marshal', name: 'Town Marshal', weaponId: 'fast-draw', strength: 15, experience: 4, abilities: { speed: 85, gunAccuracy: 85, throwingAccuracy: 60, bravery: 87 } },
];

function sheetFromScores(name: string, strength: number, abilities: AbilityForm, weaponId: string): Character {
  const modifiers = abilityModifiers(abilities, 0);
  return {
    name, strength: String(strength), morale: abilities.bravery, mode: 'scores', abilities,
    modifiers: { name, ...Object.fromEntries(Object.entries(modifiers).map(([key, value]) => [key, String(value)])) } as SheetForm,
    loadout: { weaponId, customSpeed: '5' },
  };
}

export function createExtra(presetId: string, name?: string): Character {
  const preset = extraPresets.find(item => item.id === presetId);
  if (!preset) throw new Error('Choose an extra preset.');
  const abilities = {
    ...Object.fromEntries(Object.entries(preset.abilities).map(([key, value]) => [key, String(value)])),
    gunfights: String(preset.experience),
  } as AbilityForm;
  return sheetFromScores(name?.trim() || preset.name, preset.strength, abilities, preset.weaponId);
}

export function generateExtra(name?: string, roll: () => number = rollPercentile): Character {
  // Six separate creation rolls: Speed, gun accuracy, throwing accuracy,
  // Strength, Bravery and Experience (pp. 4–5). Roll once per generated sheet.
  const rolls = Array.from({ length: 6 }, () => roll());
  if (!rolls.every(value => Number.isInteger(value) && value >= 1 && value <= 100)) throw new Error('Character creation rolls must be whole numbers from 1 to 100.');
  const [speed, gunAccuracy, throwingAccuracy, strength, bravery, experience] = rolls;
  return sheetFromScores(name?.trim() || 'The stranger', strengthFromScore(strength), {
    speed: String(speed), gunAccuracy: String(gunAccuracy), throwingAccuracy: String(throwingAccuracy),
    bravery: String(bravery), gunfights: String(gunfightsFromRoll(experience)),
  }, 'double-action');
}

// Recognize the former roster's blank-score sheets during loading, including
// renamed extras or changed weapons. Ordinary sheets and edited modifiers are
// left alone. Conversion preserves names, Strength and the chosen loadout.
const legacyTotals: Record<string, [number, number, number]> = {
  'bank-teller': [12, 56, 50], bartender: [5, 68, 91], 'bounty-hunter': [28, 79, 91],
  'cavalry-trooper': [2, 60, 50], cowboy: [15, 60, 50], deputy: [19, 71, 82],
  'deputy-us-marshal': [29, 80, 93], detective: [19, 63, 51], drifter: [19, 63, 51],
  gambler: [18, 63, 50], gunfighter: [29, 80, 93], homesteader: [-2, 50, 50],
  indian: [12, 69, 82], merchant: [-5, 50, 50], miner: [3, 60, 68],
  'saloon-gal': [8, 55, 50], sheriff: [26, 76, 90], 'stage-guard': [1, 56, 50], 'town-marshal': [24, 73, 87],
};
export function upgradeLegacyExtra(character: Character): Character {
  if (!['speed', 'gunAccuracy', 'throwingAccuracy', 'bravery'].every(key => !character.abilities[key as keyof AbilityForm].trim())) return character;
  const preset = extraPresets.find(item => {
    const [speed, accuracy, morale] = legacyTotals[item.id];
    const weapon = weaponProfiles.find(profile => profile.id === item.weaponId)!;
    const experience = experienceModifier(item.experience);
    const accuracyModifier = accuracy - 50 - weapon.bonus - experience;
    const expected = {
      speed: speed - weapon.speed, gunAccuracy: weapon.attack === 'gun' ? accuracyModifier : 0,
      throwingAccuracy: weapon.attack === 'throw' ? accuracyModifier : 0,
      braverySpeed: 0, braveryAccuracy: 0, experience,
    };
    return Number(character.morale) === morale && character.morale?.trim() !== '' &&
      character.abilities.gunfights.trim() !== '' && Number(character.abilities.gunfights) === item.experience &&
      Object.entries(expected).every(([key, value]) => character.modifiers[key as keyof SheetForm].trim() !== '' && Number(character.modifiers[key as keyof SheetForm]) === value);
  });
  if (!preset) return character;
  const upgraded = createExtra(preset.id, character.name);
  return { ...character, mode: 'scores', abilities: upgraded.abilities, modifiers: upgraded.modifiers, morale: upgraded.morale };
}
