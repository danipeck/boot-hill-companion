import { abilityModifiers, experienceModifier, initialSheet, parseSheet, percentileResult, percentileValue, statKeys, weaponProfiles, weapons, type AbilityForm, type PercentileStat, type SheetForm } from './rules';
import { upgradeLegacyExtra } from './extras';

export type Character = {
  name: string;
  strength?: string;
  morale?: string;
  percentiles?: { strength?: string; experience?: string };
  mode: 'scores' | 'modifiers';
  abilities: AbilityForm;
  modifiers: SheetForm;
  loadout: { weaponId: string; customSpeed: string };
};
export type SavedCharacter = { id: string; character: Character };
export type CharacterLibrary = { version: 1; draft: Character; activeId: string | null; characters: SavedCharacter[] };
export const libraryKey = 'boot-hill.characters.v1';
export const legacyKey = 'boot-hill.character.v1';
export const sample: Character = {
  name: 'The Colorado Kid', mode: 'scores',
  abilities: { speed: '90', gunAccuracy: '64', throwingAccuracy: '62', bravery: '55', gunfights: '0' },
  modifiers: { ...initialSheet, speed: '12', braverySpeed: '1', gunAccuracy: '5', throwingAccuracy: '5', braveryAccuracy: '3' },
  loadout: { weaponId: 'double-action', customSpeed: '5' },
};

export function blankCharacter(name: string): Character {
  return { name, mode: 'scores', abilities: { speed: '', gunAccuracy: '', throwingAccuracy: '', bravery: '', gunfights: '' }, percentiles: { strength: '', experience: '' }, modifiers: { ...initialSheet, name }, loadout: { ...sample.loadout } };
}

// Derive stored ratings from their rolls. Missing roll fields belong to old
// sheets and retain their recorded ratings; an entered but invalid roll clears
// its result so stale values cannot quietly reach combat or a saved export.
export function normalizeCharacter(character: Character): Character {
  const next = { ...character, abilities: { ...character.abilities }, modifiers: { ...character.modifiers } };
  if (next.percentiles?.strength !== undefined) {
    try { next.strength = String(percentileResult('strength', next.percentiles.strength).value); }
    catch { next.strength = ''; }
  }
  if (next.percentiles?.experience !== undefined) {
    try {
      const result = percentileResult('experience', next.percentiles.experience);
      next.abilities.gunfights = String(result.value);
      next.modifiers.experience = String(result.accuracy);
    } catch { next.abilities.gunfights = ''; next.modifiers.experience = ''; }
  }
  if (next.mode === 'scores' && next.percentiles !== undefined) {
    if (next.morale !== undefined) {
      try { next.morale = String(percentileValue(next.abilities.bravery)); } catch { next.morale = ''; }
    }
    try {
      const weapon = weaponProfiles.find(item => item.id === next.loadout.weaponId)!;
      const modifiers = abilityModifiers(next.abilities, weapon.ranges ? weapon.speed : Number(next.loadout.customSpeed));
      next.modifiers = { name: next.name, ...Object.fromEntries(Object.entries(modifiers).map(([key, value]) => [key, String(value)])) } as SheetForm;
    } catch { /* Individual readouts still show the valid rolls in a draft. */ }
  }
  return next;
}

