import { Crosshair, Shield, Star, Target, Zap } from 'lucide-react';
import { blankCharacter, setPercentileRoll, type Character } from './characters';
import { experienceModifier, percentileResult, signed, type PercentileResult, type PercentileStat } from './rules';

const fields: { key: PercentileStat; label: string; icon: typeof Zap }[] = [
  { key: 'speed', label: 'Speed', icon: Zap },
  { key: 'gunAccuracy', label: 'Gun accuracy', icon: Crosshair },
  { key: 'throwingAccuracy', label: 'Throwing accuracy', icon: Target },
  { key: 'strength', label: 'Strength', icon: Shield },
  { key: 'bravery', label: 'Bravery', icon: Shield },
  { key: 'experience', label: 'Experience', icon: Star },
];

function resultText(stat: PercentileStat, result: PercentileResult): string {
  if (stat === 'strength') return `${result.description} · Strength ${result.value}`;
  if (stat === 'experience') return `${result.description === 'None' ? 'No previous gunfights' : result.description} · Accuracy ${signed(result.accuracy!)}`;
  if (stat === 'bravery') return `${result.description} · Speed ${signed(result.value)} · Accuracy ${signed(result.accuracy!)}`;
  return `${result.description} · ${stat === 'speed' ? 'Speed' : 'Accuracy'} ${signed(result.value)}`;
}

export function characterStatReadout(character: Character, stat: PercentileStat): string {
  const raw = stat === 'strength' || stat === 'experience' ? character.percentiles?.[stat] : character.abilities[stat];
  if (raw !== undefined) {
    try { return resultText(stat, percentileResult(stat, raw)); } catch { return '—'; }
  }
  // Older saves did not retain the Strength or Experience dice. Preserve their
  // actual ratings, and let the user supply a roll rather than inventing one.
  if (stat === 'strength') return character.strength?.trim() ? `Strength ${character.strength} · recorded rating` : '—';
  try {
    if (!character.abilities.gunfights.trim()) return '—';
    const fights = Number(character.abilities.gunfights);
    return `${fights} previous gunfight${fights === 1 ? '' : 's'} · Accuracy ${signed(experienceModifier(fights))} · recorded rating`;
  } catch { return '—'; }
}

export default function CharacterStats({ character, onChange }: { character: Character; onChange: (next: Character) => void }) {
  if (character.mode === 'modifiers') {
    const stored = [
      ['Speed', character.modifiers.speed], ['Bravery · speed', character.modifiers.braverySpeed],
      ['Gun accuracy', character.modifiers.gunAccuracy], ['Throwing accuracy', character.modifiers.throwingAccuracy],
      ['Bravery · accuracy', character.modifiers.braveryAccuracy], ['Experience · accuracy', character.modifiers.experience],
    ];
    return <div className="legacy-stats"><p className="input-help">This older sheet uses saved modifiers. They remain active until you enter percentile rolls.</p><dl><div><dt>Strength rating</dt><dd>{character.strength || '—'}</dd></div>{stored.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value.trim() && Number.isInteger(Number(value)) ? signed(Number(value)) : '—'}</dd></div>)}</dl><button className="export-button" onClick={() => onChange({ ...blankCharacter(character.name), loadout: { ...character.loadout }, ...(character.morale !== undefined ? { morale: '' } : {}) })}>Enter percentile rolls</button></div>;
  }
  return <>
    <p className="input-help">Enter your percentile rolls. Ratings and modifiers are calculated below each roll.</p>
    <div className="stat-fields">
      {fields.map(({ key, label, icon: Icon }) => {
        const value = key === 'strength' || key === 'experience' ? character.percentiles?.[key] ?? '' : character.abilities[key];
        const inputId = `roll-${key}`;
        return <div className="stat-row percentile-row" key={key}>
          <Icon size={17}/><label htmlFor={inputId}>{label}<small>Percentile roll</small></label>
          <input id={inputId} type="text" inputMode="numeric" maxLength={3} placeholder="1–100" value={value} aria-describedby={`derived-${key}`} onChange={event => onChange(setPercentileRoll(character, key, event.target.value))}/>
          <output id={`derived-${key}`} htmlFor={inputId} className="derived-stat" aria-label={`Derived ${label}`} aria-live="polite">{characterStatReadout(character, key)}</output>
        </div>;
      })}
    </div>
    {(character.percentiles?.strength === undefined || character.percentiles?.experience === undefined) && <p className="input-help">Older sheets keep recorded Strength and Experience until you enter their rolls.</p>}
    <p className="sheet-footnote">00 means 100. Use final percentile scores after any creation or survival adjustments. Weapon bonuses apply in combat.</p>
  </>;
}
