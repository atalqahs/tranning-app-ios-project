/**
 * Deterministic replay of the program.
 *
 * Only facts are stored (placements, pauses, per-day inputs). Every plan,
 * status, absence, level and record is re-derived here from the start date
 * to today, so:
 * - editing today's results re-computes everything without counting twice
 * - a missed day is derived, never written, so it cannot be recorded twice
 * - closed days use their inputs as they stood at midnight (they are read-only)
 */
import { emptyRecords, isGoalReached, recordPush, recordRun, recordSit } from '../progress/records';
import type { Records } from '../progress/types';
import type { CalendarState, DayPlan, DayRecord, DayStatus, ProgramData, ProgramEvent, Timeline } from '../program/types';
import { placeAll } from '../training/placementEngine';
import { applyPushResult, applyRunResult, applySitResult } from '../training/progressionEngine';
import { bestStrictSet, prescribePush } from '../training/pushupPlan';
import { REVIEW_EVERY_WEEKS, applyReview, trainingWeeksSince } from '../training/reviewEngine';
import { asksContinuous, nextRunCycle, prescribeRun, usesRunCycle } from '../training/runningPlan';
import { bestFullSitSet, prescribeSit } from '../training/situpPlan';
import { TRACKS, type DayEntries, type PlacementInput, type TrackId, type TrainingState } from '../training/types';
import { absenceAction, resumeAction, stepBackAll } from './absenceEngine';
import { addDays, diffDays, isSunday, isTrainingDay, weekStart, type DateKey } from './dateUtils';

const MAX_PROJECTION_DAYS = 400;

export function initialPlacement(data: ProgramData): Extract<ProgramEvent, { kind: 'placement' }> | null {
  for (const e of data.events) {
    if (e.kind === 'placement' && e.reason === 'initial') return e;
  }
  return null;
}

function recordPlacement(records: Records, date: DateKey, input: PlacementInput): Records {
  let r = recordRun(records, date, input.run);
  r = recordPush(r, date, bestStrictSet(input.push.rounds));
  return recordSit(r, date, input.sit.best);
}

/** A goal reached by a real result moves that track (only that track) to maintenance. */
function applyGoals(state: TrainingState, records: Records): { state: TrainingState; reached: TrackId[] } {
  const reached = TRACKS.filter((t) => isGoalReached(records, t) && state[t].position.phase !== 'maintain');
  if (!reached.length) return { state, reached };
  const next = structuredClone(state);
  if (reached.includes('running')) next.running = { position: { phase: 'maintain' }, streak: 0, cycle: 0 };
  if (reached.includes('pushups')) next.pushups = { position: { phase: 'maintain' }, streak: 0 };
  if (reached.includes('situps')) next.situps = { position: { phase: 'maintain' }, streak: 0 };
  return { state: next, reached };
}

function isReviewDue(d: DateKey, cal: CalendarState, pausedDates: Set<DateKey>): boolean {
  return (
    isSunday(d) &&
    !cal.paused &&
    !cal.placementRequired &&
    !cal.reviewPending &&
    trainingWeeksSince(cal.lastPlacement, d, (x) => pausedDates.has(x)) >= REVIEW_EVERY_WEEKS
  );
}

/** What a date asks for, given the state at its start. Pure. */
export function planFor(d: DateKey, state: TrainingState, cal: CalendarState, reviewSubmitted: boolean): DayPlan {
  if (!isTrainingDay(d)) return { kind: 'rest' };
  if (cal.paused) return { kind: 'paused' };
  if (cal.placementRequired) return { kind: 'placementRequired' };
  if (reviewSubmitted) return { kind: 'review', submitted: true };
  if (cal.reviewPending) return { kind: 'review', submitted: false };
  // Never two main sessions on consecutive days: a light day follows any main day that happened.
  if (cal.prevDayMain) return { kind: 'light' };

  const week = weekStart(d);
  const maintenanceDone: TrackId[] = [];
  const skip = (t: TrackId) => {
    const done = state[t].position.phase === 'maintain' && cal.maintenanceWeek[t] === week;
    if (done) maintenanceDone.push(t);
    return done;
  };
  const run = skip('running') ? null : prescribeRun(state.running.position, state.running.cycle);
  const push = skip('pushups') ? null : prescribePush(state.pushups.position);
  const sit = skip('situps') ? null : prescribeSit(state.situps.position);
  if (!run && !push && !sit) return { kind: 'light' };
  return { kind: 'main', run, push, sit, maintenanceDone };
}

