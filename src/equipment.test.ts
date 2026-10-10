import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CharacterManagement from './CharacterManagement';
import App from './App';
import { blankCharacter, exportCharacterJson, importCharacter, libraryKey, loadSaved, parseCharacter, readLibrary, sample, saveDraft, updateEquipment, writeLibrary } from './characters';
import { addCombatant, adjustCombatant, newEncounter, readEncounter, undoEncounter, updateActingSheet, updateCombatantEquipment } from './encounter';
import { catalogueKey, emptyEquipment, moneyCents, parseEquipment, parseItem, readCatalogue, transact } from './equipment';
import { retiredCatalogueEntries, startingCatalogue } from './item-catalogue';

const item = (name: string) => startingCatalogue.find(entry => entry.name === name)!;
function storage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

test('supplied catalogue preserves weapon details, packages, availability and corrected GM prices', () => {
  assert.equal(startingCatalogue.length, 78);
  assert.equal(startingCatalogue.filter(entry => entry.category === 'Weapons').length, 16);
  for (const entry of startingCatalogue) assert.deepEqual(parseItem(entry), entry);
  assert.equal(item('Fast-draw Revolver').priceCents, 4000);
  assert.equal(item('Fast-draw Revolver').availability, 'Federal Marshal');
  assert.deepEqual(item('Tomahawk').weapon?.ranges, ['1', '4', '8', '4']);
  assert.equal(item('Ammunition').unit, '(100)');
  assert.equal(item('Whiskey').priceCents, 200);
  for (const [name, price] of [['Bible', 9000], ['Gramophone Record', 5000], ['Hardcover Book', 7500], ['Harmonica', 2500]] as const) {
    assert.equal(item(name).priceCents, price);
    assert.equal(item(name).notes, '');
  }
  assert.equal(item('Tomahawk').priceCents, null);
  for (const entry of startingCatalogue) {
    assert.equal(entry.kind, 'item');
    assert.ok(!Object.values(retiredCatalogueEntries).includes(entry.name));
  }
});

test('old GM price notes and the book typo are corrected on load without overriding edited prices or other notes', () => {
  const oldBook = { ...item('Hardcover Book'), name: 'Harcover Book', priceCents: null, notes: 'Listed price: 75?' };
  const local = storage();
  local.setItem(catalogueKey, JSON.stringify([oldBook]));
  assert.deepEqual(readCatalogue(local), [item('Hardcover Book')]);
  assert.equal(parseEquipment({ ...emptyEquipment(), items: [{ ...oldBook, quantity: 1 }] }).items[0].name, 'Hardcover Book');
  const edited = parseItem({ ...oldBook, priceCents: 500, notes: 'Signed copy. Listed price: 75? Keep dry.' });
  assert.equal(edited.priceCents, 500);
  assert.equal(edited.notes, 'Signed copy.  Keep dry.');
});

test('purchases use exact cents, deduct cash once and store independent inventory snapshots', () => {
  const before = { ...emptyEquipment(), cashCents: moneyCents('0.60') };
  const purchased = transact(before, item('Coffee'), 2, 'coffee');
  assert.equal(purchased.cashCents, 0);
  assert.equal(purchased.items[0].quantity, 2);
  assert.equal(purchased.items[0].unit, 'lb');
  assert.equal(purchased.transactions[0].amountCents, -60);
  assert.equal(before.items.length, 0); assert.equal(before.cashCents, 60);
  const weapon = transact({ ...emptyEquipment(), cashCents: 5000 }, item('Fast-draw Revolver'), 1, 'gun');
  weapon.items[0].weapon!.ranges[0] = '99';
  assert.equal(item('Fast-draw Revolver').weapon!.ranges[0], '3');
  const edited = { ...item('Coffee'), name: 'Better coffee', priceCents: 40 };
  assert.equal(purchased.items[0].name, 'Coffee');
  assert.equal(purchased.items[0].priceCents, 30);
  assert.equal(transact({ ...before, cashCents: 80 }, edited, 2, 'new-coffee').cashCents, 0);
});

test('custom services and wages still support transactions without being supplied catalogue entries', () => {
  const service = { id: 'custom-service', name: 'Custom service', category: 'Custom', kind: 'expense' as const, priceCents: 75, unit: 'each', notes: '' };
  const income = { ...service, id: 'custom-income', name: 'Custom income', kind: 'income' as const, priceCents: 3000 };
  const paid = transact({ ...emptyEquipment(), cashCents: 100 }, service, 1, 'bath');
  assert.equal(paid.cashCents, 25); assert.equal(paid.items.length, 0);
  const wages = transact(paid, income, 2, 'wages');
  assert.equal(wages.cashCents, 6025); assert.equal(wages.items.length, 0);
  assert.equal(wages.transactions[0].amountCents, 6000);
  assert.equal(wages.transactions[1].amountCents, -75);
});

