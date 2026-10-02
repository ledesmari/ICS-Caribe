import { useId, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, UserPlus, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useCurrentUser } from '@/hooks/queries';
import { usePeopleSearch, useScheduleMeeting } from '@/hooks/useMeetingScheduling';
import type { Person, ScheduleResult } from '@/services/meetingSchedulingService';
import { TaskStatus } from '@/types/schema';
import type { EventTask } from '@/types/entities';
import { formatDateOnly, todayDateOnly } from '@/utils/dates';
import { errorMessage } from '@/utils/format';

const inputClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-4 text-base aria-[invalid=true]:border-red-600';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Local date + time inputs → UTC ISO string. */
const toIso = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();

export function ScheduleMeetingDialog({ eventId, eventName, tasks, initialTaskIds = [], onClose, onScheduled }: {
  eventId: string;
  eventName: string;
  tasks: EventTask[];
  initialTaskIds?: string[];
  onClose: () => void;
  onScheduled: (result: ScheduleResult & { subject: string }) => void;
}) {
  const formId = useId();
  const ids = { subject: useId(), date: useId(), start: useId(), end: useId(), loc: useId(), agenda: useId(), people: useId() };
  const me = useCurrentUser();
  const schedule = useScheduleMeeting();
  const [subject, setSubject] = useState(`${eventName} — planning sync`);
  const [date, setDate] = useState(todayDateOnly());
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('10:30');
  const [isOnline, setIsOnline] = useState(true);
  const [location, setLocation] = useState('');
  const [agenda, setAgenda] = useState('');
  const [attendees, setAttendees] = useState<Person[]>([]);
  const [term, setTerm] = useState('');
  const [taskIds, setTaskIds] = useState<Set<string>>(new Set(initialTaskIds));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const people = usePeopleSearch(term);

  const results = useMemo(
    () => (people.data ?? []).filter((p) => !attendees.some((a) => a.email === p.email)).slice(0, 6),
    [people.data, attendees],
  );
  const openTasks = useMemo(
    () => [...tasks].filter((t) => t.status !== TaskStatus.Completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [tasks],
  );

  const add = (p: Person) => {
    setAttendees((list) => (list.some((a) => a.email === p.email) ? list : [...list, p]));
    setTerm('');
  };
  const toggleTask = (id: string) => setTaskIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!subject.trim()) found.subject = 'Enter a subject.';
    if (!date) found.date = 'Choose a date.';
    if (!start || !end) found.end = 'Choose start and end times.';
    else if (date && toIso(date, end) <= toIso(date, start)) found.end = 'The meeting must end after it starts.';
    if (!isOnline && !location.trim()) found.loc = 'Enter where the meeting happens.';
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) return document.getElementById(ids[first as keyof typeof ids])?.focus();
    const trimmed = subject.trim();
    schedule.mutate(
      {
        eventId, subject: trimmed, start: toIso(date, start), end: toIso(date, end), isOnline,
        location: location.trim(), agenda: agenda.trim(), attendees, taskIds: [...taskIds],
      },
      { onSuccess: (result) => onScheduled({ ...result, subject: trimmed }) },
    );
  };

  const busy = schedule.isPending;
  return (
    <Dialog
      open
      onClose={() => { if (!busy) onClose(); }}
      title="Schedule meeting"
      description={`For ${eventName}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form={formId} variant="secondary" disabled={busy}>
            {busy ? (isOnline ? 'Sending invite…' : 'Saving…') : isOnline ? 'Send Teams invite' : 'Save meeting'}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor={ids.subject} className="mb-1.5 block text-sm font-semibold">Subject <span aria-hidden className="text-red-700">*</span></label>
          <input id={ids.subject} className={inputClass} value={subject} maxLength={200} disabled={busy} aria-invalid={Boolean(errors.subject)} onChange={(e) => setSubject(e.target.value)} />
          {errors.subject && <p className="mt-1 text-sm font-semibold text-red-700">{errors.subject}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor={ids.date} className="mb-1.5 block text-sm font-semibold">Date</label>
            <input id={ids.date} type="date" className={inputClass} value={date} disabled={busy} aria-invalid={Boolean(errors.date)} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor={ids.start} className="mb-1.5 block text-sm font-semibold">Start</label>
            <input id={ids.start} type="time" className={inputClass} value={start} disabled={busy} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label htmlFor={ids.end} className="mb-1.5 block text-sm font-semibold">End</label>
            <input id={ids.end} type="time" className={inputClass} value={end} disabled={busy} aria-invalid={Boolean(errors.end)} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        {errors.end && <p className="-mt-2 text-sm font-semibold text-red-700">{errors.end}</p>}

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-page px-4 py-2">
          <input type="checkbox" className="size-5 accent-navy-700" checked={isOnline} disabled={busy} onChange={(e) => setIsOnline(e.target.checked)} />
          <Video className="size-4 text-navy-700" aria-hidden />
          <span className="text-sm font-semibold">Teams meeting</span>
          <span className="text-xs text-muted">Sends an Outlook invite with a Teams link</span>
        </label>
        {!isOnline && (
          <div>
            <label htmlFor={ids.loc} className="mb-1.5 block text-sm font-semibold">Location <span aria-hidden className="text-red-700">*</span></label>
            <input id={ids.loc} className={inputClass} value={location} maxLength={200} disabled={busy} aria-invalid={Boolean(errors.loc)} onChange={(e) => setLocation(e.target.value)} />
            {errors.loc && <p className="mt-1 text-sm font-semibold text-red-700">{errors.loc}</p>}
          </div>
        )}

        <div>
          <label htmlFor={ids.people} className="mb-1.5 block text-sm font-semibold">Attendees</label>
          {attendees.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2" aria-label="Selected attendees">
              {attendees.map((a) => (
                <li key={a.email} className="flex items-center gap-1 rounded-full bg-navy-100 py-1 pr-1 pl-3 text-sm text-navy-900">
                  {a.name || a.email}
                  <button type="button" aria-label={`Remove ${a.name || a.email}`} disabled={busy}
                    onClick={() => setAttendees((l) => l.filter((x) => x.email !== a.email))}
                    className="flex size-7 items-center justify-center rounded-full hover:bg-navy-300/40"><X className="size-3.5" aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
          <input id={ids.people} className={inputClass} value={term} disabled={busy} placeholder="Search people or type an email"
            autoComplete="off" aria-describedby={`${ids.people}-hint`} onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && EMAIL.test(term.trim())) { e.preventDefault(); add({ name: term.trim(), email: term.trim().toLowerCase() }); } }} />
          <p id={`${ids.people}-hint`} className="mt-1 text-xs text-muted">
            {people.isFetching ? 'Searching…' : people.isError ? `Search failed: ${errorMessage(people.error)}` : 'You are included automatically as the organizer.'}
          </p>
          {(results.length > 0 || EMAIL.test(term.trim())) && (
            <ul className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-line" aria-label="Search results">
              {results.map((p) => (
                <li key={p.email}>
                  <button type="button" onClick={() => add(p)} className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm hover:bg-navy-50">
                    <UserPlus className="size-4 text-muted" aria-hidden /> <span className="font-semibold">{p.name}</span> <span className="truncate text-muted">{p.email}</span>
                  </button>
                </li>
              ))}
              {EMAIL.test(term.trim()) && !results.some((p) => p.email === term.trim().toLowerCase()) && (
                <li>
                  <button type="button" onClick={() => add({ name: term.trim(), email: term.trim().toLowerCase() })} className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm hover:bg-navy-50">
                    <UserPlus className="size-4 text-muted" aria-hidden /> Add <span className="font-semibold">{term.trim()}</span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor={ids.agenda} className="mb-1.5 block text-sm font-semibold">Agenda <span className="font-normal text-muted">(optional)</span></label>
          <textarea id={ids.agenda} rows={3} maxLength={4000} className={`${inputClass} py-2`} value={agenda} disabled={busy} onChange={(e) => setAgenda(e.target.value)} />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Tasks to review <span className="font-normal text-muted">({taskIds.size} selected)</span></legend>
          {openTasks.length === 0 ? <p className="text-sm text-muted">No open tasks.</p> : (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {openTasks.map((t) => (
                <li key={t.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-navy-50">
                    <input type="checkbox" className="size-5 accent-navy-700" checked={taskIds.has(t.id)} disabled={busy} onChange={() => toggleTask(t.id)} />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    <span className="tabular shrink-0 text-xs text-muted">{formatDateOnly(t.dueDate, 'MMM d')}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {schedule.isError && (
          <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            <span>Not scheduled: {errorMessage(schedule.error)} Nothing was saved and no invite was sent.</span>
          </p>
        )}
        {me.data && isOnline && <p className="text-xs text-muted">The invite comes from {me.data.email || me.data.name}'s Outlook calendar.</p>}
      </form>
    </Dialog>
  );
}
