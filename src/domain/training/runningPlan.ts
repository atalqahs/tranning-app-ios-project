import { isEntered } from './successRules';
import type { Evaluation, Ladder, RunEntry, RunPosition, RunPrescription } from './types';

export const GOAL_DISTANCE_KM = 5;
export const GOAL_5K_SEC = 25 * 60;

/** Walking prerequisite before ج0. */
export const WALK_PREP_MINUTES = [15, 20] as const;

interface IntervalStage {
  rounds: number;
  runSec: number;
  walkSec: number;
}

/** ج0 … ج12. Stages with a single round and no walk are continuous runs. */
export const INTERVAL_STAGES: readonly IntervalStage[] = [
  { rounds: 8, runSec: 30, walkSec: 90 },
  { rounds: 8, runSec: 60, walkSec: 90 },
  { rounds: 6, runSec: 120, walkSec: 90 },
  { rounds: 5, runSec: 180, walkSec: 90 },
  { rounds: 4, runSec: 300, walkSec: 120 },
  { rounds: 3, runSec: 420, walkSec: 120 },
  { rounds: 2, runSec: 600, walkSec: 180 },
  { rounds: 1, runSec: 15 * 60, walkSec: 0 },
  { rounds: 1, runSec: 18 * 60, walkSec: 0 },
  { rounds: 1, runSec: 20 * 60, walkSec: 0 },
  { rounds: 1, runSec: 23 * 60, walkSec: 0 },
  { rounds: 1, runSec: 26 * 60, walkSec: 0 },
  { rounds: 1, runSec: 30 * 60, walkSec: 0 },
];

/** Continuous distance levels on the way to 5 km. */
export const BUILD_LEVELS_KM: readonly number[] = [
  2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5,
];

/** Minimum continuous distance that enters the distance-build phase. */
export const BUILD_ENTRY_KM = 2.5;
/** Placement starts one 0.25 km level below the recorded distance. */
export const BUILD_PLACEMENT_MARGIN_KM = 0.25;
/** Placement in the interval ladder uses 80 % of the longest continuous run. */
export const INTERVAL_PLACEMENT_RATIO = 0.8;

/** Easy run of the build rotation: 70 % of the level, rounded to 50 m. */
const BUILD_EASY_PERCENT = 70;
const EASY_ROUNDING_HUNDREDTHS = 5;
const BUILD_SHORT_MINUTES = [15, 25] as const;
const SPEED_EASY_MINUTES = [20, 30] as const;
const SPEED_STEADY_KM = [3, 5] as const;
const MAINTAIN_MINUTES = [20, 30] as const;

interface SpeedStage {
  rounds: number;
  fastSec: number;
  recoverSec: number;
}

/** س0 … س5. */
export const SPEED_STAGES: readonly SpeedStage[] = [
  { rounds: 6, fastSec: 60, recoverSec: 120 },
  { rounds: 6, fastSec: 90, recoverSec: 120 },
  { rounds: 5, fastSec: 120, recoverSec: 120 },
  { rounds: 4, fastSec: 180, recoverSec: 120 },
  { rounds: 3, fastSec: 300, recoverSec: 180 },
  { rounds: 2, fastSec: 480, recoverSec: 180 },
];

/** Build and speed phases rotate three runs; the third / second is the key one. */
export const RUN_CYCLE_LENGTH = 3;
const BUILD_KEY_CYCLE = 2;
const SPEED_KEY_CYCLE = 1;

const LAST_INTERVAL = INTERVAL_STAGES.length - 1;
const LAST_BUILD = BUILD_LEVELS_KM.length - 1;
const LAST_SPEED = SPEED_STAGES.length - 1;

