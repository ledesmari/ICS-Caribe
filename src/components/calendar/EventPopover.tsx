/** Event details popover (Calendar): template + status, dates + countdown, tasks, budget, next meeting. */
import { CalendarPlus, MapPin, Video, X } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip, EventStatusChip } from '@/components/ui/Chip';
import { Popover } from '@/components/ui/Popover';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { CalendarEvent } from '@/hooks/useCalendarData';
import type { Meeting } from '@/types/entities';
import { eventCountdown } from '@/utils/calendarLayout';
import { formatDateRange, formatDateTime } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';

export function EventPopover({ item, anchor, nextMeeting, canSchedule, onSchedule, onClose }: {
  item: CalendarEvent;
  anchor: HTMLElement;
  nextMeeting: Meeting | undefined;
  canSchedule: boolean;
  onSchedule: () => void;
  onClose: () => void;
}) {
  const { event, template, color, stats, start, end } = item;
  const countdown = eventCountdown(start, end);
  return (
    <Popover anchor={anchor} onClose={onClose} label={event.name}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Chip className={`${color.bg} ${color.text}`} icon={<span className={`size-1.5 rounded-full ${color.solid}`} aria-hidden />}>
            {template?.name ?? 'No template'}
          </Chip>
          <EventStatusChip status={event.status} />
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="-mt-2 -mr-2 hidden sm:inline-flex" icon={<X className="size-5" aria-hidden />} />
      </div>

      <h3 className="mt-3 hidden text-lg leading-snug font-extrabold sm:block">{event.name}</h3>
      <p className="mt-1 text-sm text-secondary">
        {formatDateRange(start, end)}
        {' · '}
        <span className={countdown.upcoming ? 'font-semibold text-orange-700' : 'text-muted'}>{countdown.text}</span>
      </p>
      {event.location && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-4 shrink-0" aria-hidden />{event.location}</p>
      )}

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <dt className="text-secondary">Tasks</dt>
            <dd className="flex items-center gap-2">
              <span className="tabular font-semibold">{stats.doneTasks} of {stats.totalTasks}</span>
              {stats.overdueTasks > 0 && <Chip tone="red">{stats.overdueTasks} overdue</Chip>}
            </dd>
          </div>
          <ProgressBar value={stats.doneTasks} max={stats.totalTasks} label={`${stats.doneTasks} of ${stats.totalTasks} tasks complete`} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <dt className="text-secondary">Budget spent</dt>
            <dd className="tabular font-semibold">
              {formatCurrency(stats.spentBase)} <span className="font-normal text-muted">of {stats.budgetBase ? formatCurrency(stats.budgetBase) : '—'}</span>
            </dd>
          </div>
          <ProgressBar value={stats.spentBase} max={stats.budgetBase} tone={stats.budgetBase > 0 && stats.spentBase > stats.budgetBase ? 'red' : 'orange'}
            label={`Budget spent ${formatCurrency(stats.spentBase)} of ${stats.budgetBase ? formatCurrency(stats.budgetBase) : 'no budget'}`} />
        </div>
        {nextMeeting && (
          <div>
            <dt className="text-secondary">Next meeting</dt>
            <dd className="mt-1 flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{nextMeeting.subject}</span>
                <span className="text-muted">{formatDateTime(nextMeeting.start, 'EEE, MMM d · h:mm a')}</span>
              </span>
              {nextMeeting.isOnline && <Chip tone="navy" icon={<Video className="size-3.5" aria-hidden />}>Teams</Chip>}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <ButtonLink to={`/events/${event.id}`} variant="secondary">Open event</ButtonLink>
        {canSchedule && (
          <Button variant="outline" onClick={onSchedule} icon={<CalendarPlus className="size-4" aria-hidden />}>Schedule meeting</Button>
        )}
      </div>
    </Popover>
  );
}
