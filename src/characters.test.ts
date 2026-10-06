import assert from 'node:assert/strict';
import test from 'node:test';
import { exportCharacterJson, importCharacter, legacyKey, libraryKey, loadSaved, parseCharacter, readCharacterFile, readLibrary, removeSaved, sample, saveDraft, writeLibrary, type CharacterLibrary } from './characters';

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
function initialLibrary() { return readLibrary(storage()); }
function legacyCharacter() { const { loadout, ...character } = structuredClone(sample); return character; }

test('migrates the previously saved character without deleting its original data', () => {
  const legacy = { ...legacyCharacter(), name: 'Ada', abilities: { ...sample.abilities, speed: '96' } };
  const local = storage({ [legacyKey]: JSON.stringify(legacy) });
  const library = readLibrary(local);
  assert.equal(library.draft.name, 'Ada');
  assert.equal(library.draft.abilities.speed, '96');
  assert.deepEqual(library.characters[0].character, library.draft);
  writeLibrary(local, library);
  assert.deepEqual(readLibrary(local), library);
  assert.equal(local.getItem(legacyKey), JSON.stringify(legacy));
});

test('saving a loaded character updates that ID even after a rename', () => {
  const original = initialLibrary();
  const edited = { ...original, draft: { ...original.draft, name: 'Rose', abilities: { ...original.draft.abilities, bravery: '99' } } };
  const saved = saveDraft(edited, 'unused-new-id');
  assert.equal(saved.characters.length, 1);
  assert.equal(saved.activeId, original.activeId);
  assert.equal(saved.characters[0].character.name, 'Rose');
  assert.equal(saved.characters[0].character.abilities.bravery, '99');
  assert.equal(original.characters[0].character.name, 'The Colorado Kid');
});

test('saves and loads separate character sheets and their weapon choices', () => {
  let library = initialLibrary();
  library = saveDraft({ ...library, activeId: null, draft: { ...library.draft, name: 'Rose', loadout: { weaponId: 'bow', customSpeed: '8' } } }, 'rose');
  library = saveDraft({ ...library, activeId: null, draft: { ...library.draft, name: 'Jack', loadout: { weaponId: 'custom-gun', customSpeed: '-10' } } }, 'jack');
  assert.equal(library.characters.length, 3);
  const rose = loadSaved(library, 'rose');
  assert.equal(rose.draft.name, 'Rose');
  assert.deepEqual(rose.draft.loadout, { weaponId: 'bow', customSpeed: '8' });
  rose.draft.abilities.speed = '1';
  assert.equal(library.characters.find(entry => entry.id === 'rose')!.character.abilities.speed, '90');
  assert.deepEqual(loadSaved(library, 'jack').draft.loadout, { weaponId: 'custom-gun', customSpeed: '-10' });
  assert.throws(() => loadSaved(library, 'missing'), /Choose a saved character/);
});

test('persists an unfinished draft separately from its saved snapshot', () => {
  const local = storage();
  const library = initialLibrary();
  library.draft.abilities.speed = '';
  writeLibrary(local, library);
  const restored = readLibrary(local);
  assert.equal(restored.draft.abilities.speed, '');
  assert.equal(restored.characters[0].character.abilities.speed, '90');
  assert.throws(() => saveDraft(restored, 'new'), /Sheet scores/);
  assert.equal(loadSaved(restored, restored.activeId!).draft.abilities.speed, '90');
});

test('export and import round-trip both input modes, including custom weapons', () => {
  for (const mode of ['scores', 'modifiers'] as const) {
    const character = { ...structuredClone(sample), mode, name: 'Rose', loadout: { weaponId: 'custom-throw', customSpeed: '10' } };
    character.modifiers.name = 'Rose';
    const json = exportCharacterJson(character);
    const imported = importCharacter(initialLibrary(), json, `import-${mode}`);
    assert.deepEqual(imported.draft, character);
    assert.equal(imported.characters.length, 2);
    assert.deepEqual(loadSaved(imported, `import-${mode}`).draft, character);
  }
});

test('imports old exports, BOM-prefixed JSON, and numeric stat fields', () => {
  const old = legacyCharacter();
  const imported = importCharacter(initialLibrary(), '\uFEFF' + JSON.stringify(old), 'legacy-import');
  assert.deepEqual(imported.draft.loadout, sample.loadout);
  const numeric = { ...old, abilities: { ...old.abilities, speed: 96 } };
  assert.equal(parseCharacter(numeric).abilities.speed, '96');
});

