import { useState } from 'react';
import { ArrowRight, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { holdNames } from './brawling';
import { type Character, type SavedCharacter } from './characters';
import { addCombatant, adjustCombatant, combatantsBySpeed, combatantSpeed, combatantStatus, phaseNames, remainingStrength, removeCombatant, undoEncounter, type Encounter } from './encounter';
import { signed } from './rules';

type Props = {
  encounter: Encounter; current: Character; saved: SavedCharacter[]; activeId: string | null;
  error: string; storageError: string; onChange: (next: Encounter) => void;
  onError: (message: string) => void; onAdvance: () => void; onReset: () => void;
  onActor: (id: string) => void; onTarget: (id: string) => void;
};

export default function EncounterPanel({ encounter, current, saved, activeId, error, storageError, onChange, onError, onAdvance, onReset, onActor, onTarget }: Props) {
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState('current');
  const [rating, setRating] = useState<string | null>(null);
  const [extraName, setExtraName] = useState('');
  const [editing, setEditing] = useState('');
  const [remaining, setRemaining] = useState('');
  const [dead, setDead] = useState(false);
  const [resetting, setResetting] = useState(false);
  const chosen = choice === 'current' || choice === 'extra' ? current : saved.find(item => item.id === choice)?.character;
  function add() {
    try {
      if (!chosen) throw new Error('Choose a character to add.');
      if (choice === 'extra' && !extraName.trim()) throw new Error('Give the extra combatant a name.');
      const sheet = choice === 'extra' ? { ...chosen, name: extraName.trim(), strength: rating ?? '' } : { ...chosen, strength: rating ?? chosen.strength };
      const id = choice === 'extra' ? crypto.randomUUID() : choice === 'current' ? encounter.actorId || activeId || crypto.randomUUID() : choice;
      onChange(addCombatant(encounter, sheet, id));
      setRating(null); setExtraName(''); setAdding(false); onError('');
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
          <div className="combatant-meta"><span>{member.wounds.length} wound{member.wounds.length === 1 ? '' : 's'}{member.modifier !== 0 ? ` · ${signed(member.modifier)} this round` : ''}{member.nextModifier !== 0 ? ` · ${signed(member.nextModifier)} next round` : ''}{encounter.acted.includes(member.id) ? ' · acted' : ''}</span><div><button className="text-button" onClick={() => { setEditing(member.id); setRemaining(String(remainingStrength(member))); setDead(member.dead); }}>Adjust</button><button className="icon-button" aria-label={`Remove ${member.sheet.name} from the shootout`} onClick={() => onChange(removeCombatant(encounter, member.id))}><Trash2 size={14}/></button></div></div>
          {member.hold && <p className="hold-label">{holdNames[member.hold.kind]} · held by {holder?.sheet.name}</p>}
          {member.wounds.length > 0 && <details className="tracked-wounds"><summary>Wound details</summary>{member.wounds.map((wound, index) => <p key={index}>{wound.severity} · {wound.location} · {wound.strengthLoss === null ? 'Fatal' : `−${wound.strengthLoss} Strength`}{wound.effects.length > 0 && <small>{wound.effects.join(' ')}</small>}</p>)}</details>}
          {editing === member.id && <form className="combatant-adjust" onSubmit={event => { event.preventDefault(); try { if (!remaining.trim()) throw new Error('Enter current Strength.'); onChange(adjustCombatant(encounter, member.id, Number(remaining), dead)); setEditing(''); onError(''); } catch (caught) { onError(caught instanceof Error ? caught.message : 'Check current Strength.'); } }}><label>Current Strength<input type="number" min={0} max={member.maxStrength} step="1" value={remaining} onChange={event => setRemaining(event.target.value)}/></label><label className="checkbox-label"><input type="checkbox" checked={dead} onChange={event => setDead(event.target.checked)}/>Dead</label><button className="export-button" type="submit">Apply</button><button className="text-button" type="button" onClick={() => setEditing('')}>Cancel</button></form>}
        </div>;
      })}</div>
    </>}
    <div className="encounter-tools"><button className="text-button" onClick={() => setAdding(!adding)} aria-expanded={adding}><Plus size={15}/>Add combatant</button><button className="text-button" disabled={!encounter.previous} onClick={() => { onChange(undoEncounter(encounter)); setEditing(''); }}><RotateCcw size={14}/>Undo tracker change</button><button className="text-button" onClick={() => setResetting(!resetting)}>New shootout</button></div>
    {adding && <form className="add-combatant" onSubmit={event => { event.preventDefault(); add(); }}><label>Character<select value={choice} onChange={event => { setChoice(event.target.value); setRating(null); }}><option value="current">Current sheet · {current.name || 'Unnamed'}</option>{saved.map(entry => <option key={entry.id} value={entry.id}>{entry.character.name || 'Unnamed'}</option>)}<option value="extra">Quick NPC / extra</option></select></label>{choice === 'extra' && <label>Name<input maxLength={80} value={extraName} onChange={event => setExtraName(event.target.value)} placeholder="The stranger"/></label>}<label>Strength rating<input type="number" min="1" max="99" step="1" value={rating ?? (choice !== 'extra' ? chosen?.strength || '' : '')} onChange={event => setRating(event.target.value)} placeholder="Usually 8–20" required/></label><button className="export-button" type="submit"><Plus size={15}/>Add to shootout</button><p className="panel-hint">Enter the Strength rating, not its percentile score. Changes in this fight stay separate from your saved sheets.{choice === 'extra' && ' Quick extras start with the current sheet’s other stats; select them as the acting character to edit.'}</p></form>}
    {resetting && <div className="reset-shootout"><p>Start again at turn 1 with an empty roster? Saved character sheets stay in your library.</p><button className="export-button" onClick={() => { onReset(); setResetting(false); setEditing(''); }}>Start new shootout</button><button className="text-button" onClick={() => setResetting(false)}>Cancel</button></div>}
    {error && <p className="validation-error" role="alert">{error}</p>}
    {storageError && <p className="validation-error" role="alert">{storageError}</p>}
    {encounter.log.length > 0 && <details className="encounter-log"><summary>Tracker log · {phaseNames[encounter.phase]}</summary>{encounter.log.slice(0, 12).map((message, index) => <p key={index}>{message}</p>)}</details>}
  </section>;
}
