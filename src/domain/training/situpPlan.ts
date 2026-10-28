import { isEntered } from './successRules';
import type { Evaluation, Ladder, SitEntry, SitPosition, SitPrescription } from './types';

export const SIT_GOAL = 70;

/** Half sit-ups (crunch-style prep), 3 sets. Never counted as full sit-ups. */
export const PREP_REPS: readonly number[] = [5, 8, 10, 12, 15];
const PREP_SETS = 3;

/** First full sit-up main set after the prep ladder. */
const PREP_EXIT_MAIN = 3;

const MAIN_RATIO = 0.7;
const SUPPORT_RATIO = 0.7;
/** From this main set size the support work drops to a single set. */
const SINGLE_SUPPORT_FROM = 50;
const MAINTAIN_SETS = [35, 35];

const LAST_PREP = PREP_REPS.length - 1;

/** Reps added to the main set after two successes in a row. */
export function sitIncrement(main: number): number {
  if (main < 15) return 1;
  if (main < 50) return 2;
  return 1;
}

export function sitMainFromBest(best: number): number {
  return Math.max(1, Math.floor(MAIN_RATIO * best));
}

export const sitLadder: Ladder<SitPosition> = {
  next(p) {
    switch (p.phase) {
      case 'prep':
        return p.stage < LAST_PREP ? { phase: 'prep', stage: p.stage + 1 } : { phase: 'endurance', main: PREP_EXIT_MAIN };
      case 'endurance':
        return p.main >= SIT_GOAL ? null : { phase: 'endurance', main: Math.min(SIT_GOAL, p.main + sitIncrement(p.main)) };
      case 'maintain':
        return null;
    }
  },
  prev(p) {
    switch (p.phase) {
      case 'prep':
        return p.stage > 0 ? { phase: 'prep', stage: p.stage - 1 } : null;
      case 'endurance': {
        if (p.main <= 1) return { phase: 'prep', stage: LAST_PREP };
        const twoBack = p.main - 2;
        const main = twoBack >= 1 && sitIncrement(twoBack) === 2 ? twoBack : p.main - 1;
        return { phase: 'endurance', main };
      }
      case 'maintain':
        return null;
    }
  },
  rank(p) {
    switch (p.phase) {
      case 'prep':
        return p.stage;
      case 'endurance':
        return 100 + p.main;
      case 'maintain':
        return 1000;
    }
  },
};

export function sitPositionLabel(p: SitPosition): string {
  switch (p.phase) {
    case 'prep':
      return `تمهيدي ${PREP_SETS}×${PREP_REPS[p.stage]} نصف معدة`;
    case 'endurance':
      return `رئيسية ${p.main}`;
    case 'maintain':
      return 'محقق — محافظة';
  }
}

export function prescribeSit(p: SitPosition): SitPrescription {
  const code = sitPositionLabel(p);
  switch (p.phase) {
    case 'prep':
      return { kind: 'prep', code, restSec: [60, 90], sets: Array<number>(PREP_SETS).fill(PREP_REPS[p.stage]!) };
    case 'endurance': {
      const support = Math.max(1, Math.round(SUPPORT_RATIO * p.main));
      const supportSets = p.main >= SINGLE_SUPPORT_FROM ? 1 : 2;
      return {
        kind: 'endurance',
        code,
        restSec: p.main < 30 ? [60, 90] : [90, 120],
        sets: [p.main, ...Array<number>(supportSets).fill(support)],
      };
    }
    case 'maintain':
      return { kind: 'maintain', code, restSec: [90, 120], sets: [...MAINTAIN_SETS] };
  }
}

export function hasSitData(entry: SitEntry | undefined): entry is SitEntry {
  return !!entry && entry.sets.some(isEntered);
}

export function evaluateSit(rx: SitPrescription, entry: SitEntry | undefined): Evaluation {
  if (!hasSitData(entry)) return 'none';
  return rx.sets.every((target, i) => isSitSetMet(target, entry.sets[i] ?? null)) ? 'success' : 'fail';
}

export function isSitSetMet(target: number, done: number | null): boolean {
  return (done ?? 0) >= target;
}

/** Best single set versus the session total: only the first can count toward 70. */
export function sitTotals(sets: readonly (number | null)[]): { best: number | null; total: number } {
  let best: number | null = null;
  let total = 0;
  for (const n of sets) {
    if (!isEntered(n)) continue;
    total += n;
    if (best === null || n > best) best = n;
  }
  return { best, total };
}

/** Largest single set of full sit-ups. Prep (half) sit-ups never count. */
export function bestFullSitSet(rx: SitPrescription, entry: SitEntry): number | null {
  return rx.kind === 'prep' ? null : sitTotals(entry.sets).best;
}