function statusFor(
  plan: DayPlan,
  hadResults: boolean,
  allSucceeded: boolean,
  assessed: boolean,
  isPast: boolean,
  isStart: boolean,
): DayStatus {
  switch (plan.kind) {
    case 'rest':
      return 'rest';
    case 'paused':
      return 'paused';
    case 'beforeProgram':
      return 'beforeProgram';
    default:
      break;
  }
  if (hadResults) return allSucceeded ? 'complete' : 'partial';
  if (assessed) return 'assessment';
  if (!isPast) return 'pending';
  return isStart ? 'start' : 'absent';
}

function newCalendar(start: DateKey): CalendarState {
  return {
    absenceRun: 0,
    anchor: null,
    placementRequired: false,
    paused: false,
    pausedTrainingDays: 0,
    lastPlacement: start,
    reviewPending: false,
    prevDayMain: false,
    maintenanceWeek: {},
    carryNotes: [],
  };
}

function eventsByDate(events: ProgramEvent[], initial: ProgramEvent): Map<DateKey, ProgramEvent[]> {
  const map = new Map<DateKey, ProgramEvent[]>();
  for (const e of events) {
    if (e === initial) continue;
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }
  return map;
}

function streaksOf(state: TrainingState): Record<TrackId, number> {
  return { running: state.running.streak, pushups: state.pushups.streak, situps: state.situps.streak };
}

