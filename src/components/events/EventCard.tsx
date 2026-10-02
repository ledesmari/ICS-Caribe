import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { AvatarStack } from '@/components/ui/Avatar';
import { Chip, EventStatusChip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/States';
import type { EventStats } from '@/hooks/useEventsOverview';
import { EventStatus } from '@/types/schema';
import { daysUntil, formatDateOnly, formatDateRange } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';

export function DateTile({ date, size = 'md' }: { date: string; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`flex shrink-0 flex-col items-center justify-center rounded-2xl bg-orange-50 leading-none text-orange-900 ${size === 'lg' ? 'size-16' : 'size-14'}`}
      aria-hidden
    >
      <span className="text-[11px] font-bold uppercase tracking-wide">{date ? formatDateOnly(date, 'MMM') : '—'}</span>
      <span className={`tabular font-extrabold ${size === 'lg' ? 'text-2xl' : 'text-xl'}`}>{date ? formatDateOnly(date, 'd') : ''}</span>
    </span>
  );
}

function whenLabel(start: string, end: string, status: EventStatus): string {
  if (status === EventStatus.Completed) return 'Completed';
  if (status === EventStatus.Cancelled) return 'Cancelled';
  if (!start) return 'No date';
  const days = daysUntil(start);
  if (days > 0) return `In ${days} day${days === 1 ? '' : 's'}`;
  const sinceEnd = -daysUntil(end || start);
  if (sinceEnd <= 0) return end && end !== start ? 'Happening now' : 'Today';
  return `${sinceEnd} day${sinceEnd === 1 ? '' : 's'} ago`;
}

export function EventCard({ stats }: { stats: EventStats }) {
  const { event, totalTasks, doneTasks, overdueTasks, spentBase, budgetBase, assignees } = stats;
  const dateText = event.eventDate ? formatDateRange(event.eventDate, event.endDate) : 'No date';
  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex h-full flex-col rounded-3xl border border-line bg-white p-5 transition-shadow hover:shadow-md"
      aria-label={`${event.name}, ${dateText}${event.location ? `, ${event.location}` : ''}`}
    >
      <div className="flex items-start gap-4">
        <DateTile date={event.eventDate} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-bold group-hover:underline">{event.name}</h3>
          {event.endDate && event.endDate !== event.eventDate && (
            <p className="mt-1 text-sm font-semibold text-secondary">{dateText}</p>
          )}
          {event.location && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <MapPin className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{event.location}</span>
            </p>
          )}
        </div>
        <EventStatusChip status={event.status} />
      </div>

      <dl className="mt-5 space-y-4 text-sm">
        <div>
          <div className="mb-1.5 flex justify-between">
            <dt className="text-secondary">Tasks</dt>
            <dd className="tabular font-semibold">{doneTasks} of {totalTasks}</dd>
          </div>
          <ProgressBar value={doneTasks} max={totalTasks} label={`${doneTasks} of ${totalTasks} tasks complete`} />
        </div>
        <div>
          <div className="mb-1.5 flex justify-between gap-2">
            <dt className="text-secondary">Budget spent</dt>
            <dd className="tabular font-semibold">
              {formatCurrency(spentBase)} <span className="font-normal text-muted">of {budgetBase ? formatCurrency(budgetBase) : '—'}</span>
            </dd>
          </div>
          <ProgressBar
            value={spentBase}
            max={budgetBase}
            tone={budgetBase > 0 && spentBase > budgetBase ? 'red' : 'orange'}
            label={`Budget spent ${formatCurrency(spentBase)} of ${budgetBase ? formatCurrency(budgetBase) : 'no budget'}`}
          />
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
        {assignees.length > 0 ? <AvatarStack people={assignees} /> : <span className="text-xs text-muted">No assignees</span>}
        {overdueTasks > 0 ? (
          <Chip tone="red">{overdueTasks} overdue</Chip>
        ) : (
          <span className="text-xs font-semibold text-secondary">{whenLabel(event.eventDate, event.endDate, event.status)}</span>
        )}
      </div>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="rounded-3xl border border-line bg-white p-5" aria-hidden>
      <div className="flex gap-4">
        <Skeleton className="size-14 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-6 h-2" />
      <Skeleton className="mt-5 h-2" />
      <div className="mt-6 flex justify-between">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}
