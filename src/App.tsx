import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Crosshair, Dice5, FolderOpen, History, Moon, Plus, RotateCcw, Save, Settings2, Shield, Sparkles, Star, Sun, Target, Trash2, Upload, UserRound, X, Zap } from 'lucide-react';
import { abilityModifiers, calculate, conditions, initialSheet, parseSheet, probability, ranges, resolveHit, rollPercentile, shooterMovement, signed, targetMovement, weaponProfiles, weapons, type AbilityForm, type SheetForm, type StatKey } from './rules';
import { exportCharacterJson, importCharacter, loadSaved, readCharacterFile, readLibrary, removeSaved, sample, saveDraft, writeLibrary, type Character, type CharacterLibrary } from './characters';
import WoundResult, { WoundDetails } from './WoundResult';
import { hitEffectsSummary, rollHitEffects, type HitContext, type HitEffects } from './wounds';
import EncounterPanel from './EncounterPanel';
import BrawlPanel, { BrawlDetails, type BrawlRoll } from './BrawlPanel';
import { continueHold, rollBrawl, type BrawlOptions, type CombatMode } from './brawling';
import { advancePhase, applyBrawl, applyShotWounds, canAct, newEncounter, phaseNames, readEncounter, releaseHold, trackedShootingModifiers, updateActingSheet, withDefaultTarget, writeEncounter, type ActionContext, type Encounter } from './encounter';

