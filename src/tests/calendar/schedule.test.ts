import { describe, expect, it } from 'vitest';
import { addDays, msUntilNextMidnight, todayKey, weekday } from '../../domain/calendar/dateUtils';
import { dayView, projectPlan, replay } from '../../domain/calendar/scheduleEngine';
import {
  PermissionError,
  editPermission,
  endPause,
  saveDay,
  startPause,
  submitPlacement,
  updateDraft,
} from '../../domain/program/commands';
import type { ProgramData } from '../../domain/program/types';
import { trainingWeeksSince } from '../../domain/training/reviewEngine';
import { FRI, MON, SAT, SUN, THU, TUE, TYPICAL, WED, placement, plan, run, start, successEntries, timeline, withDay } from '../helpers';

describe('Kuwait calendar', () => {
  it('uses Asia/Kuwait, not UTC, to decide the date', () => {
    // 2026-11-01 22:30 UTC is already 01:30 on 2 Nov in Kuwait.
    expect(todayKey(new Date('2026-11-01T22:30:00Z'))).toBe('2026-11-02');
    expect(todayKey(new Date('2026-11-01T20:59:00Z'))).toBe('2026-11-01');
    expect(msUntilNextMidnight(new Date('2026-11-01T20:00:00Z'))).toBe(3600_000);
  });

  it('week runs Sunday to Saturday with Friday/Saturday rest', () => {
    expect(weekday(SUN)).toBe(0);
    expect(weekday(SAT)).toBe(6);
  });
});

describe('first run', () => {
  it('days before the program never count as absences and the start day is not an absence', () => {
    const data = start(WED);
    const t = timeline(data, addDays(WED, 1));
    expect(dayView(t, TUE).when).toBe('before');
    expect(t.days.get(WED)!.status).toBe('start');
    expect(t.calendar.absenceRun).toBe(0);
  });

  it('starting builds the schedule from the recorded levels', () => {
    const t = timeline(start(SUN), SUN);
    const p = plan(t, SUN);
    expect(p.kind).toBe('main');
    if (p.kind !== 'main') return;
    expect(p.run?.code).toBe('2.75 كم');
    expect(p.push?.code).toBe('بالركب 4×8');
    expect(p.sit?.sets).toEqual([14, 10, 10]);
  });
});

describe('editing rules', () => {
  const data = start(SUN);

  it('today accepts results and can be re-saved', () => {
    let d = updateDraft(data, MON, { lightDone: true }, MON);
    d = saveDay(d, MON, MON, 'now');
    d = updateDraft(d, MON, { lightDone: false }, MON);
    d = saveDay(d, MON, MON, 'later');
    expect(d.days[MON]!.saved).toEqual({ lightDone: false });
  });

  it('yesterday is read-only in logic, not just in the UI', () => {
    const t = timeline(data, MON);
    expect(editPermission(t, SUN)).toBe('past');
    expect(() => updateDraft(data, SUN, { lightDone: true }, MON)).toThrow(PermissionError);
    expect(() => saveDay(withDay(data, SUN, {}), SUN, MON, 'x')).toThrow(PermissionError);
  });

  it('future days are view-only', () => {
    const t = timeline(data, SUN);
    expect(editPermission(t, MON)).toBe('future');
    expect(() => updateDraft(data, MON, { lightDone: true }, SUN)).toThrow(PermissionError);
  });

  it('at midnight today becomes yesterday and locks', () => {
    const d = updateDraft(data, SUN, successEntries(plan(timeline(data, SUN), SUN)), SUN);
    expect(editPermission(timeline(d, SUN), SUN)).toBe('editable');
    expect(editPermission(timeline(d, MON), SUN)).toBe('past');
  });
});

