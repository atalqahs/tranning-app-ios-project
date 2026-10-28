import { addDays, type DateKey } from '../domain/calendar/dateUtils';
import { replay } from '../domain/calendar/scheduleEngine';
import { emptyProgram, startProgram } from '../domain/program/commands';
import type { DayPlan, ProgramData, Timeline } from '../domain/program/types';
import type { DayEntries, PlacementInput, PushSetEntry, RunEntry } from '../domain/training/types';

/** 2026-11-01 is a Sunday. */
export const SUN = '2026-11-01';
export const MON = addDays(SUN, 1);
export const TUE = addDays(SUN, 2);
export const WED = addDays(SUN, 3);
export const THU = addDays(SUN, 4);
export const FRI = addDays(SUN, 5);
export const SAT = addDays(SUN, 6);

export function placement(over: {
  run?: Partial<PlacementInput['run']>;
  push?: Partial<PlacementInput['push']>;
  sit?: Partial<PlacementInput['sit']>;
} = {}): PlacementInput {
  return {
    run: {
      distanceKm: null,
      durationSec: null,
      continuous: null,
      longestContinuousMin: null,
      first5kSec: null,
      note: '',
      ...over.run,
    },
    push: {
      assisted: 'knee',
      rounds: Array.from({ length: 4 }, () => ({ normal: null, assisted: null })),
      ...over.push,
    },
    sit: { best: null, ...over.sit },
  };
}

/** A typical starting profile: 3 km in 17:00 continuous, 4×10 knees, 20 sit-ups. */
export const TYPICAL = placement({
  run: { distanceKm: 3, durationSec: 17 * 60, continuous: true },
  push: { rounds: Array.from({ length: 4 }, () => ({ normal: 0, assisted: 10 })) },
  sit: { best: 20 },
});

export function run(over: Partial<RunEntry>): RunEntry {
  return {
    intervalsDone: null,
    distanceKm: null,
    durationSec: null,
    continuous: false,
    first5kSec: null,
    effort: null,
    pain: false,
    ...over,
  };
}

export const sets = (pairs: [number | null, number | null][]): PushSetEntry[] =>
  pairs.map(([normal, assisted]) => ({ normal, assisted }));

export function start(date: DateKey, input: PlacementInput = TYPICAL): ProgramData {
  return startProgram(emptyProgram(), input, date);
}

/** Writes a closed or saved day directly (bypasses the "today only" rule on purpose, to build history). */
export function withDay(data: ProgramData, date: DateKey, entries: DayEntries): ProgramData {
  return { ...data, days: { ...data.days, [date]: { draft: entries, saved: entries, savedAt: 'x' } } };
}

/** Entries that exactly meet a main-day plan (or tick a light day). */
export function successEntries(plan: DayPlan): DayEntries {
  if (plan.kind === 'light') return { lightDone: true };
  if (plan.kind !== 'main') return {};
  const e: DayEntries = {};
  if (plan.run) {
    const rx = plan.run;
    e.run = run({
      intervalsDone: rx.rounds ?? null,
      durationSec: (rx.minMinutes ?? 30) * 60,
      distanceKm: rx.targetKm ?? 3,
      continuous: true,
    });
  }
  if (plan.push) e.push = { sets: plan.push.sets.map((s) => ({ normal: s.normalMin, assisted: s.total - s.normalMin })), effort: 6, pain: false };
  if (plan.sit) e.sit = { sets: [...plan.sit.sets], effort: 6, pain: false };
  return e;
}

export function timeline(data: ProgramData, today: DateKey): Timeline {
  const t = replay(data, today);
  if (!t) throw new Error('program not started');
  return t;
}

export function plan(t: Timeline, date: DateKey): DayPlan {
  const rec = t.days.get(date);
  if (!rec) throw new Error(`no record for ${date}`);
  return rec.plan;
}
