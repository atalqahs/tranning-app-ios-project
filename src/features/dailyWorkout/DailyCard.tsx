import { useState } from 'react';
import type { ProgramApi } from '../../app/bootstrap';
import { Button, IconButton } from '../../components/ui/Button';
import { Card, Notice, Toggle } from '../../components/ui/Bits';
import { Icon } from '../../components/ui/Icon';
import { formatFullDate } from '../../components/format';
import { addDays, type DateKey } from '../../domain/calendar/dateUtils';
import { dayView } from '../../domain/calendar/scheduleEngine';
import { editPermission, hasUnsavedChanges, saveDay, updateDraft } from '../../domain/program/commands';
import type { DayPlan, DayRecord, DayStatus } from '../../domain/program/types';
import { blankPush, blankRun, blankSit } from '../../domain/training/entries';
import type { DayEntries, TrackId } from '../../domain/training/types';
import { PushSection } from '../pushups/PushSection';
import { RunSection } from '../running/RunSection';
import { SitSection } from '../situps/SitSection';
import type { SectionResult } from './SectionParts';

interface Props {
  api: ProgramApi;
  date: DateKey;
  onDateChange: (date: DateKey) => void;
  onOpenPlacement: () => void;
  onPause: () => void;
  onResume: () => void;
}

const STATUS_TEXT: Partial<Record<DayStatus, string>> = {
  complete: 'مكتمل',
  partial: 'جزئي',
  absent: 'غياب — لم تُسجَّل نتيجة',
  assessment: 'اختبار مستوى',
  start: 'يوم بدء البرنامج',
};

const TRACK_NAME: Record<TrackId, string> = { running: 'الجري', pushups: 'الضغط', situps: 'المعدة' };

function resultOf(record: DayRecord | null, track: TrackId): SectionResult {
  if (!record) return {};
  return { evaluation: record.evaluations[track] };
}

export function DailyCard({ api, date, onDateChange, onOpenPlacement, onPause, onResume }: Props) {
  const { timeline, today, data } = api;
  const [message, setMessage] = useState<string | null>(null);
  if (!timeline) return null;

  const view = dayView(timeline, date);
  const record = view.when === 'past' || view.when === 'today' ? view.record : null;
  const editable = editPermission(timeline, date) === 'editable';
  const log = data.days[date];
  const entries: DayEntries | null = editable ? (log?.draft ?? {}) : (record?.entries ?? null);
  const unsaved = editable && hasUnsavedChanges(log);

  const change = (patch: Partial<DayEntries>) => {
    setMessage(null);
    const error = api.run((d, t) => updateDraft(d, date, { ...(d.days[date]?.draft ?? {}), ...patch }, t));
    if (error) setMessage(error);
  };
  const save = () => {
    const error = api.run((d, t) => saveDay(d, date, t, new Date().toISOString()));
    setMessage(error ?? 'تم حفظ النتائج وتحديث التقدم');
  };

  return (
    <Card className="daily" labelledBy="daily-title">
      <header className="daily__head">
        <div className="daily__title-wrap">
          <h2 id="daily-title" className="daily__title">
            {formatFullDate(date)}
          </h2>
          <ContextLine when={view.when} status={record?.status} />
        </div>
        <div className="nav-pair">
          <IconButton icon="chevronRight" label="اليوم السابق" onClick={() => onDateChange(addDays(date, -1))} />
          <IconButton icon="chevronLeft" label="اليوم التالي" onClick={() => onDateChange(addDays(date, 1))} />
        </div>
      </header>

      {date !== today ? (
        <button type="button" className="link-btn" onClick={() => onDateChange(today)}>
          العودة إلى اليوم
        </button>
      ) : null}

      <PlanBody
        plan={view.plan}
        isToday={view.when === 'today'}
        record={record}
        entries={entries}
        editable={editable}
        onChange={change}
        onOpenPlacement={onOpenPlacement}
        onResume={onResume}
      />

      {view.when === 'future' && view.plan.kind !== 'rest' ? (
        <Notice>توقعات مبنية على وضعك الحالي؛ قد تتغير بعد تسجيل أداء جديد أو غياب أو مراجعة مستوى.</Notice>
      ) : null}

      <Decisions record={record} />

      {editable ? (
        <div className="savebar">
          <Button variant="primary" block icon="check" onClick={save} disabled={!unsaved && !!log?.saved}>
            {log?.saved ? 'حفظ التعديلات' : 'حفظ النتائج'}
          </Button>
          <p className="savebar__state" aria-live="polite">
            {message ?? (unsaved ? 'تعديلات غير محفوظة — المدخلات محفوظة على الجهاز تلقائيًا' : log?.saved ? 'محفوظ — يمكنك التعديل حتى نهاية اليوم' : 'يمكنك حفظ نتيجة جزئية أو كاملة')}
          </p>
        </div>
      ) : message ? (
        <p className="savebar__state">{message}</p>
      ) : null}

      {view.when === 'today' && view.plan.kind !== 'paused' && view.plan.kind !== 'rest' ? (
        <button type="button" className="link-btn link-btn--quiet" onClick={onPause}>
          <Icon name="pause" size={16} /> توقف صحي (مرض أو إصابة)
        </button>
      ) : null}
    </Card>
  );
}

