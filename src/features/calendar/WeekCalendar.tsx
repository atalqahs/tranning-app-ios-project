import { memo } from 'react';
import { IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Bits';
import { Icon } from '../../components/ui/Icon';
import { DAY_NAMES, DAY_SHORT, formatShortDate, formatWeekRange } from '../../components/format';
import { addDays, dayParts, weekDays, weekStart, type DateKey } from '../../domain/calendar/dateUtils';
import { dayView } from '../../domain/calendar/scheduleEngine';
import type { DayStatus, Timeline } from '../../domain/program/types';

/** What the calendar shows; future days add whether a level test is expected. */
export type DiscKind = DayStatus | 'upcomingTest';

const DISC_LABEL: Record<DiscKind, string> = {
  beforeProgram: 'قبل البرنامج',
  start: 'بداية البرنامج',
  rest: 'راحة',
  paused: 'توقف صحي',
  upcoming: 'قادم',
  upcomingTest: 'اختبار مستوى قادم',
  pending: 'اليوم — لم يُسجَّل بعد',
  complete: 'مكتمل',
  partial: 'جزئي',
  absent: 'غياب',
  assessment: 'اختبار مستوى',
};

function discKind(t: Timeline | null, date: DateKey): DiscKind {
  if (!t) return 'beforeProgram';
  const view = dayView(t, date);
  if (view.when === 'before') return 'beforeProgram';
  if (view.when === 'future') {
    if (view.plan.kind === 'rest') return 'rest';
    if (view.plan.kind === 'paused') return 'paused';
    if (view.plan.kind === 'review' || view.plan.kind === 'placementRequired') return 'upcomingTest';
    return 'upcoming';
  }
  if (view.record.plan.kind === 'review' && view.record.status === 'pending') return 'upcomingTest';
  return view.record.status;
}

export function StatusDisc({ kind }: { kind: DiscKind }) {
  switch (kind) {
    case 'complete':
      return (
        <span className="disc disc--done">
          <Icon name="check" size={18} strokeWidth={2.6} />
        </span>
      );
    case 'partial':
      return (
        <span className="disc disc--partial">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="16" pathLength="100" strokeDasharray="50 100" />
          </svg>
        </span>
      );
    case 'absent':
      return (
        <span className="disc disc--absent">
          <Icon name="x" size={16} strokeWidth={2.4} />
        </span>
      );
    case 'assessment':
    case 'upcomingTest':
      return (
        <span className={`disc disc--test${kind === 'upcomingTest' ? ' disc--faint' : ''}`}>
          <Icon name="clipboard" size={16} />
        </span>
      );
    case 'paused':
      return (
        <span className="disc disc--paused">
          <Icon name="pause" size={14} />
        </span>
      );
    case 'rest':
    case 'beforeProgram':
      return <span className="disc disc--dot" />;
    case 'pending':
      return <span className="disc disc--today" />;
    case 'start':
    case 'upcoming':
      return <span className="disc disc--empty" />;
  }
}

interface Props {
  timeline: Timeline | null;
  today: DateKey;
  selected: DateKey;
  onSelect: (date: DateKey) => void;
}

export const WeekCalendar = memo(function WeekCalendar({ timeline, today, selected, onSelect }: Props) {
  const start = weekStart(selected);
  const days = weekDays(start);
  const showsToday = weekStart(today) === start;

  return (
    <Card className="week" labelledBy="week-range">
      <div className="week__bar">
        <h2 id="week-range" className="week__range">
          {formatWeekRange(start, days[6]!)}
        </h2>
        {!showsToday ? (
          <button type="button" className="link-btn" onClick={() => onSelect(today)}>
            هذا الأسبوع
          </button>
        ) : null}
        <div className="nav-pair">
          <IconButton icon="chevronRight" label="الأسبوع السابق" onClick={() => onSelect(addDays(selected, -7))} />
          <IconButton icon="chevronLeft" label="الأسبوع التالي" onClick={() => onSelect(addDays(selected, 7))} />
        </div>
      </div>

      <ol className="week__grid">
        {days.map((d, i) => {
          const kind = discKind(timeline, d);
          const isToday = d === today;
          const isSelected = d === selected;
          return (
            <li key={d}>
              <button
                type="button"
                className={`day${isSelected ? ' day--selected' : ''}${isToday ? ' day--today' : ''}`}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${DAY_NAMES[i]} ${formatShortDate(d)} — ${DISC_LABEL[kind]}${isToday ? ' — اليوم' : ''}`}
                onClick={() => onSelect(d)}
              >
                <span className="day__name" aria-hidden="true">
                  {DAY_SHORT[i]}
                </span>
                <span className="day__num" aria-hidden="true">
                  {dayParts(d).day}
                </span>
                <StatusDisc kind={kind} />
              </button>
            </li>
          );
        })}
      </ol>

      <ul className="legend" aria-label="دليل الحالات">
        {(['complete', 'partial', 'absent', 'assessment', 'rest'] as const).map((k) => (
          <li key={k}>
            <StatusDisc kind={k} />
            {DISC_LABEL[k]}
          </li>
        ))}
      </ul>
    </Card>
  );
});
