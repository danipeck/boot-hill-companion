import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Crosshair, Dice5, History, Plus, RotateCcw, Settings2, Shield, Sparkles, Star, Target, Trash2, UserRound, X, Zap } from 'lucide-react';
import { abilityModifiers, calculate, conditions, initialSheet, parseSheet, probability, ranges, resolveHit, rollPercentile, shooterMovement, signed, targetMovement, weaponProfiles, weapons, type AbilityForm, type SheetForm, type StatKey } from './rules';

type InputMode = 'scores' | 'modifiers';
type Character = { name: string; mode: InputMode; abilities: AbilityForm; modifiers: SheetForm };
type Roll = { id: string; roll: number; chance: number; hit: boolean; weapon: string; character: string; range: string; firstShot: number; time: string };
const sample: Character = {
  name: 'The Colorado Kid', mode: 'scores',
  abilities: { speed: '90', gunAccuracy: '64', throwingAccuracy: '62', bravery: '55', gunfights: '0' },
  modifiers: { ...initialSheet, speed: '12', braverySpeed: '1', gunAccuracy: '5', throwingAccuracy: '5', braveryAccuracy: '3' },
};
const storageKey = 'boot-hill.character.v1';

function loadCharacter(): Character {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!value || typeof value.name !== 'string' || !['scores', 'modifiers'].includes(value.mode)) return sample;
    if (!Object.keys(sample.abilities).every(key => typeof value.abilities?.[key] === 'string')) return sample;
    if (!Object.keys(initialSheet).every(key => typeof value.modifiers?.[key] === 'string')) return sample;
    return { name: value.name.slice(0, 80), mode: value.mode, abilities: value.abilities, modifiers: value.modifiers };
  } catch { return sample; }
}

function BadgeStar({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="m32 6 7 16 17-2-11 14 7 16-20-5-20 5 7-16L8 20l17 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="32" cy="31" r="8" stroke="currentColor" strokeWidth="1.5" /><circle cx="32" cy="6" r="2" fill="currentColor" /><circle cx="8" cy="20" r="2" fill="currentColor" /><circle cx="56" cy="20" r="2" fill="currentColor" /><circle cx="12" cy="50" r="2" fill="currentColor" /><circle cx="52" cy="50" r="2" fill="currentColor" /></svg>;
}

function Desert() {
  return <svg viewBox="0 0 400 125" className="desert" aria-hidden="true" fill="none"><circle cx="235" cy="55" r="31" fill="#e1b87f" opacity=".42"/><path d="M0 105h400M7 97l26-9 17 4 29-20 21 1 18 18 25-4 14 9h70l20-12 17 4 16-15 25-1 31 28 21-7 29 12" stroke="currentColor" strokeWidth="1.2"/><path d="M74 94V56m0 18H63V61m11 20h11V65M315 100V61m0 15h-10V67m10 19h12V72" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M168 69h8m-4-4v8m90-47h6m-3-3v6M26 40h5m-2.5-2.5v5" stroke="currentColor"/><path d="M155 113h31m22 0h10m109 0h27" stroke="currentColor" strokeWidth="1"/></svg>;
}

function Revolver() {
  return <svg viewBox="0 0 180 100" className="revolver" aria-hidden="true" fill="none"><g transform="rotate(-10 90 50)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M23 27h101v16H92v10H55l-8 33H22l12-35-11-6Z" fill="currentColor" fillOpacity=".06"/><path d="M124 30h28v9h-28M144 26v4M29 27l-4-10h12l8 10M55 52c1 21 28 17 28 0M61 52v8m-8-33v25m27-25v25M31 54l-8 25m15-24-8 25M92 32h25m-25 6h25"/><rect x="55" y="24" width="25" height="24" rx="4"/><path d="M61 29v14m6-14v14m6-14v14" strokeWidth="1"/></g></svg>;
}

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="dialog" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="dialog-title">
    <div className="dialog-header"><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}
  </dialog>;
}

