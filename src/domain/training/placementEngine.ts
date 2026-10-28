import {
  BUILD_ENTRY_KM,
  BUILD_LEVELS_KM,
  BUILD_PLACEMENT_MARGIN_KM,
  GOAL_DISTANCE_KM,
  INTERVAL_PLACEMENT_RATIO,
  INTERVAL_STAGES,
} from './runningPlan';
import {
  ENDURANCE_ENTRY_REPS,
  INCLINE_REPS,
  KNEE_REPS,
  TRANSITION_NORMALS,
  bestStrictSet,
  enduranceMainFromBest,
} from './pushupPlan';
import { sitMainFromBest } from './situpPlan';
import { isEntered } from './successRules';
import type { PlacementInput, PushPosition, RunPosition, SitPosition, TrainingState } from './types';

const EPS = 1e-6;

/**
 * Running start point.
 * - continuous ≥ 5 km → time-improvement phase (س0; interval ability is never guessed from a 5 km time)
 * - continuous 2.5–5 km → the 0.25 km level below the result, minimum 2.50
 * - otherwise → highest ج stage whose longest run block ≤ 80 % of the longest continuous run
 * - nothing usable → walking prep
 * A distance that included walking never counts as continuous.
 */
export function placeRunning(run: PlacementInput['run']): RunPosition {
  const continuous = run.continuous === true;
  const distance = run.distanceKm;
  if (continuous && isEntered(distance)) {
    if (distance >= GOAL_DISTANCE_KM - EPS) return { phase: 'speed', stage: 0 };
    if (distance >= BUILD_ENTRY_KM - EPS) {
      const limit = distance - BUILD_PLACEMENT_MARGIN_KM + EPS;
      let level = 0;
      BUILD_LEVELS_KM.forEach((km, i) => {
        if (km <= limit) level = i;
      });
      return { phase: 'build', level };
    }
  }
  const longestMin =
    continuous && isEntered(run.durationSec) ? run.durationSec / 60 : run.longestContinuousMin;
  if (!isEntered(longestMin) || longestMin <= 0) return { phase: 'walk' };
  const limitSec = INTERVAL_PLACEMENT_RATIO * longestMin * 60 + EPS;
  let stage = 0;
  INTERVAL_STAGES.forEach((s, i) => {
    if (s.runSec <= limitSec) stage = i;
  });
  return { phase: 'intervals', stage };
}

/** Highest ladder step strictly below the recorded capacity (one step conservative). */
function stepBelow(reps: readonly number[], capacity: number): number | null {
  let found: number | null = null;
  reps.forEach((r, i) => {
    if (r < capacity) found = i;
  });
  return found;
}

/** Strict-per-set target in the transition ladder for someone whose best strict set is 1–9. */
function transitionStageForBest(best: number): number {
  if (best <= 4) return best - 1; // ض1 … ض4
  const perSet = Math.floor(best * 0.45); // e.g. best 5 → 2 per set → ض5
  let stage = 4;
  TRANSITION_NORMALS.forEach((normals, i) => {
    if (i >= 4 && normals[0]! <= perSet) stage = i;
  });
  return stage;
}

/**
 * Push-up start point.
 * - best strict set ≥ 10 → endurance, main = floor(0.7 × best)
 * - best strict 1–9 and 10-rep sets possible with knees → transition (ض)
 * - otherwise → assisted ladder one step below the weakest recorded set
 * - nothing entered → first knee step (a cautious start, not a guess at ability)
 */
export function placePushups(push: PlacementInput['push']): PushPosition {
  const best = bestStrictSet(push.rounds);
  if (best !== null && best >= ENDURANCE_ENTRY_REPS) {
    return { phase: 'endurance', main: enduranceMainFromBest(best) };
  }

  const entered = push.rounds.filter((r) => isEntered(r.normal) || isEntered(r.assisted));
  const capacity = entered.length
    ? Math.min(...entered.map((r) => (r.normal ?? 0) + (r.assisted ?? 0)))
    : null;

  if (best !== null && best >= 1 && push.assisted === 'knee' && (capacity === null || capacity >= 10)) {
    return { phase: 'transition', stage: transitionStageForBest(best) };
  }

  if (push.assisted === 'incline') {
    if (capacity === null) return { phase: 'incline', stage: 0 };
    const stage = stepBelow(INCLINE_REPS, capacity);
    return { phase: 'incline', stage: stage ?? 0 };
  }

  if (capacity === null) return { phase: 'knee', stage: 0 };
  const stage = stepBelow(KNEE_REPS, capacity);
  if (stage !== null) return { phase: 'knee', stage };
  return capacity >= KNEE_REPS[0]! ? { phase: 'knee', stage: 0 } : { phase: 'incline', stage: 0 };
}

/** Sit-up start point: 0 or unknown → half sit-up prep; otherwise main = floor(0.7 × best). */
export function placeSitups(sit: PlacementInput['sit']): SitPosition {
  if (!isEntered(sit.best) || sit.best <= 0) return { phase: 'prep', stage: 0 };
  return { phase: 'endurance', main: sitMainFromBest(sit.best) };
}

export function placeAll(input: PlacementInput): TrainingState {
  return {
    running: { position: placeRunning(input.run), streak: 0, cycle: 0 },
    pushups: { position: placePushups(input.push), streak: 0 },
    situps: { position: placeSitups(input.sit), streak: 0 },
  };
}

/** Which tracks the form actually says something about. Empty tracks keep their place in a review. */
export function placementCoverage(input: PlacementInput): { running: boolean; pushups: boolean; situps: boolean } {
  return {
    running: isEntered(input.run.distanceKm) || isEntered(input.run.longestContinuousMin) || isEntered(input.run.durationSec),
    pushups: input.push.rounds.some((r) => isEntered(r.normal) || isEntered(r.assisted)),
    situps: isEntered(input.sit.best),
  };
}
