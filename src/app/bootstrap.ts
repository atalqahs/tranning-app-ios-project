import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createRepository } from '../data/repository';
import { msUntilNextMidnight, todayKey, type DateKey } from '../domain/calendar/dateUtils';
import { replay } from '../domain/calendar/scheduleEngine';
import { PermissionError } from '../domain/program/commands';
import type { ProgramData, Timeline } from '../domain/program/types';

const repository = createRepository();

/**
 * Today's Kuwait date. Re-checked at midnight and whenever the app comes back
 * to the foreground, because iOS suspends timers in the background. Missed
 * days are then derived by the replay — nothing has to run while closed.
 */
export function useToday(): DateKey {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    let timer = 0;
    const refresh = () => {
      setToday(todayKey());
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, msUntilNextMidnight() + 500);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return today;
}

export interface ProgramApi {
  data: ProgramData;
  timeline: Timeline | null;
  today: DateKey;
  persisting: boolean;
  /** Runs a domain command; returns an error message when the rules refuse it. */
  run: (command: (data: ProgramData, today: DateKey) => ProgramData) => string | null;
  reset: () => void;
}

export function useProgram(): ProgramApi {
  const data = useSyncExternalStore(repository.subscribe, repository.getSnapshot);
  const today = useToday();
  const timeline = useMemo(() => replay(data, today), [data, today]);

  const run = useCallback<ProgramApi['run']>(
    (command) => {
      try {
        repository.update((d) => command(d, today));
        return null;
      } catch (error) {
        if (error instanceof PermissionError) return error.message;
        throw error;
      }
    },
    [today],
  );

  return { data, timeline, today, persisting: repository.isPersisting(), run, reset: repository.reset };
}
