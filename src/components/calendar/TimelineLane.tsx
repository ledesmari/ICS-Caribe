/** One swimlane of the timeline: lane header (collapsible) + one row per event (prep bar, event pill, overdue chip). */
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Flag } from 'lucide-react';
import type { CalendarEvent } from '@/hooks/useCalendarData';
import { EventStatus } from '@/types/schema';
import { shortRangeLabel, timelineSpan } from '@/utils/calendarLayout';
import type { CalendarWindow } from '@/utils/calendarWindow';
import { addDaysDateOnly, formatDateRange } from '@/utils/dates';
import type { PaletteEntry } from '@/utils/templateColors';

/** A one-day event stays readable even in Year view. */
const PILL_MIN_PX = 64;
/** Put the overdue chip left of the bars when the pill ends this far right. */
const CHIP_FLIP_PCT = 80;

export function TimelineLane({ name, color, hint, items, collapsed, onToggle, window: win, showPrep, labelWidth, activeId, onOpenEvent }: {
  name: string;
  color: PaletteEntry;
  /** e.g. "8-week template · 30 tasks" */
  hint: string | null;
  items: CalendarEvent[];
  collapsed: boolean;
  onToggle: () => void;
  window: CalendarWindow;
  showPrep: boolean;
  labelWidth: number;
  activeId: string | null;
  onOpenEvent: (item: CalendarEvent, anchor: HTMLElement) => void;
}) {
  const headerId = useId();
  const rowsId = useId();
  return (
    <div role="group" aria-labelledby={headerId}>
      <div className="flex h-11 items-center border-t border-line bg-page">
        <div className="sticky left-0 z-20 flex w-max items-center gap-2 bg-page pr-3 pl-1">
          <button type="button" aria-expanded={!collapsed} aria-controls={rowsId} onClick={onToggle}
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${name}`}
            className="flex size-11 items-center justify-center rounded-full text-secondary hover:bg-navy-50">
            {collapsed ? <ChevronRight className="size-5" aria-hidden /> : <ChevronDown className="size-5" aria-hidden />}
          </button>
          <span className={`size-3 shrink-0 rounded ${color.solid}`} aria-hidden />
          <h3 id={headerId} className="text-sm font-extrabold">{name}</h3>
          <span className="tabular text-xs font-semibold text-secondary">{items.length} event{items.length === 1 ? '' : 's'}</span>
          {hint && <span className="hidden text-xs text-muted sm:inline">· {hint}</span>}
        </div>
      </div>

      <div id={rowsId} hidden={collapsed}>
        {items.map((item) => {
          const { event, stats } = item;
          const cancelled = event.status === EventStatus.Cancelled;
          const pill = timelineSpan(item.start, item.end, win.start, win.end);
          const prep = showPrep && item.prepStart < item.start
            ? timelineSpan(item.prepStart, addDaysDateOnly(item.start, -1), win.start, win.end) : null;
          const pct = stats.totalTasks ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0;
          const pillEnd = pill ? pill.left + pill.width : 0;
          const barsStart = prep?.left ?? pill?.left ?? 0;
          return (
            <div key={item.id} className="flex h-[52px] items-center border-t border-pending-bg">
              <div className="sticky left-0 z-20 shrink-0 self-stretch bg-white px-3 py-1.5" style={{ width: labelWidth }}>
                <Link to={`/events/${event.id}`} className={`block truncate text-sm font-bold text-ink hover:text-navy-700 hover:underline ${cancelled ? 'line-through opacity-60' : ''}`}>
                  {event.name}
                </Link>
                <p className="truncate text-xs text-muted">
                  {event.location ? `${event.location} · ` : ''}<span className="tabular">{stats.doneTasks}/{stats.totalTasks} tasks</span>
                </p>
              </div>
              <div className="relative h-full min-w-0 flex-1">
                {prep && (
                  <div className={`absolute top-1/2 h-4 -translate-y-1/2 overflow-hidden ${prep.clippedStart ? 'rounded-r-full' : 'rounded-full'} ${color.bg}`}
                    style={{ left: `${prep.left}%`, width: `${prep.width}%` }}
                    title={`Prep window: ${formatDateRange(item.prepStart, addDaysDateOnly(item.start, -1))} · ${pct}% of tasks done`} aria-hidden>
                    <div className={`h-full opacity-45 ${color.solid}`} style={{ width: `${pct}%` }} />
                    {prep.clippedStart && <span className={`absolute inset-y-0 left-1 flex items-center text-[10px] ${color.text}`}>◂</span>}
                  </div>
                )}
                {pill && (
                  <button type="button" onClick={(e) => onOpenEvent(item, e.currentTarget)}
                    aria-label={`${event.name}, ${formatDateRange(item.start, item.end)}, ${stats.doneTasks} of ${stats.totalTasks} tasks done${stats.overdueTasks ? `, ${stats.overdueTasks} overdue` : ''}`}
                    className={`absolute top-1/2 z-10 flex h-7 -translate-y-1/2 items-center gap-1 overflow-hidden rounded-full px-2 text-xs font-bold whitespace-nowrap text-white ring-[3px] ring-white ${color.solid} ${
                      item.id === activeId ? 'outline-2 outline-offset-2 outline-navy-700' : ''} ${cancelled ? 'line-through opacity-60' : ''} hover:brightness-110`}
                    style={{ left: `${pill.left}%`, width: `${pill.width}%`, minWidth: PILL_MIN_PX }}>
                    {pill.clippedStart ? <span aria-hidden>◂</span> : <Flag className="size-3 shrink-0" aria-hidden />}
                    <span className="truncate">{shortRangeLabel(item.start, item.end)}</span>
                    {pill.clippedEnd && <span aria-hidden className="ml-auto">▸</span>}
                  </button>
                )}
                {pill && stats.overdueTasks > 0 && (
                  <span className="absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-red-700" aria-hidden
                    style={pillEnd <= CHIP_FLIP_PCT
                      ? { left: `calc(max(${pillEnd}%, ${pill.left}% + ${PILL_MIN_PX}px) + 8px)` }
                      : { right: `calc(${100 - barsStart}% + 8px)` }}>
                    {stats.overdueTasks} overdue
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
