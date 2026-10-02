import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Receipt, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useDeleteExpense } from '@/hooks/mutations';
import { useAttachments, useExpenses } from '@/hooks/queries';
import { ExpenseStatus } from '@/types/schema';
import type { EventTask, Expense } from '@/types/entities';
import { formatDateOnly } from '@/utils/dates';
import { EXPENSE_CATEGORY_LABEL, EXPENSE_STATUS_LABEL, errorMessage, formatCurrency } from '@/utils/format';
import { ExpenseDialog } from './ExpenseDialog';

const STATUS_TONE: Record<ExpenseStatus, ChipTone> = {
  [ExpenseStatus.Estimated]: 'pending',
  [ExpenseStatus.Approved]: 'navy',
  [ExpenseStatus.Paid]: 'green',
  [ExpenseStatus.Cancelled]: 'outline',
};

function Summary({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-page p-4">
      <p className="text-xs font-semibold text-secondary">{label}</p>
      <p className={`tabular mt-1 text-xl font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}

export function BudgetTab({ eventId, budgetBase, tasks, canEdit }: {
  eventId: string; budgetBase: number; tasks: EventTask[]; canEdit: boolean;
}) {
  const eventIds = useMemo(() => [eventId], [eventId]);
  const expenses = useExpenses(eventIds);
  const expenseIds = useMemo(() => (expenses.data ?? []).map((x) => x.id), [expenses.data]);
  const receipts = useAttachments(expenseIds);
  const del = useDeleteExpense();
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const taskTitle = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks]);
  const receiptCount = useMemo(() => {
    const m = new Map<string, number>();
    receipts.data?.forEach((r) => m.set(r.objectId, (m.get(r.objectId) ?? 0) + 1));
    return m;
  }, [receipts.data]);

  if (expenses.isPending) {
    return (
      <LoadingRegion label="Loading budget">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        {[0, 1, 2].map((i) => <Skeleton key={i} className="mt-3 h-14" />)}
      </LoadingRegion>
    );
  }
  if (expenses.isError) return <ErrorState error={expenses.error} title="Couldn't load expenses" onRetry={() => void expenses.refetch()} />;

  const list = [...expenses.data].sort((a, b) => (b.paymentDate ?? '').localeCompare(a.paymentDate ?? '') || a.name.localeCompare(b.name));
  const live = list.filter((x) => x.status !== ExpenseStatus.Cancelled);
  const spent = live.reduce((s, x) => s + (x.actualAmountBase ?? 0), 0);
  const estimated = live.reduce((s, x) => s + (x.estimatedAmountBase ?? 0), 0);
  const remaining = budgetBase - spent;

  const onDelete = (x: Expense) => {
    if (!window.confirm(`Delete "${x.name}"? Its receipts are deleted too. This can't be undone.`)) return;
    setProblem(null);
    del.mutate(x, { onError: (e) => setProblem(`"${x.name}" wasn't deleted: ${errorMessage(e)}`) });
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Budget" value={budgetBase ? formatCurrency(budgetBase) : '—'} />
        <Summary label="Estimated" value={formatCurrency(estimated)} />
        <Summary label="Spent" value={formatCurrency(spent)} />
        <Summary label="Remaining" value={formatCurrency(remaining)} tone={remaining < 0 ? 'text-red-700' : 'text-green-700'} />
      </div>

      <div className="mt-5 mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold">Expenses <span className="tabular text-sm font-semibold text-muted">({list.length})</span></h3>
        {canEdit && <Button onClick={() => setEditing('new')} icon={<Plus className="size-4" aria-hidden />}>Add expense</Button>}
      </div>

      {problem && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{problem}</p>}

      {list.length === 0 ? (
        <EmptyState icon={<Wallet className="size-6" />} title="No expenses yet"
          description={canEdit ? 'Add estimated costs early, then record actual amounts and receipts as you pay.' : 'Expenses recorded by managers will appear here.'}
          action={canEdit ? <Button onClick={() => setEditing('new')} icon={<Plus className="size-4" aria-hidden />}>Add expense</Button> : undefined} />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {list.map((x) => {
            const count = receiptCount.get(x.id) ?? 0;
            return (
              <li key={x.id} className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 ${x.status === ExpenseStatus.Cancelled ? 'opacity-60' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{x.name}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                    <span>{EXPENSE_CATEGORY_LABEL[x.category]}</span>
                    {x.vendor && <span>· {x.vendor}</span>}
                    {x.paymentDate && <span>· Paid {formatDateOnly(x.paymentDate, 'MMM d')}</span>}
                    {x.eventTaskId && (
                      <span>· <Link to={`/tasks/${x.eventTaskId}`} className="font-semibold text-navy-700 hover:underline">{taskTitle.get(x.eventTaskId) ?? 'Linked task'}</Link></span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="tabular text-right">
                    <span className="block font-bold">{formatCurrency(x.actualAmount)}</span>
                    <span className="block text-xs text-muted">est. {formatCurrency(x.estimatedAmount)}</span>
                  </span>
                  <Chip tone={STATUS_TONE[x.status]}>{EXPENSE_STATUS_LABEL[x.status]}</Chip>
                  <span className="flex items-center gap-1 text-muted" aria-label={`${count} receipts`}><Receipt className="size-4" aria-hidden /><span className="tabular">{count}</span></span>
                  {canEdit && (
                    <span className="flex">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${x.name}`} onClick={() => setEditing(x)} icon={<Pencil className="size-4" aria-hidden />} />
                      <Button variant="ghost" size="icon" aria-label={`Delete ${x.name}`} disabled={del.isPending} onClick={() => onDelete(x)} icon={<Trash2 className="size-4" aria-hidden />} />
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <ExpenseDialog
          key={editing === 'new' ? 'new' : editing.id}
          eventId={eventId}
          expense={editing === 'new' ? null : editing}
          tasks={tasks}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
