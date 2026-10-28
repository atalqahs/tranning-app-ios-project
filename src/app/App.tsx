import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card, Notice } from '../components/ui/Bits';
import { endPause, pendingPlacementReason, startPause, startProgram, submitPlacement } from '../domain/program/commands';
import { computeStatistics } from '../domain/progress/statistics';
import type { PlacementInput } from '../domain/training/types';
import { PlacementDialog, type PlacementMode } from '../features/baseline/PlacementDialog';
import { WeekCalendar } from '../features/calendar/WeekCalendar';
import { DailyCard } from '../features/dailyWorkout/DailyCard';
import { AppHeader } from '../features/header/AppHeader';
import { ProgressCard } from '../features/progress/ProgressCard';
import { PauseDialog, ResetDialog } from '../features/reset/ConfirmDialogs';
import { StatsCard } from '../features/statistics/StatsCard';
import { useProgram } from './bootstrap';

type OpenDialog = 'placement' | 'reset' | 'pause' | null;

export function App() {
  const api = useProgram();
  const { timeline, today } = api;
  const [selected, setSelected] = useState(today);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [pauseError, setPauseError] = useState<string | null>(null);

  // When midnight passes while open, keep following "today" unless another day was picked.
  const [shownToday, setShownToday] = useState(today);
  if (today !== shownToday) {
    setShownToday(today);
    if (selected === shownToday) setSelected(today);
  }

  const stats = useMemo(() => (timeline ? computeStatistics(timeline) : null), [timeline]);
  const pending = pendingPlacementReason(timeline);
  const placementMode: PlacementMode = !timeline ? 'initial' : pending === 'review' ? 'review' : 'replacement';
  const paused = timeline?.calendar.paused === true;

  const submitForm = (input: PlacementInput) => {
    const error = api.run((d, t) => (timeline ? submitPlacement(d, input, t) : startProgram(d, input, t)));
    if (!error) {
      setDialog(null);
      setSelected(today);
    }
    return error;
  };

  const confirmPause = () => {
    const error = api.run((d, t) => (paused ? endPause(d, t) : startPause(d, t)));
    setPauseError(error);
    setDialog(null);
  };

  return (
    <div className="app">
      <AppHeader started={!!timeline} onStart={() => setDialog('placement')} onReset={() => setDialog('reset')} />

      {!api.persisting ? <Notice tone="warn">المتصفح يمنع الحفظ المحلي حاليًا؛ لن تبقى النتائج بعد إغلاق الصفحة.</Notice> : null}

      {timeline && stats ? (
        <main className="stack">
          <WeekCalendar timeline={timeline} today={today} selected={selected} onSelect={setSelected} />
          {pauseError ? <Notice tone="warn">{pauseError}</Notice> : null}
          <DailyCard
            key={selected}
            api={api}
            date={selected}
            onDateChange={setSelected}
            onOpenPlacement={() => setDialog('placement')}
            onPause={() => setDialog('pause')}
            onResume={() => setDialog('pause')}
          />
          <StatsCard stats={stats} />
          <ProgressCard records={timeline.records} />
        </main>
      ) : (
        <main className="stack">
          <Card className="intro" labelledBy="intro-title">
            <h2 id="intro-title" className="intro__title">
              ثلاثة أهداف، كل منها بمساره
            </h2>
            <ul className="intro__goals">
              <li>
                <b>5 كم</b> جري متواصل خلال 25 دقيقة
              </li>
              <li>
                <b>70</b> ضغطة أرضية متواصلة
              </li>
              <li>
                <b>70</b> عدة معدة متواصلة
              </li>
            </ul>
            <p className="intro__text">
              ابدأ بإدخال أرقام حققتها فعلًا، ويبني المحرك جدولك من الأحد إلى الخميس، والجمعة والسبت راحة. التقدم بعد نجاحين متتاليين، ومراجعة المستوى كل 4 أسابيع تدريبية.
            </p>
            <Button variant="primary" block onClick={() => setDialog('placement')}>
              بدء البرنامج
            </Button>
          </Card>
        </main>
      )}

      <footer className="app-footer">تُحفظ بياناتك في هذا المتصفح على هذا الجهاز فقط؛ مسح بيانات Safari يحذفها.</footer>

      <PlacementDialog open={dialog === 'placement'} mode={placementMode} onClose={() => setDialog(null)} onSubmit={submitForm} />
      <ResetDialog
        open={dialog === 'reset'}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          api.reset();
          setSelected(today);
          setDialog(null);
        }}
      />
      <PauseDialog open={dialog === 'pause'} resuming={paused} onCancel={() => setDialog(null)} onConfirm={confirmPause} />
    </div>
  );
}
