import { memo } from 'react';
import { Card } from '../../components/ui/Bits';
import { formatClock, formatShortDate } from '../../components/format';
import type { Statistics } from '../../domain/progress/statistics';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <dt className="stat__label">{label}</dt>
      <dd className="stat__value">{value}</dd>
      {sub ? <dd className="stat__sub">{sub}</dd> : null}
    </div>
  );
}

const NONE = '—';

export const StatsCard = memo(function StatsCard({ stats }: { stats: Statistics }) {
  const { records: r } = stats;
  const run = r.bestContinuous;
  return (
    <Card className="stats" labelledBy="stats-title">
      <h2 id="stats-title" className="card__title">
        الإحصائيات
      </h2>
      <dl className="stats__row">
        <Stat label="مكتملة" value={String(stats.completed)} />
        <Stat label="جزئية" value={String(stats.partial)} />
        <Stat label="غياب" value={String(stats.absent)} />
      </dl>
      <dl className="stats__grid">
        <Stat
          label="أطول جري متواصل"
          value={run ? `${run.km.toFixed(2)} كم` : NONE}
          sub={run ? `${run.sec !== null ? `${formatClock(run.sec)} · ` : ''}${formatShortDate(run.date)}` : 'لم يُسجَّل بعد'}
        />
        <Stat
          label="أفضل زمن موثوق لـ 5 كم"
          value={r.best5k ? formatClock(r.best5k.sec) : NONE}
          sub={r.best5k ? formatShortDate(r.best5k.date) : '5 كم متواصلة بزمن مسجّل'}
        />
        <Stat label="أفضل ضغط أرضي متواصل" value={r.bestPush ? String(r.bestPush.reps) : NONE} sub={r.bestPush ? formatShortDate(r.bestPush.date) : 'في جولة واحدة'} />
        <Stat label="أفضل معدة متواصلة" value={r.bestSit ? String(r.bestSit.reps) : NONE} sub={r.bestSit ? formatShortDate(r.bestSit.date) : 'في جولة واحدة'} />
      </dl>
      <h3 className="card__subtitle">المستوى الحالي</h3>
      <dl className="levels">
        <div>
          <dt>الجري</dt>
          <dd>{stats.levels.running}</dd>
        </div>
        <div>
          <dt>الضغط</dt>
          <dd>{stats.levels.pushups}</dd>
        </div>
        <div>
          <dt>المعدة</dt>
          <dd>{stats.levels.situps}</dd>
        </div>
        <div>
          <dt>مرات التقدم في المنهج</dt>
          <dd>{stats.progressions}</dd>
        </div>
      </dl>
    </Card>
  );
});
