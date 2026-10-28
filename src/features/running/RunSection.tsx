import { Toggle } from '../../components/ui/Bits';
import { DurationField, NumberField } from '../../components/ui/NumberField';
import { formatClock, formatSpan } from '../../components/format';
import { GOAL_DISTANCE_KM, asksContinuous, paceStats } from '../../domain/training/runningPlan';
import type { RunEntry, RunPrescription } from '../../domain/training/types';
import { EffortRow, SectionHead, type SectionResult } from '../dailyWorkout/SectionParts';

interface Props {
  rx: RunPrescription;
  entry: RunEntry | null;
  onChange?: (entry: RunEntry) => void;
  result: SectionResult;
}

function headline(rx: RunPrescription): { main: string; sub: string } {
  switch (rx.kind) {
    case 'walk':
      return { main: `مشي مريح ${rx.minMinutes}–${rx.maxMinutes} دقيقة`, sub: 'تمهيد قبل الجري المتقطع؛ نجاحان متتاليان ثم ج0' };
    case 'intervals':
      return {
        main: `${rx.rounds} × (${formatSpan(rx.workSec!)} جري + ${formatSpan(rx.recoverSec!)} مشي)`,
        sub: 'أضف إحماءً وتهدئة بالمشي خارج هذا الوقت',
      };
    case 'continuousTime':
      return { main: `${rx.minMinutes} دقيقة جري متواصل`, sub: 'بوتيرة تستطيع معها الكلام' };
    case 'buildEasy':
      return { main: `جري سهل ${rx.targetKm!.toFixed(2)} كم`, sub: `نحو 70% من مستوى ${rx.code}؛ جهد مريح` };
    case 'buildShort':
      return { main: `جري مريح ${rx.minMinutes}–${rx.maxMinutes} دقيقة`, sub: 'حصة أقصر للتعافي النشط' };
    case 'buildKey':
      return { main: `${rx.targetKm!.toFixed(2)} كم جري متواصل`, sub: 'الحصة المفتاحية للمستوى؛ نجاحان متتاليان = +250 م' };
    case 'speedEasy':
      return { main: `جري سهل ${rx.minMinutes}–${rx.maxMinutes} دقيقة`, sub: 'جهد 4–5 من 10' };
    case 'speedIntervals':
      return {
        main: `${rx.rounds} × (${formatSpan(rx.workSec!)} أسرع + ${formatSpan(rx.recoverSec!)} تعافٍ)`,
        sub: 'جهد نحو 7 من 10؛ التعافي مشي أو هرولة',
      };
    case 'speedSteady':
      return { main: `جري مستمر مريح ${rx.targetKm}–${rx.maxKm} كم`, sub: 'دون محاولة كسر رقم قياسي' };
    case 'maintain':
      return { main: `جري مريح ${rx.minMinutes}–${rx.maxMinutes} دقيقة`, sub: 'جلسة المحافظة الأسبوعية — الهدف محقق' };
  }
}

function facts(rx: RunPrescription): [string, string][] {
  if (rx.mode === 'intervals') {
    return [
      ['الجولات', String(rx.rounds)],
      [rx.kind === 'speedIntervals' ? 'الأسرع' : 'الجري', formatSpan(rx.workSec!)],
      [rx.kind === 'speedIntervals' ? 'التعافي' : 'المشي', formatSpan(rx.recoverSec!)],
    ];
  }
  return [];
}

export function RunSection({ rx, entry, onChange, result }: Props) {
  const h = headline(rx);
  const readOnly = !onChange;
  const e = entry;
  const set = (patch: Partial<RunEntry>) => e && onChange?.({ ...e, ...patch });
  const pace = e && (asksContinuous(rx) ? e.continuous : false) ? paceStats(e.distanceKm, e.durationSec) : null;
  const factList = facts(rx);

  return (
    <div className="section">
      <SectionHead title="الجري" code={rx.code} keySession={rx.key} result={result} />
      <p className="rx">{h.main}</p>
      <p className="rx-sub">{h.sub}</p>
      {factList.length ? (
        <dl className="facts">
          {factList.map(([k, v]) => (
            <div key={k} className="facts__item">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {e ? (
        <div className="inputs">
          {rx.mode === 'intervals' ? (
            <NumberField label={`الجولات المكتملة من ${rx.rounds}`} value={e.intervalsDone} max={rx.rounds} onChange={(v) => set({ intervalsDone: v })} disabled={readOnly} />
          ) : null}
          {rx.mode !== 'intervals' || !readOnly || e.distanceKm !== null ? (
            <div className="inputs__pair">
              <NumberField
                label={rx.mode === 'distance' ? 'المسافة' : 'المسافة (اختياري)'}
                value={e.distanceKm}
                decimal
                suffix="كم"
                onChange={(v) => set({ distanceKm: v })}
                disabled={readOnly}
              />
              <DurationField label={rx.mode === 'intervals' ? 'الزمن الكلي (اختياري)' : 'الزمن'} value={e.durationSec} onChange={(v) => set({ durationSec: v })} disabled={readOnly} />
            </div>
          ) : null}
          {asksContinuous(rx) ? (
            <Toggle label="جري متواصل دون مشي" checked={e.continuous} onChange={(v) => set({ continuous: v })} disabled={readOnly} />
          ) : null}
          {asksContinuous(rx) && e.distanceKm !== null && e.distanceKm > GOAL_DISTANCE_KM ? (
            <DurationField label="زمن أول 5 كم (إن عرفته)" value={e.first5kSec} onChange={(v) => set({ first5kSec: v })} disabled={readOnly} />
          ) : null}
          {pace ? (
            <p className="computed" aria-live="polite">
              الوتيرة <b dir="ltr">{formatClock(pace.paceSec)}</b> د/كم · السرعة <b dir="ltr">{pace.kmh.toFixed(1)}</b> كم/س
            </p>
          ) : rx.mode === 'intervals' && e.distanceKm !== null && e.durationSec !== null ? (
            <p className="hint">متوسط حصة فيها مشي لا يساوي وتيرة الجري؛ لا نحسبه وتيرة.</p>
          ) : null}
          <EffortRow effort={e.effort} pain={e.pain} onChange={readOnly ? undefined : (p) => set(p)} wantsEffort={rx.wantsEffort} />
        </div>
      ) : null}
    </div>
  );
}
