/** Week view on phones/tablets: horizontal day strip + agenda for the selected day (no time grid). */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { MapPin, Video } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import type { CalendarEvent, CalendarMeeting } from '@/hooks/useCalendarData';
import { EventStatus } from '@/types/schema';
import type { DateOnly } from '@/types/entities';
import type { CalendarWindow } from '@/utils/calendarWindow';
import { formatDateOnly, formatDateRange, todayDateOnly } from '@/utils/dates';

const MAX_DOTS = 3;

/** Agenda card (also used by the mobile month in B6). */
export function AgendaCard({ item, active, onOpen }: { item: CalendarEvent; active: boolean; onOpen: (item: CalendarEvent, anchor: HTMLElement) => void }) {
  const { event, color, stats, template } = item;
  const cancelled = event.status === EventStatus.Cancelled;
  const pct = stats.totalTasks ? (stats.doneTasks / stats.totalTasks) * 100 : 0;
  return (
    <button type="button" onClick={(e) => onOpen(item, e.currentTarget)}
      className={`w-full rounded-2xl border border-line bg-white p-4 text-left hover:bg-page ${active ? 'ring-2 ring-navy-700' : ''} ${cancelled ? 'opacity-60' : ''}`}>
      <span className="flex flex-wrap items-center gap-1.5">
        <Chip className={`${color.bg} ${color.text}`} icon={<span className={`size-1.5 rounded-full ${color.solid}`} aria-hidden />}>
          {template?.name ?? 'No template'}
        </Chip>
        {stats.overdueTasks > 0 && <Chip tone="red">{stats.overdueTasks} overdue</Chip>}
      </span>
      <span className={`mt-2 block font-bold ${cancelled ? 'line-through' : ''}`}>{event.name}</span>
      <span className="mt-0.5 block text-sm text-secondary">{formatDateRange(item.start, item.end)}</span>
      {event.location && <span className="mt-0.5 flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" aria-hidden />{event.location}</span>}
      <span className="mt-3 flex items-center gap-2 text-xs font-semibold text-secondary">
        <span className="tabular shrink-0">Tasks {stats.doneTasks}/{stats.totalTasks}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-pending-bg" aria-hidden>
          <span className="block h-full rounded-full bg-navy-700" style={{ width: `${pct}%` }} />
        </span>
      </span>
    </button>
  );
}

export function WeekAgenda({ window: win, items, meetings, activeId, onOpenEvent }: {
  window: CalendarWindow;
  items: CalendarEvent[];
  meetings: CalendarMeeting[];
  activeId: string | null;
  onOpenEvent: (item: CalendarEvent, anchor: HTMLElement) => void;
}) {
  const today = todayDateOnly();
  const days = win.columns.map((c) => c.start);
  const [picked, setPicked] = useState<DateOnly | null>(null);
  const selected = picked && days.includes(picked) ? picked : days.includes(today) ? today : days[0] ?? today;
  const on = (day: DateOnly) => items.filter((c) => c.start <= day && c.end >= day);
  const dayItems = on(selected);
  const dayMeetings = meetings.filter((m) => m.day === selected);

  return (
    <div>
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2" role="group" aria-label="Days of the week">
        {days.map((d) => {
          const list = on(d);
          const isSel = d === selected;
          return (
            <button key={d} type="button" aria-pressed={isSel} onClick={() => setPicked(d)}
              aria-label={`${formatDateOnly(d, 'EEEE, MMMM d')}, ${list.length} event${list.length === 1 ? '' : 's'}`}
              className={`flex min-h-16 min-w-12 flex-1 flex-col items-center justify-center gap-1 rounded-2xl ${isSel ? 'bg-navy-700 text-white' : 'hover:bg-navy-50'}`}>
              <span className="text-[11px] font-bold uppercase">{formatDateOnly(d, 'EEE')}</span>
              <span className={`tabular flex size-7 items-center justify-center rounded-full text-sm font-bold ${d === today && !isSel ? 'bg-orange-500 text-ink' : ''}`}>
                {Number(d.slice(8))}
              </span>
              <span className="flex h-1.5 gap-0.5" aria-hidden>
                {list.slice(0, MAX_DOTS).map((c) => <span key={c.id} className={`size-1.5 rounded-full ${isSel ? 'bg-white' : c.color.solid}`} />)}
              </span>
            </button>
          );
        })}
      </div>

      <h3 className="mt-3 mb-2 text-sm font-bold text-secondary" aria-live="polite">{formatDateOnly(selected, 'EEEE, MMMM d')}</h3>
      {dayItems.length === 0 && dayMeetings.length === 0 ? (
        <p className="rounded-2xl bg-page p-4 text-sm text-muted">Nothing on this day.</p>
      ) : (
        <div className="space-y-2">
          {dayItems.map((c) => <AgendaCard key={c.id} item={c} active={c.id === activeId} onOpen={onOpenEvent} />)}
          {dayMeetings.length > 0 && (
            <ul className="space-y-2 pt-1" aria-label="Meetings">
              {dayMeetings.map(({ meeting, item }) => (
                <li key={meeting.id}>
                  <button type="button" onClick={(e) => onOpenEvent(item, e.currentTarget)}
                    className={`flex w-full items-center gap-3 rounded-2xl border-l-4 border-current p-3 text-left text-sm ${item.color.bg} ${item.color.text}`}>
                    <span className="tabular shrink-0 font-bold">{format(parseISO(meeting.start), 'h:mm a')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{meeting.subject}</span>
                      <span className="block truncate text-xs">{item.event.name}</span>
                    </span>
                    {meeting.isOnline && <Video className="size-4 shrink-0" aria-label="Teams meeting" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
