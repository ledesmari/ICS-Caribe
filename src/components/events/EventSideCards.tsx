import { CalendarClock, ExternalLink, Video } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { StackedBar, type Segment } from '@/components/ui/ProgressBar';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { ExpenseCategory, ExpenseStatus, MeetingStatus, TaskStatus } from '@/types/schema';
import type { EventTask, Expense, Meeting, Ref } from '@/types/entities';
import { formatDateTime } from '@/utils/dates';
import { EXPENSE_CATEGORY_LABEL, formatCurrency, isTaskOverdue } from '@/utils/format';

const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  [ExpenseCategory.Airfare]: 'bg-navy-700',
  [ExpenseCategory.Lodging]: 'bg-orange-500',
  [ExpenseCategory.Meals]: 'bg-green-600',
  [ExpenseCategory.AvEquipmentRental]: 'bg-navy-300',
  [ExpenseCategory.GroundTransportation]: 'bg-orange-300',
  [ExpenseCategory.Venue]: 'bg-green-300',
  [ExpenseCategory.MaterialsAndPrinting]: 'bg-navy-900',
  [ExpenseCategory.Other]: 'bg-pending',
};

function CardSkeleton() {
  return (
    <div className="rounded-3xl border border-line bg-white p-5" aria-hidden>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-4 h-3" />
    </div>
  );
}

export function BudgetCard({ budgetBase, expenses, isPending, error, onRetry }: {
  budgetBase: number; expenses: Expense[] | undefined; isPending: boolean; error: unknown; onRetry: () => void;
}) {
  if (isPending) return <CardSkeleton />;
  if (error) return <ErrorState error={error} title="Couldn't load the budget" onRetry={onRetry} />;
  const live = (expenses ?? []).filter((x) => x.status !== ExpenseStatus.Cancelled);
  const spent = live.reduce((s, x) => s + (x.actualAmountBase ?? 0), 0);
  const estimated = live.reduce((s, x) => s + (x.estimatedAmountBase ?? 0), 0);
  const remaining = budgetBase - spent;
  const segments: Segment[] = (Object.keys(CATEGORY_COLOR).map(Number) as ExpenseCategory[])
    .map((c) => ({
      key: String(c),
      label: EXPENSE_CATEGORY_LABEL[c],
      value: live.filter((x) => x.category === c).reduce((s, x) => s + (x.actualAmountBase ?? 0), 0),
      colorClass: CATEGORY_COLOR[c],
    }))
    .filter((s) => s.value > 0);

  return (
    <Card aria-labelledby="budget-card">
      <CardHeader id="budget-card" title="Budget" />
      <p className="tabular text-3xl font-extrabold">{formatCurrency(spent)}</p>
      <p className="tabular text-sm text-muted">spent of {budgetBase ? formatCurrency(budgetBase) : 'no budget set'}</p>
      <div className="mt-4">
        <StackedBar segments={segments} max={budgetBase} label={`Spending by category: ${segments.map((s) => `${s.label} ${formatCurrency(s.value)}`).join(', ') || 'none yet'}`} />
      </div>
      {segments.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {segments.map((s) => (
            <li key={s.key} className="flex min-w-0 items-center gap-1.5">
              <span className={`size-2.5 shrink-0 rounded-full ${s.colorClass}`} aria-hidden />
              <span className="truncate text-secondary">{s.label}</span>
              <span className="tabular ml-auto font-semibold">{formatCurrency(s.value, 'USD', true)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No spending recorded yet.</p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-page p-3">
          <dt className="text-xs font-semibold text-secondary">Estimated</dt>
          <dd className="tabular mt-1 font-bold">{formatCurrency(estimated)}</dd>
        </div>
        <div className={`rounded-2xl p-3 ${remaining < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <dt className="text-xs font-semibold text-secondary">Remaining</dt>
          <dd className={`tabular mt-1 font-bold ${remaining < 0 ? 'text-red-700' : 'text-green-700'}`}>{formatCurrency(remaining)}</dd>
        </div>
      </dl>
    </Card>
  );
}

export function NextMeetingCard({ meetings, isPending, error, onRetry }: {
  meetings: Meeting[] | undefined; isPending: boolean; error: unknown; onRetry: () => void;
}) {
  if (isPending) return <CardSkeleton />;
  if (error) return <ErrorState error={error} title="Couldn't load meetings" onRetry={onRetry} />;
  const now = new Date().toISOString();
  const next = (meetings ?? [])
    .filter((m) => m.status === MeetingStatus.Scheduled && m.end >= now)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  return (
    <Card aria-labelledby="next-meeting">
      <CardHeader id="next-meeting" title="Next meeting" />
      {!next ? (
        <p className="flex items-center gap-2 text-sm text-muted"><CalendarClock className="size-4" aria-hidden /> No meetings scheduled.</p>
      ) : (
        <>
          <p className="font-bold">{next.subject}</p>
          <p className="mt-1 text-sm text-secondary">{formatDateTime(next.start, 'EEE, MMM d · h:mm a')} – {formatDateTime(next.end, 'h:mm a')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {next.isOnline ? <Chip tone="navy" icon={<Video className="size-3.5" aria-hidden />}>Teams</Chip> : next.location && <Chip tone="outline">{next.location}</Chip>}
          </div>
          {next.joinUrl && (
            <a href={next.joinUrl} target="_blank" rel="noreferrer" className={buttonClasses('secondary', 'md', 'mt-4 w-full justify-center')}>
              Join <ExternalLink className="size-4" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </>
      )}
    </Card>
  );
}

export function TeamCard({ tasks }: { tasks: EventTask[] }) {
  const people = new Map<string, { person: Ref; open: number; total: number; overdue: number }>();
  for (const t of tasks) {
    if (!t.assignee.id) continue;
    const row = people.get(t.assignee.id) ?? { person: t.assignee, open: 0, total: 0, overdue: 0 };
    row.total += 1;
    if (t.status !== TaskStatus.Completed) row.open += 1;
    if (isTaskOverdue(t)) row.overdue += 1;
    people.set(t.assignee.id, row);
  }
  const rows = [...people.values()].sort((a, b) => b.open - a.open);
  return (
    <Card aria-labelledby="team-card">
      <CardHeader id="team-card" title="Team" />
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No one is assigned yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.person.id} className="flex items-center gap-3">
              <Avatar person={r.person} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.person.name || 'Unknown user'}</span>
                <span className="tabular block text-xs text-muted">{r.open} open · {r.total} total</span>
              </span>
              {r.overdue > 0 && <Chip tone="red">{r.overdue} overdue</Chip>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
