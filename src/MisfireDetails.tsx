import type { ReactNode } from 'react';
import { misfireLabels, shotDie, shotLabel, type MisfireResult, type ShotResult } from './misfires';
import { WoundDetails } from './WoundResult';

export function ShotOutcome({ result }: { result: ShotResult }) {
  const failed = result.misfire && result.misfire.outcome !== 'ready';
  return <><strong>{shotLabel(result)}</strong><p>{failed ? <>Misfire d100 <b>{shotDie(result)}</b> · attack failed</> : <>Rolled <b>{String(result.roll).padStart(2, '0')}</b> against <b>{result.chance}</b></>} <span className={`result-tag ${result.hit ? 'hit' : 'miss'}`}>{failed ? 'MISFIRE' : result.hit ? 'HIT' : 'MISS'}</span></p></>;
}
export default function MisfireDetails({ result, shooter, action, tracked = false }: { result: MisfireResult; shooter: string; action?: ReactNode; tracked?: boolean }) {
  if (result.outcome === 'ready') return null;
  return <div className={`misfire-details misfire-${result.outcome}`}>
    <p><b>{misfireLabels[result.outcome]}</b> · misfire d100 {result.roll}</p>
    {result.outcome === 'dud' && <p>The round is a miss. No further penalty.</p>}
    {result.outcome === 'jam' && <p>Weapon unusable until cleared. Clearing takes three full turns.{!tracked && ' Use the shootout tracker to track clearing.'}</p>}
    {result.outcome === 'explosion' && <><p>{shooter}: injury d100 {result.injuryRoll} against 50 · {result.injury ? 'injured' : 'uninjured'}. The attack fails.</p>{result.injury && <WoundDetails result={result.injury}/>}</>}
    {action}
  </div>;
}