test('invalid purchases and imports reject fractional quantities, missing prices and negative or overflowing cash', () => {
  const before = { ...emptyEquipment(), cashCents: 100 };
  assert.throws(() => transact(before, item('Fast-draw Revolver'), 1, 'gun'), /Not enough cash/);
  assert.throws(() => transact(before, item('Tomahawk'), 1, 'axe'), /Set a price/);
  for (const quantity of [0, -1, 1.5, NaN, 1000001]) assert.throws(() => transact(before, item('Coffee'), quantity, 'bad'), /Quantity/);
  for (const value of ['', '-1', '1.001', '1e2', 'NaN', '1000000000000']) assert.throws(() => moneyCents(value));
  assert.equal(moneyCents('1.2'), 120);
  assert.throws(() => parseEquipment({ ...before, cashCents: -1 }));
  assert.throws(() => parseEquipment({ ...before, items: [{ ...item('Coffee'), quantity: -1 }] }));
  const duplicate = transact(before, item('Coffee'), 1, 'same');
  assert.throws(() => transact(duplicate, item('Coffee'), 1, 'same'), /Duplicate/);
  assert.deepEqual(before, { ...emptyEquipment(), cashCents: 100 });
});

test('cash, editable inventory and notes survive character and shootout save, refresh and JSON import', () => {
  const local = storage();
  const equipment = { ...transact({ ...emptyEquipment(), cashCents: 6000 }, item('Fast-draw Revolver'), 1, 'gun'), notes: 'Debt paid.\nMeet the sheriff.' };
  equipment.items[0].name = 'My revolver'; equipment.items[0].notes = 'Engraved grip';
  const character = { ...sample, equipment };
  const saved = saveDraft({ ...readLibrary(local), draft: character }, 'unused');
  writeLibrary(local, saved);
  assert.equal(local.getItem(libraryKey) !== null, true);
  assert.deepEqual(loadSaved(readLibrary(local), saved.activeId!).draft.equipment, equipment);
  const imported = importCharacter(saved, exportCharacterJson(character), 'copy');
  assert.deepEqual(imported.draft.equipment, equipment);
  const restored = parseCharacter(JSON.parse(exportCharacterJson(character)));
  restored.equipment!.items[0].name = 'Edited copy';
  assert.equal(character.equipment.items[0].name, 'My revolver');
  assert.equal(parseCharacter(sample).equipment, undefined);
  const encounter = updateActingSheet(addCombatant(newEncounter('fight'), sample, 'kid'), character);
  assert.deepEqual(readEncounter({ getItem: () => JSON.stringify(encounter) }, 'fallback').members[0].sheet.equipment, equipment);
  const other = saveDraft({ ...saved, activeId: null, draft: { ...sample, name: 'Rose' } }, 'rose');
  assert.equal(loadSaved(other, 'rose').draft.equipment, undefined);
  assert.deepEqual(loadSaved(other, saved.activeId!).draft.equipment, equipment);
});

test('catalogue edits and deletions survive refresh without changing the supplied defaults', () => {
  const local = storage();
  const catalogue = readCatalogue(local);
  catalogue[0].priceCents = 175;
  catalogue.splice(1, 1);
  local.setItem(catalogueKey, JSON.stringify(catalogue));
  assert.deepEqual(readCatalogue(local), catalogue);
  assert.equal(startingCatalogue[0].priceCents, 100);
  local.setItem(catalogueKey, '[]');
  assert.deepEqual(readCatalogue(local), []);
  local.setItem(catalogueKey, JSON.stringify([catalogue[0], catalogue[0]]));
  assert.throws(() => readCatalogue(local), /Duplicate/);
});

test('saved catalogues lose retired defaults while retaining custom services, renamed entries and owned items', () => {
  const local = storage();
  const retired = Object.entries(retiredCatalogueEntries).map(([id, name]) => ({ ...item('Coffee'), id, name, category: 'Services', kind: 'expense' as const }));
  const custom = { ...retired[0], id: 'custom-service' };
  const renamed = { ...retired[1], name: 'Custom possession', kind: 'item' as const };
  const editedCoffee = { ...item('Coffee'), priceCents: 35 };
  local.setItem(catalogueKey, JSON.stringify([retired[0], ...retired.slice(2), custom, renamed, editedCoffee]));
  const expected = [custom, renamed, editedCoffee];
  assert.deepEqual(readCatalogue(local), expected);
  local.setItem(catalogueKey, JSON.stringify(readCatalogue(local)));
  assert.deepEqual(readCatalogue(local), expected);
  const owned = { ...emptyEquipment(), items: [{ ...retired[0], quantity: 1 }] };
  assert.equal(parseEquipment(owned).items[0].name, retired[0].name);
  assert.deepEqual(readCatalogue(storage()), startingCatalogue);
});

