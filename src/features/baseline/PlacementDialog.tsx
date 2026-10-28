import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { DurationField, NumberField } from '../../components/ui/NumberField';
import { formatClock } from '../../components/format';
import { placeAll } from '../../domain/training/placementEngine';
import { pushPositionLabel } from '../../domain/training/pushupPlan';
import { GOAL_DISTANCE_KM, paceStats, runPositionLabel } from '../../domain/training/runningPlan';
import { sitPositionLabel } from '../../domain/training/situpPlan';
import type { AssistedType, PlacementInput, PushSetEntry } from '../../domain/training/types';

export type PlacementMode = 'initial' | 'review' | 'replacement';

const TITLES: Record<PlacementMode, { title: string; submit: string }> = {
  initial: { title: 'تحديد المستوى', submit: 'اعتماد وبناء الجدول' },
  review: { title: 'مراجعة المستوى', submit: 'اعتماد نتائج المراجعة' },
  replacement: { title: 'تحديد مستوى جديد', submit: 'اعتماد واستئناف البرنامج' },
};

const PUSH_ROUNDS = 4;

function blankInput(): PlacementInput {
  return {
    run: { distanceKm: null, durationSec: null, continuous: null, longestContinuousMin: null, first5kSec: null, note: '' },
    push: { assisted: 'knee', rounds: Array.from({ length: PUSH_ROUNDS }, () => ({ normal: null, assisted: null })) },
    sit: { best: null },
  };
}

interface Props {
  open: boolean;
  mode: PlacementMode;
  onClose: () => void;
  onSubmit: (input: PlacementInput) => string | null;
}

