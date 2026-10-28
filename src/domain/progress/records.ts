import type { DateKey } from '../calendar/dateUtils';
import { PUSH_GOAL } from '../training/pushupPlan';
import { GOAL_5K_SEC, reliable5kSec } from '../training/runningPlan';
import { SIT_GOAL } from '../training/situpPlan';
import type { TrackId } from '../training/types';
import { MILESTONES } from './milestones';
import type { Records } from './types';

export function emptyRecords(): Records {
  return { bestContinuous: null, first5k: null, best5k: null, bestPush: null, bestSit: null, milestones: {} };
}

export interface RunFacts {
  distanceKm: number | null;
  durationSec: number | null;
  continuous: boolean | null;
  first5kSec: number | null;
}

/** Records a run. Runs that included walking never count as continuous. */
export function recordRun(r: Records, date: DateKey, run: RunFacts): Records {
  let next = r;
  if (run.continuous && run.distanceKm !== null && run.distanceKm > 0) {
    const prev = r.bestContinuous;
    if (!prev || run.distanceKm > prev.km) {
      next = { ...next, bestContinuous: { km: run.distanceKm, sec: run.durationSec, date } };
    }
  }
  const fiveK = reliable5kSec(run);
  if (fiveK !== null) {
    if (!next.first5k) next = { ...next, first5k: { sec: fiveK, date } };
    if (!next.best5k || fiveK < next.best5k.sec) next = { ...next, best5k: { sec: fiveK, date } };
  }
  return unlock(next, date);
}

export function recordPush(r: Records, date: DateKey, bestSet: number | null): Records {
  if (bestSet === null || (r.bestPush && r.bestPush.reps >= bestSet)) return r;
  return unlock({ ...r, bestPush: { reps: bestSet, date } }, date);
}

export function recordSit(r: Records, date: DateKey, bestSet: number | null): Records {
  if (bestSet === null || (r.bestSit && r.bestSit.reps >= bestSet)) return r;
  return unlock({ ...r, bestSit: { reps: bestSet, date } }, date);
}

function unlock(r: Records, date: DateKey): Records {
  let milestones = r.milestones;
  for (const m of MILESTONES) {
    if (!milestones[m.id] && m.reached(r)) milestones = { ...milestones, [m.id]: date };
  }
  return milestones === r.milestones ? r : { ...r, milestones };
}

/** Goals are proven only by a single explicit result: 5 km ≤ 25:00, or 70 in one set. */
export function isGoalReached(r: Records, track: TrackId): boolean {
  switch (track) {
    case 'running':
      return r.best5k !== null && r.best5k.sec <= GOAL_5K_SEC;
    case 'pushups':
      return (r.bestPush?.reps ?? 0) >= PUSH_GOAL;
    case 'situps':
      return (r.bestSit?.reps ?? 0) >= SIT_GOAL;
  }
}
