import { describe, expect, it } from 'vitest';
import { applyPushResult, applyRunResult, applySitResult } from '../../domain/training/progressionEngine';
import { evaluatePush, prescribePush, pushLadder } from '../../domain/training/pushupPlan';
import { evaluateRun, prescribeRun, reliable5kSec } from '../../domain/training/runningPlan';
import { prescribeSit } from '../../domain/training/situpPlan';
import { recalibrate } from '../../domain/training/successRules';
import type { PushTrack, RunTrack } from '../../domain/training/types';
import { run, sets } from '../helpers';

describe('two-in-a-row rule (push-ups)', () => {
  const track: PushTrack = { position: { phase: 'knee', stage: 2 }, streak: 0 };
  const rx = prescribePush(track.position);
  const done = { sets: sets([[0, 8], [0, 8], [0, 8], [0, 8]]), effort: 6, pain: false };
  const short = { sets: sets([[0, 8], [0, 8], [0, 6], [0, 8]]), effort: 6, pain: false };

  it('first success repeats the lesson, second advances one step', () => {
    const first = applyPushResult(track, rx, done)!;
    expect(first.track).toEqual({ position: { phase: 'knee', stage: 2 }, streak: 1 });
    expect(first.note).toContain('نكررها');
    const second = applyPushResult(first.track, rx, done)!;
    expect(second.track).toEqual({ position: { phase: 'knee', stage: 3 }, streak: 0 });
    expect(second.advanced).toBe(true);
  });

  it('a failure holds the level and resets the streak', () => {
    const failed = applyPushResult({ ...track, streak: 1 }, rx, short)!;
    expect(failed.evaluation).toBe('fail');
    expect(failed.track).toEqual({ position: { phase: 'knee', stage: 2 }, streak: 0 });
  });

  it('effort 9–10 or pain holds the level even when complete', () => {
    expect(applyPushResult({ ...track, streak: 1 }, rx, { ...done, effort: 9 })!.track.streak).toBe(0);
    expect(applyPushResult({ ...track, streak: 1 }, rx, { ...done, pain: true })!.advanced).toBe(false);
  });

  it('no entered numbers is not an attempt', () => {
    expect(applyPushResult(track, rx, { sets: sets([[null, null]]), effort: null, pain: false })).toBeNull();
  });
});

describe('push-up set rules', () => {
  it('strict reps replace assisted reps inside the 10, never on top', () => {
    const rx = prescribePush({ phase: 'transition', stage: 4 }); // 2 strict in each set of 10
    expect(evaluatePush(rx, { sets: sets([[2, 8], [2, 8], [3, 7], [2, 8]]), effort: null, pain: false })).toBe('success');
    expect(evaluatePush(rx, { sets: sets([[1, 9], [2, 8], [2, 8], [2, 8]]), effort: null, pain: false })).toBe('fail');
  });

  it('endurance increments follow the rep bands and never pass 70', () => {
    expect(pushLadder.next({ phase: 'endurance', main: 14 })).toEqual({ phase: 'endurance', main: 15 });
    expect(pushLadder.next({ phase: 'endurance', main: 15 })).toEqual({ phase: 'endurance', main: 17 });
    expect(pushLadder.next({ phase: 'endurance', main: 59 })).toEqual({ phase: 'endurance', main: 61 });
    expect(pushLadder.next({ phase: 'endurance', main: 69 })).toEqual({ phase: 'endurance', main: 70 });
    expect(prescribePush({ phase: 'endurance', main: 52 }).sets).toHaveLength(2);
  });
});

describe('running sessions', () => {
  it('build key session: two full continuous runs add 250 m', () => {
    const track: RunTrack = { position: { phase: 'build', level: 1 }, streak: 0, cycle: 2 };
    const rx = prescribeRun(track.position, track.cycle);
    expect(rx).toMatchObject({ kind: 'buildKey', targetKm: 2.75, key: true });
    const ok = run({ distanceKm: 2.75, durationSec: 1000, continuous: true });
    const first = applyRunResult(track, rx, ok)!;
    expect(first.track.streak).toBe(1);
    const again = applyRunResult({ ...first.track, cycle: 2 }, rx, ok)!;
    expect(again.track.position).toEqual({ phase: 'build', level: 2 });
    expect(again.note).toBe('نجاحان متتاليان — زيادة 250 م');
  });

  it('a key distance run with walking is not a success', () => {
    const rx = prescribeRun({ phase: 'build', level: 1 }, 2);
    expect(evaluateRun(rx, run({ distanceKm: 2.75, durationSec: 1100, continuous: false }))).toBe('fail');
  });

  it('easy runs move the rotation but never the level', () => {
    const track: RunTrack = { position: { phase: 'build', level: 1 }, streak: 1, cycle: 0 };
    const rx = prescribeRun(track.position, 0);
    expect(rx).toMatchObject({ kind: 'buildEasy', key: false, targetKm: 1.95 });
    const o = applyRunResult(track, rx, run({ distanceKm: 2, durationSec: 700, continuous: true }))!;
    expect(o.track).toEqual({ position: { phase: 'build', level: 1 }, streak: 1, cycle: 1 });
  });

  it('interval session counts completed blocks', () => {
    const rx = prescribeRun({ phase: 'intervals', stage: 3 }, 0);
    expect(rx).toMatchObject({ rounds: 5, workSec: 180, recoverSec: 90 });
    expect(evaluateRun(rx, run({ intervalsDone: 4 }))).toBe('fail');
    expect(evaluateRun(rx, run({ intervalsDone: 5 }))).toBe('success');
  });

  it('only exactly 5 km continuous, or a stated first-5 km split, is a 5 km time', () => {
    expect(reliable5kSec({ distanceKm: 5, durationSec: 1500, continuous: true, first5kSec: null })).toBe(1500);
    expect(reliable5kSec({ distanceKm: 5, durationSec: 1500, continuous: false, first5kSec: null })).toBeNull();
    expect(reliable5kSec({ distanceKm: 6, durationSec: 1700, continuous: true, first5kSec: null })).toBeNull();
    expect(reliable5kSec({ distanceKm: 6, durationSec: 1700, continuous: true, first5kSec: 1440 })).toBe(1440);
    expect(reliable5kSec({ distanceKm: 4.9, durationSec: 1400, continuous: true, first5kSec: null })).toBeNull();
  });
});

describe('sit-ups', () => {
  it('two successes in a row add reps to the main set only', () => {
    const track = { position: { phase: 'endurance' as const, main: 14 }, streak: 1 };
    const rx = prescribeSit(track.position);
    const o = applySitResult(track, rx, { sets: [14, 10, 10], effort: null, pain: false })!;
    expect(o.track.position).toEqual({ phase: 'endurance', main: 15 });
  });
});

describe('review recalibration', () => {
  const at = (main: number) => ({ phase: 'endurance' as const, main });
  it('moves forward at most two steps', () => {
    expect(recalibrate(pushLadder, at(14), at(30), 2).position).toEqual(at(17));
  });
  it('keeps the level when the result is the same or one step below', () => {
    expect(recalibrate(pushLadder, at(20), at(18), 2).position).toEqual(at(20));
  });
  it('goes back as far as the result requires', () => {
    expect(recalibrate(pushLadder, at(30), at(10), 2).position).toEqual(at(10));
  });
});