describe('automatic absence', () => {
  it('Sunday not logged → absence once, Monday shows the same session', () => {
    const data = start(addDays(SUN, -3)); // started the Thursday before
    const t = timeline(data, MON);
    expect(t.days.get(SUN)!.status).toBe('absent');
    expect(t.calendar.absenceRun).toBe(1);
    expect(plan(t, MON)).toEqual(plan(t, SUN));
    // Re-opening the app any number of times derives the same single absence.
    expect(timeline(data, MON).calendar.absenceRun).toBe(1);
    const tue = timeline(data, TUE);
    expect([...tue.days.values()].filter((d) => d.status === 'absent')).toHaveLength(2);
  });

  it('after Monday’s main session Tuesday is light, never two hard runs in a row', () => {
    let data = start(addDays(SUN, -3));
    data = withDay(data, MON, successEntries(plan(timeline(data, MON), MON)));
    const t = timeline(data, TUE);
    expect(t.days.get(MON)!.status).toBe('complete');
    expect(plan(t, TUE).kind).toBe('light');
  });

  it('Friday and Saturday do not increase the absence count', () => {
    const data = start(addDays(SUN, -7)); // previous Sunday
    let d = data;
    for (let i = -7; i <= -5; i++) {
      const day = addDays(SUN, i);
      d = withDay(d, day, successEntries(plan(timeline(d, day), day)));
    }
    // previous Wed, Thu missed; Fri, Sat rest; Sunday missed → 3 training days
    const t = timeline(d, MON);
    expect(t.days.get(addDays(SUN, -2))!.status).toBe('rest');
    expect(t.days.get(addDays(SUN, -1))!.status).toBe('rest');
    expect(t.calendar.absenceRun).toBe(3);
  });

  it('3 days → back one lesson, 4 → two in total, 5 → new placement form', () => {
    // Start on a Sunday with ض5 push-ups so steps back are visible.
    const data = start(SUN, placement({ push: { rounds: [{ normal: 5, assisted: 5 }, { normal: 2, assisted: 8 }, { normal: 2, assisted: 8 }, { normal: 2, assisted: 8 }] }, sit: { best: 20 } }));
    const base = timeline(data, SUN).state.pushups.position;
    expect(base).toEqual({ phase: 'transition', stage: 4 });

    const after = (days: number) => timeline(data, addDays(SUN, days));
    // Sunday is the start day (grace); Mon, Tue missed → 2
    expect(after(3).state.pushups.position).toEqual(base);
    // Wed missed → 3 → −1
    expect(after(4).state.pushups.position).toEqual({ phase: 'transition', stage: 3 });
    expect(after(4).days.get(THU)!.notes.join()).toContain('غياب 3 أيام');
    // Thu missed → 4 → −2 in total (not −3)
    expect(after(7).state.pushups.position).toEqual({ phase: 'transition', stage: 2 });
    // next Sunday missed → 5 → placement required
    const t5 = after(8);
    expect(t5.calendar.placementRequired).toBe(true);
    expect(plan(t5, addDays(SUN, 8)).kind).toBe('placementRequired');
  });

  it('returning resets the absence count; a new placement clears the requirement', () => {
    const data = start(SUN);
    const day8 = addDays(SUN, 8);
    const placed = submitPlacement(data, TYPICAL, day8);
    const t = timeline(placed, day8);
    expect(t.calendar.placementRequired).toBe(false);
    expect(plan(t, day8).kind).toBe('main');
    expect(t.calendar.absenceRun).toBe(0);
  });
});

describe('partial days', () => {
  it('run done and sit-ups missing → partial, run kept, sit-ups still pending, no absence', () => {
    let data = start(addDays(SUN, -3));
    const sunPlan = plan(timeline(data, SUN), SUN);
    const ok = successEntries(sunPlan);
    data = withDay(data, SUN, { run: ok.run });
    const t = timeline(data, MON);
    const sun = t.days.get(SUN)!;
    expect(sun.status).toBe('partial');
    expect(sun.evaluations).toEqual({ running: 'success' });
    expect(t.calendar.absenceRun).toBe(0);
    expect(t.state.situps).toEqual(sun.levels.situps);
    // Next main session shows the same sit-up lesson, no doubled load.
    const tue = projectPlan(t, TUE);
    if (sunPlan.kind === 'main' && tue.kind === 'main') expect(tue.sit).toEqual(sunPlan.sit);
  });
});

