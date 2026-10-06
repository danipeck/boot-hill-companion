import { useState } from 'react';
import { ArrowRight, Dice5, Hand, Link, Unlock } from 'lucide-react';
import { brawlProbability, defaultBrawlOptions, holdNames, type BrawlOptions, type BrawlResult, type HoldKind } from './brawling';
import { canAct, type ActionContext, type Encounter } from './encounter';
import { signed } from './rules';
import { WoundDetails } from './WoundResult';

export type BrawlRoll = { kind: 'brawl'; id: string; order: number; character: string; targetName: string; time: string; result: BrawlResult; context?: ActionContext; held: HoldKind | null };

export function BrawlDetails({ result }: { result: BrawlResult }) {
  const wound = result.wound;
  return <div className="brawl-result">
    {result.dice.length > 0 && <p className="brawl-dice">2d10: <b>{result.dice[0]}</b> + <b>{result.dice[1]}</b>{result.modifier !== 0 && <> {signed(result.modifier)}</>} = <b>{result.adjusted}</b></p>}
    <strong className="brawl-result-name">{result.label}</strong>
    <div className="brawl-effects">{result.opponentLoss > 0 && <span>Target: −{result.opponentLoss} Strength</span>}{result.selfLoss > 0 && <span>You: −{result.selfLoss} Strength</span>}{result.opponentModifier !== 0 && <span>Target’s next round: {signed(result.opponentModifier)}</span>}{result.selfModifier !== 0 && <span>Your next round: {signed(result.selfModifier)}</span>}{result.notes.map(note => <span key={note}>{note}</span>)}</div>
    {wound && <WoundDetails result={{ spreadRoll: null, spreadDie: null, wounds: [wound], totalStrengthLoss: wound.strengthLoss ?? 0, mortal: wound.severity === 'Mortal' }}/>}
  </div>;
}