type InputMode = 'scores' | 'modifiers';
type Roll = HitContext & { kind: 'shot'; order: number; id: string; roll: number; chance: number; weapon: string; character: string; range: string; firstShot: number; time: string; woundResult?: HitEffects; context?: ActionContext; targetName: string };

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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const [library, setLibrary] = useState<CharacterLibrary>(() => {
    try { return readLibrary(localStorage); }
    catch { return readLibrary({ getItem: () => null }); }
  });
  const character = library.draft;
  const [encounter, setEncounter] = useState<Encounter>(() => {
    try { return readEncounter(localStorage, crypto.randomUUID()); }
    catch { return newEncounter(crypto.randomUUID()); }
  });
  const [combatMode, setCombatMode] = useState<CombatMode>('shooting');
  const [encounterError, setEncounterError] = useState('');
  const [encounterStorageError, setEncounterStorageError] = useState('');
  const [brawlRolls, setBrawlRolls] = useState<BrawlRoll[]>([]);
  const [gunHand, setGunHand] = useState<'left' | 'right'>('right');
  const actor = encounter.members.find(member => member.id === encounter.actorId);
  const encounterTarget = encounter.members.find(member => member.id === encounter.targetId);
  const { weaponId, customSpeed } = character.loadout;
  const [selectedCharacterId, setSelectedCharacterId] = useState(library.activeId || '');
  const [libraryError, setLibraryError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
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
  const importRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef(library);
  libraryRef.current = library;

  function setCharacter(next: Character | ((current: Character) => Character)) {
    const draft = typeof next === 'function' ? next(character) : next;
    setLibrary(current => ({ ...current, draft }));
    if (actor) setEncounter(current => updateActingSheet(current, draft));
  }
  function setWeaponId(next: string) {
    setCharacter(current => ({ ...current, loadout: { ...current.loadout, weaponId: next } }));
  }
  function setCustomSpeed(next: string) {
    setCharacter(current => ({ ...current, loadout: { ...current.loadout, customSpeed: next } }));
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#191c18' : '#f6f2e9');
  }, [theme]);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try { localStorage.setItem('boot-hill.theme.v1', next); } catch {}
  }

  useEffect(() => {
    try {
      writeLibrary(localStorage, library);
      const saved = library.characters.find(item => item.id === library.activeId);
      setSaveStatus(saved && JSON.stringify(saved.character) === JSON.stringify(character) ? 'Saved on this device' : 'Draft saved · save to library');
    }
    catch { setSaveStatus('Browser storage unavailable'); }
  }, [library, character]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    try { writeEncounter(localStorage, encounter); setEncounterStorageError(''); }
    catch { setEncounterStorageError('Browser storage unavailable. This shootout is kept for this session only.'); }
  }, [encounter]);
  useEffect(() => {
    // Resume the encounter's working sheet without overwriting a saved character.
    const member = encounter.members.find(item => item.id === encounter.actorId);
    if (member) {
      const libraryId = member.libraryId || member.id;
      setLibrary(current => ({ ...current, draft: member.sheet, activeId: current.characters.some(item => item.id === libraryId) ? libraryId : null }));
      setSelectedCharacterId(library.characters.some(item => item.id === libraryId) ? libraryId : '');
    }
    if (encounter.phase !== 'shooting') setCombatMode('punching');
  }, []);

  function updateEncounter(next: Encounter) {
    next = withDefaultTarget(next);
    setEncounter(next); setEncounterError('');
    if (next.phase !== encounter.phase) setCombatMode(next.phase === 'shooting' ? 'shooting' : combatMode === 'shooting' ? 'punching' : combatMode);
    if (next.actorId && (next.actorId !== encounter.actorId || next.members.find(item => item.id === next.actorId)?.sheet !== actor?.sheet)) {
      const member = next.members.find(item => item.id === next.actorId);
      if (member) {
        const libraryId = member.libraryId || member.id;
        setLibrary(current => ({ ...current, draft: member.sheet, activeId: current.characters.some(item => item.id === libraryId) ? libraryId : null }));
        setSelectedCharacterId(library.characters.some(item => item.id === libraryId) ? libraryId : '');
      }
    }
  }
  function selectActor(id: string) {
    const member = encounter.members.find(item => item.id === id);
    updateEncounter({ ...encounter, actorId: id, targetId: encounter.targetId === id ? '' : encounter.targetId });
    if (member) resetConditions();
  }
  function detachActor() { setEncounter(current => withDefaultTarget({ ...current, actorId: '' })); }
  function nextPhase() {
    const next = advancePhase(encounter); updateEncounter(next);
    setCombatMode(next.phase === 'shooting' ? 'shooting' : combatMode === 'shooting' ? 'punching' : combatMode);
    if (next.phase === 'shooting') setShot('0');
  }
  function currentActionContext(): ActionContext | undefined {
    return actor && encounterTarget ? { encounterId: encounter.id, actorId: actor.id, targetId: encounterTarget.id, turn: encounter.turn, phase: encounter.phase } : undefined;
  }
  function recordBrawl(mode: 'punching' | 'grappling', options: BrawlOptions) {
    try {
      const result = rollBrawl(mode, options);
      const item: BrawlRoll = { kind: 'brawl', id: crypto.randomUUID(), order: Date.now(), character: character.name || 'Unnamed gunslinger', targetName: encounterTarget?.sheet.name || '', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), result, context: currentActionContext(), held: options.held };
      setBrawlRolls(current => [item, ...current].slice(0, 50));
      setEncounterError('');
    } catch (caught) { setEncounterError(caught instanceof Error ? caught.message : 'Could not roll this action.'); }
  }
  function maintainHold() {
    const target = encounter.members.find(member => member.hold?.by === actor?.id);
    if (!actor || !target) return;
    const result = continueHold(target.hold!.kind);
    const item: BrawlRoll = { kind: 'brawl', id: crypto.randomUUID(), order: Date.now(), character: actor.sheet.name, targetName: target.sheet.name, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), result, context: { encounterId: encounter.id, actorId: actor.id, targetId: target.id, turn: encounter.turn, phase: encounter.phase }, held: actor.hold?.kind ?? null };
    setBrawlRolls(current => [item, ...current].slice(0, 50));
    setCombatMode('grappling');
  }
  function applyBrawlRoll(item: BrawlRoll) {
    if (!item.context) return;
    try { updateEncounter(applyBrawl(encounter, item.context, item.id, item.result, item.held)); }
    catch (caught) { setEncounterError(caught instanceof Error ? caught.message : 'Could not apply this result.'); }
  }
  function applyWounds(item: Roll) {
    if (!item.context || !item.woundResult) return;
    try { updateEncounter(applyShotWounds(encounter, item.context, item.id, item.woundResult)); }
    catch (caught) { setEncounterError(caught instanceof Error ? caught.message : 'Could not apply these wounds.'); }
  }
  function woundAction(item: Roll) {
    if (!item.context || !item.woundResult) return null;
    const applied = encounter.applied.includes(item.id);
    const available = item.context.encounterId === encounter.id && encounter.members.some(member => member.id === item.context!.targetId);
    return <button className="export-button apply-result" disabled={applied || !available} onClick={() => applyWounds(item)}>{applied ? 'Applied to shootout' : `Apply wounds · ${item.targetName}`}</button>;
  }

  const weapon = weaponProfiles.find(item => item.id === weaponId)!;
  const speed = weapon.ranges ? weapon.speed : Number(customSpeed);
  const selected = conditions.filter(item => selectedConditions.includes(item.id));
  const tracked = actor ? trackedShootingModifiers(actor, gunHand) : null;
  const woundPenalty = tracked?.wound ?? Number(wound);
  const armPenalty = tracked?.arm ?? Number(gunArm);
  const brawlHitModifier = tracked?.brawling ?? 0;
  const speedAdjustment = selected.reduce((sum, item) => sum + item.speed, 0) + shooterMovement[movementIndex].speed + woundPenalty + Number(surprise) + Number(aiming) + Number(speedExtra);
  const accuracyAdjustment = selected.reduce((sum, item) => sum + item.accuracy, 0) + shooterMovement[movementIndex].accuracy + targetMovement[targetIndex].accuracy + woundPenalty + Number(shot) + armPenalty + Number(accuracyExtra) + weapon.bonus + brawlHitModifier;
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
  const latestBrawl = brawlRolls.find(item => item.result.mode === combatMode);
  const history = [...rolls, ...brawlRolls].sort((first, second) => second.order - first.order);
  const shootingBlocked = encounter.members.length > 0 ? encounter.phase !== 'shooting' ? 'Advance to the shooting phase to fire.' : !actor ? 'Choose an acting character above, or remove the roster to roll freely.' : !canAct(actor) ? 'An unconscious or dead character cannot act.' : actor.hold?.kind === 'bear-hug' ? 'A bear hug prevents shooting; grapple to escape.' : actor.hold?.kind === `${gunHand}-arm` ? 'Your gun arm is held. Switch hands or escape the hold.' : '' : '';
  const hasModifiers = selected.length > 0 || [movementIndex, targetIndex, woundPenalty, Number(shot), Number(surprise), Number(aiming), armPenalty, brawlHitModifier, Number(speedExtra), Number(accuracyExtra)].some(value => value !== 0);

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
    if (!valid || shootingBlocked) return;
    const outcome = resolveHit(rollPercentile(), baseHit, ranges[rangeIndex].value, accuracyAdjustment);
    const item: Roll = { ...outcome, kind: 'shot', order: Date.now(), id: crypto.randomUUID(), weapon: weapon.name, weaponId: weapon.id, rangeIndex, character: character.name || 'Unnamed gunslinger', range: ranges[rangeIndex].label, firstShot, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), context: currentActionContext(), targetName: encounterTarget?.sheet.name || '' };
    setRolls(current => [item, ...current].slice(0, 50));
  }
  function resolveWounds(id: string) {
    const hit = rolls.find(item => item.id === id);
    if (!hit || !hit.hit || hit.woundResult) return;
    // Use the weapon and range recorded for this shot, even if the loadout
    // has changed. Generate dice outside React's replayable state updater.
    const woundResult = rollHitEffects(hit);
    setRolls(current => current.map(item => item.id === id && !item.woundResult ? { ...item, woundResult } : item));
  }
  function exportCharacter() {
    try {
      const blob = new Blob([exportCharacterJson(character)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `${character.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'gunslinger'}.json`; link.click(); URL.revokeObjectURL(url);
      setLibraryError('');
      setToast('Character exported. Keep it for your next ride.');
    } catch (caught) { setLibraryError(caught instanceof Error ? caught.message : 'Could not export this character.'); }
  }
  function commitLibrary(next: CharacterLibrary, message: string) {
    setLibrary(next);
    setLibraryError('');
    try { writeLibrary(localStorage, next); setToast(message); }
    catch {
      setLibraryError('Browser storage is unavailable. Changes are kept for this session only; export a copy to keep them.');
      setSaveStatus('Browser storage unavailable');
    }
  }
  function saveSheet() {
    try {
      const next = saveDraft(library, crypto.randomUUID());
      if (actor) setEncounter(current => ({ ...current, members: current.members.map(member => member.id === actor.id ? { ...member, libraryId: next.activeId!, sheet: next.draft } : member) }));
      commitLibrary(next, `${next.draft.name} saved to your library.`);
      setSelectedCharacterId(next.activeId!);
    } catch (caught) { setLibraryError(caught instanceof Error ? caught.message : 'Check the character sheet before saving.'); }
  }
  function loadSheet() {
    try {
      const next = loadSaved(library, selectedCharacterId);
      detachActor();
      commitLibrary(next, `${next.draft.name || 'Unnamed gunslinger'} loaded.`);
      resetConditions(); setRangeIndex(0);
    } catch (caught) { setLibraryError(caught instanceof Error ? caught.message : 'Could not load this character.'); }
  }
  function deleteSheet() {
    const next = removeSaved(library, selectedCharacterId);
    commitLibrary(next, 'Removed from the library. Your open sheet is still here.');
    setSelectedCharacterId(next.activeId || '');
  }
  function startCharacter(next: Character) {
    detachActor();
    setLibrary(current => ({ ...current, draft: next, activeId: null }));
    setSelectedCharacterId(''); setLibraryError('');
    setRangeIndex(0); resetConditions(); setDialog(null);
  }
  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setIsImporting(true); setLibraryError('');
    try {
      const text = await readCharacterFile(file);
      const next = importCharacter(libraryRef.current, text, crypto.randomUUID());
      detachActor();
      commitLibrary(next, `${next.draft.name} imported and added to your library.`);
      setSelectedCharacterId(next.activeId!);
      resetConditions(); setRangeIndex(0);
    } catch (caught) { setLibraryError(caught instanceof Error ? caught.message : 'Could not import that character file.'); }
    finally { setIsImporting(false); }
  }
  const modifierLabel = weapons.find(item => item.value === speed)?.label || 'Custom';

  return <>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="#" aria-label="Boot Hill home"><BadgeStar/><span>BOOT HILL<small>THE GUNSLINGER’S COMPANION</small></span></a>
      <div className="header-actions">
        <span className="edition">SECOND EDITION <span>1979</span></span>
        <button className="header-button" type="button" onClick={() => setDialog('rules')}><BookOpen size={16}/>Rules reference</button>
        <button className="header-button theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
          {theme === 'light' ? <Moon size={16}/> : <Sun size={16}/>}
          <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </button>
      </div>
    </div></header>

    <main className="page" id="tabletop">
      <section className="intro">
        <h1>Silver runs thin. Blood runs easy.</h1>
        <Desert/>
      </section>
      <div className="workspace">
        <aside className="character-card card" id="character-sheet">
          <div className="section-heading"><div className="title-with-icon"><UserRound size={18}/><h2>The gunslinger</h2></div><button className="text-button" onClick={() => { setNewName(''); setDialog('new'); }}><Plus size={14}/> New</button></div>
          <div className="character-library">
            <label htmlFor="saved-character">SAVED CHARACTERS <span>{library.characters.length}</span></label>
            <div className="library-controls">
              <select id="saved-character" value={selectedCharacterId} onChange={event => setSelectedCharacterId(event.target.value)}>
                <option value="">Choose a character</option>
                {library.characters.map((entry, index) => <option key={entry.id} value={entry.id}>{entry.character.name || 'Unnamed gunslinger'}{library.characters.some((other, otherIndex) => otherIndex !== index && other.character.name === entry.character.name) ? ` (${index + 1})` : ''}</option>)}
              </select>
              <button type="button" className="export-button" onClick={loadSheet} disabled={!selectedCharacterId}><FolderOpen size={14}/> Load</button>
              <button type="button" className="icon-button library-delete" onClick={deleteSheet} disabled={!selectedCharacterId} aria-label="Delete selected saved character" title="Remove selected character from library"><Trash2 size={14}/></button>
            </div>
          </div>
          <div className="character-identity"><div className="character-emblem"><BadgeStar/></div><div><label htmlFor="character-name">NAME ON THE WANTED POSTER</label><input id="character-name" className="name-input" maxLength={80} value={character.name} placeholder="Your gunslinger’s name" onChange={event => setCharacter({ ...character, name: event.target.value })}/></div></div>
          <div className="sheet-loadout">
            <label htmlFor="preferred-weapon">Preferred weapon</label>
            <select id="preferred-weapon" value={weaponId} onChange={event => setWeaponId(event.target.value)}>{weaponProfiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            {!weapon.ranges && <><label htmlFor="preferred-weapon-speed">Weapon speed class</label><select id="preferred-weapon-speed" value={customSpeed} onChange={event => setCustomSpeed(event.target.value)}>{weapons.map(item => <option key={item.value} value={item.value}>{item.label} ({signed(item.value)})</option>)}</select></>}
            <p>Changes in combat are remembered for this shootout. Save sheet to keep the choice in your library.</p>
          </div>
          <div className="input-tabs" aria-label="Character input mode"><button className={character.mode === 'scores' ? 'active' : ''} onClick={() => switchMode('scores')}>Sheet scores</button><button className={character.mode === 'modifiers' ? 'active' : ''} onClick={() => switchMode('modifiers')}>Modifiers</button></div>
          <p className="input-help">{character.mode === 'scores' ? 'Enter your final sheet scores. We’ll find the modifiers.' : 'Enter the signed modifiers from your character sheet.'}</p>
          <div className="stat-fields">
            <div className="stat-row"><Shield size={17}/><label htmlFor="strength-rating">Strength<small>Rating, usually 8–20</small></label><input id="strength-rating" type="number" min="1" max="99" step="1" placeholder="—" value={character.strength || ''} onChange={event => setCharacter({ ...character, strength: event.target.value })}/></div>
            {character.mode === 'scores' ? scoreFields.map(field => { const Icon = field.icon; return <div className="stat-row" key={field.key}><Icon size={17}/><label htmlFor={`score-${field.key}`}>{field.label}<small>{field.hint}</small></label><input id={`score-${field.key}`} type="number" min={field.key === 'gunfights' ? 0 : 1} max={field.key === 'gunfights' ? 999 : 100} step="1" value={character.abilities[field.key]} onChange={event => setCharacter({ ...character, abilities: { ...character.abilities, [field.key]: event.target.value } })}/></div>; }) : modifierFields.map(field => { const Icon = field.icon; return <div className="stat-row" key={field.key}><Icon size={17}/><label htmlFor={`mod-${field.key}`}>{field.label}<small>{field.hint}</small></label><input id={`mod-${field.key}`} type="number" min="-100" max="100" step="1" value={character.modifiers[field.key]} onChange={event => setCharacter({ ...character, modifiers: { ...character.modifiers, [field.key]: event.target.value } })}/></div>; })}
          </div>
          <div className="sheet-footnote"><CircleHelp size={15}/><span>{character.mode === 'scores' ? 'Use 100 for 00. Include any creation or survival improvements already on your sheet.' : 'Positive bonuses and negative penalties both work. Weapon speed is set in your loadout.'}</span></div>
          <div className="character-bottom">
            <div className="character-actions">
              <button type="button" className="export-button save-sheet-button" onClick={saveSheet}><Save size={14}/> Save sheet</button>
              <button type="button" className="export-button" onClick={() => importRef.current?.click()} disabled={isImporting}><Upload size={14}/> {isImporting ? 'Importing…' : 'Import'}</button>
              <button type="button" className="export-button" onClick={exportCharacter}><ArrowDownToLine size={14}/> Export</button>
              <input ref={importRef} type="file" accept=".json,application/json" hidden aria-label="Import character JSON" onChange={handleImport}/>
            </div>
            <span className={`save-status ${saveStatus.includes('unavailable') ? 'unsaved' : ''}`} role="status"><span/>{saveStatus}</span>
            {libraryError && <p className="validation-error library-error" role="alert">{libraryError}</p>}
          </div>
          <div className="character-note"><Sparkles size={14}/><span>Start with the Colorado Kid example, or make this sheet your own.</span></div>
        </aside>

        <div className="combat-column">
          <EncounterPanel encounter={encounter} current={character} saved={library.characters} activeId={library.activeId} error={encounterError} storageError={encounterStorageError} onChange={updateEncounter} onError={setEncounterError} onAdvance={nextPhase} onReset={() => { updateEncounter(newEncounter(crypto.randomUUID())); setCombatMode('shooting'); }} onActor={selectActor} onTarget={id => updateEncounter({ ...encounter, targetId: id })}/>
          <div className="combat-mode-tabs" role="group" aria-label="Combat action">{(['shooting', 'punching', 'grappling'] as const).map(mode => <button key={mode} aria-pressed={combatMode === mode} className={combatMode === mode ? 'active' : ''} onClick={() => setCombatMode(mode)}>{mode === 'shooting' ? 'Shooting' : mode === 'punching' ? 'Punching' : 'Grappling'}</button>)}</div>
          <div className="shooting-panels" hidden={combatMode !== 'shooting'}>
          <section className="loadout-card card"><div className="section-heading"><div className="title-with-icon"><Crosshair size={18}/><h2>Ready your weapon</h2></div><span className="small-label">01 / THE SETUP</span></div>
            {actor && <div className="shootout-shooting"><p className="panel-hint">{actor.sheet.name}{encounterTarget ? ` → ${encounterTarget.sheet.name}` : ' · untracked target'} · wounds {signed(woundPenalty)} · gun arm {signed(armPenalty)} · brawling {signed(brawlHitModifier)} to hit</p><label>Gun hand<select value={gunHand} onChange={event => setGunHand(event.target.value as 'left' | 'right')}><option value="right">Right</option><option value="left">Left</option></select></label></div>}
            <div className="loadout-grid"><div className="weapon-illustration"><Revolver/></div><div className="weapon-field"><label htmlFor="weapon">WEAPON OF CHOICE</label><div className="select-wrap"><select id="weapon" value={weaponId} onChange={event => setWeaponId(event.target.value)}>{weaponProfiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={16}/></div><div className="weapon-meta"><span>{weapon.attack === 'gun' ? 'Firearm' : 'Thrown / launched'}</span><i/> <span>{modifierLabel} speed <b>{signed(speed)}</b></span>{weapon.bonus !== 0 && <><i/><span>Accuracy <b>{signed(weapon.bonus)}</b></span></>}</div></div></div>
            {!weapon.ranges && <div className="custom-speed"><label htmlFor="weapon-speed">Weapon speed class</label><select id="weapon-speed" value={customSpeed} onChange={event => setCustomSpeed(event.target.value)}>{weapons.map(item => <option key={item.value} value={item.value}>{item.label} ({signed(item.value)})</option>)}</select></div>}
            <div className="range-section"><div className="range-label"><span>RANGE TO TARGET</span><span>{weapon.ranges ? 'Map spaces / tabletop inches' : 'Choose the range band for your weapon'}</span></div><div className="range-options">{ranges.map((item, index) => <button key={item.label} className={rangeIndex === index ? 'selected' : ''} onClick={() => setRangeIndex(index)} aria-pressed={rangeIndex === index}><span>{item.label}<b>{signed(item.value)}</b></span><small>{weapon.ranges ? index === 0 ? `0–${weapon.ranges[index]}` : `${weapon.ranges[index - 1]}+ to ${weapon.ranges[index]}` : 'Referee’s range band'}</small></button>)}</div></div>
            <div className="modifier-toggle-row"><button className="modifier-toggle" onClick={() => setShowModifiers(!showModifiers)} aria-expanded={showModifiers} aria-controls="combat-modifiers"><Settings2 size={16}/> Situational modifiers {hasModifiers && <span className="active-dot"/>}<ChevronDown size={16} className={showModifiers ? 'rotated' : ''}/></button><span className="modifier-summary">{hasModifiers ? `${signed(speedAdjustment)} speed · ${signed(accuracyAdjustment - weapon.bonus)} accuracy` : 'A fair fight, for now'}</span></div>
            {showModifiers && <div className="modifiers-panel" id="combat-modifiers"><div className="condition-chips">{conditions.map(item => <button key={item.id} className={selectedConditions.includes(item.id) ? 'checked' : ''} aria-pressed={selectedConditions.includes(item.id)} onClick={() => setSelectedConditions(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])}>{selectedConditions.includes(item.id) ? <Check size={13}/> : <Plus size={13}/>}{item.label}<span>{signed(item.accuracy)}</span></button>)}</div>
              {selectedConditions.includes('rest') && <p className="modifier-hint">Weapon at rest applies after the turn it is first aimed at this target.</p>}
              {selectedConditions.includes('obscured') && <p className="modifier-hint">Obscured: half or less of the target is visible. Protective cover can still stop a hit; the referee resolves that.</p>}
              <div className="modifier-fields">
                <label>Shooter movement<select value={movementIndex} onChange={event => setMovementIndex(Number(event.target.value))}>{shooterMovement.map((item, index) => <option key={item.label} value={index}>{item.label} ({signed(item.accuracy)} hit)</option>)}</select></label>
                <label>Target movement<select value={targetIndex} onChange={event => setTargetIndex(Number(event.target.value))}>{targetMovement.map((item, index) => <option key={item.label} value={index}>{item.label} ({signed(item.accuracy)} hit)</option>)}</select></label>
                <label>Total wounds{actor && ' · tracked'}<select value={actor ? String(woundPenalty) : wound} disabled={!!actor} onChange={event => setWound(event.target.value)}><option value="0">Unwounded</option><option value="-5">Less than 50% of strength (−5)</option><option value="-20">50% or more of strength (−20)</option></select></label>
                <label>Shot this turn<select value={shot} onChange={event => setShot(event.target.value)}><option value="0">First shot</option><option value="-10">Second shot (−10 hit)</option><option value="-20">Third shot (−20 hit)</option></select></label>
                <label>Surprise<select value={surprise} onChange={event => setSurprise(event.target.value)}><option value="0">Neither side surprised</option><option value="-1">Giving opponent first move (−1)</option><option value="-5">Surprised (−5 speed)</option><option value="-10">Completely surprised (−10 speed)</option></select></label>
                <label>Aiming / firing continuity<select value={aiming} onChange={event => setAiming(event.target.value)}><option value="0">No continuity bonus</option><option value="5">Aiming at same target, 2nd+ turn (+5)</option><option value="10">Firing at same target, 2nd+ turn (+10)</option><option value="15">Both applicable (+15 speed)</option></select></label>
                <label>Gun-arm wound{actor && ' · tracked'}<select value={actor ? String(armPenalty) : gunArm} disabled={!!actor} onChange={event => setGunArm(event.target.value)}><option value="0">None</option><option value="-25">Light wound (−25 hit)</option><option value="-50">Serious wound (−50 hit)</option></select></label>
                <label>Other first-shot modifier<input type="number" min="-100" max="100" step="1" value={speedExtra} onChange={event => setSpeedExtra(event.target.value)}/></label>
                <label>Other hit modifier<input type="number" min="-100" max="100" step="1" value={accuracyExtra} onChange={event => setAccuracyExtra(event.target.value)}/></label>
              </div><button className="text-button reset-modifiers" onClick={resetConditions}><RotateCcw size={13}/>Reset situational modifiers</button></div>}
          </section>

          <section className="shot-card card"><div className="section-heading"><div className="title-with-icon"><Dice5 size={18}/><h2>Make your shot</h2></div><span className="small-label">02 / THE MOMENT OF TRUTH</span></div>
            {error && <p className="validation-error" role="alert">{error}</p>}
            {shootingBlocked && <p className="validation-error" role="status">{shootingBlocked}</p>}
            <div className="combat-stats"><div className="first-shot-stat"><span><Zap size={14}/> FIRST SHOT</span><strong>{valid ? signed(firstShot) : '—'}</strong><small>Highest score shoots first</small></div><div className="hit-stat"><span><Crosshair size={14}/> CHANCE TO HIT</span><strong>{valid ? hitChance : '—'}<em>%</em></strong><small>{valid ? hitThreshold < 0 || hitThreshold > 100 ? `Rules threshold: ${hitThreshold} · roll 1–100` : `Roll ${hitThreshold} or lower on d100` : 'Check your character values'}</small></div><div className="chance-bar" aria-hidden="true"><span style={{ width: `${valid ? hitChance : 0}%` }}/></div></div>
            <button className="breakdown-toggle text-button" onClick={() => setShowBreakdown(!showBreakdown)} aria-expanded={showBreakdown}>Show the arithmetic <ChevronDown size={13} className={showBreakdown ? 'rotated' : ''}/></button>
            {showBreakdown && sheet && totals && <div className="breakdown"><p><b>First shot</b><span>{signed(sheet.speed)} speed {signed(sheet.braverySpeed)} bravery {signed(sheet.weaponSpeed)} weapon {signed(speedAdjustment)} situation = <strong>{signed(firstShot)}</strong></span></p><p><b>Hit threshold</b><span>50 base {signed(weapon.attack === 'gun' ? sheet.gunAccuracy : sheet.throwingAccuracy)} accuracy {signed(sheet.braveryAccuracy)} bravery {signed(sheet.experience)} experience {signed(ranges[rangeIndex].value)} range {signed(accuracyAdjustment)} weapon / situation = <strong>{hitThreshold}</strong></span></p></div>}
            <div className="roll-area"><div className={`dice-result ${latest ? latest.hit ? 'is-hit' : 'is-miss' : ''}`} key={latest?.id || 'empty'}><div className="percentile-dice" aria-hidden="true"><span>{latest ? String(Math.floor((latest.roll % 100) / 10) * 10).padStart(2, '0') : '00'}</span><span>{latest ? latest.roll % 10 : '0'}</span></div><div className="roll-outcome" aria-live="polite" aria-atomic="true">{latest ? <><strong>{latest.hit ? 'Right on target.' : 'Wide of the mark.'}</strong><p>Rolled <b>{String(latest.roll).padStart(2, '0')}</b> against <b>{latest.chance}</b> <span className={`result-tag ${latest.hit ? 'hit' : 'miss'}`}>{latest.hit ? 'HIT' : 'MISS'}</span></p></> : <><strong>Fortune favors the bold.</strong><p>Your next shot is one roll away.</p></>}</div></div><button className="roll-button" onClick={roll} disabled={!valid || !!shootingBlocked}><Dice5 size={20}/>{latest ? 'Roll again' : 'Roll to hit'}<ArrowRight size={18}/></button></div>
          </section>

          {latest?.hit && <WoundResult weapon={latest.weapon} range={latest.range} result={latest.woundResult} onRoll={() => resolveWounds(latest.id)} action={woundAction(latest)}/>}
          </div>
          <div hidden={combatMode === 'shooting'}><BrawlPanel mode={combatMode === 'grappling' ? 'grappling' : 'punching'} encounter={encounter} latest={latestBrawl} onRoll={recordBrawl} onContinue={maintainHold} onRelease={() => updateEncounter(releaseHold(encounter, encounter.actorId))} onApply={applyBrawlRoll}/></div>

          <section className="history-card card">
            <div className="section-heading"><div className="title-with-icon"><History size={17}/><h2>The trail so far</h2><span className="count-badge">{history.length}</span></div><button className="text-button" disabled={!history.length} onClick={() => { setRolls([]); setBrawlRolls([]); }}><Trash2 size={13}/>Clear</button></div>
            {history.length ? <div className="history-list">{history.slice(0, 5).map(item => <div className="history-entry" key={item.id}>
              {item.kind === 'shot' ? <>
                <div className="history-row"><span className={`history-die ${item.hit ? 'hit' : 'miss'}`}>{String(item.roll).padStart(2, '0')}</span><div className="history-description"><strong>Shooting · {item.weapon}</strong><small>{item.character}{item.targetName && ` → ${item.targetName}`} · {item.range} range · ≤ {item.chance} · first shot {signed(item.firstShot)}{item.context && ` · turn ${item.context.turn}`}</small></div><span className={`result-tag ${item.hit ? 'hit' : 'miss'}`}>{item.hit ? 'HIT' : 'MISS'}</span><time>{item.time}</time></div>
                {item.hit && <div className="history-wounds">{item.woundResult ? <><details><summary>{hitEffectsSummary(item.woundResult)}<ChevronDown size={13}/></summary><WoundDetails result={item.woundResult}/></details>{woundAction(item)}</> : <button className="text-button" onClick={() => resolveWounds(item.id)} aria-label={`Roll wounds for ${item.weapon}, shot at ${item.time}`}><Dice5 size={13}/>Roll wounds</button>}</div>}
              </> : <>
                <div className="history-row"><span className="history-die">{item.result.adjusted ?? '—'}</span><div className="history-description"><strong>{item.result.mode === 'punching' ? 'Punching' : 'Grappling'} · {item.result.label}</strong><small>{item.character}{item.targetName && ` → ${item.targetName}`}{item.context && ` · turn ${item.context.turn} · ${phaseNames[item.context.phase]}`}</small></div><time>{item.time}</time></div>
                <div className="history-wounds"><details><summary>Result details<ChevronDown size={13}/></summary><BrawlDetails result={item.result}/></details>{item.context && <button className="export-button apply-result" disabled={encounter.applied.includes(item.id) || item.context.encounterId !== encounter.id || item.context.turn !== encounter.turn || item.context.phase !== encounter.phase} onClick={() => applyBrawlRoll(item)}>{encounter.applied.includes(item.id) ? 'Applied to shootout' : `Apply result · ${item.targetName}`}</button>}</div>
              </>}
            </div>)}</div> : <div className="history-empty"><span className="trail-line"/><p>A clean slate. Let’s see what the dice have in store.</p><span className="trail-line"/></div>}
            {history.length > 5 && <p className="history-limit">Showing the last 5 of {history.length} rolls this session.</p>}
          </section>
        </div>
      </div>
      <footer><span><BadgeStar/> An unofficial companion for Boot Hill, 2nd Edition.</span></footer>
    </main>
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
    {dialog === 'rules' && <Dialog title="A little rules refresher" onClose={() => setDialog(null)}><div className="rules-content"><span className="eyebrow">BOOT HILL · SECOND EDITION</span><h3>Fast hands. Straight shooting.</h3><p><b>First shot</b> = speed ability modifier + bravery speed modifier + weapon speed modifier + situational speed modifiers. Higher scores shoot first; ties fire simultaneously. This score is not rolled.</p><p><b>Hit determination</b> = 50 + gun or throwing accuracy modifier + bravery accuracy modifier + experience modifier + range and situational modifiers. Roll d100: a result at or below that threshold hits.</p><p><b>Sheet scores</b> are the final percentile scores on your character sheet, including any creation or survival adjustments. Experience uses your previous number of gunfights. You can also enter your sheet’s modifiers directly. Each input mode keeps its own values; switching to Modifiers converts your current scores.</p><p><b>Range</b> uses the selected weapon’s chart in map spaces or tabletop inches. Each map space / tabletop inch represents six feet. Choose the applicable band; targets beyond the listed extreme range are out of range.</p><p><b>Situational modifiers</b> are cumulative. Check the weapon-at-rest restriction, referee decisions about protective cover, and which bonuses apply to your attack. Shotgun and scatter-gun accuracy bonuses are included automatically. After a hit, Roll wounds resolves location, severity, and shotgun or scatter-gun wound counts. Apply the results to the target.</p><p><b>Brawling</b> follows shooting, with two rounds per turn. Add two d10s and the current roll modifier, then use the punching or grappling chart. Results can reduce Strength and modify the next round. In the intervening shooting phase, each point of the previous brawl modifier changes hit chance by 10%.</p><p><b>Holds and Strength</b>: escape on an adjusted grapple of 3 or less, or 15–16, without causing damage. Other grapple results have no effect while held. Bear hugs prevent punching. Existing holds continue without another roll until escaped, released, or replaced by another action. Zero Strength means unconscious; a mortal wound is immediately fatal. The referee handles later death from untreated wounds using Adjust.</p><p><b>Shootout tracker</b>: add characters with their Strength ratings, select who acts and their target, and apply each result before advancing the brawling round. Wounds, holds, and turn progress are saved on this device. Saved character sheets are updated only with Save sheet.</p><p className="reference-note">Checked against the local 2e rulebook: ability tables p. 5, base numbers pp. 6–7, weapons p. 8, combat modifiers p. 9, wounds p. 10, brawling pp. 10–11. No automatic misses, critical hits, or extra house rules are added.</p><button className="roll-button" onClick={() => setDialog(null)}>Back to the tabletop<ArrowRight size={16}/></button></div></Dialog>}
    {dialog === 'new' && <Dialog title="A new face in town" onClose={() => setDialog(null)}><form className="new-character-form" onSubmit={event => { event.preventDefault(); startCharacter({ name: newName.trim() || 'Unnamed gunslinger', mode: 'modifiers', abilities: { speed: '20', gunAccuracy: '30', throwingAccuracy: '30', bravery: '25', gunfights: '0' }, modifiers: { ...initialSheet }, loadout: { ...sample.loadout } }); setToast('Your new sheet is ready. Fill it in, then Save sheet to keep it in your library.'); }}><p>Give your gunslinger a name, then fill in their character sheet. Save any changes to your current sheet before starting another.</p><label htmlFor="new-name">Character name<input id="new-name" autoFocus maxLength={80} placeholder="A name the West will remember" value={newName} onChange={event => setNewName(event.target.value)}/></label><button className="roll-button" type="submit">Create character<ArrowRight size={16}/></button><button className="example-button" type="button" onClick={() => startCharacter(sample)}>Use the Colorado Kid example</button></form></Dialog>}
  </>;
}