function ContextLine({ when, status }: { when: 'before' | 'past' | 'today' | 'future'; status?: DayStatus }) {
  if (when === 'today') return <p className="context context--today">اليوم</p>;
  if (when === 'future')
    return (
      <p className="context">
        <Icon name="eye" size={15} /> هذا تمرين قادم — العرض فقط
      </p>
    );
  if (when === 'past')
    return (
      <p className="context">
        <Icon name="lock" size={15} /> يوم سابق — للقراءة فقط{status && STATUS_TEXT[status] ? ` · ${STATUS_TEXT[status]}` : ''}
      </p>
    );
  return <p className="context">قبل بدء البرنامج</p>;
}

interface BodyProps {
  plan: DayPlan;
  isToday: boolean;
  record: DayRecord | null;
  entries: DayEntries | null;
  editable: boolean;
  onChange: (patch: Partial<DayEntries>) => void;
  onOpenPlacement: () => void;
  onResume: () => void;
}

function PlanBody({ plan, isToday, record, entries, editable, onChange, onOpenPlacement, onResume }: BodyProps) {
  switch (plan.kind) {
    case 'beforeProgram':
      return <EmptyState title="قبل بدء البرنامج" text="لا تُحتسب الأيام السابقة لبدء البرنامج غيابًا." />;
    case 'rest':
      return <EmptyState title="يوم راحة" text="الجمعة والسبت راحة كاملة ولا يُحتسبان غيابًا." />;
    case 'paused':
      return (
        <EmptyState title="توقف صحي" text="الخطة مجمّدة ولا تُحتسب الأيام غيابًا. التطبيق لا يشخّص ولا يؤكد الجاهزية طبيًا.">
          {isToday ? (
            <Button variant="primary" icon="play" onClick={onResume}>
              العودة من التوقف
            </Button>
          ) : null}
        </EmptyState>
      );
    case 'placementRequired':
      return (
        <EmptyState title="تحديد مستوى جديد" text="بعد انقطاع 5 أيام تدريب متتالية نحدد نقطة بداية جديدة لكل تمرين. أدخل أرقامًا حققتها فعلًا.">
          {isToday ? (
            <Button variant="primary" icon="clipboard" onClick={onOpenPlacement}>
              فتح استمارة تحديد المستوى
            </Button>
          ) : null}
        </EmptyState>
      );
    case 'review':
      return plan.submitted ? (
        <EmptyState title="تم اختبار مراجعة المستوى" text="حلّت المراجعة محل حصة هذا اليوم." />
      ) : (
        <EmptyState title="اختبار مراجعة المستوى" text="مرت 4 أسابيع تدريبية. يحل الاختبار محل حصة اليوم؛ سجّل أرقامًا حققتها، ويمكن أداء المحاولات في أوقات منفصلة.">
          {isToday ? (
            <Button variant="primary" icon="clipboard" onClick={onOpenPlacement}>
              فتح استمارة المراجعة
            </Button>
          ) : null}
        </EmptyState>
      );
    case 'light':
      return (
        <div className="section">
          <div className="section__head">
            <h3 className="section__title">يوم خفيف — تعافٍ نشط</h3>
          </div>
          <p className="rx">10–20 دقيقة مشي مريح</p>
          <p className="rx-sub">أو حركة خفيفة. لا جري شاق بعد يوم رئيسي.</p>
          {entries ? (
            <Toggle label="تم" checked={entries.lightDone === true} onChange={(v) => onChange({ lightDone: v })} disabled={!editable} />
          ) : null}
        </div>
      );
    case 'main':
      return (
        <div className="sections">
          {plan.run ? (
            <RunSection
              rx={plan.run}
              entry={entries ? (entries.run ?? (editable ? blankRun() : null)) : null}
              onChange={editable ? (run) => onChange({ run }) : undefined}
              result={resultOf(record, 'running')}
            />
          ) : null}
          {plan.push ? (
            <PushSection
              rx={plan.push}
              entry={entries ? (entries.push ?? (editable ? blankPush(plan.push) : null)) : null}
              onChange={editable ? (push) => onChange({ push }) : undefined}
              result={resultOf(record, 'pushups')}
            />
          ) : null}
          {plan.sit ? (
            <SitSection
              rx={plan.sit}
              entry={entries ? (entries.sit ?? (editable ? blankSit(plan.sit) : null)) : null}
              onChange={editable ? (sit) => onChange({ sit }) : undefined}
              result={resultOf(record, 'situps')}
            />
          ) : null}
          {plan.maintenanceDone.length ? (
            <p className="hint">
              جلسة المحافظة لهذا الأسبوع منجزة: {plan.maintenanceDone.map((t) => TRACK_NAME[t]).join('، ')}
            </p>
          ) : null}
        </div>
      );
  }
}

function EmptyState({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <h3 className="empty__title">{title}</h3>
      <p className="empty__text">{text}</p>
      {children}
    </div>
  );
}

function Decisions({ record }: { record: DayRecord | null }) {
  if (!record) return null;
  const outcomes = (Object.keys(TRACK_NAME) as TrackId[]).filter((t) => record.outcomes[t]);
  if (!record.notes.length && !outcomes.length) return null;
  return (
    <div className="decisions">
      <h3 className="decisions__title">قرار المحرك</h3>
      <ul>
        {record.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
        {outcomes.map((t) => (
          <li key={t}>
            <b>{TRACK_NAME[t]}:</b> {record.outcomes[t]}
          </li>
        ))}
      </ul>
    </div>
  );
}
