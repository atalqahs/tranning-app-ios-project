import type { Timeline } from '../program/types';
import { PUSH_GOAL, pushPositionLabel } from '../training/pushupPlan';
import { GOAL_5K_SEC, GOAL_DISTANCE_KM, runPositionLabel } from '../training/runningPlan';
import { SIT_GOAL, sitPositionLabel } from '../training/situpPlan';
import type { TrackId } from '../training/types';
import { MILESTONES } from './milestones';
import type { Records } from './types';

export interface Statistics {
  completed: number;
  partial: number;
  absent: number;
  levels: Record<TrackId, string>;
  progressions: number;
  records: Records;
}

export function computeStatistics(t: Timeline): Statistics {
  let completed = 0;
  let partial = 0;
  let absent = 0;
  for (const day of t.days.values()) {
    if (day.status === 'complete') completed++;
    else if (day.status === 'partial') partial++;
    else if (day.status === 'absent') absent++;
  }
  return {
    completed,
    partial,
    absent,
    levels: {
      running: runPositionLabel(t.state.running.position),
      pushups: pushPositionLabel(t.state.pushups.position),
      situps: sitPositionLabel(t.state.situps.position),
    },
    progressions: t.progressions,
    records: t.records,
  };
}

/** Share of the run bar given to building continuous distance; the rest is speed. */
const RUN_DISTANCE_SHARE = 50;

export interface GoalProgress {
  track: TrackId;
  /** 0–100, never above. */
  percent: number;
  /** Which half of the running bar applies. */
  stage?: 'distance' | 'speed';
}

const clampPercent = (n: number) => Math.min(100, Math.max(0, n));

/**
 * Running: 0–50 % builds continuous distance to 5 km; 50–100 % is the
 * improvement from the first trustworthy 5 km time to 25:00. Without such a
 * time the bar stays in the first half — no reference is invented.
 */
export function runningProgress(r: Records): GoalProgress {
  if (r.first5k && r.best5k) {
    const start = r.first5k.sec;
    const best = r.best5k.sec;
    if (best <= GOAL_5K_SEC) return { track: 'running', percent: 100, stage: 'speed' };
    const gained = (start - best) / (start - GOAL_5K_SEC);
    return { track: 'running', percent: clampPercent(RUN_DISTANCE_SHARE + (100 - RUN_DISTANCE_SHARE) * gained), stage: 'speed' };
  }
  const km = Math.min(r.bestContinuous?.km ?? 0, GOAL_DISTANCE_KM);
  return { track: 'running', percent: clampPercent((RUN_DISTANCE_SHARE * km) / GOAL_DISTANCE_KM), stage: 'distance' };
}

export function goalProgress(r: Records): GoalProgress[] {
  return [
    runningProgress(r),
    { track: 'pushups', percent: clampPercent((100 * (r.bestPush?.reps ?? 0)) / PUSH_GOAL) },
    { track: 'situps', percent: clampPercent((100 * (r.bestSit?.reps ?? 0)) / SIT_GOAL) },
  ];
}

export function milestoneStates(r: Records): { id: string; track: TrackId; label: string; reachedOn: string | null }[] {
  return MILESTONES.map((m) => ({ id: m.id, track: m.track, label: m.label, reachedOn: r.milestones[m.id] ?? null }));
}