export function setPercentileRoll(character: Character, stat: PercentileStat, value: string): Character {
  if (stat === 'strength' || stat === 'experience') return normalizeCharacter({ ...character, percentiles: { ...character.percentiles, [stat]: value } });
  return normalizeCharacter({ ...character, abilities: { ...character.abilities, [stat]: value } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function field(value: unknown, label: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.length <= 32) return value;
  throw new Error(`Missing or invalid ${label} in the character sheet.`);
}

// Read only known fields. Local drafts may contain unfinished inputs; imports
// and saved snapshots validate the currently selected input mode.
export function parseCharacter(value: unknown, validateStats = true): Character {
  if (!isRecord(value) || typeof value.name !== 'string' || value.name.length > 80 || (value.mode !== 'scores' && value.mode !== 'modifiers')) {
    throw new Error('Choose a character JSON file exported by this app.');
  }
  if (!isRecord(value.abilities) || !isRecord(value.modifiers)) throw new Error('The JSON file is missing character stats.');
  const abilities = {} as AbilityForm;
  for (const key of ['speed', 'gunAccuracy', 'throwingAccuracy', 'bravery', 'gunfights'] as const) {
    abilities[key] = field(value.abilities[key], key);
  }
  const modifiers = { name: value.name } as SheetForm;
  for (const key of statKeys) modifiers[key] = field(value.modifiers[key], key);
  let loadout = { ...sample.loadout };
  if (value.loadout !== undefined) {
    if (!isRecord(value.loadout) || typeof value.loadout.weaponId !== 'string') {
      throw new Error('The character file has an unknown weapon.');
    }
    const weaponId = value.loadout.weaponId;
    if (!weaponProfiles.some(weapon => weapon.id === weaponId)) throw new Error('The character file has an unknown weapon.');
    const customSpeed = field(value.loadout.customSpeed, 'weapon speed');
    if (customSpeed.trim() === '' || !weapons.some(weapon => weapon.value === Number(customSpeed))) throw new Error('Choose a valid weapon speed.');
    loadout = { weaponId, customSpeed };
  }
  let character: Character = { name: value.name, mode: value.mode as Character['mode'], abilities, modifiers, loadout };
  if (value.percentiles !== undefined) {
    if (!isRecord(value.percentiles)) throw new Error('Invalid percentile rolls in the character sheet.');
    character.percentiles = {};
    for (const stat of ['strength', 'experience'] as const) {
      if (value.percentiles[stat] !== undefined) {
        character.percentiles[stat] = field(value.percentiles[stat], `${stat} roll`);
        if (validateStats) percentileValue(character.percentiles[stat]!);
      }
    }
  }
  if (value.strength !== undefined) {
    character.strength = field(value.strength, 'Strength');
    if (validateStats && character.percentiles?.strength === undefined && character.strength.trim() !== '' && (!Number.isInteger(Number(character.strength)) || Number(character.strength) < 1 || Number(character.strength) > 99)) {
      throw new Error('Strength must be a whole-number rating from 1 to 99, or left blank.');
    }
  }
  if (value.morale !== undefined) {
    character.morale = field(value.morale, 'Morale');
    if (validateStats && character.morale.trim() !== '' && (!Number.isInteger(Number(character.morale)) || Number(character.morale) < 0 || Number(character.morale) > 100)) {
      throw new Error('Morale must be a whole-number percentage from 0 to 100, or left blank.');
    }
  }
  character = normalizeCharacter(upgradeLegacyExtra(character));
  if (validateStats) {
    const weapon = weaponProfiles.find(item => item.id === loadout.weaponId)!;
    const speed = weapon.ranges ? weapon.speed : Number(loadout.customSpeed);
    if (character.mode === 'scores') abilityModifiers(character.abilities, speed);
    else parseSheet({ ...character.modifiers, weaponSpeed: String(speed) });
  }
  return character;
}

function startingLibrary(character: Character): CharacterLibrary {
  const draft = parseCharacter(character, false);
  return { version: 1, draft, activeId: 'initial-character', characters: [{ id: 'initial-character', character: parseCharacter(draft, false) }] };
}

export function readLibrary(storage: Pick<Storage, 'getItem'>): CharacterLibrary {
  try {
    const raw = storage.getItem(libraryKey);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (isRecord(value) && value.version === 1 && Array.isArray(value.characters)) {
        const characters: SavedCharacter[] = [];
        for (const item of value.characters) {
          try {
            if (!isRecord(item) || typeof item.id !== 'string' || !item.id || item.id.length > 100 || characters.some(entry => entry.id === item.id)) continue;
            characters.push({ id: item.id, character: parseCharacter(item.character, false) });
          } catch { /* Keep the other saved characters if one entry is damaged. */ }
        }
        const activeId = typeof value.activeId === 'string' && characters.some(item => item.id === value.activeId) ? value.activeId : null;
        let draft: Character;
        try { draft = parseCharacter(value.draft, false); }
        catch { draft = parseCharacter((characters.find(item => item.id === activeId) || characters[0])?.character || sample, false); }
        return { version: 1, draft, activeId, characters };
      }
    }
  } catch { /* Fall back to the previous single-character storage format. */ }
  try {
    const legacy = storage.getItem(legacyKey);
    if (legacy) return startingLibrary(parseCharacter(JSON.parse(legacy), false));
  } catch { /* The app also works when browser storage is disabled. */ }
  return startingLibrary(sample);
}

export function writeLibrary(storage: Pick<Storage, 'setItem'>, library: CharacterLibrary) {
  storage.setItem(libraryKey, JSON.stringify(library));
}

export function saveDraft(library: CharacterLibrary, newId: string): CharacterLibrary {
  const character = parseCharacter(library.draft);
  character.name = character.name.trim() || 'Unnamed gunslinger';
  character.modifiers.name = character.name;
  const id = library.activeId || newId;
  if (!library.activeId && library.characters.some(item => item.id === newId)) throw new Error('A character already has this ID.');
  const entry = { id, character };
  const characters = library.activeId
    ? library.characters.map(item => item.id === id ? entry : item)
    : [...library.characters, entry];
  return { ...library, draft: parseCharacter(character, false), activeId: id, characters };
}

export function loadSaved(library: CharacterLibrary, id: string): CharacterLibrary {
  const entry = library.characters.find(item => item.id === id);
  if (!entry) throw new Error('Choose a saved character to load.');
  return { ...library, draft: parseCharacter(entry.character, false), activeId: entry.id };
}

export function removeSaved(library: CharacterLibrary, id: string): CharacterLibrary {
  return { ...library, characters: library.characters.filter(item => item.id !== id), activeId: library.activeId === id ? null : library.activeId };
}

export function importCharacter(library: CharacterLibrary, text: string, newId: string): CharacterLibrary {
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('That file is not valid JSON. Choose a character export.'); }
  const draft = parseCharacter(value);
  return saveDraft({ ...library, draft, activeId: null }, newId);
}

export async function readCharacterFile(file: Pick<File, 'size' | 'text'>): Promise<string> {
  if (file.size > 64 * 1024) throw new Error('Choose a character JSON file smaller than 64 KB.');
  try { return await file.text(); }
  catch { throw new Error('Could not read that file. Please choose it again.'); }
}

export function exportCharacterJson(character: Character): string {
  return JSON.stringify(parseCharacter(character), null, 2);
}
