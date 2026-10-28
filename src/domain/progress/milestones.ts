import type { TrackId } from '../training/types';
import type { Records } from './types';

export interface Milestone {
  id: string;
  track: TrackId;
  label: string;
  reached: (r: Records) => boolean;
}

const runKm = (km: number) => (r: Records) => (r.bestContinuous?.km ?? 0) >= km - 1e-6;
const run5kUnder = (sec: number) => (r: Records) => r.best5k !== null && r.best5k.sec <= sec;
const pushAt = (n: number) => (r: Records) => (r.bestPush?.reps ?? 0) >= n;
const sitAt = (n: number) => (r: Records) => (r.bestSit?.reps ?? 0) >= n;

export const MILESTONES: readonly Milestone[] = [
  { id: 'run-1k', track: 'running', label: '1 كم متواصل', reached: runKm(1) },
  { id: 'run-3k', track: 'running', label: '3 كم متواصلة', reached: runKm(3) },
  { id: 'run-5k', track: 'running', label: '5 كم متواصلة', reached: runKm(5) },
  { id: 'run-5k-30', track: 'running', label: '5 كم خلال 30 دقيقة', reached: run5kUnder(30 * 60) },
  { id: 'run-5k-25', track: 'running', label: '5 كم خلال 25 دقيقة', reached: run5kUnder(25 * 60) },
  { id: 'push-1', track: 'pushups', label: 'أول ضغطة أرضية', reached: pushAt(1) },
  { id: 'push-10', track: 'pushups', label: '10 متواصلة', reached: pushAt(10) },
  { id: 'push-25', track: 'pushups', label: '25 متواصلة', reached: pushAt(25) },
  { id: 'push-50', track: 'pushups', label: '50 متواصلة', reached: pushAt(50) },
  { id: 'push-70', track: 'pushups', label: '70 متواصلة', reached: pushAt(70) },
  { id: 'sit-10', track: 'situps', label: '10 متواصلة', reached: sitAt(10) },
  { id: 'sit-25', track: 'situps', label: '25 متواصلة', reached: sitAt(25) },
  { id: 'sit-50', track: 'situps', label: '50 متواصلة', reached: sitAt(50) },
  { id: 'sit-70', track: 'situps', label: '70 متواصلة', reached: sitAt(70) },
];
