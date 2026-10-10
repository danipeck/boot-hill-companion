import { useEffect, useRef, useState } from 'react';
import { Check, DollarSign, Package, Pencil, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react';
import type { Character } from './characters';
import { catalogueKey, emptyEquipment, itemQuantity, money, moneyCents, parseInventoryItem, parseItem, readCatalogue, transact, type CatalogueItem, type Equipment, type InventoryItem } from './equipment';
import { startingCatalogue } from './item-catalogue';

type Editor = { item: CatalogueItem | InventoryItem; inventory: boolean; isNew: boolean };
function ItemDetails({ item }: { item: CatalogueItem }) {
  return <>
    <p className="item-category">{item.code && `${item.code} · `}{item.category}{item.unit && ` · ${item.unit}`}</p>
    {item.weapon && <dl className="item-weapon-details"><div><dt>Range S / M / L / E</dt><dd>{item.weapon.ranges.join(' / ')}</dd></div><div><dt>Ammo capacity</dt><dd>{item.weapon.ammo}</dd></div><div><dt>Reload rate</dt><dd>{item.weapon.reload}</dd></div><div><dt>Weapon speed</dt><dd>{item.weapon.speed}</dd></div></dl>}
    {item.availability && <p className="item-notes">Availability: {item.availability}</p>}
    {item.notes && <p className="item-notes">{item.notes}</p>}
  </>;
}

function ItemEditor({ editor, onSave, onClose }: { editor: Editor; onSave: (item: InventoryItem) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [item, setItem] = useState(editor.item);
  const [price, setPrice] = useState(item.priceCents === null ? '' : (item.priceCents / 100).toFixed(2));
  const [quantity, setQuantity] = useState('quantity' in editor.item ? String(editor.item.quantity) : '1');
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  function save() {
    try {
      const parsed = parseInventoryItem({ ...item, priceCents: price.trim() ? moneyCents(price) : null, quantity: itemQuantity(Number(quantity)) });
      onSave(parsed);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Check item fields.'); }
  }
  return <dialog ref={dialog} className="dialog item-dialog" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="item-editor-title">
    <div className="dialog-header"><h2 id="item-editor-title">{editor.isNew ? 'Add item' : 'Edit item'}</h2><button className="icon-button" onClick={onClose} aria-label="Close item editor"><X size={20}/></button></div>
    <form className="item-editor" onSubmit={event => { event.preventDefault(); save(); }}>
      <label className="wide-field">Name<input autoFocus required maxLength={200} value={item.name} onChange={event => setItem({ ...item, name: event.target.value })}/></label>
      <label>Category<input required maxLength={200} value={item.category} onChange={event => setItem({ ...item, category: event.target.value })}/></label>
      <label>Type<select value={item.kind} disabled={editor.inventory} onChange={event => setItem({ ...item, kind: event.target.value as CatalogueItem['kind'] })}><option value="item">Inventory item</option><option value="expense">Service / expense</option><option value="income">Income / wages</option></select></label>
      <label>Price ($)<input inputMode="decimal" value={price} placeholder="Unset" onChange={event => setPrice(event.target.value)}/></label>
      <label>Unit / package<input maxLength={200} value={item.unit} onChange={event => setItem({ ...item, unit: event.target.value })}/></label>
      {editor.inventory && <label>Quantity<input type="number" min="1" max="1000000" step="1" required value={quantity} onChange={event => setQuantity(event.target.value)}/></label>}
      <label>Code<input maxLength={200} value={item.code ?? ''} onChange={event => setItem({ ...item, code: event.target.value })}/></label>
      <label>Availability<input maxLength={200} value={item.availability ?? ''} onChange={event => setItem({ ...item, availability: event.target.value })}/></label>
      <label className="wide-field">Notes<textarea rows={3} maxLength={2000} value={item.notes} onChange={event => setItem({ ...item, notes: event.target.value })}/></label>
      <label className="checkbox-label wide-field"><input type="checkbox" checked={!!item.weapon} onChange={event => setItem({ ...item, weapon: event.target.checked ? { ranges: ['', '', '', ''], ammo: '', reload: '', speed: '' } : undefined })}/>Weapon details</label>
      {item.weapon && <>
        {['Short range', 'Medium range', 'Long range', 'Extreme range'].map((label, index) => <label key={label}>{label}<input maxLength={32} value={item.weapon!.ranges[index]} onChange={event => setItem({ ...item, weapon: { ...item.weapon!, ranges: item.weapon!.ranges.map((value, i) => i === index ? event.target.value : value) } })}/></label>)}
        {(['ammo', 'reload', 'speed'] as const).map(key => <label key={key}>{key === 'ammo' ? 'Ammo capacity' : key === 'reload' ? 'Reload rate' : 'Weapon speed'}<input maxLength={200} value={item.weapon![key]} onChange={event => setItem({ ...item, weapon: { ...item.weapon!, [key]: event.target.value } })}/></label>)}
      </>}
      {error && <p className="validation-error wide-field" role="alert">{error}</p>}
      <div className="management-actions wide-field"><button className="export-button" type="submit"><Check size={16}/>Save item</button><button className="text-button" type="button" onClick={onClose}>Cancel</button></div>
    </form>
  </dialog>;
}

export default function CharacterManagement({ character, onChange }: { character: Character; onChange: (equipment: Equipment) => void }) {
  const equipment = character.equipment ?? emptyEquipment();
  const [catalogue, setCatalogue] = useState(() => {
    try { return { items: readCatalogue(localStorage), error: '' }; }
    catch { return { items: structuredClone(startingCatalogue), error: 'The saved catalogue could not be read. Showing the supplied item list.' }; }
  });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cash, setCash] = useState((equipment.cashCents / 100).toFixed(2));
  const [editingCash, setEditingCash] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(''), 3500);
    return () => clearTimeout(timer);
  }, [status]);
  function updateCatalogue(items: CatalogueItem[]) {
    setCatalogue({ items, error: '' });
    try { localStorage.setItem(catalogueKey, JSON.stringify(items)); }
    catch { setCatalogue({ items, error: 'Browser storage is unavailable. Catalogue edits are kept for this session only.' }); }
  }
  function newItem(inventory: boolean) {
    setEditor({ inventory, isNew: true, item: { id: crypto.randomUUID(), name: '', category: 'Equipment', priceCents: null, unit: 'each', notes: '', kind: 'item' } });
  }
  function saveItem(item: InventoryItem) {
    if (!editor) return;
    if (editor.inventory) {
      if (editor.isNew && equipment.items.length >= 1000) throw new Error('Remove an inventory entry before adding another.');
      onChange({ ...equipment, items: editor.isNew ? [...equipment.items, item] : equipment.items.map(entry => entry.id === item.id ? item : entry) });
    } else {
      const parsed = parseItem(item);
      if (editor.isNew && catalogue.items.length >= 2000) throw new Error('Remove a catalogue entry before adding another.');
      updateCatalogue(editor.isNew ? [...catalogue.items, parsed] : catalogue.items.map(entry => entry.id === parsed.id ? parsed : entry));
    }
    setEditor(null); setError(''); setStatus('Item saved.');
  }
  function buy(item: CatalogueItem) {
    try {
      const next = transact(equipment, item, itemQuantity(Number(quantity)), crypto.randomUUID());
      onChange(next); setError(''); setStatus(`${item.name}: ${item.kind === 'income' ? 'income recorded' : item.kind === 'expense' ? 'payment recorded' : 'added to inventory'}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not buy this item.'); }
  }
  const categories = [...new Set(catalogue.items.map(item => item.category))].sort();
  const shown = catalogue.items.filter(item => (!category || item.category === category) && `${item.name} ${item.code ?? ''} ${item.category} ${item.notes}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="management-column">
    <section className="card management-card">
      <div className="section-heading"><div className="title-with-icon"><DollarSign size={19}/><h2>Cash &amp; notes</h2></div><strong className="cash-total">{money(equipment.cashCents)}</strong></div>
      {editingCash ? <form className="cash-form" onSubmit={event => { event.preventDefault(); try { onChange({ ...equipment, cashCents: moneyCents(cash) }); setEditingCash(false); setError(''); setStatus('Cash updated.'); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Check cash amount.'); } }}><label htmlFor="cash-balance">Cash balance ($)<input id="cash-balance" autoFocus inputMode="decimal" value={cash} onChange={event => setCash(event.target.value)}/></label><button className="export-button" type="submit">Update cash</button><button className="text-button" type="button" onClick={() => setEditingCash(false)}>Cancel</button></form> : <button className="text-button" onClick={() => { setCash((equipment.cashCents / 100).toFixed(2)); setEditingCash(true); }}><Pencil size={14}/>Adjust cash</button>}
      <label className="character-notes" htmlFor="character-notes">Character notes<textarea id="character-notes" rows={4} maxLength={10000} placeholder="Background, possessions, reminders…" value={equipment.notes} onChange={event => onChange({ ...equipment, notes: event.target.value })}/></label>
      <p className="panel-hint">Cash, inventory and notes save automatically for this character on this device. Use Save sheet for stat changes, or Export for a backup.</p>
    </section>
    {error ? <p className="validation-error management-message management-feedback" role="alert">{error}</p> : status && <p className="management-message management-feedback" role="status">{status}</p>}
    <section className="card management-card">
      <div className="section-heading"><div className="title-with-icon"><Package size={19}/><h2>Inventory</h2><span className="count-badge">{equipment.items.length}</span></div><button className="text-button" onClick={() => newItem(true)}><Plus size={15}/>Add existing item</button></div>
      {!equipment.items.length ? <p className="panel-hint">Buy from the catalogue below, or add possessions you already own.</p> : <div className="inventory-list">{equipment.items.map(item => <article className="inventory-entry" key={item.id}><div className="item-heading"><strong>{item.name}</strong><span className="item-quantity">×{item.quantity}</span></div><ItemDetails item={item}/><div className="management-actions"><button className="text-button" onClick={() => setEditor({ item, inventory: true, isNew: false })}><Pencil size={14}/>Edit</button><button className="text-button" title="Remove from inventory without refunding cash" onClick={() => onChange({ ...equipment, items: equipment.items.filter(entry => entry.id !== item.id) })}><Trash2 size={14}/>Remove</button></div></article>)}</div>}
    </section>
    <section className="card management-card">
      <div className="section-heading"><div className="title-with-icon"><ShoppingBag size={19}/><h2>Item catalogue</h2></div><button className="text-button" onClick={() => newItem(false)}><Plus size={15}/>New catalogue item</button></div>
      <div className="catalogue-filters"><label className="catalogue-search"><Search size={16}/><input aria-label="Search item catalogue" placeholder="Search items or weapon codes" value={search} onChange={event => setSearch(event.target.value)}/></label><label>Category<select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label>Quantity<input type="number" min="1" max="1000000" step="1" value={quantity} onChange={event => setQuantity(event.target.value)}/></label></div>
      <p className="panel-hint">Prices are per listed unit or package. Catalogue edits apply to future purchases. Availability is listed for the referee.</p>
      {catalogue.error && <p className="validation-error" role="alert">{catalogue.error}</p>}
      <p className="catalogue-count">{shown.length} of {catalogue.items.length} entries</p>
      {!shown.length && <p className="panel-hint">No items match these filters.</p>}
      <div className="catalogue-list">{shown.map(item => <article className="catalogue-entry" key={item.id}><div className="item-heading"><strong>{item.name}</strong><span className="item-price">{item.priceCents === null ? 'Price unset' : money(item.priceCents)}</span></div><ItemDetails item={item}/><div className="management-actions"><button className="export-button" onClick={() => item.priceCents === null ? setEditor({ item, inventory: false, isNew: false }) : buy(item)}>{item.priceCents === null ? 'Set price' : item.kind === 'income' ? 'Record income' : item.kind === 'expense' ? 'Pay' : 'Buy'}</button><button className="text-button" onClick={() => setEditor({ item, inventory: false, isNew: false })}><Pencil size={14}/>Edit</button><button className="icon-button" aria-label={`Remove ${item.name} from catalogue`} onClick={() => updateCatalogue(catalogue.items.filter(entry => entry.id !== item.id))}><Trash2 size={14}/></button></div></article>)}</div>
    </section>
    {editor && <ItemEditor editor={editor} onSave={saveItem} onClose={() => setEditor(null)}/>}
  </div>;
}