const scoreFields: { key: keyof AbilityForm; label: string; hint: string; icon: typeof Zap }[] = [
  { key: 'speed', label: 'Speed', hint: 'Final sheet score', icon: Zap },
  { key: 'gunAccuracy', label: 'Gun accuracy', hint: 'Final sheet score', icon: Crosshair },
  { key: 'throwingAccuracy', label: 'Throwing accuracy', hint: 'Final sheet score', icon: Target },
  { key: 'bravery', label: 'Bravery', hint: 'Final sheet score', icon: Shield },
  { key: 'gunfights', label: 'Experience', hint: 'Previous gunfights', icon: Star },
];
const modifierFields: { key: StatKey; label: string; hint: string; icon: typeof Zap }[] = [
  { key: 'speed', label: 'Speed', hint: 'Speed ability modifier', icon: Zap },
  { key: 'braverySpeed', label: 'Bravery · speed', hint: 'Bravery speed modifier', icon: Shield },
  { key: 'gunAccuracy', label: 'Gun accuracy', hint: 'Firearm accuracy modifier', icon: Crosshair },
  { key: 'throwingAccuracy', label: 'Throwing accuracy', hint: 'Thrown / launched modifier', icon: Target },
  { key: 'braveryAccuracy', label: 'Bravery · accuracy', hint: 'Bravery accuracy modifier', icon: Shield },
  { key: 'experience', label: 'Experience', hint: 'Experience accuracy modifier', icon: Star },
];