describe('editing today', () => {
  it('re-saving today recomputes without counting the same day twice', () => {
    let data = start(addDays(SUN, -3));
    const ok = successEntries(plan(timeline(data, SUN), SUN));
    data = updateDraft(data, SUN, ok, SUN);
    data = saveDay(data, SUN, SUN, 'a');
    data = saveDay(data, SUN, SUN, 'b');
    data = saveDay(data, SUN, SUN, 'c');
    const t = timeline(data, SUN);
    expect(t.state.pushups.streak).toBe(1);
    expect(t.state.situps.streak).toBe(1);
  });

  it('changing a saved result updates records and progress', () => {
    let data = start(addDays(SUN, -3));
    const p = plan(timeline(data, SUN), SUN);
    if (p.kind !== 'main') throw new Error();
    const sitWith = (n: number) => ({ ...successEntries(p), sit: { sets: [n, 10, 10], effort: null, pain: false } });
    data = saveDay(updateDraft(data, SUN, sitWith(30), SUN), SUN, SUN, 'a');
    expect(timeline(data, SUN).records.bestSit?.reps).toBe(30);
    data = saveDay(updateDraft(data, SUN, sitWith(20), SUN), SUN, SUN, 'b');
    expect(timeline(data, SUN).records.bestSit?.reps).toBe(20);
  });

  it('a run edit never moves push-ups or sit-ups', () => {
    let data = start(addDays(SUN, -3));
    const p = plan(timeline(data, SUN), SUN);
    const before = timeline(data, SUN).state;
    data = saveDay(updateDraft(data, SUN, { run: successEntries(p).run }, SUN), SUN, SUN, 'a');
    const after = timeline(data, SUN).state;
    expect(after.pushups).toEqual(before.pushups);
    expect(after.situps).toEqual(before.situps);
  });

  it('unsaved draft does not move today’s progress, but counts once the day closes', () => {
    let data = start(addDays(SUN, -3));
    data = updateDraft(data, SUN, successEntries(plan(timeline(data, SUN), SUN)), SUN);
    expect(timeline(data, SUN).days.get(SUN)!.status).toBe('pending');
    expect(timeline(data, MON).days.get(SUN)!.status).toBe('complete');
  });
});

/** Attends every training day with exactly the prescribed work. */
function attendEverything(data: ProgramData, from: string, days: number): ProgramData {
  let d = data;
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    const p = plan(timeline(d, day), day);
    if (p.kind === 'main' || p.kind === 'light') d = withDay(d, day, successEntries(p));
    if (p.kind === 'review' && !p.submitted) d = submitPlacement(d, TYPICAL, day);
  }
  return d;
}

describe('periodic review', () => {
  it('appears once after four training weeks, on a Sunday, replacing the session', () => {
    const data = attendEverything(start(SUN), SUN, 57);
    const t = timeline(data, addDays(SUN, 56));
    const reviews = [...t.days.values()].filter((d) => d.plan.kind === 'review');
    expect(reviews.map((r) => r.date)).toEqual([addDays(SUN, 28), addDays(SUN, 56)]);
    expect(reviews.every((r) => weekday(r.date) === 0)).toBe(true);
  });

  it('is postponed to the Sunday after a health pause', () => {
    const due = addDays(SUN, 28);
    let data = attendEverything(start(SUN), SUN, 28);
    data = startPause(data, due);
    data = endPause(data, addDays(due, 1));
    data = attendEverything(data, addDays(due, 1), 8);
    const t = timeline(data, addDays(SUN, 36));
    expect(t.days.get(due)!.status).toBe('paused');
    const reviews = [...t.days.values()].filter((d) => d.plan.kind === 'review');
    expect(reviews.map((r) => r.date)).toEqual([addDays(SUN, 35)]);
  });

  it('a fully paused training week is not counted', () => {
    // Pausing Sun–Thu needs a new placement, which restarts the four-week count anyway;
    // the counter itself must still skip that week.
    const paused = new Set([0, 1, 2, 3, 4].map((i) => addDays(SUN, 7 + i)));
    expect(trainingWeeksSince(SUN, addDays(SUN, 35), (d) => paused.has(d))).toBe(4);
    expect(trainingWeeksSince(SUN, addDays(SUN, 35), () => false)).toBe(5);
  });

  it('a 5-absence placement and a due review never show as two forms', () => {
    const t = timeline(start(SUN), addDays(SUN, 28));
    const p = plan(t, addDays(SUN, 28));
    expect(p.kind).toBe('placementRequired');
  });

  it('review results move forward at most two steps and restart streaks', () => {
    let data = attendEverything(start(SUN), SUN, 28);
    const sunday = addDays(SUN, 28);
    const before = timeline(data, sunday).state;
    expect(plan(timeline(data, sunday), sunday)).toEqual({ kind: 'review', submitted: false });
    data = submitPlacement(data, placement({ sit: { best: 60 } }), sunday);
    const t = timeline(data, sunday);
    expect(before.situps.position.phase).toBe('endurance');
    const main = (p: typeof t.state.situps.position) => (p.phase === 'endurance' ? p.main : NaN);
    expect(main(t.state.situps.position) - main(before.situps.position)).toBeLessThanOrEqual(4);
    expect(t.state.situps.streak).toBe(0);
    // Tracks with no new numbers keep their place.
    expect(t.state.pushups.position).toEqual(before.pushups.position);
    expect(t.days.get(sunday)!.status).toBe('assessment');
  });

  it('a clearly weaker review goes back as far as needed, and keeps past bests', () => {
    let data = attendEverything(start(SUN), SUN, 28);
    const sunday = addDays(SUN, 28);
    const bestBefore = timeline(data, sunday).records.bestSit!.reps;
    data = submitPlacement(data, placement({ sit: { best: 5 } }), sunday);
    const t = timeline(data, sunday);
    expect(t.state.situps.position).toEqual({ phase: 'endurance', main: 3 });
    expect(t.records.bestSit!.reps).toBe(bestBefore);
  });
});

