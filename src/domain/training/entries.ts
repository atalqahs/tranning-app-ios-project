import type { PushEntry, PushPrescription, RunEntry, SitEntry, SitPrescription } from './types';

/** Empty result forms: every field "not entered". */
export function blankRun(): RunEntry {
  return { intervalsDone: null, distanceKm: null, durationSec: null, continuous: false, first5kSec: null, effort: null, pain: false };
}

export function blankPush(rx: PushPrescription): PushEntry {
  return { sets: rx.sets.map(() => ({ normal: null, assisted: null })), effort: null, pain: false };
}

export function blankSit(rx: SitPrescription): SitEntry {
  return { sets: rx.sets.map(() => null), effort: null, pain: false };
}
