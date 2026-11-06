import type { MountedHit } from './horses';

export default function MountedHitDetails({ result }: { result: MountedHit }) {
  return <p className="mounted-hit" role="status">Aimed at <b>{result.intendedName}</b> · mounted target d100 <b>{result.roll}</b> · <b>{result.actualName} takes the hit.</b></p>;
}
