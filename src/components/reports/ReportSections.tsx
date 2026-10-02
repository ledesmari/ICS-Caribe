import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Chip, EventStatusChip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { EventStats } from '@/hooks/useEventsOverview';
import type { DateOnly, Ref } from '@/types/entities';
import { daysUntil, formatDateOnly, formatDateRange } from '@/utils/dates';
import { EXPENSE_CATEGORY_LABEL, EXPENSE_STATUS_LABEL, formatCurrency } from '@/utils/format';
import { DUE_SOON_DAYS, type Report } from '@/utils/reports';

const usd = (n: number) => formatCurrency(n, 'USD', true);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const th = 'px-3 py-2 text-left text-xs font-bold tracking-wide text-muted uppercase';
const td = 'px-3 py-3 align-middle';

function Section({ id, title, description, action, children }: {
  id: string; title: string; description?: ReactNode; action?: ReactNode; children: ReactNode;
}) {
  return (
    <Card aria-labelledby={id}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id} className="text-lg font-bold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-page px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

/* ---------- 1. Event health ---------- */

type HealthSort = 'date' | 'overdue' | 'budget';

function budgetRatio(s: EventStats) {
  return s.budgetBase > 0 ? s.spentBase / s.budgetBase : 0;
}

function daysLabel(d: number) {
  if (d === 0) return 'Today';
  return d > 0 ? `In ${d}d` : `${-d}d ago`;
}

export function EventHealthSection({ stats, today }: { stats: EventStats[]; today: DateOnly }) {
  const [sort, setSort] = useState<HealthSort>('date');
  const rows = useMemo(() => {
    if (sort === 'overdue') return [...stats].sort((a, b) => b.overdueTasks - a.overdueTasks);
    if (sort === 'budget') return [...stats].sort((a, b) => budgetRatio(b) - budgetRatio(a));
    return stats;
  }, [stats, sort]);

  return (
    <Section
      id="report-health"
      title="Event health"
      description="Progress, overdue work and budget use for each event."
      action={<SegmentedControl<HealthSort> label="Sort events by" value={sort} onChange={setSort}
        options={[{ value: 'date', label: 'Date' }, { value: 'overdue', label: 'Overdue' }, { value: 'budget', label: 'Budget used' }]} />}
    >
      {rows.length === 0 ? <Empty>No events match these filters.</Empty> : (
        <div className="-mx-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr><th className={th}>Event</th><th className={th}>Event date</th><th className={th}>Tasks done</th><th className={th}>Overdue</th><th className={th}>Budget used</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const ratio = budgetRatio(s);
                return (
                  <tr key={s.event.id} className="border-t border-line">
                    <td className={td}>
                      <Link to={`/events/${s.event.id}`} className="font-semibold text-navy-700 hover:underline">{s.event.name}</Link>
                      <div className="mt-1"><EventStatusChip status={s.event.status} /></div>
                    </td>
                    <td className={`${td} tabular whitespace-nowrap`}>
                      {s.event.eventDate ? <>{formatDateRange(s.event.eventDate, s.event.endDate)}<span className="block text-xs text-muted">{daysLabel(daysUntil(s.event.eventDate, today))}</span></> : '—'}
                    </td>
                    <td className={`${td} w-40`}>
                      <ProgressBar value={s.doneTasks} max={s.totalTasks} tone="green" label={`${s.event.name}: tasks done`} />
                      <span className="tabular mt-1 block text-xs text-muted">{s.doneTasks}/{s.totalTasks} · {pct(s.doneTasks, s.totalTasks)}%</span>
                    </td>
                    <td className={`${td} tabular font-bold ${s.overdueTasks > 0 ? 'text-red-700' : 'text-muted'}`}>{s.overdueTasks}</td>
                    <td className={`${td} w-48`}>
                      {s.budgetBase > 0 ? (
                        <>
                          <ProgressBar value={s.spentBase} max={s.budgetBase} tone={ratio > 1 ? 'red' : 'orange'} label={`${s.event.name}: budget used`} />
                          <span className={`tabular mt-1 block text-xs ${ratio > 1 ? 'font-bold text-red-700' : 'text-muted'}`}>
                            {usd(s.spentBase)} of {usd(s.budgetBase)} · {Math.round(ratio * 100)}%
                          </span>
                        </>
                      ) : <span className="tabular text-xs text-muted">{usd(s.spentBase)} spent · no budget</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ---------- 2. At-risk tasks ---------- */

type RiskGroup = 'assignee' | 'event';

function dueChip(days: number) {
  if (days < 0) return <Chip tone="red">{-days}d late</Chip>;
  return <Chip tone="orange">{days === 0 ? 'Due today' : `Due in ${days}d`}</Chip>;
}

export function AtRiskSection({ items }: { items: Report['atRisk'] }) {
  const [groupBy, setGroupBy] = useState<RiskGroup>('assignee');
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; title: string; person?: Ref; items: Report['atRisk'] }>();
    for (const it of items) {
      const t = it.task;
      const key = groupBy === 'assignee' ? t.assignee.id || 'none' : t.eventId;
      const g = map.get(key) ?? (groupBy === 'assignee'
        ? { key, title: t.assignee.name || 'Unassigned', person: t.assignee, items: [] }
        : { key, title: t.eventName || 'Event', items: [] });
      g.items.push(it);
      map.set(key, g);
    }
    return [...map.values()];
  }, [items, groupBy]);

  return (
    <Section
      id="report-risk"
      title="At-risk tasks"
      description={`Overdue, or due in the next ${DUE_SOON_DAYS} days.`}
      action={<SegmentedControl<RiskGroup> label="Group at-risk tasks by" value={groupBy} onChange={setGroupBy}
        options={[{ value: 'assignee', label: 'Person' }, { value: 'event', label: 'Event' }]} />}
    >
      {groups.length === 0 ? <Empty>Nothing overdue or due in the next {DUE_SOON_DAYS} days.</Empty> : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
                {g.person && <Avatar person={g.person} size="sm" />}
                <span className="truncate">{g.title}</span>
                <span className="tabular rounded-full bg-pending-bg px-2 text-xs text-pending">{g.items.length}</span>
              </h3>
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {g.items.map(({ task, days }) => (
                  <li key={task.id}>
                    <Link to={`/tasks/${task.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-navy-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{task.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {groupBy === 'assignee' ? task.eventName : task.assignee.name || 'Unassigned'} · due {formatDateOnly(task.dueDate, 'MMM d')}
                        </span>
                      </span>
                      {dueChip(days)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ---------- 3. Budget vs actual ---------- */

export function BudgetSection({ budget, budgetBase }: { budget: Report['budget']; budgetBase: number }) {
  const remaining = budgetBase - budget.actualBase;
  const figures: [string, string, string][] = [
    ['Budget', usd(budgetBase), ''],
    ['Estimated', usd(budget.estimatedBase), ''],
    ['Actual', usd(budget.actualBase), budgetBase > 0 && budget.actualBase > budgetBase ? 'text-red-700' : ''],
    ['Remaining', usd(remaining), remaining < 0 ? 'text-red-700' : ''],
  ];
  return (
    <Section id="report-budget" title="Budget vs actual" description="USD. Includes cancelled events; cancelled expenses are excluded.">
      <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {figures.map(([label, value, cls]) => (
          <div key={label} className="rounded-2xl bg-page px-3 py-2.5">
            <dt className="text-xs font-semibold text-muted">{label}</dt>
            <dd className={`tabular text-lg font-extrabold ${cls}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {budget.categories.length === 0 ? <Empty>No expenses recorded for these events.</Empty> : (
        <>
          <div className="-mx-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead><tr><th className={th}>Category</th><th className={`${th} text-right`}>Estimated</th><th className={`${th} text-right`}>Actual</th><th className={th}>Share of actual</th></tr></thead>
              <tbody>
                {budget.categories.map((r) => (
                  <tr key={r.category} className="border-t border-line">
                    <td className={`${td} font-semibold`}>{EXPENSE_CATEGORY_LABEL[r.category]}</td>
                    <td className={`${td} tabular text-right text-muted`}>{usd(r.estimatedBase)}</td>
                    <td className={`${td} tabular text-right font-bold ${r.estimatedBase > 0 && r.actualBase > r.estimatedBase ? 'text-red-700' : ''}`}>{usd(r.actualBase)}</td>
                    <td className={`${td} w-40`}>
                      <ProgressBar value={r.actualBase} max={budget.actualBase} tone="navy" label={`${EXPENSE_CATEGORY_LABEL[r.category]}: share of actual spend`} />
                      <span className="tabular mt-1 block text-xs text-muted">{pct(r.actualBase, budget.actualBase)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span className="font-semibold">Actual by expense status:</span>
            {budget.actualByStatus.map((s) => (
              <span key={s.status} className="tabular">{EXPENSE_STATUS_LABEL[s.status]} {usd(s.actualBase)}</span>
            ))}
          </p>
        </>
      )}
    </Section>
  );
}

/* ---------- 4. Team workload + on-time completion ---------- */

export function WorkloadSection({ rows, onTime }: { rows: Report['workload']; onTime: Report['onTime'] }) {
  return (
    <Section
      id="report-team"
      title="Team workload"
      description={onTime.eligible > 0
        ? <>On time across the team: <span className="tabular font-bold text-ink">{pct(onTime.onTime, onTime.eligible)}%</span> ({onTime.onTime} of {onTime.eligible} completed tasks finished by their due date)</>
        : 'The on-time rate appears once tasks are completed.'}
    >
      {rows.length === 0 ? <Empty>No tasks match these filters.</Empty> : (
        <div className="-mx-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr>
                <th className={th}>Person</th><th className={`${th} text-right`}>Open</th><th className={`${th} text-right`}>Due ≤ {DUE_SOON_DAYS}d</th>
                <th className={`${th} text-right`}>Overdue</th><th className={`${th} text-right`}>Completed</th><th className={th}>On time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const name = r.person.name || 'Unassigned';
                return (
                  <tr key={r.person.id || 'none'} className="border-t border-line">
                    <td className={td}><span className="flex items-center gap-2 font-semibold"><Avatar person={r.person} size="sm" /><span className="truncate">{name}</span></span></td>
                    <td className={`${td} tabular text-right`}>{r.open}</td>
                    <td className={`${td} tabular text-right ${r.dueSoon > 0 ? 'font-bold text-orange-900' : 'text-muted'}`}>{r.dueSoon}</td>
                    <td className={`${td} tabular text-right ${r.overdue > 0 ? 'font-bold text-red-700' : 'text-muted'}`}>{r.overdue}</td>
                    <td className={`${td} tabular text-right`}>{r.completed}</td>
                    <td className={`${td} w-36`}>
                      {r.onTimeEligible > 0 ? (
                        <>
                          <ProgressBar value={r.onTime} max={r.onTimeEligible} tone="green" label={`${name}: on-time completion`} />
                          <span className="tabular mt-1 block text-xs text-muted">{pct(r.onTime, r.onTimeEligible)}% · {r.onTime}/{r.onTimeEligible}</span>
                        </>
                      ) : <span className="text-xs text-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {onTime.missingDates > 0 && (
        <p className="mt-3 text-xs text-muted">
          {onTime.missingDates} completed task{onTime.missingDates === 1 ? '' : 's'} without a completion or due date {onTime.missingDates === 1 ? 'is' : 'are'} left out of the on-time rate.
        </p>
      )}
    </Section>
  );
}