type Props = {
  mode: 'punching' | 'grappling'; encounter: Encounter; latest?: BrawlRoll;
  onRoll: (mode: 'punching' | 'grappling', options: BrawlOptions) => void;
  onContinue: () => void; onRelease: () => void; onApply: (roll: BrawlRoll) => void;
};
export default function BrawlPanel({ mode, encounter, latest, onRoll, onContinue, onRelease, onApply }: Props) {
  const [options, setOptions] = useState(defaultBrawlOptions);
  const [extra, setExtra] = useState('0');
  const [manualHold, setManualHold] = useState<HoldKind | ''>('');
  const actor = encounter.members.find(member => member.id === encounter.actorId);
  const target = encounter.members.find(member => member.id === encounter.targetId);
  const holding = encounter.members.find(member => member.hold?.by === actor?.id);
  const held = actor?.hold?.kind ?? (actor ? null : manualHold || null);
  const effective = { ...options, held, modifier: (actor?.modifier || 0) + Number(extra) };
  let error = '';
  let chance = 0;
  try {
    if (!extra.trim()) throw new Error('Enter a whole-number modifier.');
    chance = brawlProbability(mode, effective);
    if (encounter.members.length) {
      if (encounter.phase === 'shooting') throw new Error('Advance to brawling after the shooting phase.');
      if (!actor || !target) throw new Error('Choose an acting character and target above.');
      if (!canAct(actor)) throw new Error('An unconscious or dead character cannot act.');
      if (target.dead) throw new Error('Choose a living target.');
      if (encounter.acted.includes(actor.id)) throw new Error('This character has acted. Choose another, or advance the round.');
      if (actor.hold && actor.hold.by !== target.id) throw new Error('Choose the character holding you as your target.');
    }
  } catch (caught) { error = caught instanceof Error ? caught.message : 'Check brawling options.'; }
  const alreadyApplied = latest && encounter.applied.includes(latest.id);
  const currentResult = latest?.context && latest.context.encounterId === encounter.id && latest.context.turn === encounter.turn && latest.context.phase === encounter.phase;
  return <section className="brawl-card card" aria-labelledby="brawl-title">
    <div className="section-heading"><div className="title-with-icon">{mode === 'punching' ? <Hand size={19}/> : <Link size={19}/>}<h2 id="brawl-title">{mode === 'punching' ? 'Throw a punch' : held ? 'Break the hold' : 'Get a grip'}</h2></div><span className="small-label">2d10</span></div>
    <p className="panel-hint">Within six feet. Highest speed acts first unless completely surprised; resolve the other character’s reply afterward.</p>
    <div className="brawl-fields">
      {mode === 'punching' && <>
        <label>Attack with<select value={options.weapon} onChange={event => setOptions({ ...options, weapon: event.target.value as BrawlOptions['weapon'] })}><option value="fists">Fists</option><option value="blunt">Club / gun butt (+1 damage, −1 roll)</option><option value="large">Large weapon / chair (+2 damage, −2 roll)</option><option value="cutting">Knife / cutting weapon (wounds, −1 roll)</option></select></label>
        <label>Dominant hand<select value={options.dominantHand} onChange={event => setOptions({ ...options, dominantHand: event.target.value as 'left' | 'right' })}><option value="right">Right-handed</option><option value="left">Left-handed</option></select></label>
        {options.weapon !== 'fists' && <label>Weapon hand<select value={options.hand} onChange={event => setOptions({ ...options, hand: event.target.value as 'left' | 'right' })}><option value="right">Right hand</option><option value="left">Left hand</option></select></label>}
        <div className="arm-options"><label className="checkbox-label"><input type="checkbox" checked={options.leftFree} onChange={event => setOptions({ ...options, leftFree: event.target.checked })}/>Left arm free</label><label className="checkbox-label"><input type="checkbox" checked={options.rightFree} onChange={event => setOptions({ ...options, rightFree: event.target.checked })}/>Right arm free</label></div>
      </>}
      {!actor && <label>Currently held<select value={manualHold} onChange={event => setManualHold(event.target.value as HoldKind | '')}><option value="">No hold</option>{Object.entries(holdNames).map(([value, name]) => <option value={value} key={value}>{name}</option>)}</select></label>}
      <label>Other roll modifier<input type="number" min="-20" max="20" step="1" value={extra} onChange={event => setExtra(event.target.value)}/></label>
    </div>
    {held && <p className="hold-label">Held: {holdNames[held]}. {held === 'bear-hug' ? 'Grapple to escape; punching is unavailable.' : 'Only grappling can break this hold.'}</p>}
    {actor?.modifier !== undefined && actor.modifier !== 0 && <p className="panel-hint">Tracked modifier included: {signed(actor.modifier)}. In the shooting phase this becomes {signed(actor.modifier * 10)}% to hit.</p>}
    <div className="brawl-chance"><span>{mode === 'punching' ? 'Chance to land a blow' : held ? 'Chance to escape' : 'Chance to damage or hold'}</span><strong>{chance}%</strong><div className="chance-bar" aria-hidden="true"><span style={{ width: `${chance}%` }}/></div></div>
    {error && <p className="validation-error" role="status">{error}</p>}
    <div className="brawl-actions"><button className="roll-button" disabled={!!error} onClick={() => onRoll(mode, effective)}><Dice5 size={19}/>{mode === 'punching' ? 'Roll punch' : held ? 'Roll escape' : 'Roll grapple'}<ArrowRight size={16}/></button>{holding && <><button className="export-button" disabled={!actor || !canAct(actor) || encounter.phase === 'shooting' || encounter.acted.includes(actor.id) || !!actor.hold} onClick={onContinue}>Continue hold on {holding.sheet.name}</button><button className="text-button" onClick={onRelease}><Unlock size={14}/>Release hold</button></>}</div>
    {holding && <p className="panel-hint">Continue the hold each round without rolling to apply its damage. Choosing a different action releases it.</p>}
    {latest && <div className="latest-brawl" aria-live="polite"><p className="wound-context">{latest.character}{latest.targetName && ` → ${latest.targetName}`}</p><BrawlDetails result={latest.result}/>{latest.context && <><button className="export-button apply-result" disabled={alreadyApplied || !currentResult} onClick={() => onApply(latest)}>{alreadyApplied ? 'Applied to shootout' : `Apply result · ${latest.targetName}`}</button>{!alreadyApplied && <p className="panel-hint">{currentResult ? 'Apply this result before advancing the round.' : 'This result belongs to an earlier round or shootout.'}</p>}</>}</div>}
  </section>;
}
