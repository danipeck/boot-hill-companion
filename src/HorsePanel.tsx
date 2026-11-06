import { useState } from 'react';
import { Dice5, Plus, Trash2 } from 'lucide-react';
import { addHorse, adjustHorse, canAct, removeHorse, resolveHorseBolting, setHorseHeld, setHorseRider, settleHorse, type Encounter } from './encounter';
import { horseRemaining, horseStanding, horseStatus, horseStrength, horseStrengthTypes, type Horse } from './horses';
import { WoundDetails } from './WoundResult';

type Props = { encounter: Encounter; onChange: (next: Encounter) => void; onError: (message: string) => void };

export function HorseAdder({ encounter, onChange, onError, onClose }: Props & { onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<typeof horseStrengthTypes[number]>('Horse');
  const [strength, setStrength] = useState('30');
  const [riderId, setRiderId] = useState('');
  function generate(next = type) { setStrength(String(horseStrength(next))); }
  return <form className="add-combatant horse-add-form" onSubmit={event => {
    event.preventDefault();
    try {
      onChange(addHorse(encounter, name, Number(strength), crypto.randomUUID(), riderId || null));
      onError(''); onClose();
    } catch (caught) { onError(caught instanceof Error ? caught.message : 'Could not add this horse.'); }
  }}>
    <label>Horse name<input maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Cinder" required/></label>
    <label>Horse type<select value={type} onChange={event => { const next = event.target.value as typeof type; setType(next); generate(next); }}>{horseStrengthTypes.map(item => <option key={item}>{item}</option>)}</select></label>
    <label>Strength rating<input type="number" min={1} max={99} step={1} required value={strength} onChange={event => setStrength(event.target.value)}/></label>
    <label>Mounted rider<select value={riderId} onChange={event => setRiderId(event.target.value)}><option value="">Unmounted</option>{encounter.members.filter(member => canAct(member) && !encounter.horses?.some(horse => horse.mounted && horse.riderId === member.id)).map(member => <option key={member.id} value={member.id}>{member.sheet.name}</option>)}</select></label>
    {type !== 'Horse' && <button type="button" className="export-button" onClick={() => generate()}><Dice5 size={15}/>Roll Strength again</button>}
    <p className="panel-hint">{type === 'Workhorse' ? '30 + d10 (31–40).' : type === 'Pony' ? '30 − d10 (20–29).' : 'Base Strength 30.'} Edit the rating directly to use your own horse’s stats.</p>
    <div className="horse-actions"><button className="export-button" type="submit"><Plus size={15}/>Add horse</button><button className="text-button" type="button" onClick={onClose}>Cancel</button></div>
  </form>;
}

export function HorseCard({ horse, encounter, onChange, onError }: Props & { horse: Horse }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(horse.name);
  const [maximum, setMaximum] = useState(String(horse.maxStrength));
  const [remaining, setRemaining] = useState(String(horseRemaining(horse)));
  const [dead, setDead] = useState(horse.dead);
  const [boltModifier, setBoltModifier] = useState('0');
  const status = horseStatus(horse);
  function change(action: () => Encounter) {
    try { onChange(action()); onError(''); }
    catch (caught) { onError(caught instanceof Error ? caught.message : 'Could not update this horse.'); }
  }
  return <section className="horse-card" aria-label={`${horse.name}, horse`}>
    <div className="combatant-summary"><div><strong>{horse.name}</strong><span className={`result-tag ${status === 'Standing' ? 'hit' : 'miss'}`}>{status}</span></div><span className="strength-count">{horseRemaining(horse)} / {horse.maxStrength} Strength · {horse.mounted ? 'Mounted' : 'Unmounted'}</span></div>
    <div className="strength-bar" aria-hidden="true"><span style={{ width: `${horseRemaining(horse) / horse.maxStrength * 100}%` }}/></div>
    <div className="horse-controls"><label>Rider<select value={horse.riderId || ''} onChange={event => change(() => setHorseRider(encounter, horse.id, event.target.value || null, false))}><option value="">No linked rider</option>{encounter.members.map(member => <option key={member.id} value={member.id}>{member.sheet.name}</option>)}</select></label>
      {horse.riderId && <button className="export-button" disabled={!horse.mounted && (!horseStanding(horse) || !encounter.members.some(member => member.id === horse.riderId && canAct(member)))} onClick={() => change(() => setHorseRider(encounter, horse.id, horse.riderId, !horse.mounted))}>{horse.mounted ? 'Dismount' : 'Mount'}</button>}
      {!horse.mounted && <label className="checkbox-label"><input type="checkbox" checked={horse.held} onChange={event => change(() => setHorseHeld(encounter, horse.id, event.target.checked))}/>Held by someone</label>}
    </div>
    <div className="combatant-meta"><span>{horse.wounds.length} wound{horse.wounds.length === 1 ? '' : 's'}</span><div><button className="text-button" onClick={() => { setName(horse.name); setMaximum(String(horse.maxStrength)); setRemaining(String(horseRemaining(horse))); setDead(horse.dead); setEditing(!editing); }}>Adjust horse</button><button className="icon-button" aria-label={`Remove ${horse.name} from the shootout`} onClick={() => change(() => removeHorse(encounter, horse.id))}><Trash2 size={14}/></button></div></div>
    {horse.wounds.length > 0 && <details className="tracked-wounds"><summary>Horse wound details</summary><WoundDetails result={{ spreadRoll: null, spreadDie: null, wounds: horse.wounds, totalStrengthLoss: horse.wounds.reduce((sum, wound) => sum + (wound.strengthLoss ?? 0), 0), mortal: horse.wounds.some(wound => wound.severity === 'Mortal') }}/></details>}
    {horse.boltPending && <div className="horse-bolting" role="status"><strong>Check for bolting</strong>{horse.mounted || horse.held ? <><p>Non-leg wound · base chance 40%.</p><label>Referee adjustment (%)<input type="number" min={-100} max={100} step={1} value={boltModifier} onChange={event => setBoltModifier(event.target.value)}/></label></> : <p>Unridden and unheld: the horse bolts.</p>}<button className="export-button" onClick={() => change(() => {
      if ((horse.mounted || horse.held) && !boltModifier.trim()) throw new Error('Enter a bolting adjustment, or 0.');
      return resolveHorseBolting(encounter, horse.id, horse.mounted || horse.held ? Number(boltModifier) : 0);
    })}>{horse.mounted || horse.held ? 'Roll bolting check' : 'Mark bolting'}</button></div>}
    {horse.lastBolt && <p className="panel-hint">{horse.lastBolt.roll === null ? 'Unridden and unheld' : `Bolting d100 ${horse.lastBolt.roll} against ${horse.lastBolt.chance}%`} · {horse.lastBolt.bolted ? 'bolted' : 'stayed under control'}.</p>}
    {horse.bolting && <div className="horse-bolting"><p>The horse is bolting. Resolve its random direction at the table.</p><button className="text-button" onClick={() => change(() => settleHorse(encounter, horse.id))}>Referee: horse settled</button></div>}
    {editing && <form className="horse-adjust" onSubmit={event => {
      event.preventDefault(); change(() => {
        if (!maximum.trim() || !remaining.trim()) throw new Error('Enter maximum and current Strength.');
        const next = adjustHorse(encounter, horse.id, name, Number(maximum), Number(remaining), dead); setEditing(false); return next;
      });
    }}>
      <label>Name<input value={name} maxLength={80} required onChange={event => setName(event.target.value)}/></label>
      <label>Maximum Strength<input type="number" value={maximum} min={1} max={99} step={1} required onChange={event => setMaximum(event.target.value)}/></label>
      <label>Current Strength<input type="number" value={remaining} min={0} max={maximum} step={1} required onChange={event => setRemaining(event.target.value)}/></label>
      <label className="checkbox-label"><input type="checkbox" checked={dead} onChange={event => setDead(event.target.checked)}/>Dead</label>
      <button className="export-button" type="submit">Apply</button><button className="text-button" type="button" onClick={() => setEditing(false)}>Cancel</button>
    </form>}
  </section>;
}
