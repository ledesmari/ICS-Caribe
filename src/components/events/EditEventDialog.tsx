import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useUpdateEvent } from '@/hooks/mutations';
import { EventStatus } from '@/types/schema';
import type { EpmEvent } from '@/types/entities';
import { EVENT_STATUS_LABEL, errorMessage } from '@/utils/format';

const inputClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-4 text-base aria-[invalid=true]:border-red-600';

function Field({ id, label, required, error, hint, children }: {
  id: string; label: string; required?: boolean; error?: string; hint?: ReactNode; children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label} {required && <span aria-hidden className="text-red-700">*</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-sm text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}

export function EditEventDialog({ event, onClose }: { event: EpmEvent; onClose: () => void }) {
  const formId = useId();
  const ids = { name: useId(), date: useId(), end: useId(), location: useId(), status: useId(), budget: useId() };
  const save = useUpdateEvent();
  const [name, setName] = useState(event.name);
  const [eventDate, setEventDate] = useState(event.eventDate);
  const [endDate, setEndDate] = useState(event.endDate || event.eventDate);
  const [location, setLocation] = useState(event.location);
  const [status, setStatus] = useState<EventStatus>(event.status);
  const [budget, setBudget] = useState(event.budget?.toString() ?? '');
  const [errors, setErrors] = useState<Partial<Record<keyof typeof ids, string>>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found: Partial<Record<keyof typeof ids, string>> = {};
    if (!name.trim()) found.name = 'Enter an event name.';
    else if (name.trim().length > 200) found.name = 'Use 200 characters or fewer.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) found.date = 'Choose the start date.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) found.end = 'Choose the end date.';
    else if (!found.date && endDate < eventDate) found.end = 'The end date can’t be before the start date.';
    if (location.trim().length > 200) found.location = 'Use 200 characters or fewer.';
    const budgetValue = budget.trim() === '' ? null : Number(budget);
    if (budgetValue !== null && (!Number.isFinite(budgetValue) || budgetValue < 0)) found.budget = 'Enter an amount of 0 or more.';
    setErrors(found);
    const first = Object.keys(found)[0] as keyof typeof ids | undefined;
    if (first) return document.getElementById(ids[first])?.focus();
    save.mutate(
      { id: event.id, patch: { name: name.trim(), eventDate, endDate, location: location.trim(), status, budget: budgetValue } },
      { onSuccess: onClose },
    );
  };

  const dateChanged = eventDate !== event.eventDate;

  return (
    <Dialog
      open
      onClose={() => { if (!save.isPending) onClose(); }}
      title="Edit event"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form={formId} variant="secondary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="space-y-4">
        <Field id={ids.name} label="Event name" required error={errors.name}>
          <input id={ids.name} className={inputClass} value={name} maxLength={200} autoFocus aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${ids.name}-err` : undefined} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={ids.date} label="Start date" required error={errors.date}
            hint={dateChanged ? 'Existing task due dates are not moved.' : undefined}>
            <input id={ids.date} type="date" className={inputClass} value={eventDate} aria-invalid={Boolean(errors.date)}
              aria-describedby={errors.date ? `${ids.date}-err` : dateChanged ? `${ids.date}-hint` : undefined}
              onChange={(e) => {
                const next = e.target.value;
                // Keep a one-day event one day: move the end along when it's equal or would fall before the start.
                if (next && (endDate === eventDate || endDate < next)) setEndDate(next);
                setEventDate(next);
              }} />
          </Field>
          <Field id={ids.end} label="End date" required error={errors.end}>
            <input id={ids.end} type="date" className={inputClass} value={endDate} min={eventDate || undefined} aria-invalid={Boolean(errors.end)}
              aria-describedby={errors.end ? `${ids.end}-err` : undefined} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field id={ids.status} label="Status" required>
            <select id={ids.status} className={inputClass} value={status} onChange={(e) => setStatus(Number(e.target.value) as EventStatus)}>
              {(Object.keys(EVENT_STATUS_LABEL).map(Number) as EventStatus[]).map((s) => <option key={s} value={s}>{EVENT_STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field id={ids.location} label="Location" error={errors.location}>
            <input id={ids.location} className={inputClass} value={location} maxLength={200} aria-invalid={Boolean(errors.location)}
              aria-describedby={errors.location ? `${ids.location}-err` : undefined} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </div>
        <Field id={ids.budget} label={`Budget${event.currency?.name ? ` (${event.currency.name})` : ''}`} error={errors.budget}>
          <input id={ids.budget} type="number" inputMode="decimal" min={0} step="0.01" className={`tabular ${inputClass}`} value={budget}
            aria-invalid={Boolean(errors.budget)} aria-describedby={errors.budget ? `${ids.budget}-err` : undefined}
            onChange={(e) => setBudget(e.target.value)} />
        </Field>
        {save.isError && (
          <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> Not saved: {errorMessage(save.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}
