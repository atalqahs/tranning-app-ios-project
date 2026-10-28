import { memo } from 'react';
import { Card, ProgressBar } from '../../components/ui/Bits';
import { Icon } from '../../components/ui/Icon';
import { formatShortDate } from '../../components/format';
import { goalProgress, milestoneStates } from '../../domain/progress/statistics';
import type { Records } from '../../domain/progress/types';
import type { TrackId } from '../../domain/training/types';

const GOALS: Record<TrackId, { title: string; goal: string }> = {
  running: { title: 'الجري', goal: '5 كم خلال 25 دقيقة' },
  pushups: { title: 'الضغط', goal: '70 ضغطة أرضية متواصلة' },
  situps: { title: 'المعدة', goal: '70 عدة متواصلة' },
};

export const ProgressCard = memo(function ProgressCard({ records }: { records: Records }) {
  const progress = goalProgress(records);
  const milestones = milestoneStates(records);
  return (
    <Card className="progress" labelledBy="progress-title">
      <h2 id="progress-title" className="card__title">
        التقدم والإنجازات
      </h2>
      {progress.map((p) => {
        const g = GOALS[p.track];
        const pct = Math.round(p.percent);
        return (
          <div key={p.track} className="goal">
            <div className="goal__head">
              <h3 className="goal__title">{g.title}</h3>
              <span className="goal__target">{g.goal}</span>
              <span className="goal__pct">{pct}%</span>
            </div>
            <ProgressBar percent={p.percent} label={`${g.title}: ${pct}%`} accent={p.track === 'running'} />
            {p.track === 'running' ? (
              <p className="goal__note">
                {p.stage === 'speed'
                  ? '50–100%: التحسن من أول زمن موثوق لـ 5 كم نحو 25:00'
                  : '0–50%: بناء الجري المتواصل حتى 5 كم؛ النصف الثاني يبدأ بأول زمن موثوق لـ 5 كم'}
              </p>
            ) : null}
            <ul className="milestones">
              {milestones
                .filter((m) => m.track === p.track)
                .map((m) => (
                  <li key={m.id} className={`milestone${m.reachedOn ? ' milestone--done' : ''}`}>
                    {m.reachedOn ? <Icon name="check" size={14} strokeWidth={2.6} /> : null}
                    <span>{m.label}</span>
                    <span className="sr-only">{m.reachedOn ? `تحقق في ${formatShortDate(m.reachedOn)}` : 'لم يتحقق بعد'}</span>
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
      <p className="fineprint">مؤشرات تحفيزية مبنية على نتائجك المسجلة فقط؛ ليست تقييمًا طبيًا أو قياسًا علميًا شاملًا للياقة.</p>
    </Card>
  );
});
