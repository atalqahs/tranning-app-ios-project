import type { DateKey } from '../calendar/dateUtils';
import type { Records } from '../progress/types';
import type {
  DayEntries,
  Evaluation,
  PlacementInput,
  PushPrescription,
  RunPrescription,
  SitPrescription,
  TrackId,
  TrainingState,
} from '../training/types';

// ------------------------------------------------------------ stored facts

export type PlacementReason = 'initial' | 'absence' | 'pause' | 'review';

export type ProgramEvent =
  | { kind: 'placement'; date: DateKey; reason: PlacementReason; input: PlacementInput }
  | { kind: 'pauseStart'; date: DateKey }
  | { kind: 'pauseEnd'; date: DateKey };

export interface DayLog {
  /** Latest inputs, written on every keystroke so nothing is lost. */
  draft: DayEntries;
  /** Last explicitly saved version; drives today's progress. */
  saved: DayEntries | null;
  savedAt: string | null;
}

/** Everything persisted. All plans, statuses and stats are derived from it. */
export interface ProgramData {
  events: ProgramEvent[];
  days: Record<DateKey, DayLog>;
}

// ----------------------------------------------------------- derived views

export type DayPlan =
  | { kind: 'beforeProgram' }
  | { kind: 'rest' }
  | { kind: 'paused' }
  | { kind: 'placementRequired' }
  | { kind: 'review'; submitted: boolean }
  | { kind: 'light' }
  | {
      kind: 'main';
      run: RunPrescription | null;
      push: PushPrescription | null;
      sit: SitPrescription | null;
      /** Goals in maintenance whose weekly session is already done. */
      maintenanceDone: TrackId[];
    };

export type DayStatus =
  | 'beforeProgram'
  | 'start'
  | 'rest'
  | 'paused'
  | 'upcoming'
  | 'pending'
  | 'complete'
  | 'partial'
  | 'absent'
  | 'assessment';

export interface DayRecord {
  date: DateKey;
  plan: DayPlan;
  status: DayStatus;
  /** Entries the engine used: the draft for a closed day, the saved version today. */
  entries: DayEntries | null;
  evaluations: Partial<Record<TrackId, Exclude<Evaluation, 'none'>>>;
  /** Changes applied before the day (absence fallback, placement, pause). */
  notes: string[];
  /** Engine decision per track after the day's results. */
  outcomes: Partial<Record<TrackId, string>>;
  /** Curriculum positions at the start of the day. */
  levels: TrainingState;
  streaks: Record<TrackId, number>;
}

export interface CalendarState {
  absenceRun: number;
  /** Positions when the current absence run began; fallbacks never compound. */
  anchor: TrainingState | null;
  placementRequired: boolean;
  paused: boolean;
  pausedTrainingDays: number;
  lastPlacement: DateKey;
  reviewPending: boolean;
  prevDayMain: boolean;
  /** Track → Sunday of the week its maintenance session was done. */
  maintenanceWeek: Partial<Record<TrackId, DateKey>>;
  /** Notes produced at the end of a day, shown on the next training day. */
  carryNotes: string[];
}

export interface Timeline {
  startDate: DateKey;
  today: DateKey;
  days: Map<DateKey, DayRecord>;
  /** State after today's saved results. */
  state: TrainingState;
  calendar: CalendarState;
  pausedDates: Set<DateKey>;
  records: Records;
  progressions: number;
}
