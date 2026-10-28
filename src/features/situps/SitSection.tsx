import { Icon } from '../../components/ui/Icon';
import { NumberField } from '../../components/ui/NumberField';
import { formatRest } from '../../components/format';
import { isSitSetMet, sitTotals } from '../../domain/training/situpPlan';
import type { Num, SitEntry, SitPrescription } from '../../domain/training/types';
import { EffortRow, RestNote, SectionHead, type SectionResult } from '../dailyWorkout/SectionParts';

interface Props {
  rx: SitPrescription;
  entry: SitEntry | null;
  onChange?: (entry: SitEntry) => void;
  result: SectionResult;
}

function setTarget(rx: SitPrescription, reps: number, index: number): string {
  if (rx.kind === 'prep') return `${reps} نصف معدة`;
  if (rx.kind === 'maintain') return `${reps} دون الوصول للفشل`;
  return index === 0 ? `${reps} متواصلة — الرئيسية` : `${reps} — داعمة`;
}

export function SitSection({ rx, entry, onChange, result }: Props) {
  const readOnly = !onChange;
  const totals = sitTotals(entry?.sets ?? []);
  const updateSet = (i: number, v: Num) => {
    if (!entry) return;
    onChange?.({ ...entry, sets: entry.sets.map((s, j) => (j === i ? v : s)) });
  };

  return (
    <div className="section">
      <SectionHead title="المعدة" code={rx.code} result={result} />
      <p className="rx-sub">
        {rx.kind === 'prep'
          ? `${rx.sets.length} جولات تمهيدية — لا تُحتسب ضمن هدف الـ70`
          : rx.kind === 'maintain'
            ? 'جلسة المحافظة الأسبوعية — الهدف محقق'
            : `${rx.sets.length} جولات Sit-ups كاملة، دون توقيت`}
      </p>
      <ol className="sets">
        {rx.sets.map((reps, i) => {
          const value = entry?.sets[i] ?? null;
          const met = isSitSetMet(reps, value);
          return (
            <li key={i} className={`row${entry ? ' row--one' : ''}`}>
              <div className="row__label">
                <span className="row__num">
                  {i + 1}
                  {value !== null ? (
                    <span className={`set__mark${met ? ' set__mark--ok' : ''}`} aria-label={met ? 'الجولة مكتملة' : 'الجولة غير مكتملة'}>
                      <Icon name={met ? 'check' : 'x'} size={12} strokeWidth={2.8} />
                    </span>
                  ) : null}
                </span>
                <span className="row__target">{setTarget(rx, reps, i)}</span>
              </div>
              {entry ? <NumberField label={`عدد الجولة ${i + 1}`} hideLabel value={value} onChange={(v) => updateSet(i, v)} disabled={readOnly} /> : null}
            </li>
          );
        })}
      </ol>
      {entry && totals.best !== null ? (
        <p className="computed">
          {rx.kind === 'prep' ? 'أعلى جولة تمهيدية' : 'أعلى متواصل'} <b>{totals.best}</b> · المجموع <b>{totals.total}</b>
        </p>
      ) : null}
      <RestNote text={formatRest(rx.restSec)} />
      <p className="hint">أعلى متواصل من جولة واحدة؛ المجموع للمتابعة فقط.</p>
      {entry ? <EffortRow effort={entry.effort} pain={entry.pain} onChange={readOnly ? undefined : (p) => onChange?.({ ...entry, ...p })} /> : null}
    </div>
  );
}
