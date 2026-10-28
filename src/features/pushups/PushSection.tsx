import { Icon } from '../../components/ui/Icon';
import { NumberField } from '../../components/ui/NumberField';
import { formatRest } from '../../components/format';
import { bestStrictSet, isPushSetMet } from '../../domain/training/pushupPlan';
import type { PushEntry, PushPrescription, PushSetEntry, PushSetTarget } from '../../domain/training/types';
import { EffortRow, RestNote, SectionHead, type SectionResult } from '../dailyWorkout/SectionParts';

interface Props {
  rx: PushPrescription;
  entry: PushEntry | null;
  onChange?: (entry: PushEntry) => void;
  result: SectionResult;
}

const ASSISTED_LABEL = { knee: 'بالركب', incline: 'مائل' } as const;

function setTarget(rx: PushPrescription, t: PushSetTarget, index: number): string {
  switch (rx.kind) {
    case 'transition':
      return t.normalMin > 0
        ? `${t.total} منها ${t.normalMin} طبيعي على الأقل`
        : `${t.total} بالركب`;
    case 'knee':
    case 'incline':
      return `${t.total} ${ASSISTED_LABEL[rx.assisted!]}`;
    case 'endurance':
      return index === 0 ? `${t.total} متواصلة — الرئيسية` : `${t.total} — داعمة`;
    case 'maintain':
      return `${t.total} دون الوصول للفشل`;
  }
}

function headline(rx: PushPrescription): string {
  const sets = `${rx.sets.length} جولات`;
  switch (rx.kind) {
    case 'incline':
      return `${sets} ضغط مائل/جدار — تمهيد حتى تصبح قادرًا على الركب`;
    case 'knee':
      return `${sets} ضغط بالركب — الطبيعي إن أديته يحل محل المساعد`;
    case 'transition':
      return `${sets} × 10 — الطبيعي أولًا ثم أكمل بالركب`;
    case 'endurance':
      return `${sets} ضغط أرضي طبيعي`;
    case 'maintain':
      return 'جلسة المحافظة الأسبوعية — الهدف محقق';
  }
}

export function PushSection({ rx, entry, onChange, result }: Props) {
  const readOnly = !onChange;
  const best = entry ? bestStrictSet(entry.sets) : null;
  const updateSet = (i: number, patch: Partial<PushSetEntry>) => {
    if (!entry) return;
    const sets = entry.sets.map((s, j) => (j === i ? { ...s, ...patch } : s));
    onChange?.({ ...entry, sets });
  };

  return (
    <div className="section">
      <SectionHead title="الضغط" code={rx.code} result={result} />
      <p className="rx-sub">{headline(rx)}</p>
      {entry ? (
        <div className={`set-cols${rx.assisted ? '' : ' set-cols--one'}`} aria-hidden="true">
          <span />
          <span>طبيعي</span>
          {rx.assisted ? <span>{ASSISTED_LABEL[rx.assisted]}</span> : null}
        </div>
      ) : null}
      <ol className="sets">
        {rx.sets.map((target, i) => {
          const set = entry?.sets[i];
          const touched = set && (set.normal !== null || set.assisted !== null);
          const met = isPushSetMet(rx, target, set);
          return (
            <li key={i} className={`row${entry ? (rx.assisted ? ' row--two' : ' row--one') : ''}`}>
              <div className="row__label">
                <span className="row__num">
                  {i + 1}
                  {touched ? (
                    <span className={`set__mark${met ? ' set__mark--ok' : ''}`} aria-label={met ? 'الجولة مكتملة' : 'الجولة غير مكتملة'}>
                      <Icon name={met ? 'check' : 'x'} size={12} strokeWidth={2.8} />
                    </span>
                  ) : null}
                </span>
                <span className="row__target">{setTarget(rx, target, i)}</span>
              </div>
              {entry ? (
                <>
                  <NumberField label={`الجولة ${i + 1} — طبيعي`} hideLabel value={set?.normal ?? null} onChange={(v) => updateSet(i, { normal: v })} disabled={readOnly} />
                  {rx.assisted ? (
                    <NumberField
                      label={`الجولة ${i + 1} — مساعد ${ASSISTED_LABEL[rx.assisted]}`}
                      hideLabel
                      value={set?.assisted ?? null}
                      onChange={(v) => updateSet(i, { assisted: v })}
                      disabled={readOnly}
                    />
                  ) : null}
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
      {best !== null ? (
        <p className="computed">
          أعلى طبيعي متواصل في جولة <b>{best}</b>
        </p>
      ) : null}
      <RestNote text={formatRest(rx.restSec)} />
      <p className="hint">أفضل متواصل يُحسب من جولة طبيعية واحدة، لا من المجموع.</p>
      {entry ? <EffortRow effort={entry.effort} pain={entry.pain} onChange={readOnly ? undefined : (p) => onChange?.({ ...entry, ...p })} /> : null}
    </div>
  );
}
