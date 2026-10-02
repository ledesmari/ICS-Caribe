/**
 * Timeline (Concept B) for Quarter / Year / Custom: sticky label column, swimlanes by template,
 * prep-window bars + event pills positioned in percent of the window, orange today line.
 * On small screens the track scrolls horizontally inside the card and opens scrolled to today.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { NO_TEMPLATE } from '@/hooks/useCalendarParams';
import type { CalendarEvent } from '@/hooks/useCalendarData';
import type { TemplateTaskSummary } from '@/services/templatesService';
import { timelineSpan } from '@/utils/calendarLayout';
import { dayIndex, type CalendarWindow } from '@/utils/calendarWindow';
import { parseDateOnly, toDateOnly, todayDateOnly } from '@/utils/dates';
import { colorForTemplate } from '@/utils/templateColors';
import { TimelineLane } from './TimelineLane';

const STORAGE_KEY = 'epm.calendar.collapsedLanes';
/** Minimum track width on small screens, per column, so bars stay readable while scrolling. */
const MIN_PX_PER_WEEK = 64;
const MIN_PX_PER_MONTH = 96;

function readCollapsed(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as string[]); } catch { return new Set(); }
}

export function TimelineView({ window: win, items, summary, showPrep, onShowPrepChange, desktop, activeId, onOpenEvent }: {
  window: CalendarWindow;
  items: CalendarEvent[];
  summary: Map<string, TemplateTaskSummary> | undefined;
  showPrep: boolean;
  onShowPrepChange: (v: boolean) => void;
  desktop: boolean;
  activeId: string | null;
  onOpenEvent: (item: CalendarEvent, anchor: HTMLElement) => void;
}) {
  const labelWidth = desktop ? 260 : 140;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed);
  const today = todayDateOnly();
  const todayPct = today >= win.start && today <= win.end ? ((dayIndex(today, win.start) + 0.5) / win.days) * 100 : null;

  const lanes = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    for (const c of items) {
      const key = c.template?.id ?? NO_TEMPLATE;
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return [...groups.entries()]
      .map(([key, list]) => {
        const template = list[0]?.template ?? null;
        const s = template ? summary?.get(template.id) : undefined;
        const weeks = s?.maxDaysBefore ? Math.ceil(s.maxDaysBefore / 7) : 0;
        const hint = s ? [weeks ? `${weeks}-week template` : null, `${s.taskCount} task${s.taskCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ') : null;
        return { key, name: template?.name ?? 'No template', color: colorForTemplate(template), hint, list: [...list].sort((a, b) => a.start.localeCompare(b.start)) };
      })
      .sort((a, b) => (a.key === NO_TEMPLATE ? 1 : b.key === NO_TEMPLATE ? -1 : a.name.localeCompare(b.name)));
  }, [items, summary]);

  const months = useMemo(() => {
    const out: { key: string; label: string; left: number; width: number }[] = [];
    for (let m = startOfMonth(parseDateOnly(win.start)); toDateOnly(m) <= win.end; m = addMonths(m, 1)) {
      const span = timelineSpan(toDateOnly(m), toDateOnly(endOfMonth(m)), win.start, win.end);
      if (span) out.push({ key: toDateOnly(m), label: format(m, win.view === 'year' ? 'MMM' : 'MMMM yyyy'), left: span.left, width: span.width });
    }
    return out;
  }, [win]);
  const ticks = win.columns.map((c) => ({ key: c.start, label: c.label, left: (dayIndex(c.start, win.start) / win.days) * 100 }));
  const showTicks = win.columnUnit === 'week';
  const trackMin = desktop ? 0 : win.columns.length * (win.columnUnit === 'week' ? MIN_PX_PER_WEEK : MIN_PX_PER_MONTH);

  // Small screens: open with today centred in the visible part of the track (left of the window otherwise).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const track = el.scrollWidth - labelWidth;
    el.scrollLeft = todayPct === null ? 0 : Math.max(0, (todayPct / 100) * track - (el.clientWidth - labelWidth) / 2);
  }, [win.start, win.end, labelWidth, todayPct]);

  const toggleLane = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* storage unavailable: keep in memory only */ }
      return next;
    });
  };

  return (
    <div>
      <div ref={scrollRef} className="overflow-x-auto rounded-2xl border border-line">
        <div className="relative" style={{ minWidth: trackMin ? labelWidth + trackMin : undefined }}>
          {/* Header: months, then week ticks */}
          <div className="flex border-b border-line bg-page">
            <div className="sticky left-0 z-30 shrink-0 bg-page" style={{ width: labelWidth }} />
            <div className="relative min-w-0 flex-1">
              <div className="relative h-8">
                {months.map((m) => (
                  <span key={m.key} className="absolute inset-y-0 flex items-center truncate border-l border-line px-2 text-xs font-bold text-secondary"
                    style={{ left: `${m.left}%`, width: `${m.width}%` }}>{m.label}</span>
                ))}
              </div>
              {showTicks && (
                <div className="relative h-6 border-t border-line">
                  {ticks.map((t) => (
                    <span key={t.key} className="tabular absolute inset-y-0 flex items-center pl-1 text-[11px] whitespace-nowrap text-muted" style={{ left: `${t.left}%` }}>{t.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Body: grid lines + today line behind/above the lanes */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: labelWidth }} aria-hidden>
              {ticks.map((t) => <span key={t.key} className="absolute inset-y-0 w-px bg-pending-bg" style={{ left: `${t.left}%` }} />)}
            </div>
            {lanes.map((lane) => (
              <TimelineLane key={lane.key} name={lane.name} color={lane.color} hint={lane.hint} items={lane.list}
                collapsed={collapsed.has(lane.key)} onToggle={() => toggleLane(lane.key)} window={win} showPrep={showPrep}
                labelWidth={labelWidth} activeId={activeId} onOpenEvent={onOpenEvent} />
            ))}
            {todayPct !== null && (
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10" style={{ left: labelWidth }} aria-hidden>
                <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-orange-500" style={{ left: `${todayPct}%` }} />
                <span className="absolute top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500" style={{ left: `${todayPct}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend + prep toggle */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-secondary">
        <span className="flex items-center gap-1.5"><span className="h-3 w-6 rounded-full bg-tpl-neutral-bg" aria-hidden><span className="block h-full w-1/2 rounded-full bg-tpl-neutral opacity-45" /></span>Prep window (fill = tasks done)</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-6 rounded-full bg-tpl-neutral ring-2 ring-white" aria-hidden />Event</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-0.5 bg-orange-500" aria-hidden />Today</span>
        <span className="flex items-center gap-1.5"><span className="rounded-full bg-red-50 px-1.5 font-bold text-red-700" aria-hidden>N</span>Overdue tasks</span>
        <label className="ml-auto flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-ink">
          <input type="checkbox" role="switch" className="peer sr-only" checked={showPrep} onChange={(e) => onShowPrepChange(e.target.checked)} />
          <span aria-hidden className={`relative h-6 w-10 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy-700 ${showPrep ? 'bg-navy-700' : 'bg-line'}`}>
            <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${showPrep ? 'left-[1.125rem]' : 'left-0.5'}`} />
          </span>
          Show prep windows
        </label>
      </div>
    </div>
  );
}
