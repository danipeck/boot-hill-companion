import { retiredCatalogueEntries, startingCatalogue } from './item-catalogue';

export type CatalogueItem = {
  id: string; name: string; category: string; priceCents: number | null;
  unit: string; notes: string; kind: 'item' | 'expense' | 'income';
  code?: string; availability?: string;
  weapon?: { ranges: string[]; ammo: string; reload: string; speed: string };
};
export type InventoryItem = CatalogueItem & { quantity: number; sourceId?: string };
export type Transaction = { id: string; name: string; quantity: number; amountCents: number };
export type Equipment = { cashCents: number; items: InventoryItem[]; notes: string; transactions: Transaction[] };
export const catalogueKey = 'boot-hill.items.v1';
export const emptyEquipment = (): Equipment => ({ cashCents: 0, items: [], notes: '', transactions: [] });
export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function moneyCents(raw: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(raw.trim())) throw new Error('Enter a dollar amount with up to two decimal places.');
  const [dollars, cents = ''] = raw.trim().split('.');
  return amount(Number(dollars) * 100 + Number(cents.padEnd(2, '0')));
}
function amount(value: unknown, negative = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Math.abs(value) > 1_000_000_000_000 || (!negative && value < 0)) throw new Error('Invalid cash or price amount.');
  return value;
}
export function itemQuantity(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 1_000_000) throw new Error('Quantity must be a whole number from 1 to 1,000,000.');
  return raw;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid equipment data.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid item text.');
  return value;
}
export function parseItem(value: unknown): CatalogueItem {
  const item = record(value);
  const id = text(item.id), name = text(item.name), category = text(item.category);
  if (!id.trim() || !name.trim() || !category.trim() || !['item', 'expense', 'income'].includes(String(item.kind))) throw new Error('Enter an item name, category and type.');
  const parsed: CatalogueItem = { id, name, category, kind: item.kind as CatalogueItem['kind'], priceCents: item.priceCents === null ? null : amount(item.priceCents), unit: text(item.unit), notes: text(item.notes, 2000) };
  for (const key of ['code', 'availability'] as const) if (item[key] !== undefined) parsed[key] = text(item[key]);
  if (item.weapon !== undefined) {
    const weapon = record(item.weapon);
    if (!Array.isArray(weapon.ranges) || weapon.ranges.length !== 4) throw new Error('Enter four weapon range bands.');
    parsed.weapon = { ranges: weapon.ranges.map(value => text(value, 32)), ammo: text(weapon.ammo), reload: text(weapon.reload), speed: text(weapon.speed) };
  }
  // Correct the original GM price annotations in saved catalogues and items.
  // A price already edited by the user takes precedence over the old note.
  const listedPrice = parsed.notes.match(/(?:^|\s)Listed price:\s*(\d+(?:\.\d{1,2})?)\?(?=\s|$)/);
  if (listedPrice) {
    if (parsed.priceCents === null) parsed.priceCents = moneyCents(listedPrice[1]);
    parsed.notes = parsed.notes.replace(listedPrice[0], ' ').trim();
  }
  if (parsed.name === 'Harcover Book') parsed.name = 'Hardcover Book';
  return parsed;
}
export function parseInventoryItem(value: unknown): InventoryItem {
  const item = record(value);
  return { ...parseItem(value), quantity: itemQuantity(item.quantity), ...(item.sourceId !== undefined ? { sourceId: text(item.sourceId) } : {}) };
}
export function parseEquipment(value: unknown): Equipment {
  const equipment = record(value);
  if (!Array.isArray(equipment.items) || equipment.items.length > 1000 || !Array.isArray(equipment.transactions) || equipment.transactions.length > 100) throw new Error('Invalid inventory or transaction list.');
  const items = equipment.items.map(parseInventoryItem);
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate inventory item IDs.');
  return {
    cashCents: amount(equipment.cashCents), items, notes: text(equipment.notes, 10000),
    transactions: equipment.transactions.map(value => {
      const transaction = record(value);
      return { id: text(transaction.id), name: text(transaction.name), quantity: itemQuantity(transaction.quantity), amountCents: amount(transaction.amountCents, true) };
    }),
  };
}
export function transact(equipment: Equipment, item: CatalogueItem, quantity: number, id: string): Equipment {
  equipment = parseEquipment(equipment); item = parseItem(item); quantity = itemQuantity(quantity);
  if (item.priceCents === null) throw new Error('Set a price for this item before buying or recording payment.');
  const cost = amount(item.priceCents * quantity);
  const change = item.kind === 'income' ? cost : -cost;
  if (equipment.cashCents + change < 0) throw new Error(`Not enough cash. This costs ${money(cost)}.`);
  if (!id.trim() || equipment.items.some(entry => entry.id === id) || equipment.transactions.some(entry => entry.id === id)) throw new Error('Duplicate transaction ID.');
  if (item.kind === 'item' && equipment.items.length >= 1000) throw new Error('Remove an inventory entry before adding another.');
  return {
    ...equipment, cashCents: amount(equipment.cashCents + change),
    items: item.kind === 'item' ? [...equipment.items, { ...structuredClone(item), id, sourceId: item.id, quantity }] : equipment.items,
    transactions: [{ id, name: item.name, quantity, amountCents: change }, ...equipment.transactions].slice(0, 100),
  };
}
export function readCatalogue(storage: Pick<Storage, 'getItem'>): CatalogueItem[] {
  const raw = storage.getItem(catalogueKey);
  if (!raw) return structuredClone(startingCatalogue);
  const values: unknown = JSON.parse(raw);
  if (!Array.isArray(values) || values.length > 2000) throw new Error('Invalid item catalogue.');
  const items = values.map(parseItem);
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate catalogue item IDs.');
  // Retire supplied services from old saves without removing custom entries,
  // renamed items, purchased possessions or recorded transactions.
  return items.filter(item => retiredCatalogueEntries[item.id] !== item.name);
}
