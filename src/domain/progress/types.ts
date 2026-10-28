import type { DateKey } from '../calendar/dateUtils';

/** Personal bests, built only from numbers the user actually entered. */
export interface Records {
  bestContinuous: { km: number; sec: number | null; date: DateKey } | null;
  /** First trustworthy 5 km time: the reference for the speed half of the run bar. */
  first5k: { sec: number; date: DateKey } | null;
  best5k: { sec: number; date: DateKey } | null;
  bestPush: { reps: number; date: DateKey } | null;
  bestSit: { reps: number; date: DateKey } | null;
  /** Milestone id → date it was first reached. */
  milestones: Record<string, DateKey>;
}
