import { abilityModifiers, initialSheet, parseSheet, statKeys, weaponProfiles, weapons, type AbilityForm, type SheetForm } from './rules';

export type Character = {
  name: string;
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
  const character: Character = { name: value.name, mode: value.mode as Character['mode'], abilities, modifiers, loadout };
  if (validateStats) {
    const weapon = weaponProfiles.find(item => item.id === loadout.weaponId)!;
    const speed = weapon.ranges ? weapon.speed : Number(loadout.customSpeed);
    if (character.mode === 'scores') abilityModifiers(abilities, speed);
    else parseSheet({ ...modifiers, weaponSpeed: String(speed) });
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
