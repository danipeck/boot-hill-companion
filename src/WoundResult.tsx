import { ArrowRight, Crosshair, Dice5 } from 'lucide-react';
import { hitEffectsSummary, type HitEffects } from './wounds';
import type { ReactNode } from 'react';

export function WoundDetails({ result }: { result: HitEffects }) {
  return <div className="wound-details">
    {result.spreadDie !== null && <p className="spread-result">Spread d10: <b>{result.spreadDie}</b> · {result.wounds.length} wound{result.wounds.length === 1 ? '' : 's'}</p>}
    {!result.wounds.length ? <p className="no-wounds">No wounds at this range.</p> : <div className="wound-list">
      {result.wounds.map((wound, index) => <div className={`wound-result severity-${wound.severity.toLowerCase()}`} key={index}>
        <div className="wound-result-heading"><strong>{result.wounds.length > 1 && <span className="wound-number">{index + 1}.</span>}{wound.location}</strong><span className="wound-severity">{wound.severity} wound</span></div>
        <div className="wound-impact"><b>{wound.strengthLoss === null ? 'Fatal' : `−${wound.strengthLoss} Strength`}</b>{wound.effects.map(effect => <span key={effect}>{effect}</span>)}</div>
        <div className="wound-dice"><span>Location d100 <b>{wound.locationRoll}</b></span><span>Severity d100 <b>{wound.severityRoll}</b></span></div>
      </div>)}
    </div>}
    {result.wounds.length > 1 && <p className={`wound-total ${result.mortal ? 'is-mortal' : ''}`}>{result.mortal ? 'Mortal wound: immediately fatal.' : `Total: −${result.totalStrengthLoss} Strength`}</p>}
  </div>;
}

export default function WoundResult({ weapon, range, result, onRoll, action }: { weapon: string; range: string; result?: HitEffects; onRoll: () => void; action?: ReactNode }) {
  return <section className="wound-card card" aria-labelledby="wound-title">
    <div className="section-heading"><div className="title-with-icon"><Crosshair size={18}/><h2 id="wound-title">Where it lands</h2></div><span className="small-label">03 / HIT RESULTS</span></div>
    <p className="wound-context">{weapon} · {range} range</p>
    {result ? <div aria-live="polite" aria-atomic="true" aria-label={hitEffectsSummary(result)}><WoundDetails result={result}/></div> : <div className="wound-prompt"><p>Roll the target’s wound location and severity after resolving cover.</p><button type="button" className="roll-button" onClick={onRoll}><Dice5 size={18}/>Roll wounds<ArrowRight size={16}/></button></div>}
    {action}
  </section>;
}