export const runningLadder: Ladder<RunPosition> = {
  next(p) {
    switch (p.phase) {
      case 'walk':
        return { phase: 'intervals', stage: 0 };
      case 'intervals':
        return p.stage < LAST_INTERVAL
          ? { phase: 'intervals', stage: p.stage + 1 }
          : { phase: 'build', level: 0 };
      case 'build':
        return p.level < LAST_BUILD ? { phase: 'build', level: p.level + 1 } : { phase: 'speed', stage: 0 };
      case 'speed':
        return p.stage < LAST_SPEED ? { phase: 'speed', stage: p.stage + 1 } : null;
      case 'maintain':
        return null;
    }
  },
  prev(p) {
    switch (p.phase) {
      case 'walk':
      case 'maintain':
        return null;
      case 'intervals':
        return p.stage > 0 ? { phase: 'intervals', stage: p.stage - 1 } : { phase: 'walk' };
      case 'build':
        return p.level > 0 ? { phase: 'build', level: p.level - 1 } : { phase: 'intervals', stage: LAST_INTERVAL };
      case 'speed':
        return p.stage > 0 ? { phase: 'speed', stage: p.stage - 1 } : { phase: 'build', level: LAST_BUILD };
    }
  },
  rank(p) {
    switch (p.phase) {
      case 'walk':
        return 0;
      case 'intervals':
        return 1 + p.stage;
      case 'build':
        return 20 + p.level;
      case 'speed':
        return 40 + p.stage;
      case 'maintain':
        return 100;
    }
  },
};

export function formatKm(km: number): string {
  return km.toFixed(2);
}

export function runPositionLabel(p: RunPosition): string {
  switch (p.phase) {
    case 'walk':
      return 'مشي تمهيدي';
    case 'intervals':
      return `ج${p.stage}`;
    case 'build':
      return `${formatKm(BUILD_LEVELS_KM[p.level]!)} كم متواصلة`;
    case 'speed':
      return `تحسين الزمن س${p.stage}`;
    case 'maintain':
      return 'محقق — محافظة';
  }
}

/** Integer arithmetic in hundredths of a km avoids 2.75 × 0.7 = 1.92499… */
function easyDistanceKm(levelKm: number): number {
  const hundredths = (Math.round(levelKm * 100) * BUILD_EASY_PERCENT) / 100;
  return (Math.round(hundredths / EASY_ROUNDING_HUNDREDTHS) * EASY_ROUNDING_HUNDREDTHS) / 100;
}

/** Prescription for the next running session of a track. */
export function prescribeRun(position: RunPosition, cycle: number): RunPrescription {
  switch (position.phase) {
    case 'walk':
      return {
        kind: 'walk',
        code: 'تمهيدي',
        mode: 'duration',
        key: true,
        minMinutes: WALK_PREP_MINUTES[0],
        maxMinutes: WALK_PREP_MINUTES[1],
      };
    case 'intervals': {
      const s = INTERVAL_STAGES[position.stage]!;
      const code = `ج${position.stage}`;
      if (s.walkSec === 0) {
        return { kind: 'continuousTime', code, mode: 'duration', key: true, minMinutes: s.runSec / 60 };
      }
      return {
        kind: 'intervals',
        code,
        mode: 'intervals',
        key: true,
        rounds: s.rounds,
        workSec: s.runSec,
        recoverSec: s.walkSec,
      };
    }
    case 'build': {
      const level = BUILD_LEVELS_KM[position.level]!;
      const code = `${formatKm(level)} كم`;
      if (cycle === BUILD_KEY_CYCLE) {
        return { kind: 'buildKey', code, mode: 'distance', key: true, targetKm: level };
      }
      if (cycle === 0) {
        return {
          kind: 'buildEasy',
          code,
          mode: 'distance',
          key: false,
          targetKm: easyDistanceKm(level),
        };
      }
      return {
        kind: 'buildShort',
        code,
        mode: 'duration',
        key: false,
        minMinutes: BUILD_SHORT_MINUTES[0],
        maxMinutes: BUILD_SHORT_MINUTES[1],
      };
    }
    case 'speed': {
      const s = SPEED_STAGES[position.stage]!;
      const code = `س${position.stage}`;
      if (cycle === SPEED_KEY_CYCLE) {
        return {
          kind: 'speedIntervals',
          code,
          mode: 'intervals',
          key: true,
          rounds: s.rounds,
          workSec: s.fastSec,
          recoverSec: s.recoverSec,
          wantsEffort: true,
        };
      }
      if (cycle === 0) {
        return {
          kind: 'speedEasy',
          code,
          mode: 'duration',
          key: false,
          minMinutes: SPEED_EASY_MINUTES[0],
          maxMinutes: SPEED_EASY_MINUTES[1],
        };
      }
      return {
        kind: 'speedSteady',
        code,
        mode: 'distance',
        key: false,
        targetKm: SPEED_STEADY_KM[0],
        maxKm: SPEED_STEADY_KM[1],
      };
    }
    case 'maintain':
      return {
        kind: 'maintain',
        code: 'محافظة',
        mode: 'duration',
        key: false,
        minMinutes: MAINTAIN_MINUTES[0],
        maxMinutes: MAINTAIN_MINUTES[1],
      };
  }
}

