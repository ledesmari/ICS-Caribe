import { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { MeetingList } from '@/components/meetings/MeetingList';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useEvents, useMeetings } from '@/hooks/queries';

/** Every meeting the user can see, across events. Scheduling happens from an event page. */
export default function MeetingsPage() {
  const meetings = useMeetings();
  const events = useEvents();
  const eventNames = useMemo(() => new Map((events.data ?? []).map((e) => [e.id, e.name])), [events.data]);

  return (
    <>
      <PageHeader title="Meetings" subtitle="Planning meetings across all events" />
      {meetings.isPending ? (
        <LoadingRegion label="Loading meetings">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="mt-3 h-24 rounded-2xl" />)}
        </LoadingRegion>
      ) : meetings.isError ? (
        <ErrorState error={meetings.error} title="Couldn't load meetings" onRetry={() => void meetings.refetch()} />
      ) : meetings.data.length === 0 ? (
        <EmptyState icon={<CalendarClock className="size-6" />} title="No meetings yet"
          description="Open an event and choose “Schedule meeting” to send a Teams invite." />
      ) : (
        <MeetingList meetings={meetings.data} eventNames={eventNames} />
      )}
    </>
  );
}
