import { Toggle } from '../../components/ui/Bits';
import { Icon } from '../../components/ui/Icon';
import { NumberField } from '../../components/ui/NumberField';
import type { Num } from '../../domain/training/types';

export interface SectionResult {
  evaluation?: 'success' | 'fail';
}

export function SectionHead({
  title,
  code,
  keySession,
  result,
}: {
  title: string;
  code: string;
  keySession?: boolean;
  result: SectionResult;
}) {
  return (
    <div className="section__head">
      <h3 className="section__title">{title}</h3>
      <span className="chip">{code}</span>
      {keySession ? <span className="chip chip--accent">مفتاحية</span> : null}
      {result.evaluation ? (
        <span className={`result result--${result.evaluation}`}>
          <Icon name={result.evaluation === 'success' ? 'check' : 'x'} size={14} strokeWidth={2.6} />
          {result.evaluation === 'success' ? 'مكتمل' : 'غير مكتمل'}
        </span>
      ) : null}
    </div>
  );
}

export function EffortRow({
  effort,
  pain,
  onChange,
  wantsEffort,
}: {
  effort: Num;
  pain: boolean;
  onChange?: (patch: { effort?: Num; pain?: boolean }) => void;
  wantsEffort?: boolean;
}) {
  const readOnly = !onChange;
  if (readOnly && effort === null && !pain) return null;
  return (
    <div className="effort">
      <span className="effort__label" aria-hidden="true">
        {wantsEffort ? 'الجهد' : 'الصعوبة'} <small>من 10{wantsEffort ? '' : '، اختياري'}</small>
      </span>
      <div className="effort__field">
        <NumberField
          label={wantsEffort ? 'الجهد من 10' : 'الصعوبة من 10، اختياري'}
          hideLabel
          value={effort}
          max={10}
          onChange={(v) => onChange?.({ effort: v })}
          disabled={readOnly}
        />
      </div>
      <Toggle label="ألم أو إصابة" checked={pain} onChange={(v) => onChange?.({ pain: v })} disabled={readOnly} />
    </div>
  );
}

export function RestNote({ text }: { text: string }) {
  return <p className="rest">راحة مقترحة بين الجولات {text}</p>;
}
