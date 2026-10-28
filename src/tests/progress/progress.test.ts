import { describe, expect, it } from 'vitest';
import { addDays } from '../../domain/calendar/dateUtils';
import { saveDay, updateDraft } from '../../domain/program/commands';
import { emptyRecords, isGoalReached, recordPush, recordRun, recordSit } from '../../domain/progress/records';
import { computeStatistics, goalProgress, runningProgress } from '../../domain/progress/statistics';
import { bestStrictSet } from '../../domain/training/pushupPlan';
import { SUN, placement, plan, run, sets, start, timeline } from '../helpers';

const fiveK = (sec: number, continuous = true) => ({ distanceKm: 5, durationSec: sec, continuous, first5kSec: null });

describe('running goal', () => {
  it('5 km in 25:00 continuous reaches the goal; 25:01 does not', () => {
    const at2500 = recordRun(emptyRecords(), SUN, fiveK(1500));
    const at2501 = recordRun(emptyRecords(), SUN, fiveK(1501));
    expect(isGoalReached(at2500, 'running')).toBe(true);
    expect(at2500.milestones['run-5k-25']).toBe(SUN);
    expect(isGoalReached(at2501, 'running')).toBe(false);
    expect(at2501.milestones['run-5k-25']).toBeUndefined();
    expect(at2501.milestones['run-5k-30']).toBe(SUN);
  });

  it('5 km with walking is not a goal, a milestone or a 5 km time', () => {
    const r = recordRun(emptyRecords(), SUN, fiveK(1400, false));
    expect(isGoalReached(r, 'running')).toBe(false);
    expect(r.best5k).toBeNull();
    expect(r.milestones['run-5k']).toBeUndefined();
  });

  it('bar: distance alone stops at 50 %, speed half uses the first trustworthy time', () => {
    const slow = recordRun(emptyRecords(), SUN, fiveK(30 * 60));
    expect(runningProgress(slow)).toEqual({ track: 'running', percent: 50, stage: 'speed' });
    const faster = recordRun(slow, addDays(SUN, 30), fiveK(27 * 60 + 30));
    expect(runningProgress(faster).percent).toBe(75);
    const done = recordRun(faster, addDays(SUN, 60), fiveK(24 * 60));
    expect(runningProgress(done).percent).toBe(100);
  });

  it('bar: 3 km continuous is 30 %; 6 km without a 5 km split stays at 50 %', () => {
    expect(runningProgress(recordRun(emptyRecords(), SUN, { distanceKm: 3, durationSec: 1020, continuous: true, first5kSec: null })).percent).toBe(30);
    const long = recordRun(emptyRecords(), SUN, { distanceKm: 6, durationSec: 2400, continuous: true, first5kSec: null });
    expect(runningProgress(long)).toMatchObject({ percent: 50, stage: 'distance' });
  });

  it('no data → 0 %, nothing invented', () => {
    expect(goalProgress(emptyRecords()).map((g) => g.percent)).toEqual([0, 0, 0]);
  });
});

describe('push-up and sit-up goals', () => {
  it('70 strict in one set reaches the goal; 40 strict + 30 assisted does not', () => {
    expect(isGoalReached(recordPush(emptyRecords(), SUN, bestStrictSet(sets([[70, null]]))), 'pushups')).toBe(true);
    expect(isGoalReached(recordPush(emptyRecords(), SUN, bestStrictSet(sets([[40, 30]]))), 'pushups')).toBe(false);
  });

  it('several sets summing to 70 are not 70 in a row', () => {
    const r = recordPush(emptyRecords(), SUN, bestStrictSet(sets([[30, null], [25, null], [15, null]])));
    expect(r.bestPush?.reps).toBe(30);
    expect(isGoalReached(r, 'pushups')).toBe(false);
  });

  it('progress is best single set / 70, capped at 100 %', () => {
    let r = recordPush(emptyRecords(), SUN, 35);
    r = recordSit(r, SUN, 90);
    const [, push, sit] = goalProgress(r);
    expect(push!.percent).toBe(50);
    expect(sit!.percent).toBe(100);
  });

  it('sit-up sets summing to 70 in a real session do not reach the goal', () => {
    let data = start(addDays(SUN, -3), placement({ sit: { best: 50 } }));
    const p = plan(timeline(data, SUN), SUN);
    if (p.kind !== 'main' || !p.sit) throw new Error('expected sit-ups');
    data = saveDay(updateDraft(data, SUN, { sit: { sets: [35, 25, 10], effort: null, pain: false } }, SUN), SUN, SUN, 'x');
    const t = timeline(data, SUN);
    expect(t.records.bestSit?.reps).toBe(50);
    expect(isGoalReached(t.records, 'situps')).toBe(false);
  });

  it('a goal reached in a normal session switches only that track to maintenance', () => {
    let data = start(addDays(SUN, -3), placement({ push: { rounds: sets([[60, null], [null, null], [null, null], [null, null]]) }, sit: { best: 20 } }));
    const p = plan(timeline(data, SUN), SUN);
    if (p.kind !== 'main' || !p.push) throw new Error();
    data = saveDay(updateDraft(data, SUN, { push: { sets: sets([[70, null], [25, null]]), effort: null, pain: false } }, SUN), SUN, SUN, 'x');
    const t = timeline(data, SUN);
    expect(t.state.pushups.position).toEqual({ phase: 'maintain' });
    expect(t.state.situps.position.phase).toBe('endurance');
    expect(t.days.get(SUN)!.outcomes.pushups).toContain('تحقق الهدف');
    expect(t.records.milestones['push-70']).toBe(SUN);
  });
});

describe('statistics', () => {
  it('counts complete, partial and absent days without inventing numbers', () => {
    let data = start(addDays(SUN, -3));
    data = saveDay(updateDraft(data, SUN, { run: run({ distanceKm: 1, durationSec: 400, continuous: true }) }, SUN), SUN, SUN, 'x');
    const t = timeline(data, addDays(SUN, 2));
    const s = computeStatistics(t);
    expect(s).toMatchObject({ completed: 0, partial: 1, absent: 1 });
    expect(s.records.bestPush?.reps).toBe(0);
    expect(s.records.best5k).toBeNull();
    expect(s.levels.running).toBe('2.75 كم متواصلة');
  });
});