test('optional Strength ratings round-trip without breaking older character exports', () => {
  assert.equal(parseCharacter(legacyCharacter()).strength, undefined);
  const character = { ...sample, strength: '15' };
  assert.equal(importCharacter(initialLibrary(), exportCharacterJson(character), 'strong').draft.strength, '15');
  assert.equal(parseCharacter({ ...sample, strength: 13 }).strength, '13');
  assert.equal(parseCharacter({ ...sample, strength: '' }).strength, '');
  for (const strength of ['0', '100', '1.5', 'bad']) assert.throws(() => parseCharacter({ ...sample, strength }), /Strength/);
});

test('same-name imports add separate entries instead of overwriting characters', () => {
  const original = initialLibrary();
  const json = exportCharacterJson(sample);
  const first = importCharacter(original, json, 'import-one');
  const second = importCharacter(first, json, 'import-two');
  assert.equal(second.characters.length, 3);
  assert.deepEqual(second.characters[0], original.characters[0]);
  assert.deepEqual(second.characters.map(entry => entry.id), ['initial-character', 'import-one', 'import-two']);
  assert.throws(() => importCharacter(second, json, 'import-one'), /already has this ID/);
});

test('rejects invalid imports without changing the open sheet or library', () => {
  const library = initialLibrary();
  const before = structuredClone(library);
  const invalid = [
    'not JSON', 'null', '[]', '{}',
    JSON.stringify({ ...sample, mode: ['scores'] }),
    JSON.stringify({ ...sample, abilities: { ...sample.abilities, speed: '101' } }),
    JSON.stringify({ ...sample, abilities: { ...sample.abilities, speed: '1.5' } }),
    JSON.stringify({ ...sample, mode: 'modifiers', modifiers: { ...sample.modifiers, experience: 'bad' } }),
    JSON.stringify({ ...sample, loadout: { weaponId: 'missing', customSpeed: '5' } }),
    JSON.stringify({ ...sample, loadout: { weaponId: 'custom-gun', customSpeed: '' } }),
  ];
  for (const json of invalid) assert.throws(() => importCharacter(library, json, 'new'));
  assert.deepEqual(library, before);
});

test('removing a saved entry retains the current draft and other characters', () => {
  const library = importCharacter(initialLibrary(), exportCharacterJson({ ...sample, name: 'Rose' }), 'rose');
  const removed = removeSaved(library, 'rose');
  assert.equal(removed.activeId, null);
  assert.equal(removed.draft.name, 'Rose');
  assert.equal(removed.characters.length, 1);
  const resaved = saveDraft(removed, 'rose-new');
  assert.equal(resaved.characters.length, 2);
  assert.equal(resaved.activeId, 'rose-new');
});

test('recovers good saved entries when a library entry or draft is damaged', () => {
  const library = initialLibrary();
  const damaged = { ...library, draft: null, characters: [...library.characters, { id: 'bad', character: {} }, library.characters[0]] };
  const recovered = readLibrary(storage({ [libraryKey]: JSON.stringify(damaged) }));
  assert.equal(recovered.characters.length, 1);
  assert.equal(recovered.draft.name, sample.name);
  const badJson = readLibrary(storage({ [libraryKey]: '{', [legacyKey]: JSON.stringify({ ...legacyCharacter(), name: 'Legacy' }) }));
  assert.equal(badJson.draft.name, 'Legacy');
});

test('handles unavailable browser storage and surfaces failed writes', () => {
  const blocked = { getItem: () => { throw new Error('Storage disabled'); }, setItem: () => { throw new Error('Storage full'); } };
  const library: CharacterLibrary = readLibrary(blocked);
  assert.equal(library.draft.name, sample.name);
  assert.throws(() => writeLibrary(blocked, library), /Storage full/);
});

test('reads small files and reports oversized or unreadable files', async () => {
  assert.equal(await readCharacterFile({ size: 2, text: async () => '{}' }), '{}');
  await assert.rejects(readCharacterFile({ size: 65537, text: async () => '{}' }), /smaller than 64 KB/);
  await assert.rejects(readCharacterFile({ size: 2, text: async () => { throw new Error('Unreadable'); } }), /Could not read/);
});