test('purchases persist to the correct saved character without committing unfinished stat changes', () => {
  const local = storage();
  const initial = readLibrary(local);
  const equipment = transact({ ...emptyEquipment(), cashCents: 5000 }, item('Fast-draw Revolver'), 1, 'gun');
  const edited = { ...initial, draft: { ...initial.draft, abilities: { ...initial.draft.abilities, speed: '' } } };
  const next = updateEquipment(edited, equipment);
  assert.equal(next.draft.abilities.speed, '');
  assert.equal(next.characters[0].character.abilities.speed, '90');
  assert.equal(initial.characters[0].character.equipment, undefined);
  writeLibrary(local, next);
  const refreshed = readLibrary(local);
  assert.deepEqual(loadSaved(refreshed, next.activeId!).draft.equipment, equipment);
  const unsaved = updateEquipment({ ...initial, activeId: null, draft: blankCharacter('Rose') }, equipment);
  assert.deepEqual(unsaved.draft.equipment, equipment);
  assert.equal(unsaved.characters[0].character.equipment, undefined);
  unsaved.draft.equipment!.items[0].name = 'Personal gun';
  assert.equal(next.characters[0].character.equipment!.items[0].name, 'Fast-draw Revolver');
});

test('managing a saved character carries possessions back to its shootout while preserving combat state', () => {
  const equipment = transact({ ...emptyEquipment(), cashCents: 5000 }, item('Fast-draw Revolver'), 1, 'gun');
  const initial = addCombatant(addCombatant(newEncounter('inventory-sync'), sample, 'kid'), { ...sample, name: 'Rose' }, 'rose');
  const before = { ...initial, actorId: '', members: initial.members.map(member => member.id === 'kid' ? { ...member, libraryId: 'saved-kid', loss: 5, modifier: -2, sheet: { ...member.sheet, abilities: { ...member.sheet.abilities, speed: '96' } } } : member) };
  const updated = updateCombatantEquipment(before, 'saved-kid', equipment);
  assert.deepEqual(updated.members[0].sheet.equipment, equipment);
  assert.equal(updated.members[0].sheet.abilities.speed, '96');
  assert.equal(updated.members[0].loss, 5); assert.equal(updated.members[0].modifier, -2);
  assert.equal(updated.members[1], before.members[1]);
  assert.equal(before.members[0].sheet.equipment, undefined);
  assert.equal(updateCombatantEquipment(before, null, equipment), before);
  const changedCombat = adjustCombatant(initial, 'kid', 10, false);
  const purchased = updateCombatantEquipment(changedCombat, 'kid', equipment);
  const undone = undoEncounter(purchased);
  assert.equal(undone.members[0].loss, 0);
  assert.deepEqual(undone.members[0].sheet.equipment, equipment);
});

test('the direct character-sheet route renders management, with combat retained behind the navigation', () => {
  const previous = ['document', 'window', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset: { theme: 'light' } } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { pathname: '/character-sheet/' } } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() });
  try {
    const html = renderToStaticMarkup(React.createElement(App));
    assert.match(html, /Character sheet &amp; inventory/);
    assert.match(html, /href="\/"[^>]*>[\s\S]*?<span>Combat<\/span>/);
    assert.match(html, /class="combat-column" hidden=""/);
    assert.match(html, /Item catalogue/);
    assert.match(html, /id="roll-strength"/);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('management view renders character inventory, cash, catalogue search and shopping controls', () => {
  const local = storage();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true });
  try {
    const equipment = transact({ ...emptyEquipment(), cashCents: 10000 }, item('Fast-draw Revolver'), 1, 'gun');
    const html = renderToStaticMarkup(React.createElement(CharacterManagement, { character: { ...sample, equipment }, onChange() {} }));
    assert.match(html, /\$60\.00/); assert.match(html, /Inventory/); assert.match(html, /Item catalogue/);
    assert.match(html, /Search item catalogue/); assert.match(html, /Set price/);
    assert.ok(!html.includes('Record income'));
    assert.ok(!html.includes('Bullet removed'));
    assert.ok(!html.includes('Shave &amp; Haircut'));
    assert.match(html, /Add existing item/); assert.match(html, /Fast-draw Revolver/);
    assert.match(html, /78 of 78 entries/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
