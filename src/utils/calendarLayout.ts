/**
 * Calendar layout helpers (pure, exported for testing): split multi-day events into per-week
 * segments and pack them into lanes so overlapping events stack instead of colliding.
 */
import type { DateOnly } from '@/types/entities';
import { addDaysDateOnly, todayDateOnly } from '@/utils/dates';
import { dayIndex } from '@/utils/calendarWindow';

export interface Span {
  id: string;
  start: DateOnly;
  end: DateOnly;
}

export interface Segment<T extends Span> {
  item: T;
  /** Column of the first visible day in this row (0 = row start). */
  col: number;
  /** Number of days covered in this row (≥ 1). */
  span: number;
  /** The event started before this row (draw "◂", square left edge). */
  continuesBefore: boolean;
  /** The event ends after this row (draw "▸", square right edge). */
  continuesAfter: boolean;
}

export interface PlacedSegment<T extends Span> extends Segment<T> {
  lane: number;
}

/** Segments of `items` inside the row [rowStart, rowStart + days − 1]. */
export function rowSegments<T extends Span>(items: T[], rowStart: DateOnly, days = 7): Segment<T>[] {
  const rowEnd = addDaysDateOnly(rowStart, days - 1);
  const out: Segment<T>[] = [];
  for (const item of items) {
    if (item.start > rowEnd || item.end < rowStart) continue;
    const segStart = item.start < rowStart ? rowStart : item.start;
    const segEnd = item.end > rowEnd ? rowEnd : item.end;
    out.push({
      item,
      col: dayIndex(segStart, rowStart),
      span: dayIndex(segEnd, segStart) + 1,
      continuesBefore: item.start < rowStart,
      continuesAfter: item.end > rowEnd,
    });
  }
  return out;
}

/**
 * Greedy lane packing: sort by start column, then longer first (then id for stability); place
 * each segment in the first lane whose last segment ends before it starts.
 */
export function packLanes<T extends Span>(segments: Segment<T>[]): PlacedSegment<T>[] {
  const sorted = [...segments].sort((a, b) => a.col - b.col || b.span - a.span || a.item.id.localeCompare(b.item.id));
  const laneEnds: number[] = [];
  return sorted.map((seg) => {
    const last = seg.col + seg.span - 1;
    let lane = laneEnds.findIndex((end) => end < seg.col);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(last);
    } else {
      laneEnds[lane] = last;
    }
    return { ...seg, lane };
  });
}

export interface TimelineSpan {
  /** Percent of the window from the left edge. */
  left: number;
  /** Percent of the window covered (inclusive days). */
  width: number;
  /** Starts before the window (draw a "◂" cap). */
  clippedStart: boolean;
  /** Ends after the window. */
  clippedEnd: boolean;
}

/**
 * Position of the inclusive day range [start, end] on a timeline window, in percent
 * (left = dayIndex / days). Null when it doesn't touch the window.
 */
export function timelineSpan(start: DateOnly, end: DateOnly, windowStart: DateOnly, windowEnd: DateOnly): TimelineSpan | null {
  if (end < start || start > windowEnd || end < windowStart) return null;
  const days = dayIndex(windowEnd, windowStart) + 1;
  const from = Math.max(0, dayIndex(start, windowStart));
  const to = Math.min(days - 1, dayIndex(end, windowStart));
  return { left: (from / days) * 100, width: ((to - from + 1) / days) * 100, clippedStart: start < windowStart, clippedEnd: end > windowEnd };
}

/** Pill date: "Oct 10" · "Oct 10–12" · "Oct 30–Nov 2". */
export function shortRangeLabel(start: DateOnly, end: DateOnly): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const part = (d: DateOnly) => ({ m: MONTHS[Number(d.slice(5, 7)) - 1] ?? '', d: Number(d.slice(8)) });
  const a = part(start);
  if (!end || end === start) return `${a.m} ${a.d}`;
  const b = part(end);
  return a.m === b.m && start.slice(0, 4) === end.slice(0, 4) ? `${a.m} ${a.d}–${b.d}` : `${a.m} ${a.d}–${b.m} ${b.d}`;
}

export interface TimedBlock {
  id: string;
  /** Minutes from midnight (local). */
  startMin: number;
  endMin: number;
}

/**
 * Side-by-side columns for overlapping timed blocks in one day: each block gets a column and the
 * number of columns in its overlap cluster (width = 1 / columns).
 */
export function packTimedBlocks<T extends TimedBlock>(blocks: T[]): (T & { column: number; columns: number })[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.id.localeCompare(b.id));
  const out: (T & { column: number; columns: number })[] = [];
  let cluster: (T & { column: number; columns: number })[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const columns = Math.max(1, ...cluster.map((b) => b.column + 1));
    for (const b of cluster) out.push({ ...b, columns });
    cluster = [];
  };
  for (const block of sorted) {
    if (cluster.length && block.startMin >= clusterEnd) flush();
    const taken = new Set(cluster.filter((b) => b.endMin > block.startMin).map((b) => b.column));
    let column = 0;
    while (taken.has(column)) column++;
    cluster.push({ ...block, column, columns: 1 });
    clusterEnd = Math.max(clusterEnd, block.endMin);
  }
  if (cluster.length) flush();
  return out;
}

/** "9 days to go" · "Today" · "Ends in N days" / "Ends today" (running) · "N days ago" (past). */
export function eventCountdown(start: DateOnly, end: DateOnly, today: DateOnly = todayDateOnly()): { text: string; upcoming: boolean } {
  const toStart = dayIndex(start, today);
  if (toStart > 0) return { text: toStart === 1 ? '1 day to go' : `${toStart} days to go`, upcoming: true };
  const toEnd = dayIndex(end, today);
  if (toEnd >= 0) {
    if (start === end) return { text: 'Today', upcoming: true };
    return { text: toEnd === 0 ? 'Ends today' : `Ends in ${toEnd} day${toEnd === 1 ? '' : 's'}`, upcoming: true };
  }
  return { text: `${-toEnd} day${toEnd === -1 ? '' : 's'} ago`, upcoming: false };
}

/** Per column: segments covering it whose lane is ≥ `visibleLanes` (they're behind "+N more"). */
export function hiddenPerColumn<T extends Span>(placed: PlacedSegment<T>[], visibleLanes: number, columns = 7): number[] {
  const hidden = Array.from({ length: columns }, () => 0);
  for (const seg of placed) {
    if (seg.lane < visibleLanes) continue;
    for (let c = seg.col; c < seg.col + seg.span && c < columns; c++) hidden[c] = (hidden[c] ?? 0) + 1;
  }
  return hidden;
}
