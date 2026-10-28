/**
 * The only operations that change program data. Each one checks the date
 * rules itself, so a hidden button is never the only protection:
 * - only today can receive results; past days are read-only, future days view-only
 * - placement forms are accepted only when the plan asks for one today
 */
import { diffDays, type DateKey } from '../calendar/dateUtils';
import { initialPlacement, replay } from '../calendar/scheduleEngine';
import { hasPushData } from '../training/pushupPlan';
import { hasRunData } from '../training/runningPlan';
import { hasSitData } from '../training/situpPlan';
import type { DayEntries, PlacementInput } from '../training/types';
import type { DayLog, PlacementReason, ProgramData, Timeline } from './types';

export class PermissionError extends Error {}

export function emptyProgram(): ProgramData {
  return { events: [], days: {} };
}

export function hasRealResults(entries: DayEntries | null | undefined): boolean {
  if (!entries) return false;
  return hasRunData(entries.run) || hasPushData(entries.push) || hasSitData(entries.sit) || entries.lightDone === true;
}

/** Today's inputs differ from what was last saved. */
export function hasUnsavedChanges(log: DayLog | undefined): boolean {
  if (!log) return false;
  if (!log.saved) return hasRealResults(log.draft);
  return JSON.stringify(log.draft) !== JSON.stringify(log.saved);
}

export type EditPermission = 'editable' | 'past' | 'future' | 'notTrainingInput' | 'notStarted';

/** Whether results can be entered for `date`. */
export function editPermission(t: Timeline | null, date: DateKey): EditPermission {
  if (!t) return 'notStarted';
  const offset = diffDays(t.today, date);
  if (offset < 0) return 'past';
  if (offset > 0) return 'future';
  const plan = t.days.get(date)?.plan;
  return plan && (plan.kind === 'main' || plan.kind === 'light') ? 'editable' : 'notTrainingInput';
}

export function startProgram(data: ProgramData, input: PlacementInput, today: DateKey): ProgramData {
  if (initialPlacement(data)) throw new PermissionError('البرنامج بدأ بالفعل');
  return { events: [{ kind: 'placement', date: today, reason: 'initial', input }], days: {} };
}

/** Which form today's plan is waiting for, if any. */
export function pendingPlacementReason(t: Timeline | null): PlacementReason | null {
  if (!t) return null;
  const plan = t.days.get(t.today)?.plan;
  if (plan?.kind === 'placementRequired') return 'absence';
  if (plan?.kind === 'review' && !plan.submitted) return 'review';
  return null;
}

export function submitPlacement(data: ProgramData, input: PlacementInput, today: DateKey): ProgramData {
  const t = replay(data, today);
  const reason = pendingPlacementReason(t);
  if (!reason) throw new PermissionError('لا يوجد اختبار مستوى مطلوب اليوم');
  return { ...data, events: [...data.events, { kind: 'placement', date: today, reason, input }] };
}

/** Autosave of today's inputs. */
export function updateDraft(data: ProgramData, date: DateKey, entries: DayEntries, today: DateKey): ProgramData {
  if (editPermission(replay(data, today), date) !== 'editable') {
    throw new PermissionError('لا يمكن تعديل نتائج هذا اليوم');
  }
  const log = data.days[date] ?? { draft: {}, saved: null, savedAt: null };
  return { ...data, days: { ...data.days, [date]: { ...log, draft: entries } } };
}

/** Saves (or re-saves) today's results; the replay then recomputes progress. */
export function saveDay(data: ProgramData, date: DateKey, today: DateKey, nowIso: string): ProgramData {
  if (editPermission(replay(data, today), date) !== 'editable') {
    throw new PermissionError('لا يمكن حفظ نتائج هذا اليوم');
  }
  const log = data.days[date];
  if (!log) throw new PermissionError('لا توجد نتائج لحفظها');
  return { ...data, days: { ...data.days, [date]: { ...log, saved: structuredClone(log.draft), savedAt: nowIso } } };
}

export function isPausedToday(t: Timeline | null): boolean {
  return t?.calendar.paused === true;
}

export function startPause(data: ProgramData, today: DateKey): ProgramData {
  const t = replay(data, today);
  if (!t || t.calendar.paused) throw new PermissionError('لا يمكن بدء التوقف الآن');
  if (hasRealResults(t.days.get(today)?.entries)) {
    throw new PermissionError('سجّلت نتائج اليوم؛ يمكنك بدء التوقف الصحي غدًا');
  }
  return { ...data, events: [...data.events, { kind: 'pauseStart', date: today }] };
}

export function endPause(data: ProgramData, today: DateKey): ProgramData {
  const t = replay(data, today);
  if (!t || !t.calendar.paused) throw new PermissionError('لا يوجد توقف صحي');
  const startedToday = data.events.findIndex((e) => e.kind === 'pauseStart' && e.date === today);
  if (startedToday >= 0) {
    // Undo a pause begun today instead of recording a zero-day pause.
    return { ...data, events: data.events.filter((_, i) => i !== startedToday) };
  }
  return { ...data, events: [...data.events, { kind: 'pauseEnd', date: today }] };
}