export function replay(data: ProgramData, today: DateKey): Timeline | null {
  const initial = initialPlacement(data);
  if (!initial) return null;
  const startDate = initial.date;

  let records = recordPlacement(emptyRecords(), startDate, initial.input);
  let state = applyGoals(placeAll(initial.input), records).state;
  const cal = newCalendar(startDate);
  const pausedDates = new Set<DateKey>();
  const days = new Map<DateKey, DayRecord>();
  const byDate = eventsByDate(data.events, initial);
  let progressions = 0;

  for (let d = startDate; diffDays(d, today) >= 0; d = addDays(d, 1)) {
    const isPast = diffDays(d, today) > 0;
    const notes = cal.carryNotes;
    cal.carryNotes = [];
    const outcomes: DayRecord['outcomes'] = {};
    const dayEvents = byDate.get(d) ?? [];

    // 1. Health pause transitions.
    for (const e of dayEvents) {
      if (e.kind === 'pauseEnd' && cal.paused) {
        const action = resumeAction(cal.pausedTrainingDays);
        cal.paused = false;
        cal.pausedTrainingDays = 0;
        notes.push(action.note);
        if (action.kind === 'placement') {
          cal.placementRequired = true;
          cal.reviewPending = false;
        } else if (action.kind === 'stepBack') {
          state = stepBackAll(state, action.steps);
        }
      } else if (e.kind === 'pauseStart' && !cal.paused) {
        cal.paused = true;
        cal.pausedTrainingDays = 0;
        notes.push('توقف صحي — الخطة مجمّدة');
      }
    }
    if (cal.paused) pausedDates.add(d);

    // 2. Periodic review, shown on the Sunday after four training weeks.
    if (isReviewDue(d, cal, pausedDates)) {
      cal.reviewPending = true;
      notes.push('مرت 4 أسابيع تدريبية — اختبار مراجعة المستوى بدل حصة اليوم');
    }

    // 3. Placement forms submitted on this date.
    let assessed = false;
    let reviewSubmitted = false;
    for (const e of dayEvents) {
      if (e.kind !== 'placement' || cal.paused) continue;
      records = recordPlacement(records, d, e.input);
      if (e.reason === 'review') {
        const review = applyReview(state, e.input);
        state = review.state;
        progressions += review.forwardSteps;
        Object.assign(outcomes, review.notes);
        reviewSubmitted = true;
      } else {
        state = placeAll(e.input);
        notes.push('تحديد مستوى جديد — نقطة بداية جديدة لكل تمرين');
      }
      state = applyGoals(state, records).state;
      cal.lastPlacement = d;
      cal.reviewPending = false;
      cal.placementRequired = false;
      cal.absenceRun = 0;
      cal.anchor = null;
      assessed = true;
    }

    // 4. The day's plan from the state at its start.
    const levels = structuredClone(state);
    const plan = planFor(d, state, cal, reviewSubmitted);

    // 5. Results: closed days use their last inputs; today uses what was saved.
    const log = data.days[d];
    const entries: DayEntries | null = log ? (isPast ? log.draft : log.saved) : null;
    const evaluations: DayRecord['evaluations'] = {};
    let hadResults = false;
    let allSucceeded = true;

    if (plan.kind === 'main' && entries) {
      const week = weekStart(d);
      if (plan.run) {
        const o = applyRunResult(state.running, plan.run, entries.run);
        if (o && entries.run) {
          state = { ...state, running: o.track };
          evaluations.running = o.evaluation;
          outcomes.running = o.note;
          progressions += o.advanced ? 1 : 0;
          if (plan.run.kind === 'maintain') cal.maintenanceWeek.running = week;
          records = recordRun(records, d, {
            ...entries.run,
            continuous: asksContinuous(plan.run) && entries.run.continuous,
          });
        }
      }
      if (plan.push) {
        const o = applyPushResult(state.pushups, plan.push, entries.push);
        if (o && entries.push) {
          state = { ...state, pushups: o.track };
          evaluations.pushups = o.evaluation;
          outcomes.pushups = o.note;
          progressions += o.advanced ? 1 : 0;
          if (plan.push.kind === 'maintain') cal.maintenanceWeek.pushups = week;
          records = recordPush(records, d, bestStrictSet(entries.push.sets.slice(0, plan.push.sets.length)));
        }
      }
      if (plan.sit) {
        const o = applySitResult(state.situps, plan.sit, entries.sit);
        if (o && entries.sit) {
          state = { ...state, situps: o.track };
          evaluations.situps = o.evaluation;
          outcomes.situps = o.note;
          progressions += o.advanced ? 1 : 0;
          if (plan.sit.kind === 'maintain') cal.maintenanceWeek.situps = week;
          records = recordSit(records, d, bestFullSitSet(plan.sit, { ...entries.sit, sets: entries.sit.sets.slice(0, plan.sit.sets.length) }));
        }
      }
      const prescribed = TRACKS.filter((t) => (t === 'running' ? plan.run : t === 'pushups' ? plan.push : plan.sit));
      hadResults = Object.keys(evaluations).length > 0;
      allSucceeded = prescribed.every((t) => evaluations[t] === 'success');
      const goals = applyGoals(state, records);
      state = goals.state;
      for (const t of goals.reached) outcomes[t] = 'تحقق الهدف — ننتقل إلى المحافظة';
    } else if (plan.kind === 'light' && entries?.lightDone) {
      hadResults = true;
    }

    const status = statusFor(plan, hadResults, allSucceeded, assessed, isPast, d === startDate);
    days.set(d, { date: d, plan, status, entries, evaluations, notes, outcomes, levels, streaks: streaksOf(levels) });

    // 6. Closing a past day: absences are counted only on scheduled days outside a pause.
    if (isPast) {
      if (isTrainingDay(d) && !cal.paused) {
        if (hadResults || assessed) {
          cal.absenceRun = 0;
          cal.anchor = null;
        } else if (d !== startDate) {
          if (cal.absenceRun === 0) cal.anchor = structuredClone(state);
          cal.absenceRun += 1;
          const action = absenceAction(cal.absenceRun, cal.anchor!);
          if (action.kind === 'stepBack') {
            state = action.state;
            cal.carryNotes.push(action.note);
          } else if (action.kind === 'placement' && !cal.placementRequired) {
            cal.placementRequired = true;
            cal.reviewPending = false;
            cal.carryNotes.push(action.note);
          }
        }
      }
      if (cal.paused && isTrainingDay(d)) cal.pausedTrainingDays += 1;
      cal.prevDayMain = plan.kind === 'main' && hadResults;
    }
  }

  return { startDate, today, days, state, calendar: cal, pausedDates, records, progressions };
}