/** Does this session type ask whether the run was continuous? */
export function asksContinuous(rx: RunPrescription): boolean {
  return rx.mode !== 'intervals' && rx.kind !== 'walk';
}

export function hasRunData(entry: RunEntry | undefined): entry is RunEntry {
  return !!entry && (isEntered(entry.intervalsDone) || isEntered(entry.distanceKm) || isEntered(entry.durationSec));
}

export function evaluateRun(rx: RunPrescription, entry: RunEntry | undefined): Evaluation {
  if (!hasRunData(entry)) return 'none';
  const minutes = (entry.durationSec ?? 0) / 60;
  let ok: boolean;
  switch (rx.kind) {
    case 'walk':
      ok = minutes >= rx.minMinutes!;
      break;
    case 'intervals':
    case 'speedIntervals':
      ok = (entry.intervalsDone ?? 0) >= rx.rounds!;
      break;
    case 'continuousTime':
    case 'buildShort':
    case 'speedEasy':
    case 'maintain':
      ok = entry.continuous && minutes >= rx.minMinutes!;
      break;
    case 'buildEasy':
    case 'buildKey':
    case 'speedSteady':
      // Small tolerance for typed decimals such as 2.749999.
      ok = entry.continuous && (entry.distanceKm ?? 0) >= rx.targetKm! - 1e-6;
      break;
  }
  return ok ? 'success' : 'fail';
}

const FIVE_K_TOLERANCE_KM = 0.005;

/**
 * A 5 km time that can be trusted: a continuous run of exactly 5 km, or the
 * stated first-5-km split of a longer continuous run. Anything else is not
 * proof of the 25:00 goal.
 */
export function reliable5kSec(run: {
  distanceKm: number | null;
  durationSec: number | null;
  continuous: boolean | null;
  first5kSec: number | null;
}): number | null {
  if (!run.continuous || run.distanceKm === null) return null;
  if (Math.abs(run.distanceKm - GOAL_DISTANCE_KM) <= FIVE_K_TOLERANCE_KM) {
    return run.durationSec !== null && run.durationSec > 0 ? run.durationSec : null;
  }
  if (run.distanceKm > GOAL_DISTANCE_KM && run.first5kSec !== null && run.first5kSec > 0) {
    return run.first5kSec;
  }
  return null;
}

export interface PaceStats {
  /** Seconds per km. */
  paceSec: number;
  kmh: number;
}

/** Pace and speed; only meaningful for a continuous run with valid numbers. */
export function paceStats(distanceKm: number | null, durationSec: number | null): PaceStats | null {
  if (distanceKm === null || durationSec === null || distanceKm <= 0 || durationSec <= 0) return null;
  return { paceSec: durationSec / distanceKm, kmh: distanceKm / (durationSec / 3600) };
}

export function nextRunCycle(cycle: number): number {
  return (cycle + 1) % RUN_CYCLE_LENGTH;
}

/** Whether the rotation index means anything for this phase. */
export function usesRunCycle(p: RunPosition): boolean {
  return p.phase === 'build' || p.phase === 'speed';
}
