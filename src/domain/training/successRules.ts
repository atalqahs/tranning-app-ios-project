import type { Evaluation, Ladder, Num } from './types';

/** Successes in a row on the same level before the level goes up. */
export const SUCCESSES_TO_ADVANCE = 2;

/** A completed session with effort above this holds the level instead of counting. */
export const MAX_QUALIFYING_EFFORT = 8;

export type StreakResult =
  | { kind: 'advance' }
  | { kind: 'repeat'; streak: number }
  | { kind: 'hold' }
  | { kind: 'fail' };

/**
 * The two-in-a-row rule shared by every track.
 * - fail → streak resets, same lesson next time
 * - success with effort 9–10 or pain → level held, streak resets (safety rule)
 * - first qualifying success → repeat the lesson
 * - second qualifying success in a row → advance one step
 */
export function applyStreak(
  streak: number,
  evaluation: Exclude<Evaluation, 'none'>,
  effort: Num,
  pain: boolean,
): StreakResult {
  if (evaluation === 'fail') return { kind: 'fail' };
  if (pain || (effort !== null && effort > MAX_QUALIFYING_EFFORT)) return { kind: 'hold' };
  const next = streak + 1;
  return next >= SUCCESSES_TO_ADVANCE ? { kind: 'advance' } : { kind: 'repeat', streak: next };
}

export function stepBack<P>(ladder: Ladder<P>, position: P, steps: number): P {
  let current = position;
  for (let i = 0; i < steps; i++) {
    const prev = ladder.prev(current);
    if (prev === null) break;
    current = prev;
  }
  return current;
}

/**
 * Moves `current` toward a review result:
 * - better result → forward, at most `maxForward` steps and never past the supported level
 * - same or one step below (placement is already one step conservative) → stay
 * - clearly lower → go straight to the supported level, however far back that is
 */
export function recalibrate<P>(
  ladder: Ladder<P>,
  current: P,
  supported: P,
  maxForward: number,
): { position: P; forwardSteps: number } {
  const target = ladder.rank(supported);
  if (target > ladder.rank(current)) {
    let position = current;
    let steps = 0;
    while (steps < maxForward) {
      const next = ladder.next(position);
      if (next === null || ladder.rank(next) > target) break;
      position = next;
      steps++;
    }
    return { position, forwardSteps: steps };
  }
  const oneBack = ladder.prev(current);
  const isClose = target === ladder.rank(current) || (oneBack !== null && target >= ladder.rank(oneBack));
  return { position: isClose ? current : supported, forwardSteps: 0 };
}

/** Number of real (entered) values; 0 counts, empty does not. */
export function isEntered(value: Num): value is number {
  return value !== null && Number.isFinite(value);
}
