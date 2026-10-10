import { resolveHit, rollPercentile, weaponProfiles } from './rules';
import { resolveWound, type HitEffects } from './wounds';

// Misfire Table supplied by the user: 00 is the percentile result 100.
export const misfireProfiles = [
  { id: 'derringer', label: 'Derringer', safe: 98, dud: 100 },
  { id: 'cap-ball', label: 'Cap & ball revolver', safe: 95, dud: 99 },
  { id: 'revolver', label: 'Single / double action, long barrel or fast draw revolver', safe: 99, dud: 100 },
  { id: 'shotgun', label: 'Shotgun / scatter gun', safe: 99, dud: 100 },
  { id: 'civil-war-carbine', label: 'Civil War carbine', safe: 95, dud: 97 },
  { id: 'civil-war-rifle', label: 'Civil War rifle', safe: 95, dud: 97 },
  { id: 'other-rifle', label: 'Other rifles', safe: 97, dud: 98 },
  { id: 'other-carbine', label: 'Other carbines', safe: 97, dud: 98 },
  { id: 'buffalo', label: 'Buffalo rifle', safe: 98, dud: 100 },
  { id: 'army', label: 'Army rifle', safe: 98, dud: 100 },
] as const;
export type MisfireProfileId = typeof misfireProfiles[number]['id'];
export type MisfireResult = { profileId: MisfireProfileId; roll: number; outcome: 'ready' | 'dud' | 'explosion' | 'jam'; injuryRoll: number | null; injury: HitEffects | null };
export type ShotResult = { roll: number | null; chance: number; hit: boolean; misfire: MisfireResult | null };
export function defaultMisfireProfile(weaponId: string): MisfireProfileId {
  if (weaponId === 'derringer' || weaponId === 'cap-ball' || weaponId === 'buffalo') return weaponId;
  if (weaponId === 'shotgun' || weaponId === 'scatter') return 'shotgun';
  if (weaponId === 'rifle') return 'other-rifle';
  if (weaponId === 'carbine') return 'other-carbine';
  return 'revolver';
}
export function assertMisfireProfile(value: unknown): MisfireProfileId {
  if (!misfireProfiles.some(profile => profile.id === value)) throw new Error('Choose a valid misfire table.');
  return value as MisfireProfileId;
}
function drawPercentile(draw: () => number): number {
  const value = draw();
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('Misfire dice must be 1–100.');
  return value;
}
export function rollMisfire(profileId: MisfireProfileId, draw: () => number = rollPercentile): MisfireResult {
  const profile = misfireProfiles.find(item => item.id === assertMisfireProfile(profileId))!;
  const roll = drawPercentile(draw);
  const outcome = roll <= profile.safe ? 'ready' : roll <= profile.dud ? 'dud' : profileId === 'cap-ball' ? 'explosion' : 'jam';
  const injuryRoll = outcome === 'explosion' ? drawPercentile(draw) : null;
  const wound = injuryRoll !== null && injuryRoll <= 50 ? resolveWound(drawPercentile(draw), drawPercentile(draw)) : null;
  return { profileId, roll, outcome, injuryRoll, injury: wound ? { spreadRoll: null, spreadDie: null, wounds: [wound], totalStrengthLoss: wound.strengthLoss ?? 0, mortal: wound.severity === 'Mortal' } : null };
}
export function rollShot(weaponId: string, profileId: MisfireProfileId, base: number, range: number, situational: number, draw: () => number = rollPercentile): ShotResult {
  const weapon = weaponProfiles.find(item => item.id === weaponId);
  if (!weapon) throw new Error('Unknown weapon.');
  if (![base, range, situational].every(Number.isInteger)) throw new Error('Modifiers must be whole numbers.');
  const misfire = weapon.attack === 'gun' ? rollMisfire(profileId, draw) : null;
  if (misfire && misfire.outcome !== 'ready') return { roll: null, chance: base + range + situational, hit: false, misfire };
  // Successful checks stay silent; only actual misfires belong in the result.
  return { ...resolveHit(drawPercentile(draw), base, range, situational), misfire: null };
}
export const misfireLabels = { ready: 'No misfire', dud: 'Dud round', explosion: 'Explosion', jam: 'Jammed shell' };
export function shotLabel(result: ShotResult): string { return result.misfire && result.misfire.outcome !== 'ready' ? misfireLabels[result.misfire.outcome] : result.hit ? 'Hit' : 'Miss'; }
export function shotDie(result: ShotResult): number { return result.roll ?? result.misfire!.roll; }
