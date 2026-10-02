/** Loading placeholders shaped like each calendar view. */
import { LoadingRegion, Skeleton } from '@/components/ui/States';
import type { CalendarView } from '@/utils/calendarWindow';

const TIMELINE_BARS = ['ml-[8%] w-1/4', 'ml-[22%] w-1/3', 'ml-[40%] w-1/5'];

export function CalendarSkeleton({ view, desktop }: { view: CalendarView; desktop: boolean }) {
  if (view === 'month' && desktop) {
    return (
      <LoadingRegion label="Loading calendar">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line bg-line">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="min-h-[120px] bg-white p-2">
              <Skeleton className="size-6 rounded-full" />
              {i % 4 === 1 && <Skeleton className="mt-3 h-5 w-4/5" />}
            </div>
          ))}
        </div>
      </LoadingRegion>
    );
  }
  if (view === 'month') {
    return (
      <LoadingRegion label="Loading calendar">
        <div className="grid grid-cols-7 gap-2">{Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="mx-auto size-11 rounded-full" />)}</div>
        <Skeleton className="mt-5 h-28 rounded-2xl" />
      </LoadingRegion>
    );
  }
  if (view === 'week') {
    return (
      <LoadingRegion label="Loading calendar">
        <div className="grid grid-cols-7 gap-2">{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
        <Skeleton className="mt-4 h-16 w-2/3 rounded-xl" />
        <Skeleton className="mt-2 h-16 w-1/2 rounded-xl" />
      </LoadingRegion>
    );
  }
  return (
    <LoadingRegion label="Loading calendar">
      <Skeleton className="h-8 rounded-xl" />
      {[0, 1].map((lane) => (
        <div key={lane} className="mt-4">
          <Skeleton className="h-6 w-48 rounded-lg" />
          {TIMELINE_BARS.map((bar) => (
            <div key={bar} className="mt-3 flex items-center">
              <Skeleton className="h-8 w-[140px] shrink-0 lg:w-[260px]" />
              <Skeleton className={`h-4 rounded-full ${bar}`} />
            </div>
          ))}
        </div>
      ))}
    </LoadingRegion>
  );
}