/**
 * Expected plan for a future date: assumes every day until then is attended
 * and completed as planned, without inventing level-ups. Never mutates the timeline.
 */
export function projectPlan(t: Timeline, date: DateKey): DayPlan {
  const state = structuredClone(t.state);
  const cal = structuredClone(t.calendar);
  const pausedDates = new Set(t.pausedDates);

  const assumeDone = (d: DateKey, plan: DayPlan) => {
    if (plan.kind === 'main') {
      cal.prevDayMain = true;
      const week = weekStart(d);
      if (plan.run && usesRunCycle(state.running.position)) state.running.cycle = nextRunCycle(state.running.cycle);
      if (plan.run?.kind === 'maintain') cal.maintenanceWeek.running = week;
      if (plan.push?.kind === 'maintain') cal.maintenanceWeek.pushups = week;
      if (plan.sit?.kind === 'maintain') cal.maintenanceWeek.situps = week;
    } else {
      cal.prevDayMain = false;
      if (plan.kind === 'review' || plan.kind === 'placementRequired') {
        cal.reviewPending = false;
        cal.placementRequired = false;
        cal.lastPlacement = d;
      }
    }
  };

  const today = t.days.get(t.today);
  if (today) {
    if (today.plan.kind === 'main') {
      // Only the parts not yet done today are assumed done.
      const remaining: DayPlan = { ...today.plan, run: today.evaluations.running ? null : today.plan.run };
      assumeDone(t.today, remaining);
      // A track that already got its result today has its cycle updated in `state`.
    } else if (today.plan.kind !== 'review' || !today.plan.submitted) {
      assumeDone(t.today, today.plan);
    } else {
      cal.prevDayMain = false;
    }
  }

  let d = addDays(t.today, 1);
  for (let i = 0; i < MAX_PROJECTION_DAYS; i++, d = addDays(d, 1)) {
    if (cal.paused) pausedDates.add(d);
    if (isReviewDue(d, cal, pausedDates)) cal.reviewPending = true;
    const plan = planFor(d, state, cal, false);
    if (d === date) return plan;
    if (!isTrainingDay(d)) {
      cal.prevDayMain = false;
      continue;
    }
    if (cal.paused) continue;
    assumeDone(d, plan);
  }
  return { kind: 'rest' };
}

export type DayView =
  | { when: 'before'; plan: DayPlan }
  | { when: 'past' | 'today'; record: DayRecord; plan: DayPlan }
  | { when: 'future'; plan: DayPlan };

export function dayView(t: Timeline, date: DateKey): DayView {
  if (diffDays(t.startDate, date) < 0) return { when: 'before', plan: { kind: 'beforeProgram' } };
  const offset = diffDays(t.today, date);
  if (offset > 0) return { when: 'future', plan: projectPlan(t, date) };
  const record = t.days.get(date);
  if (!record) return { when: 'before', plan: { kind: 'beforeProgram' } };
  return { when: offset === 0 ? 'today' : 'past', record, plan: record.plan };
}