export function PlacementDialog({ open, mode, onClose, onSubmit }: Props) {
  const [input, setInput] = useState(blankInput);
  const [error, setError] = useState<string | null>(null);
  const text = TITLES[mode];

  const setRun = (patch: Partial<PlacementInput['run']>) => setInput((i) => ({ ...i, run: { ...i.run, ...patch } }));
  const setRound = (index: number, patch: Partial<PushSetEntry>) =>
    setInput((i) => ({ ...i, push: { ...i.push, rounds: i.push.rounds.map((r, j) => (j === index ? { ...r, ...patch } : r)) } }));
  const setAssisted = (assisted: AssistedType) => setInput((i) => ({ ...i, push: { ...i.push, assisted } }));

  const preview = placeAll(input);
  const pace = input.run.continuous ? paceStats(input.run.distanceKm, input.run.durationSec) : null;

  const submit = () => {
    const message = onSubmit(input);
    if (message) setError(message);
    else setInput(blankInput());
  };

  return (
    <Dialog
      open={open}
      title={text.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="primary" onClick={submit}>
            {text.submit}
          </Button>
        </>
      }
    >
      <p className="sheet__lead">
        أدخل أرقامًا حققتها فعلًا — لا حاجة لأداء الاختبار الآن. اترك الحقل فارغًا إن لم تجرّبه؛ الصفر يعني أنك جرّبت ولم تكمل عدة.
      </p>

      <fieldset className="form-group">
        <legend>الجري</legend>
        <div className="inputs__pair">
          <NumberField label="المسافة" decimal suffix="كم" value={input.run.distanceKm} onChange={(v) => setRun({ distanceKm: v })} />
          <DurationField label="الزمن" value={input.run.durationSec} onChange={(v) => setRun({ durationSec: v })} />
        </div>
        <div className="segmented" role="radiogroup" aria-label="هل كان الجري متواصلًا دون مشي؟">
          <span className="segmented__label">متواصل دون مشي؟</span>
          {([
            [true, 'نعم'],
            [false, 'لا، فيه مشي'],
          ] as const).map(([value, label]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={input.run.continuous === value}
              className={`segmented__opt${input.run.continuous === value ? ' segmented__opt--on' : ''}`}
              onClick={() => setRun({ continuous: input.run.continuous === value ? null : value })}
            >
              {label}
            </button>
          ))}
        </div>
        {input.run.continuous === false ? (
          <>
            <NumberField label="أطول جري متواصل (اختياري)" decimal suffix="دقيقة" value={input.run.longestContinuousMin} onChange={(v) => setRun({ longestContinuousMin: v })} />
            <label className="field">
              <span className="field__label">وصف الفترات (اختياري)</span>
              <span className="field__box">
                <input className="field__input field__input--text" value={input.run.note} onChange={(e) => setRun({ note: e.target.value })} placeholder="مثال: 5 × 3 د جري + 1 د مشي" />
              </span>
            </label>
          </>
        ) : null}
        {input.run.continuous && input.run.distanceKm !== null && input.run.distanceKm > GOAL_DISTANCE_KM ? (
          <DurationField label="زمن أول 5 كم (إن عرفته)" value={input.run.first5kSec} onChange={(v) => setRun({ first5kSec: v })} />
        ) : null}
        {pace ? (
          <p className="computed">
            الوتيرة <b dir="ltr">{formatClock(pace.paceSec)}</b> د/كم · السرعة <b dir="ltr">{pace.kmh.toFixed(1)}</b> كم/س
          </p>
        ) : input.run.continuous === false ? (
          <p className="hint">متوسط رحلة فيها مشي لا يساوي وتيرة الجري المتواصل.</p>
        ) : null}
      </fieldset>

      <fieldset className="form-group">
        <legend>الضغط — 4 جولات</legend>
        <div className="segmented" role="radiogroup" aria-label="نوع الضغط المساعد">
          <span className="segmented__label">المساعد</span>
          {([
            ['knee', 'بالركب'],
            ['incline', 'مائل/جدار'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={input.push.assisted === value}
              className={`segmented__opt${input.push.assisted === value ? ' segmented__opt--on' : ''}`}
              onClick={() => setAssisted(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="set-cols" aria-hidden="true">
          <span />
          <span>طبيعي</span>
          <span>{input.push.assisted === 'knee' ? 'بالركب' : 'مائل'}</span>
        </div>
        <ol className="sets">
          {input.push.rounds.map((r, i) => (
            <li key={i} className="row row--two">
              <div className="row__label">
                <span className="row__target">الجولة {i + 1}</span>
              </div>
              <NumberField label={`الجولة ${i + 1} — أرضي طبيعي`} hideLabel value={r.normal} onChange={(v) => setRound(i, { normal: v })} />
              <NumberField
                label={`الجولة ${i + 1} — ${input.push.assisted === 'knee' ? 'مساعد بالركب' : 'مساعد مائل'}`}
                hideLabel
                value={r.assisted}
                onChange={(v) => setRound(i, { assisted: v })}
              />
            </li>
          ))}
        </ol>
      </fieldset>

      <fieldset className="form-group">
        <legend>المعدة</legend>
        <NumberField label="أقصى Sit-ups متواصلة" value={input.sit.best} onChange={(v) => setInput((i) => ({ ...i, sit: { best: v } }))} />
      </fieldset>

      <div className="preview" aria-live="polite">
        <h3 className="preview__title">{mode === 'review' ? 'المستوى الذي تدعمه النتائج' : 'نقطة البداية'}</h3>
        <dl>
          <div>
            <dt>الجري</dt>
            <dd>{runPositionLabel(preview.running.position)}</dd>
          </div>
          <div>
            <dt>الضغط</dt>
            <dd>{pushPositionLabel(preview.pushups.position)}</dd>
          </div>
          <div>
            <dt>المعدة</dt>
            <dd>{sitPositionLabel(preview.situps.position)}</dd>
          </div>
        </dl>
        {mode === 'review' ? <p className="hint">في المراجعة: تقدّم بحد أقصى مستويين، وتثبيت عند التقارب، ورجوع عند تراجع واضح. الحقول الفارغة تُبقي المستوى كما هو.</p> : null}
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </Dialog>
  );
}