describe('health pause', () => {
  it('pause days are not absences; a long pause asks for a new placement', () => {
    let data = start(SUN);
    data = startPause(data, MON);
    const t = timeline(data, addDays(SUN, 9));
    expect(t.days.get(TUE)!.status).toBe('paused');
    expect(t.calendar.absenceRun).toBe(0);
    data = endPause(data, addDays(SUN, 9));
    expect(plan(timeline(data, addDays(SUN, 9)), addDays(SUN, 9)).kind).toBe('placementRequired');
  });

  it('cannot start a pause on a day that already has saved results', () => {
    let data = start(SUN);
    data = saveDay(updateDraft(data, SUN, { run: run({ intervalsDone: 1, distanceKm: 1 }) }, SUN), SUN, SUN, 'x');
    expect(() => startPause(data, SUN)).toThrow(PermissionError);
  });
});

describe('future days', () => {
  it('viewing future days never changes progress or history', () => {
    const data = start(addDays(SUN, -3));
    const t = timeline(data, SUN);
    const snapshot = JSON.stringify({ s: t.state, c: t.calendar, r: t.records, d: [...t.days.entries()] });
    for (let i = 1; i < 40; i++) dayView(t, addDays(SUN, i));
    expect(JSON.stringify({ s: t.state, c: t.calendar, r: t.records, d: [...t.days.entries()] })).toBe(snapshot);
  });

  it('the projected week alternates main and light days and rests on Fri/Sat', () => {
    const t = timeline(start(SUN), SUN);
    const kinds = [MON, TUE, WED, THU, FRI, SAT].map((d) => projectPlan(t, d).kind);
    expect(kinds).toEqual(['light', 'main', 'light', 'main', 'rest', 'rest']);
  });

  it('the build rotation advances in projections: easy → short → key', () => {
    const t = timeline(start(SUN), SUN);
    const runKind = (d: string) => {
      const p = projectPlan(t, d);
      return p.kind === 'main' ? p.run?.kind : p.kind;
    };
    expect([plan(t, SUN), projectPlan(t, TUE), projectPlan(t, THU)].map((p) => (p.kind === 'main' ? p.run?.kind : p.kind))).toEqual([
      'buildEasy',
      'buildShort',
      'buildKey',
    ]);
    expect(runKind(addDays(SUN, 7))).toBe('buildEasy');
  });

  it('replay returns null before the program starts', () => {
    expect(replay({ events: [], days: {} }, SUN)).toBeNull();
  });
});
