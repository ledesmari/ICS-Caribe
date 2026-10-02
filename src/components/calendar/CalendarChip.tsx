/** Event chip / multi-day bar: template bg + text, 6px solid dot, truncated name. */
import type { CalendarEvent } from '@/hooks/useCalendarData';
import { EventStatus } from '@/types/schema';
import { formatDateRange } from '@/utils/dates';

export function CalendarChip({ item, active, continuesBefore = false, continuesAfter = false, tabIndex, className = '', style, onOpen }: {
  item: CalendarEvent;
  /** Its popover is open (2px navy ring). */
  active: boolean;
  continuesBefore?: boolean;
  continuesAfter?: boolean;
  tabIndex?: number;
  className?: string;
  style?: React.CSSProperties;
  onOpen: (item: CalendarEvent, anchor: HTMLElement) => void;
}) {
  const { color, event } = item;
  const cancelled = event.status === EventStatus.Cancelled;
  const radius = `${continuesBefore ? 'rounded-l-none' : 'rounded-l-md'} ${continuesAfter ? 'rounded-r-none' : 'rounded-r-md'}`;
  return (
    <button type="button" tabIndex={tabIndex} style={style}
      aria-label={`${event.name}, ${formatDateRange(item.start, item.end)}${cancelled ? ', cancelled' : ''}`}
      onClick={(e) => { e.stopPropagation(); onOpen(item, e.currentTarget); }}
      className={`flex h-6 min-w-0 items-center gap-1.5 px-1.5 text-left text-xs font-semibold ${radius} ${color.bg} ${color.text} ${
        active ? 'ring-2 ring-navy-700' : ''
      } ${cancelled ? 'opacity-60' : ''} hover:brightness-95 ${className}`}>
      {continuesBefore && <span aria-hidden>◂</span>}
      <span className={`size-1.5 shrink-0 rounded-full ${color.solid}`} aria-hidden />
      <span className={`min-w-0 flex-1 truncate ${cancelled ? 'line-through' : ''}`}>{event.name}</span>
      {continuesAfter && <span aria-hidden>▸</span>}
    </button>
  );
}
