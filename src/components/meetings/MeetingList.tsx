import { Link } from 'react-router-dom';
import { CalendarX, ExternalLink, MapPin, Video } from 'lucide-react';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { MeetingStatus } from '@/types/schema';
import type { Meeting } from '@/types/entities';
import { formatDateTime } from '@/utils/dates';

const STATUS: Record<MeetingStatus, { label: string; tone: ChipTone }> = {
  [MeetingStatus.Scheduled]: { label: 'Scheduled', tone: 'navy' },
  [MeetingStatus.Completed]: { label: 'Completed', tone: 'green' },
  [MeetingStatus.Cancelled]: { label: 'Cancelled', tone: 'outline' },
};

interface CancelProps {
  /** Managers only: offers "Mark as cancelled" on Scheduled meetings when provided. */
  onCancel?: (m: Meeting) => void;
  /** Meeting being cancelled right now (its button shows "Cancelling…"). */
  cancellingId?: string | null;
}

function Row({ m, eventName, upcoming, onCancel, cancellingId }: { m: Meeting; eventName?: string; upcoming: boolean } & CancelProps) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-orange-50 leading-none text-orange-900" aria-hidden>
        <span className="text-[11px] font-bold uppercase">{formatDateTime(m.start, 'MMM')}</span>
        <span className="tabular text-xl font-extrabold">{formatDateTime(m.start, 'd')}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{m.subject}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-secondary">
          <span className="tabular">{formatDateTime(m.start, 'EEE h:mm a')} – {formatDateTime(m.end, 'h:mm a')}</span>
          {eventName && m.eventId && <>· <Link to={`/events/${m.eventId}`} className="font-semibold text-navy-700 hover:underline">{eventName}</Link></>}
        </p>
        <p className="mt-1.5 flex flex-wrap gap-2">
          <Chip tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Chip>
          {m.isOnline ? <Chip tone="navy" icon={<Video className="size-3.5" aria-hidden />}>Teams</Chip>
            : m.location && <Chip tone="outline" icon={<MapPin className="size-3.5" aria-hidden />}>{m.location}</Chip>}
        </p>
      </div>
      {upcoming && m.joinUrl && m.status === MeetingStatus.Scheduled && (
        <a href={m.joinUrl} target="_blank" rel="noreferrer" className={buttonClasses('secondary', 'md', 'justify-center')}>
          Join <ExternalLink className="size-4" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
      {onCancel && m.status === MeetingStatus.Scheduled && (
        <button type="button" onClick={() => onCancel(m)} disabled={!!cancellingId}
          aria-label={`Mark "${m.subject}" as cancelled`} className={buttonClasses('outline', 'md', 'justify-center')}>
          <CalendarX className="size-4" aria-hidden />
          {cancellingId === m.id ? 'Cancelling…' : 'Mark as cancelled'}
        </button>
      )}
    </li>
  );
}

/** Upcoming (soonest first) then past (latest first). */
export function MeetingList({ meetings, eventNames, onCancel, cancellingId }: { meetings: Meeting[]; eventNames?: Map<string, string> } & CancelProps) {
  const now = new Date().toISOString();
  const upcoming = meetings.filter((m) => m.end >= now).sort((a, b) => a.start.localeCompare(b.start));
  const past = meetings.filter((m) => m.end < now).sort((a, b) => b.start.localeCompare(a.start));
  const section = (title: string, list: Meeting[], isUpcoming: boolean) =>
    list.length > 0 && (
      <section aria-label={title}>
        <h3 className="mb-2 text-sm font-bold text-secondary">{title} <span className="tabular text-muted">({list.length})</span></h3>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {list.map((m) => (
            <Row key={m.id} m={m} upcoming={isUpcoming} eventName={m.eventId ? eventNames?.get(m.eventId) : undefined}
              onCancel={onCancel} cancellingId={cancellingId} />
          ))}
        </ul>
      </section>
    );
  return (
    <div className="space-y-5">
      {section('Upcoming', upcoming, true)}
      {section('Past', past, false)}
    </div>
  );
}
