import { useState } from 'react';
import { ArrowRight, Dice5, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { holdNames } from './brawling';
import { normalizeCharacter, setPercentileRoll, type Character, type SavedCharacter } from './characters';
import { addCombatant, adjustCombatant, combatantsBySpeed, combatantSpeed, combatantStatus, phaseNames, remainingStrength, removeCombatant, undoEncounter, type Encounter } from './encounter';
import { signed, weaponProfiles, weapons } from './rules';
import { createExtra, extraPresets, generateExtra } from './extras';

type Props = {
  encounter: Encounter; current: Character; saved: SavedCharacter[]; activeId: string | null;
  error: string; storageError: string; onChange: (next: Encounter) => void;
  onError: (message: string) => void; onAdvance: () => void; onReset: () => void;
  onActor: (id: string) => void; onTarget: (id: string) => void;
};

export function ExtraPreview({ sheet }: { sheet: Character }) {
  return <div className="extra-preview" role="status">
    <strong>{sheet.name} · sheet scores</strong>
    <dl>
      <div><dt>Speed</dt><dd>{sheet.abilities.speed}</dd></div>
      <div><dt>Gun accuracy</dt><dd>{sheet.abilities.gunAccuracy}</dd></div>
      <div><dt>Throwing accuracy</dt><dd>{sheet.abilities.throwingAccuracy}</dd></div>
      <div><dt>Strength</dt><dd>{sheet.strength}</dd></div>
      <div><dt>Bravery / morale</dt><dd>{sheet.abilities.bravery}</dd></div>
      <div><dt>Gunfights</dt><dd>{sheet.abilities.gunfights}</dd></div>
    </dl>
    <p>Weapon bonuses are applied in combat. Select the extra as the acting character to edit its sheet.</p>
  </div>;
}

export default function EncounterPanel({ encounter, current, saved, activeId, error, storageError, onChange, onError, onAdvance, onReset, onActor, onTarget }: Props) {
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState('current');
  const [strengthRoll, setStrengthRoll] = useState<string | null>(null);
  const [extraName, setExtraName] = useState('');
  const [presetId, setPresetId] = useState('');
  const [extraDraft, setExtraDraft] = useState<Character | null>(null);
  const [editing, setEditing] = useState('');
  const [remaining, setRemaining] = useState('');
  const [dead, setDead] = useState(false);
  const [resetting, setResetting] = useState(false);
  const preset = extraPresets.find(item => item.id === presetId);
  const chosen = choice === 'extra' ? extraDraft : choice === 'current' ? current : saved.find(item => item.id === choice)?.character;
  const prepared = chosen ? strengthRoll === null ? normalizeCharacter(chosen) : setPercentileRoll(chosen, 'strength', strengthRoll) : null;
  function ensureExtra() {
    if (!extraDraft) {
      setExtraDraft(generateExtra());
      if (!extraName.trim()) setExtraName('The stranger');
    }
  }
  function choosePreset(id: string) {
    const next = id ? createExtra(id) : generateExtra();
    if (!extraName.trim() || extraName === preset?.name || extraName === 'The stranger') setExtraName(next.name);
    setExtraDraft(next);
    setPresetId(id); setStrengthRoll(null);
  }
  function rerollExtra() {
    const next = generateExtra(extraName);
    setExtraDraft({ ...next, loadout: extraDraft?.loadout ?? next.loadout });
    setStrengthRoll(null);
  }
  function add() {
    try {
      if (!prepared) throw new Error('Choose a character to add.');
      if (choice === 'extra' && !extraName.trim()) throw new Error('Give the extra combatant a name.');
      const sheet = { ...prepared, name: choice === 'extra' ? extraName.trim() : prepared.name };
      const id = choice === 'extra' ? crypto.randomUUID() : choice === 'current' ? encounter.actorId || activeId || crypto.randomUUID() : choice;
      onChange(addCombatant(encounter, sheet, id));
      setStrengthRoll(null); setExtraName(''); setPresetId(''); setExtraDraft(null); setAdding(false); onError('');
    } catch (caught) { onError(caught instanceof Error ? caught.message : 'Could not add this character.'); }
  }
  const nextPhase = encounter.phase === 'shooting' ? 'Brawling 1' : encounter.phase === 'brawl-1' ? 'Brawling 2' : `Turn ${encounter.turn + 1}`;
  const actingOrder = combatantsBySpeed(encounter.members);
  const automaticTarget = encounter.members.find(member => member.id === encounter.targetId && member.id !== encounter.actorId);
  return <section className="encounter-card card" aria-labelledby="encounter-title">
    <div className="section-heading"><div className="title-with-icon"><Users size={18}/><h2 id="encounter-title">The shootout</h2></div><span className="turn-label">TURN {encounter.turn}</span></div>
    <div className="phase-row"><ol className="phase-steps" aria-label="Turn phases">{(['shooting', 'brawl-1', 'brawl-2'] as const).map(phase => <li key={phase} aria-current={encounter.phase === phase ? 'step' : undefined} className={encounter.phase === phase ? 'current' : ''}>{phase === 'shooting' ? 'Shooting' : phase === 'brawl-1' ? 'Brawling 1' : 'Brawling 2'}</li>)}</ol><button className="export-button" onClick={onAdvance}>{nextPhase}<ArrowRight size={15}/></button></div>
    {!encounter.members.length && <p className="panel-hint">Add characters to track Strength, wounds, and holds. You can also use the dice below on their own.</p>}
    {encounter.members.length > 0 && <>
      <div className="combatant-selectors"><label>Acting character<select value={encounter.actorId} onChange={event => onActor(event.target.value)}><option value="">Choose who acts</option>{actingOrder.map(member => <option value={member.id} key={member.id}>{member.sheet.name} · {combatantSpeed(member).label} · {combatantStatus(member)}</option>)}</select></label><label>Target{encounter.members.length >= 3 ? <select value={encounter.targetId} onChange={event => onTarget(event.target.value)}><option value="">Untracked target</option>{encounter.members.filter(member => member.id !== encounter.actorId).map(member => <option value={member.id} key={member.id}>{member.sheet.name} · {combatantStatus(member)}</option>)}</select> : <span className="automatic-target" role="status">{automaticTarget ? `${automaticTarget.sheet.name} · ${combatantStatus(automaticTarget)}` : encounter.actorId ? 'No other combatant' : 'Choose an acting character'}</span>}</label></div>
      <p className="panel-hint">Acting characters are listed by Speed, highest first. Choose who acts when surprise changes the order.</p>
      <div className="combatant-list">{encounter.members.map(member => {
        const status = combatantStatus(member);
        const holder = encounter.members.find(item => item.id === member.hold?.by);
        return <div className={`combatant-row status-${status.toLowerCase()}`} key={member.id}>
          <div className="combatant-summary"><div><strong>{member.sheet.name || 'Unnamed gunslinger'}</strong><span className={`result-tag ${status === 'Standing' ? 'hit' : 'miss'}`}>{status}</span></div><span className="strength-count">{remainingStrength(member)} / {member.maxStrength} Strength · {combatantSpeed(member).label}</span></div>
          <div className="strength-bar" aria-hidden="true"><span style={{ width: `${remainingStrength(member) / member.maxStrength * 100}%` }}/></div>
          {member.sheet.morale !== undefined && <p className="extra-reference">Morale {member.sheet.mode === 'scores' ? `${member.sheet.abilities.bravery}%` : member.sheet.morale.trim() ? `${member.sheet.morale}%` : 'unset'} · Experience {member.sheet.abilities.gunfights || 'unset'}</p>}
          <div className="combatant-meta"><span>{member.wounds.length} wound{member.wounds.length === 1 ? '' : 's'}{member.modifier !== 0 ? ` · ${signed(member.modifier)} this round` : ''}{member.nextModifier !== 0 ? ` · ${signed(member.nextModifier)} next round` : ''}{encounter.acted.includes(member.id) ? ' · acted' : ''}</span><div><button className="text-button" onClick={() => { setEditing(member.id); setRemaining(String(remainingStrength(member))); setDead(member.dead); }}>Adjust</button><button className="icon-button" aria-label={`Remove ${member.sheet.name} from the shootout`} onClick={() => onChange(removeCombatant(encounter, member.id))}><Trash2 size={14}/></button></div></div>
          {member.hold && <p className="hold-label">{holdNames[member.hold.kind]} · held by {holder?.sheet.name}</p>}
          {member.wounds.length > 0 && <details className="tracked-wounds"><summary>Wound details</summary>{member.wounds.map((wound, index) => <p key={index}>{wound.severity} · {wound.location} · {wound.strengthLoss === null ? 'Fatal' : `−${wound.strengthLoss} Strength`}{wound.effects.length > 0 && <small>{wound.effects.join(' ')}</small>}</p>)}</details>}
          {editing === member.id && <form className="combatant-adjust" onSubmit={event => { event.preventDefault(); try { if (!remaining.trim()) throw new Error('Enter current Strength.'); onChange(adjustCombatant(encounter, member.id, Number(remaining), dead)); setEditing(''); onError(''); } catch (caught) { onError(caught instanceof Error ? caught.message : 'Check current Strength.'); } }}><label>Current Strength<input type="number" min={0} max={member.maxStrength} step="1" value={remaining} onChange={event => setRemaining(event.target.value)}/></label><label className="checkbox-label"><input type="checkbox" checked={dead} onChange={event => setDead(event.target.checked)}/>Dead</label><button className="export-button" type="submit">Apply</button><button className="text-button" type="button" onClick={() => setEditing('')}>Cancel</button></form>}
        </div>;
      })}</div>
    </>}
    <div className="encounter-tools"><button className="text-button" onClick={() => { if (!adding && choice === 'extra') ensureExtra(); setAdding(!adding); }} aria-expanded={adding}><Plus size={15}/>Add combatant</button><button className="text-button" disabled={!encounter.previous} onClick={() => { onChange(undoEncounter(encounter)); setEditing(''); }}><RotateCcw size={14}/>Undo tracker change</button><button className="text-button" onClick={() => setResetting(!resetting)}>New shootout</button></div>
    {adding && <form className="add-combatant" onSubmit={event => { event.preventDefault(); add(); }}>
      <label>Character<select value={choice} onChange={event => { const value = event.target.value; setChoice(value); setStrengthRoll(null); if (value === 'extra') ensureExtra(); }}><option value="current">Current sheet · {current.name || 'Unnamed'}</option>{saved.map(entry => <option key={entry.id} value={entry.id}>{entry.character.name || 'Unnamed'}</option>)}<option value="extra">Quick NPC / extra</option></select></label>
      {choice === 'extra' && <>
        <label>Extra preset<select value={presetId} onChange={event => choosePreset(event.target.value)}><option value="">Custom · randomly rolled NPC</option>{extraPresets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Name<input maxLength={80} value={extraName} onChange={event => setExtraName(event.target.value)} placeholder="The stranger" required/></label>
      </>}
      <label>Strength percentile roll<input type="text" inputMode="numeric" maxLength={3} value={strengthRoll ?? chosen?.percentiles?.strength ?? ''} onChange={event => setStrengthRoll(event.target.value)} placeholder="1–100" required={!prepared?.strength?.trim()}/></label>
      <label>Strength rating<output className="automatic-target">{prepared?.strength || '—'}</output></label>
      {choice === 'extra' && extraDraft && <>
        <label>Preferred weapon<select value={extraDraft.loadout.weaponId} onChange={event => setExtraDraft({ ...extraDraft, loadout: { ...extraDraft.loadout, weaponId: event.target.value } })}>{weaponProfiles.map(weapon => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}</select></label>
        {extraDraft.loadout.weaponId.startsWith('custom-') && <label>Weapon speed class<select value={extraDraft.loadout.customSpeed} onChange={event => setExtraDraft({ ...extraDraft, loadout: { ...extraDraft.loadout, customSpeed: event.target.value } })}>{weapons.map(weapon => <option key={weapon.value} value={weapon.value}>{weapon.label} ({signed(weapon.value)})</option>)}</select></label>}
        <ExtraPreview sheet={{ ...prepared!, name: extraName }}/>
        {!preset && <button className="export-button" type="button" onClick={rerollExtra}><Dice5 size={15}/>Roll new stats</button>}
      </>}
      <button className="export-button" type="submit"><Plus size={15}/>Add to shootout</button>
      <p className="panel-hint">{choice === 'extra' ? preset ? 'Preset scores follow the book’s NPC role ranges, with Astra’s preferred weapons.' : 'Custom extras roll all six starting stats using the book’s NPC character creation charts.' : 'Strength is calculated from its percentile roll. Older sheets keep their recorded rating until a roll is entered.'} Changes in this fight stay separate from your saved sheets.</p>
    </form>}
    {resetting && <div className="reset-shootout"><p>Start again at turn 1 with an empty roster? Saved character sheets stay in your library.</p><button className="export-button" onClick={() => { onReset(); setResetting(false); setEditing(''); }}>Start new shootout</button><button className="text-button" onClick={() => setResetting(false)}>Cancel</button></div>}
    {error && <p className="validation-error" role="alert">{error}</p>}
    {storageError && <p className="validation-error" role="alert">{storageError}</p>}
    {encounter.log.length > 0 && <details className="encounter-log"><summary>Tracker log · {phaseNames[encounter.phase]}</summary>{encounter.log.slice(0, 12).map((message, index) => <p key={index}>{message}</p>)}</details>}
  </section>;
}