export default function App() {
  const [character, setCharacter] = useState<Character>(loadCharacter);
  const [weaponId, setWeaponId] = useState('double-action');
  const [customSpeed, setCustomSpeed] = useState('5');
  const [rangeIndex, setRangeIndex] = useState(0);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [movementIndex, setMovementIndex] = useState(0);
  const [targetIndex, setTargetIndex] = useState(0);
  const [wound, setWound] = useState('0');
  const [shot, setShot] = useState('0');
  const [surprise, setSurprise] = useState('0');
  const [gunArm, setGunArm] = useState('0');
  const [aiming, setAiming] = useState('0');
  const [speedExtra, setSpeedExtra] = useState('0');
  const [accuracyExtra, setAccuracyExtra] = useState('0');
  const [showModifiers, setShowModifiers] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [dialog, setDialog] = useState<'rules' | 'new' | null>(null);
  const [newName, setNewName] = useState('');
  const [saveStatus, setSaveStatus] = useState('Saved on this device');
  const [toast, setToast] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(character)); setSaveStatus('Saved on this device'); }
    catch { setSaveStatus('Browser storage unavailable'); }
  }, [character]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);

  const weapon = weaponProfiles.find(item => item.id === weaponId)!;
  const speed = weapon.ranges ? weapon.speed : Number(customSpeed);
  const selected = conditions.filter(item => selectedConditions.includes(item.id));
  const speedAdjustment = selected.reduce((sum, item) => sum + item.speed, 0) + shooterMovement[movementIndex].speed + Number(wound) + Number(surprise) + Number(aiming) + Number(speedExtra);
  const accuracyAdjustment = selected.reduce((sum, item) => sum + item.accuracy, 0) + shooterMovement[movementIndex].accuracy + targetMovement[targetIndex].accuracy + Number(wound) + Number(shot) + Number(gunArm) + Number(accuracyExtra) + weapon.bonus;
  let error = '';
  let sheet;
  let totals;
  try {
    sheet = character.mode === 'scores' ? abilityModifiers(character.abilities, speed) : parseSheet({ ...character.modifiers, weaponSpeed: String(speed) });
    totals = calculate(sheet);
    for (const value of [speedExtra, accuracyExtra]) {
      if (value.trim() === '' || !Number.isInteger(Number(value)) || Math.abs(Number(value)) > 100) throw new Error('Other modifiers must be whole numbers between −100 and +100.');
    }
  } catch (caught) { error = caught instanceof Error ? caught.message : 'Check your character values.'; }
  const valid = !error && !!sheet && !!totals;
  const baseHit = totals ? weapon.attack === 'gun' ? totals.gunHit : totals.throwingHit : 0;
  const hitThreshold = baseHit + ranges[rangeIndex].value + accuracyAdjustment;
  const hitChance = probability(hitThreshold);
  const firstShot = (totals?.firstShot ?? 0) + speedAdjustment;
  const latest = rolls[0];
  const hasModifiers = selected.length > 0 || [movementIndex, targetIndex, Number(wound), Number(shot), Number(surprise), Number(aiming), Number(gunArm), Number(speedExtra), Number(accuracyExtra)].some(value => value !== 0);

  function switchMode(mode: InputMode) {
    setCharacter(current => {
      if (mode === 'modifiers' && current.mode === 'scores') {
        try {
          const converted = abilityModifiers(current.abilities, speed);
          return { ...current, mode, modifiers: { name: current.name, ...Object.fromEntries(Object.entries(converted).map(([key, value]) => [key, String(value)])) } as SheetForm };
        } catch { return { ...current, mode }; }
      }
      return { ...current, mode };
    });
  }
  function resetConditions() {
    setSelectedConditions([]); setMovementIndex(0); setTargetIndex(0); setWound('0'); setShot('0'); setSurprise('0'); setAiming('0'); setGunArm('0'); setSpeedExtra('0'); setAccuracyExtra('0');
  }
  function roll() {
    if (!valid) return;
    const outcome = resolveHit(rollPercentile(), baseHit, ranges[rangeIndex].value, accuracyAdjustment);
    setRolls(current => [{ ...outcome, id: crypto.randomUUID(), weapon: weapon.name, character: character.name || 'Unnamed gunslinger', range: ranges[rangeIndex].label, firstShot, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current].slice(0, 50));
  }
  function exportCharacter() {
    const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${character.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'gunslinger'}.json`; link.click(); URL.revokeObjectURL(url);
    setToast('Character exported. Keep it for your next ride.');
  }
  const modifierLabel = weapons.find(item => item.value === speed)?.label || 'Custom';

  return <>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="#" aria-label="Boot Hill home"><BadgeStar/><span>BOOT HILL<small>THE GUNSLINGER’S COMPANION</small></span></a>
      <nav aria-label="Main navigation"><a className="nav-active" href="#tabletop"><Dice5 size={16}/>Tabletop</a><button onClick={() => { nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); nameRef.current?.focus({ preventScroll: true }); }}><UserRound size={16}/>Character</button><button onClick={() => setDialog('rules')}><BookOpen size={16}/>Rules reference</button></nav>
      <span className="edition">SECOND EDITION <span>1979</span></span>
    </div></header>

    <main className="page" id="tabletop">
      <section className="intro">
        <h1>A steady hand. A little luck.</h1>
        <Desert/>
      </section>
      <div className="workspace">
        <aside className="character-card card" id="character-sheet">
          <div className="section-heading"><div className="title-with-icon"><UserRound size={18}/><h2>The gunslinger</h2></div><button className="text-button" onClick={() => { setNewName(''); setDialog('new'); }}><Plus size={14}/> New</button></div>
          <div className="character-identity"><div className="character-emblem"><BadgeStar/></div><div><label htmlFor="character-name">NAME ON THE WANTED POSTER</label><input ref={nameRef} id="character-name" className="name-input" maxLength={80} value={character.name} placeholder="Your gunslinger’s name" onChange={event => setCharacter({ ...character, name: event.target.value })}/></div></div>
          <div className="input-tabs" aria-label="Character input mode"><button className={character.mode === 'scores' ? 'active' : ''} onClick={() => switchMode('scores')}>Sheet scores</button><button className={character.mode === 'modifiers' ? 'active' : ''} onClick={() => switchMode('modifiers')}>Modifiers</button></div>
          <p className="input-help">{character.mode === 'scores' ? 'Enter your final sheet scores. We’ll find the modifiers.' : 'Enter the signed modifiers from your character sheet.'}</p>
          <div className="stat-fields">
            {character.mode === 'scores' ? scoreFields.map(field => { const Icon = field.icon; return <div className="stat-row" key={field.key}><Icon size={17}/><label htmlFor={`score-${field.key}`}>{field.label}<small>{field.hint}</small></label><input id={`score-${field.key}`} type="number" min={field.key === 'gunfights' ? 0 : 1} max={field.key === 'gunfights' ? 999 : 100} step="1" value={character.abilities[field.key]} onChange={event => setCharacter({ ...character, abilities: { ...character.abilities, [field.key]: event.target.value } })}/></div>; }) : modifierFields.map(field => { const Icon = field.icon; return <div className="stat-row" key={field.key}><Icon size={17}/><label htmlFor={`mod-${field.key}`}>{field.label}<small>{field.hint}</small></label><input id={`mod-${field.key}`} type="number" min="-100" max="100" step="1" value={character.modifiers[field.key]} onChange={event => setCharacter({ ...character, modifiers: { ...character.modifiers, [field.key]: event.target.value } })}/></div>; })}
          </div>
          <div className="sheet-footnote"><CircleHelp size={15}/><span>{character.mode === 'scores' ? 'Use 100 for 00. Include any creation or survival improvements already on your sheet.' : 'Positive bonuses and negative penalties both work. Weapon speed is set in your loadout.'}</span></div>
          <div className="character-bottom"><span className={`save-status ${saveStatus.includes('unavailable') ? 'unsaved' : ''}`}><span/>{saveStatus}</span><button className="export-button" onClick={exportCharacter}><ArrowDownToLine size={15}/> Export</button></div>
          <div className="character-note"><Sparkles size={14}/><span>Start with the Colorado Kid example, or make this sheet your own.</span></div>
        </aside>

        <div className="combat-column">
          <section className="loadout-card card"><div className="section-heading"><div className="title-with-icon"><Crosshair size={18}/><h2>Ready your weapon</h2></div><span className="small-label">01 / THE SETUP</span></div>
            <div className="loadout-grid"><div className="weapon-illustration"><Revolver/></div><div className="weapon-field"><label htmlFor="weapon">WEAPON OF CHOICE</label><div className="select-wrap"><select id="weapon" value={weaponId} onChange={event => { setWeaponId(event.target.value); setRolls(current => current); }}>{weaponProfiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={16}/></div><div className="weapon-meta"><span>{weapon.attack === 'gun' ? 'Firearm' : 'Thrown / launched'}</span><i/> <span>{modifierLabel} speed <b>{signed(speed)}</b></span>{weapon.bonus !== 0 && <><i/><span>Accuracy <b>{signed(weapon.bonus)}</b></span></>}</div></div></div>
            {!weapon.ranges && <div className="custom-speed"><label htmlFor="weapon-speed">Weapon speed class</label><select id="weapon-speed" value={customSpeed} onChange={event => setCustomSpeed(event.target.value)}>{weapons.map(item => <option key={item.value} value={item.value}>{item.label} ({signed(item.value)})</option>)}</select></div>}
            <div className="range-section"><div className="range-label"><span>RANGE TO TARGET</span><span>{weapon.ranges ? 'Map spaces / tabletop inches' : 'Choose the range band for your weapon'}</span></div><div className="range-options">{ranges.map((item, index) => <button key={item.label} className={rangeIndex === index ? 'selected' : ''} onClick={() => setRangeIndex(index)} aria-pressed={rangeIndex === index}><span>{item.label}<b>{signed(item.value)}</b></span><small>{weapon.ranges ? index === 0 ? `0–${weapon.ranges[index]}` : `${weapon.ranges[index - 1]}+ to ${weapon.ranges[index]}` : 'Referee’s range band'}</small></button>)}</div></div>
            <div className="modifier-toggle-row"><button className="modifier-toggle" onClick={() => setShowModifiers(!showModifiers)} aria-expanded={showModifiers} aria-controls="combat-modifiers"><Settings2 size={16}/> Situational modifiers {hasModifiers && <span className="active-dot"/>}<ChevronDown size={16} className={showModifiers ? 'rotated' : ''}/></button><span className="modifier-summary">{hasModifiers ? `${signed(speedAdjustment)} speed · ${signed(accuracyAdjustment - weapon.bonus)} accuracy` : 'A fair fight, for now'}</span></div>
            {showModifiers && <div className="modifiers-panel" id="combat-modifiers"><div className="condition-chips">{conditions.map(item => <button key={item.id} className={selectedConditions.includes(item.id) ? 'checked' : ''} aria-pressed={selectedConditions.includes(item.id)} onClick={() => setSelectedConditions(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])}>{selectedConditions.includes(item.id) ? <Check size={13}/> : <Plus size={13}/>}{item.label}<span>{signed(item.accuracy)}</span></button>)}</div>
              {selectedConditions.includes('rest') && <p className="modifier-hint">Weapon at rest applies after the turn it is first aimed at this target.</p>}
              {selectedConditions.includes('obscured') && <p className="modifier-hint">Obscured: half or less of the target is visible. Protective cover can still stop a hit; the referee resolves that.</p>}
              <div className="modifier-fields">
                <label>Shooter movement<select value={movementIndex} onChange={event => setMovementIndex(Number(event.target.value))}>{shooterMovement.map((item, index) => <option key={item.label} value={index}>{item.label} ({signed(item.accuracy)} hit)</option>)}</select></label>
                <label>Target movement<select value={targetIndex} onChange={event => setTargetIndex(Number(event.target.value))}>{targetMovement.map((item, index) => <option key={item.label} value={index}>{item.label} ({signed(item.accuracy)} hit)</option>)}</select></label>
                <label>Total wounds<select value={wound} onChange={event => setWound(event.target.value)}><option value="0">Unwounded</option><option value="-5">Less than 50% of strength (−5)</option><option value="-20">50% or more of strength (−20)</option></select></label>
                <label>Shot this turn<select value={shot} onChange={event => setShot(event.target.value)}><option value="0">First shot</option><option value="-10">Second shot (−10 hit)</option><option value="-20">Third shot (−20 hit)</option></select></label>
                <label>Surprise<select value={surprise} onChange={event => setSurprise(event.target.value)}><option value="0">Neither side surprised</option><option value="-1">Giving opponent first move (−1)</option><option value="-5">Surprised (−5 speed)</option><option value="-10">Completely surprised (−10 speed)</option></select></label>
                <label>Aiming / firing continuity<select value={aiming} onChange={event => setAiming(event.target.value)}><option value="0">No continuity bonus</option><option value="5">Aiming at same target, 2nd+ turn (+5)</option><option value="10">Firing at same target, 2nd+ turn (+10)</option><option value="15">Both applicable (+15 speed)</option></select></label>
                <label>Gun-arm wound<select value={gunArm} onChange={event => setGunArm(event.target.value)}><option value="0">None</option><option value="-25">Light wound (−25 hit)</option><option value="-50">Serious wound (−50 hit)</option></select></label>
                <label>Other first-shot modifier<input type="number" min="-100" max="100" step="1" value={speedExtra} onChange={event => setSpeedExtra(event.target.value)}/></label>
                <label>Other hit modifier<input type="number" min="-100" max="100" step="1" value={accuracyExtra} onChange={event => setAccuracyExtra(event.target.value)}/></label>
              </div><button className="text-button reset-modifiers" onClick={resetConditions}><RotateCcw size={13}/>Reset situational modifiers</button></div>}
          </section>

          <section className="shot-card card"><div className="section-heading"><div className="title-with-icon"><Dice5 size={18}/><h2>Make your shot</h2></div><span className="small-label">02 / THE MOMENT OF TRUTH</span></div>
            {error && <p className="validation-error" role="alert">{error}</p>}
            <div className="combat-stats"><div className="first-shot-stat"><span><Zap size={14}/> FIRST SHOT</span><strong>{valid ? signed(firstShot) : '—'}</strong><small>Highest score shoots first</small></div><div className="hit-stat"><span><Crosshair size={14}/> CHANCE TO HIT</span><strong>{valid ? hitChance : '—'}<em>%</em></strong><small>{valid ? hitThreshold < 0 || hitThreshold > 100 ? `Rules threshold: ${hitThreshold} · roll 1–100` : `Roll ${hitThreshold} or lower on d100` : 'Check your character values'}</small></div><div className="chance-bar" aria-hidden="true"><span style={{ width: `${valid ? hitChance : 0}%` }}/></div></div>
            <button className="breakdown-toggle text-button" onClick={() => setShowBreakdown(!showBreakdown)} aria-expanded={showBreakdown}>Show the arithmetic <ChevronDown size={13} className={showBreakdown ? 'rotated' : ''}/></button>
            {showBreakdown && sheet && totals && <div className="breakdown"><p><b>First shot</b><span>{signed(sheet.speed)} speed {signed(sheet.braverySpeed)} bravery {signed(sheet.weaponSpeed)} weapon {signed(speedAdjustment)} situation = <strong>{signed(firstShot)}</strong></span></p><p><b>Hit threshold</b><span>50 base {signed(weapon.attack === 'gun' ? sheet.gunAccuracy : sheet.throwingAccuracy)} accuracy {signed(sheet.braveryAccuracy)} bravery {signed(sheet.experience)} experience {signed(ranges[rangeIndex].value)} range {signed(accuracyAdjustment)} weapon / situation = <strong>{hitThreshold}</strong></span></p></div>}
            <div className="roll-area"><div className={`dice-result ${latest ? latest.hit ? 'is-hit' : 'is-miss' : ''}`} key={latest?.id || 'empty'}><div className="percentile-dice" aria-hidden="true"><span>{latest ? String(Math.floor((latest.roll % 100) / 10) * 10).padStart(2, '0') : '00'}</span><span>{latest ? latest.roll % 10 : '0'}</span></div><div className="roll-outcome" aria-live="polite" aria-atomic="true">{latest ? <><strong>{latest.hit ? 'Right on target.' : 'Wide of the mark.'}</strong><p>Rolled <b>{String(latest.roll).padStart(2, '0')}</b> against <b>{latest.chance}</b> <span className={`result-tag ${latest.hit ? 'hit' : 'miss'}`}>{latest.hit ? 'HIT' : 'MISS'}</span></p></> : <><strong>Fortune favors the bold.</strong><p>Your next shot is one roll away.</p></>}</div></div><button className="roll-button" onClick={roll} disabled={!valid}><Dice5 size={20}/>{latest ? 'Roll again' : 'Roll to hit'}<ArrowRight size={18}/></button></div>
          </section>

          <section className="history-card card"><div className="section-heading"><div className="title-with-icon"><History size={17}/><h2>The trail so far</h2><span className="count-badge">{rolls.length}</span></div><button className="text-button" disabled={!rolls.length} onClick={() => setRolls([])}><Trash2 size={13}/>Clear</button></div>{rolls.length ? <div className="history-list">{rolls.slice(0, 5).map(item => <div className="history-row" key={item.id}><span className={`history-die ${item.hit ? 'hit' : 'miss'}`}>{String(item.roll).padStart(2, '0')}</span><div className="history-description"><strong>{item.weapon}</strong><small>{item.character} · {item.range} range · ≤ {item.chance} · first shot {signed(item.firstShot)}</small></div><span className={`result-tag ${item.hit ? 'hit' : 'miss'}`}>{item.hit ? 'HIT' : 'MISS'}</span><time>{item.time}</time></div>)}</div> : <div className="history-empty"><span className="trail-line"/><p>A clean slate. Let’s see what the dice have in store.</p><span className="trail-line"/></div>} {rolls.length > 5 && <p className="history-limit">Showing the last 5 of {rolls.length} rolls this session.</p>}</section>
        </div>
      </div>
      <footer><span><BadgeStar/> An unofficial companion for Boot Hill, 2nd Edition.</span><button onClick={() => setDialog('rules')}>Keep the rulebook close <BookOpen size={13}/></button></footer>
    </main>
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
    {dialog === 'rules' && <Dialog title="A little rules refresher" onClose={() => setDialog(null)}><div className="rules-content"><span className="eyebrow">BOOT HILL · SECOND EDITION</span><h3>Fast hands. Straight shooting.</h3><p><b>First shot</b> = speed ability modifier + bravery speed modifier + weapon speed modifier + situational speed modifiers. Higher scores shoot first; ties fire simultaneously. This score is not rolled.</p><p><b>Hit determination</b> = 50 + gun or throwing accuracy modifier + bravery accuracy modifier + experience modifier + range and situational modifiers. Roll d100: a result at or below that threshold hits.</p><p><b>Sheet scores</b> are the final percentile scores on your character sheet, including any creation or survival adjustments. Experience uses your previous number of gunfights. You can also enter your sheet’s modifiers directly. Each input mode keeps its own values; switching to Modifiers converts your current scores.</p><p><b>Range</b> uses the selected weapon’s chart in map spaces or tabletop inches. Each map space / tabletop inch represents six feet. Choose the applicable band; targets beyond the listed extreme range are out of range.</p><p><b>Situational modifiers</b> are cumulative. Check the weapon-at-rest restriction, referee decisions about protective cover, and which bonuses apply to your attack. Shotgun and scatter-gun accuracy bonuses are included automatically. Wound location, severity, and multiple pellet effects still use the rulebook.</p><p className="reference-note">Checked against the local 2e rulebook: ability tables p. 5, base numbers pp. 6–7, weapons p. 8, combat modifiers p. 9. No automatic misses, critical hits, or extra house rules are added.</p><button className="roll-button" onClick={() => setDialog(null)}>Back to the tabletop<ArrowRight size={16}/></button></div></Dialog>}
    {dialog === 'new' && <Dialog title="A new face in town" onClose={() => setDialog(null)}><form className="new-character-form" onSubmit={event => { event.preventDefault(); setCharacter({ name: newName.trim() || 'Unnamed gunslinger', mode: 'modifiers', abilities: { speed: '20', gunAccuracy: '30', throwingAccuracy: '30', bravery: '25', gunfights: '0' }, modifiers: { ...initialSheet } }); setWeaponId('double-action'); setRangeIndex(0); resetConditions(); setDialog(null); setToast('Your new sheet is ready. Enter your character’s stats.'); }}><p>Give your gunslinger a name, then fill in their character sheet. Export your current character if you want to keep a copy.</p><label htmlFor="new-name">Character name<input id="new-name" autoFocus maxLength={80} placeholder="A name the West will remember" value={newName} onChange={event => setNewName(event.target.value)}/></label><button className="roll-button" type="submit">Create character<ArrowRight size={16}/></button><button className="example-button" type="button" onClick={() => { setCharacter(sample); setWeaponId('double-action'); setRangeIndex(0); resetConditions(); setDialog(null); }}>Use the Colorado Kid example</button></form></Dialog>}
  </>;
}
