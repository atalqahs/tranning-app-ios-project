import { pushLadder } from '../training/pushupPlan';
import { runningLadder } from '../training/runningPlan';
import { sitLadder } from '../training/situpPlan';
import { stepBack } from '../training/successRules';
import type { TrainingState } from '../training/types';

/** Consecutive missed training days → steps back from the position before the run of absences. */
const ABSENCE_STEP_BACK: Readonly<Record<number, number>> = { 1: 0, 2: 0, 3: 1, 4: 2 };

/** Consecutive missed training days that require a fresh placement form. */
export const ABSENCE_REPLACEMENT_DAYS = 5;

/** A health pause this long (in missed training days) also needs a fresh placement. */
export const PAUSE_REPLACEMENT_DAYS = 5;
/** A shorter pause of at least this many training days resumes one step back. */
const PAUSE_STEP_BACK_FROM = 3;

export function stepBackAll(state: TrainingState, steps: number): TrainingState {
  if (steps <= 0) return state;
  return {
    running: { ...state.running, position: stepBack(runningLadder, state.running.position, steps), streak: 0 },
    pushups: { position: stepBack(pushLadder, state.pushups.position, steps), streak: 0 },
    situps: { position: stepBack(sitLadder, state.situps.position, steps), streak: 0 },
  };
}

export type AbsenceAction =
  | { kind: 'keep' }
  | { kind: 'stepBack'; state: TrainingState; note: string }
  | { kind: 'placement'; note: string };

/**
 * What a run of `absenceRun` missed training days means.
 * Always measured from `anchor` (the position before the run), so 3 then 4
 * days gives −1 then −2 in total, never −3.
 */
export function absenceAction(absenceRun: number, anchor: TrainingState): AbsenceAction {
  if (absenceRun >= ABSENCE_REPLACEMENT_DAYS) {
    return { kind: 'placement', note: `غياب ${absenceRun} أيام تدريب — تحديد مستوى جديد قبل الاستئناف` };
  }
  const steps = ABSENCE_STEP_BACK[absenceRun] ?? 0;
  if (steps === 0) return { kind: 'keep' };
  return {
    kind: 'stepBack',
    state: stepBackAll(anchor, steps),
    note: `غياب ${absenceRun} أيام — رجوع ${steps === 1 ? 'حصة واحدة' : 'حصتين'}`,
  };
}

export type ResumeAction =
  | { kind: 'keep'; note: string }
  | { kind: 'stepBack'; steps: number; note: string }
  | { kind: 'placement'; note: string };

export function resumeAction(pausedTrainingDays: number): ResumeAction {
  if (pausedTrainingDays >= PAUSE_REPLACEMENT_DAYS) {
    return { kind: 'placement', note: 'عودة من توقف صحي طويل — تحديد مستوى جديد' };
  }
  if (pausedTrainingDays >= PAUSE_STEP_BACK_FROM) {
    return { kind: 'stepBack', steps: 1, note: 'عودة من توقف صحي — رجوع حصة احتياطًا' };
  }
  return { kind: 'keep', note: 'عودة من التوقف الصحي — نفس الحصة' };
}
