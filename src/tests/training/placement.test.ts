import { describe, expect, it } from 'vitest';
import { placePushups, placeRunning, placeSitups } from '../../domain/training/placementEngine';
import { prescribePush } from '../../domain/training/pushupPlan';
import { prescribeRun } from '../../domain/training/runningPlan';
import { prescribeSit } from '../../domain/training/situpPlan';
import type { PlacementInput } from '../../domain/training/types';
import { placement, sets } from '../helpers';

const runOf = (r: Partial<PlacementInput['run']>) => placeRunning(placement({ run: r }).run);

describe('running placement', () => {
  it('3 km continuous in 17:00 starts at 2.75 km, not a walk-from-zero plan', () => {
    expect(runOf({ distanceKm: 3, durationSec: 1020, continuous: true })).toEqual({ phase: 'build', level: 1 });
  });

  it('3 km that included walking does not give the same placement', () => {
    expect(runOf({ distanceKm: 3, durationSec: 1500, continuous: false })).toEqual({ phase: 'walk' });
    // With a longest continuous block of 10 min: 80 % = 8 min → ج5 (7-minute blocks).
    expect(runOf({ distanceKm: 3, durationSec: 1500, continuous: false, longestContinuousMin: 10 })).toEqual({
      phase: 'intervals',
      stage: 5,
    });
  });

  it('never goes below 2.50 km in the build phase', () => {
    expect(runOf({ distanceKm: 2.6, durationSec: 900, continuous: true })).toEqual({ phase: 'build', level: 0 });
  });

  it('short continuous runs map to the interval ladder by 80 % of their duration', () => {
    expect(runOf({ distanceKm: 1, durationSec: 6 * 60, continuous: true })).toEqual({ phase: 'intervals', stage: 3 });
  });

  it('continuous 5 km enters the speed phase at س0 regardless of the time', () => {
    expect(runOf({ distanceKm: 5, durationSec: 22 * 60, continuous: true })).toEqual({ phase: 'speed', stage: 0 });
    expect(prescribeRun({ phase: 'speed', stage: 0 }, 1).code).toBe('س0');
  });

  it('no running data starts with the walking prep', () => {
    expect(runOf({})).toEqual({ phase: 'walk' });
    expect(runOf({ longestContinuousMin: 0 })).toEqual({ phase: 'walk' });
  });
});

describe('push-up placement', () => {
  it('0 strict and 4×10 knees → knee 4×8, strict fields allow zero', () => {
    const p = placePushups(placement({ push: { rounds: sets([[0, 10], [0, 10], [0, 10], [0, 10]]) } }).push);
    expect(p).toEqual({ phase: 'knee', stage: 2 });
    const rx = prescribePush(p);
    expect(rx.assisted).toBe('knee');
    expect(rx.sets).toHaveLength(4);
    expect(rx.sets.every((s) => s.total === 8 && s.normalMin === 0)).toBe(true);
  });

  it('one strict push-up in one round with 10-rep sets → ض1', () => {
    const p = placePushups(placement({ push: { rounds: sets([[1, 9], [0, 10], [0, 10], [0, 10]]) } }).push);
    expect(p).toEqual({ phase: 'transition', stage: 0 });
  });

  it('best strict 5 → ض5 (2 strict per set)', () => {
    const p = placePushups(placement({ push: { rounds: sets([[5, 5], [3, 7], [2, 8], [2, 8]]) } }).push);
    expect(p).toEqual({ phase: 'transition', stage: 4 });
    expect(prescribePush(p).sets.map((s) => s.normalMin)).toEqual([2, 2, 2, 2]);
  });

  it('best strict ≥ 10 → endurance main floor(0.7×best) with two support sets', () => {
    const p = placePushups(placement({ push: { rounds: sets([[20, null], [12, null], [null, null], [null, null]]) } }).push);
    expect(p).toEqual({ phase: 'endurance', main: 14 });
    expect(prescribePush(p).sets.map((s) => s.total)).toEqual([14, 8, 8]);
  });

  it('cannot do knees → incline work, recorded as its own type', () => {
    const p = placePushups(placement({ push: { assisted: 'incline', rounds: sets([[0, 10], [0, 10], [0, 11], [0, 12]]) } }).push);
    expect(p).toEqual({ phase: 'incline', stage: 1 });
    expect(prescribePush(p).assisted).toBe('incline');
  });

  it('nothing entered starts at the first knee step', () => {
    expect(placePushups(placement().push)).toEqual({ phase: 'knee', stage: 0 });
  });
});

describe('sit-up placement', () => {
  it('20 continuous → 14 main + 10 + 10, no timing', () => {
    const p = placeSitups({ best: 20 });
    expect(p).toEqual({ phase: 'endurance', main: 14 });
    expect(prescribeSit(p).sets).toEqual([14, 10, 10]);
  });

  it('zero or unknown starts with half sit-up prep', () => {
    expect(placeSitups({ best: 0 })).toEqual({ phase: 'prep', stage: 0 });
    expect(placeSitups({ best: null })).toEqual({ phase: 'prep', stage: 0 });
    expect(prescribeSit({ phase: 'prep', stage: 0 }).kind).toBe('prep');
  });
});
