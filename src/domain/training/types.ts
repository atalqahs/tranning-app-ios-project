/** Shared vocabulary of the training domain. No logic lives here. */

export type TrackId = 'running' | 'pushups' | 'situps';

export const TRACKS: readonly TrackId[] = ['running', 'pushups', 'situps'];

// ---------------------------------------------------------------- positions

export type RunPosition =
  | { phase: 'walk' }
  | { phase: 'intervals'; stage: number }
  | { phase: 'build'; level: number }
  | { phase: 'speed'; stage: number }
  | { phase: 'maintain' };

export type PushPosition =
  | { phase: 'incline'; stage: number }
  | { phase: 'knee'; stage: number }
  | { phase: 'transition'; stage: number }
  | { phase: 'endurance'; main: number }
  | { phase: 'maintain' };

export type SitPosition =
  | { phase: 'prep'; stage: number }
  | { phase: 'endurance'; main: number }
  | { phase: 'maintain' };

export interface RunTrack {
  position: RunPosition;
  streak: number;
  /** Index inside the 3-run rotation (build and speed phases only). */
  cycle: number;
}

export interface PushTrack {
  position: PushPosition;
  streak: number;
}

export interface SitTrack {
  position: SitPosition;
  streak: number;
}

export interface TrainingState {
  running: RunTrack;
  pushups: PushTrack;
  situps: SitTrack;
}

/** Steps along one track's curriculum, independent of the other tracks. */
export interface Ladder<P> {
  next(p: P): P | null;
  prev(p: P): P | null;
  /** Total order across phases; larger is further along. */
  rank(p: P): number;
}

// ------------------------------------------------------------ prescriptions

export type RunInputMode = 'duration' | 'intervals' | 'distance';

export interface RunPrescription {
  kind:
    | 'walk'
    | 'intervals'
    | 'continuousTime'
    | 'buildEasy'
    | 'buildShort'
    | 'buildKey'
    | 'speedEasy'
    | 'speedIntervals'
    | 'speedSteady'
    | 'maintain';
  /** Curriculum code shown to the user, e.g. "ج3", "2.75 كم", "س1". */
  code: string;
  mode: RunInputMode;
  /** Counts toward the two-in-a-row rule. */
  key: boolean;
  rounds?: number;
  workSec?: number;
  recoverSec?: number;
  minMinutes?: number;
  maxMinutes?: number;
  targetKm?: number;
  maxKm?: number;
  /** Speed sessions ask for the perceived effort. */
  wantsEffort?: boolean;
}

export type AssistedType = 'knee' | 'incline';

export interface PushSetTarget {
  /** Total reps for the set (normal + assisted when assisted is allowed). */
  total: number;
  /** Minimum strict floor push-ups inside that total. */
  normalMin: number;
}

export interface PushPrescription {
  kind: 'incline' | 'knee' | 'transition' | 'endurance' | 'maintain';
  code: string;
  sets: PushSetTarget[];
  /** null → only strict push-ups are recorded. */
  assisted: AssistedType | null;
  restSec: readonly [number, number];
}

export interface SitPrescription {
  kind: 'prep' | 'endurance' | 'maintain';
  code: string;
  sets: number[];
  restSec: readonly [number, number];
}

// ------------------------------------------------------------------ results

/** null means "not entered"; 0 is a real result. */
export type Num = number | null;

export interface RunEntry {
  intervalsDone: Num;
  distanceKm: Num;
  durationSec: Num;
  continuous: boolean;
  /** Split for the first 5 km when the run was longer than 5 km. */
  first5kSec: Num;
  effort: Num;
  pain: boolean;
}

export interface PushSetEntry {
  normal: Num;
  assisted: Num;
}

export interface PushEntry {
  sets: PushSetEntry[];
  effort: Num;
  pain: boolean;
}

export interface SitEntry {
  sets: Num[];
  effort: Num;
  pain: boolean;
}

export interface DayEntries {
  run?: RunEntry;
  push?: PushEntry;
  sit?: SitEntry;
  lightDone?: boolean;
}

export type Evaluation = 'none' | 'fail' | 'success';

// ---------------------------------------------------------------- placement

export interface PlacementInput {
  run: {
    distanceKm: Num;
    durationSec: Num;
    continuous: boolean | null;
    longestContinuousMin: Num;
    first5kSec: Num;
    note: string;
  };
  push: {
    assisted: AssistedType;
    rounds: PushSetEntry[];
  };
  sit: {
    best: Num;
  };
}
