import { addDays, diffDays, isTrainingDay, weekStart, type DateKey } from '../calendar/dateUtils';
import { placementCoverage, placePushups, placeRunning, placeSitups } from './placementEngine';
import { pushLadder, pushPositionLabel } from './pushupPlan';
import { runningLadder, runPositionLabel } from './runningPlan';
import { sitLadder, sitPositionLabel } from './situpPlan';
import { recalibrate } from './successRules';
import type { Ladder, PlacementInput, TrackId, TrainingState } from './types';

/** Training weeks between periodic level reviews. */
export const REVIEW_EVERY_WEEKS = 4;
/** A review may move a track forward at most this many steps. */
export const REVIEW_MAX_FORWARD = 2;

export interface ReviewResult {
  state: TrainingState;
  forwardSteps: number;
  notes: Partial<Record<TrackId, string>>;
}

function describe<P>(ladder: Ladder<P>, before: P, after: P, steps: number, label: (p: P) => string): string {
  const diff = ladder.rank(after) - ladder.rank(before);
  if (diff > 0) return `مراجعة المستوى — تقدّم ${steps === 1 ? 'حصة' : 'حصتين'} إلى ${label(after)}`;
  if (diff < 0) return `مراجعة المستوى — رجوع إلى ${label(after)} المناسب لنتيجتك`;
  return 'مراجعة المستوى — النتيجة متقاربة؛ نثبت المستوى';
}

/**
 * Re-maps each track independently from review results.
 * Tracks without new numbers, and goals already in maintenance, stay as they are.
 * Every moved track restarts its success streak.
 */
export function applyReview(state: TrainingState, input: PlacementInput): ReviewResult {
  const covered = placementCoverage(input);
  const next: TrainingState = structuredClone(state);
  const notes: ReviewResult['notes'] = {};
  let forwardSteps = 0;

  const run = state.running.position;
  if (covered.running && run.phase !== 'maintain') {
    const supported = placeRunning(input.run);
    // Inside the speed phase a 5 km time updates the reference, not the interval stage.
    const result =
      run.phase === 'speed' && supported.phase === 'speed'
        ? { position: run, forwardSteps: 0 }
        : recalibrate(runningLadder, run, supported, REVIEW_MAX_FORWARD);
    next.running = { position: result.position, streak: 0, cycle: 0 };
    forwardSteps += result.forwardSteps;
    notes.running =
      run.phase === 'speed' && supported.phase === 'speed'
        ? 'مراجعة المستوى — تحديث زمن 5 كم المرجعي؛ مرحلة السرعة كما هي'
        : describe(runningLadder, run, result.position, result.forwardSteps, runPositionLabel);
  }

  const push = state.pushups.position;
  if (covered.pushups && push.phase !== 'maintain') {
    const result = recalibrate(pushLadder, push, placePushups(input.push), REVIEW_MAX_FORWARD);
    next.pushups = { position: result.position, streak: 0 };
    forwardSteps += result.forwardSteps;
    notes.pushups = describe(pushLadder, push, result.position, result.forwardSteps, pushPositionLabel);
  }

  const sit = state.situps.position;
  if (covered.situps && sit.phase !== 'maintain') {
    const result = recalibrate(sitLadder, sit, placeSitups(input.sit), REVIEW_MAX_FORWARD);
    next.situps = { position: result.position, streak: 0 };
    forwardSteps += result.forwardSteps;
    notes.situps = describe(sitLadder, sit, result.position, result.forwardSteps, sitPositionLabel);
  }

  return { state: next, forwardSteps, notes };
}

/**
 * Training weeks (Sunday–Thursday blocks) completed since the last placement,
 * counted up to the Sunday `sunday`. A block entirely inside a health pause
 * does not count. A partial first week (placement after its Sunday) does not count.
 */
export function trainingWeeksSince(
  lastPlacement: DateKey,
  sunday: DateKey,
  isPaused: (d: DateKey) => boolean,
): number {
  let count = 0;
  for (let w = weekStart(lastPlacement); diffDays(w, sunday) > 0; w = addDays(w, 7)) {
    if (diffDays(lastPlacement, w) < 0) continue;
    let allPaused = true;
    for (let i = 0; i < 7; i++) {
      const d = addDays(w, i);
      if (isTrainingDay(d) && !isPaused(d)) allPaused = false;
    }
    if (!allPaused) count++;
  }
  return count;
}
