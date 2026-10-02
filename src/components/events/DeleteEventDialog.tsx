/**
 * Delete an event: loads what would be removed, blocks while Teams meetings are still scheduled,
 * and asks for the event name before the permanent delete. Offers "Mark as Cancelled" instead.
 */
import { useId, useState } from 'react';
import { AlertTriangle, CalendarX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useDeleteEvent, useUpdateEvent } from '@/hooks/mutations';
import { useDeletionImpact } from '@/hooks/queries';
import type { DeletionImpact } from '@/services/eventDeletionService';
import { EventStatus } from '@/types/schema';
import type { EpmEvent } from '@/types/entities';
import { formatDateTime } from '@/utils/dates';
import { errorMessage, pluralize } from '@/utils/format';

/** "30 tasks (12 completed) · 4 expenses (1 paid) · …" — non-zero items only. */
function impactParts(i: DeletionImpact): string[] {
  const parts: string[] = [];
  if (i.tasks) parts.push(`${pluralize(i.tasks, 'task')}${i.completedTasks ? ` (${i.completedTasks} completed)` : ''}`);
  if (i.expenses) parts.push(`${pluralize(i.expenses, 'expense')}${i.paidExpenses ? ` (${i.paidExpenses} paid)` : ''}`);
  if (i.meetings) parts.push(`${pluralize(i.meetings, 'past meeting')}${i.attendees ? `, ${pluralize(i.attendees, 'attendee')}` : ''}`);
  if (i.comments) parts.push(pluralize(i.comments, 'comment'));
  if (i.historyEntries) parts.push(pluralize(i.historyEntries, 'history entry', 'history entries'));
  if (i.attachments) parts.push(pluralize(i.attachments, 'file'));
  return parts;
}

export function DeleteEventDialog({ event, onClose, onGoToMeetings, onDeleted }: {
  event: EpmEvent;
  onClose: () => void;
  onGoToMeetings: () => void;
  onDeleted: (name: string) => void;
}) {
  const impact = useDeletionImpact(event.id, true);
  const del = useDeleteEvent();
  const cancel = useUpdateEvent();
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const busy = del.isPending || cancel.isPending;
  const matches = typed.trim() === event.name.trim();
  const blocking = impact.data?.blockingMeetings ?? [];
  const close = () => { if (!busy) onClose(); };
  const confirmDelete = () => { if (matches && !busy) del.mutate(event.id, { onSuccess: () => onDeleted(event.name) }); };

  if (impact.isPending || impact.isError) {
    return (
      <Dialog open onClose={close} title={`Delete "${event.name}"?`}
        footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
        {impact.isError ? (
          <ErrorState error={impact.error} title="Couldn't check what this event contains" onRetry={() => void impact.refetch()} />
        ) : (
          <LoadingRegion label="Checking what will be deleted">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="mt-4 h-4 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <Skeleton className="mt-5 h-11 rounded-xl" />
          </LoadingRegion>
        )}
      </Dialog>
    );
  }

  if (blocking.length > 0) {
    return (
      <Dialog open onClose={onClose} title="This event can't be deleted yet"
        description="Its Teams meetings must be cancelled first."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button variant="secondary" onClick={onGoToMeetings}>Go to meetings</Button>
          </>
        }>
        <p className="text-sm text-secondary">
          Cancel {blocking.length === 1 ? 'this meeting' : 'these meetings'} in <strong>Outlook or Teams</strong> so attendees are notified,
          then mark {blocking.length === 1 ? 'it' : 'each one'} <strong>Cancelled</strong> in the event's Meetings tab. After that you can delete the event.
        </p>
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {blocking.map((m) => (
            <li key={m.id} className="flex items-start gap-3 p-3">
              <CalendarX className="mt-0.5 size-5 shrink-0 text-orange-700" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{m.subject}</span>
                <span className="text-sm text-muted">{formatDateTime(m.start, 'EEE, MMM d · h:mm a')}</span>
              </span>
            </li>
          ))}
        </ul>
      </Dialog>
    );
  }

  const parts = impact.data ? impactParts(impact.data) : [];
  const canCancelInstead = event.status !== EventStatus.Cancelled;
  return (
    <Dialog open onClose={close} title={`Delete "${event.name}"?`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Keep event</Button>
          {canCancelInstead && (
            <Button variant="outline" disabled={busy}
              onClick={() => cancel.mutate({ id: event.id, patch: { status: EventStatus.Cancelled } }, { onSuccess: onClose })}>
              {cancel.isPending ? 'Saving…' : 'Mark as Cancelled instead'}
            </Button>
          )}
          <Button variant="danger" disabled={!matches || busy} onClick={confirmDelete}>
            {del.isPending ? 'Deleting…' : 'Delete event'}
          </Button>
        </>
      }>
      <div className="flex gap-2 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        This permanently deletes the event and everything in it. This can't be undone.
      </div>
      <p className="mt-4 text-sm text-secondary">
        {parts.length > 0 ? <>It contains <span className="font-semibold text-ink">{parts.join(' · ')}</span>.</> : 'The event has no tasks, expenses or meetings.'}
      </p>
      {canCancelInstead && (
        <p className="mt-2 text-sm text-muted">If the event simply didn't happen, marking it Cancelled keeps its history.</p>
      )}
      <label htmlFor={inputId} className="mt-5 mb-1.5 block text-sm font-semibold">
        Type the event name to confirm: <span className="font-bold break-words">{event.name}</span>
      </label>
      <input id={inputId} className="min-h-11 w-full rounded-xl border border-line bg-white px-4 text-base" value={typed} autoComplete="off" spellCheck={false}
        disabled={busy} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmDelete(); }} />
      {(del.isError || cancel.isError) && (
        <p role="alert" className="mt-3 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errorMessage(del.error ?? cancel.error)}
        </p>
      )}
    </Dialog>
  );
}
