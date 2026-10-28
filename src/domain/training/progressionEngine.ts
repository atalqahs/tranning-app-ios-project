import { evaluatePush, pushLadder, pushPositionLabel } from './pushupPlan';
import { evaluateRun, nextRunCycle, runningLadder, runPositionLabel, usesRunCycle } from './runningPlan';
import { evaluateSit, sitLadder, sitPositionLabel } from './situpPlan';
import { applyStreak, type StreakResult } from './successRules';
import type {
  Evaluation,
  Ladder,
  PushEntry,
  PushPrescription,
  PushTrack,
  RunEntry,
  RunPrescription,
  RunTrack,
  SitEntry,
  SitPrescription,
  SitTrack,
} from './types';

export interface TrackOutcome<T> {
  track: T;
  evaluation: Exclude<Evaluation, 'none'>;
  advanced: boolean;
  /** Short reason shown as the engine's decision. */
  note: string;
}

const NOTE_FIRST = 'أكملت الحصة أول مرة — نكررها';
const NOTE_FAIL = 'لم تكتمل الحصة — نكررها';
const NOTE_HOLD = 'صعوبة عالية أو ألم — تثبيت المستوى';
const NOTE_MAINTAIN = 'جلسة محافظة مسجّلة';

function advanceNote(from: string, to: string | null): string {
  return to === null ? 'نجاحان متتاليان — أعلى مرحلة؛ نحافظ عليها' : `نجاحان متتاليان — من ${from} إلى ${to}`;
}

/** Applies the streak rule on a ladder and returns the new position/streak. */
function stepOnLadder<P>(
  ladder: Ladder<P>,
  position: P,
  result: StreakResult,
  label: (p: P) => string,
): { position: P; streak: number; advanced: boolean; note: string } {
  switch (result.kind) {
    case 'fail':
      return { position, streak: 0, advanced: false, note: NOTE_FAIL };
    case 'hold':
      return { position, streak: 0, advanced: false, note: NOTE_HOLD };
    case 'repeat':
      return { position, streak: result.streak, advanced: false, note: NOTE_FIRST };
    case 'advance': {
      const next = ladder.next(position);
      return {
        position: next ?? position,
        streak: 0,
        advanced: next !== null,
        note: advanceNote(label(position), next === null ? null : label(next)),
      };
    }
  }
}

export function applyRunResult(
  track: RunTrack,
  rx: RunPrescription,
  entry: RunEntry | undefined,
): TrackOutcome<RunTrack> | null {
  const evaluation = evaluateRun(rx, entry);
  if (evaluation === 'none' || !entry) return null;

  if (rx.kind === 'maintain') {
    return { track, evaluation, advanced: false, note: evaluation === 'success' ? NOTE_MAINTAIN : NOTE_FAIL };
  }

  if (!rx.key) {
    // Supporting runs of the rotation: done → next run in the rotation; not done → repeat it.
    if (evaluation === 'fail') {
      return { track, evaluation, advanced: false, note: 'الحصة الداعمة لم تكتمل — نكررها' };
    }
    return {
      track: { ...track, cycle: nextRunCycle(track.cycle) },
      evaluation,
      advanced: false,
      note: 'حصة داعمة مكتملة — ننتقل للحصة التالية في الدورة',
    };
  }

  const step = stepOnLadder(
    runningLadder,
    track.position,
    applyStreak(track.streak, evaluation, entry.effort, entry.pain),
    runPositionLabel,
  );
  const phaseChanged = step.position.phase !== track.position.phase;
  const cycle = !usesRunCycle(step.position)
    ? 0
    : phaseChanged
      ? 0
      : evaluation === 'success'
        ? nextRunCycle(track.cycle)
        : track.cycle;
  let note = step.note;
  if (step.advanced && track.position.phase === 'build' && step.position.phase === 'build') {
    note = 'نجاحان متتاليان — زيادة 250 م';
  }
  return { track: { position: step.position, streak: step.streak, cycle }, evaluation, advanced: step.advanced, note };
}

export function applyPushResult(
  track: PushTrack,
  rx: PushPrescription,
  entry: PushEntry | undefined,
): TrackOutcome<PushTrack> | null {
  const evaluation = evaluatePush(rx, entry);
  if (evaluation === 'none' || !entry) return null;
  if (rx.kind === 'maintain') {
    return { track, evaluation, advanced: false, note: evaluation === 'success' ? NOTE_MAINTAIN : NOTE_FAIL };
  }
  const step = stepOnLadder(
    pushLadder,
    track.position,
    applyStreak(track.streak, evaluation, entry.effort, entry.pain),
    pushPositionLabel,
  );
  return { track: { position: step.position, streak: step.streak }, evaluation, advanced: step.advanced, note: step.note };
}

export function applySitResult(
  track: SitTrack,
  rx: SitPrescription,
  entry: SitEntry | undefined,
): TrackOutcome<SitTrack> | null {
  const evaluation = evaluateSit(rx, entry);
  if (evaluation === 'none' || !entry) return null;
  if (rx.kind === 'maintain') {
    return { track, evaluation, advanced: false, note: evaluation === 'success' ? NOTE_MAINTAIN : NOTE_FAIL };
  }
  const step = stepOnLadder(
    sitLadder,
    track.position,
    applyStreak(track.streak, evaluation, entry.effort, entry.pain),
    sitPositionLabel,
  );
  return { track: { position: step.position, streak: step.streak }, evaluation, advanced: step.advanced, note: step.note };
}
