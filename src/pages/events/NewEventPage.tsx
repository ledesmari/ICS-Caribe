import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, Lock } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useCreateEvent } from '@/hooks/mutations';
import { useCurrencies, useCurrentUser, useTemplateTasks, useTemplates } from '@/hooks/queries';
import { planTasks, type CloneProgress } from '@/services/eventCreationService';
import { formatDateOnly, todayDateOnly } from '@/utils/dates';
import { errorMessage, pluralize } from '@/utils/format';

interface FormState {
  name: string;
  templateId: string;
  eventDate: string;
  endDate: string;
  location: string;
  budget: string;
  currencyId: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Enter an event name.';
  else if (f.name.trim().length > 200) e.name = 'Use 200 characters or fewer.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.eventDate)) e.eventDate = 'Choose the start date.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.endDate)) e.endDate = 'Choose the end date.';
  else if (!e.eventDate && f.endDate < f.eventDate) e.endDate = 'The end date can’t be before the start date.';
  if (f.location.trim().length > 200) e.location = 'Use 200 characters or fewer.';
  if (f.budget !== '') {
    const n = Number(f.budget);
    if (!Number.isFinite(n) || n < 0) e.budget = 'Enter an amount of 0 or more.';
  }
  return e;
}

const inputClass =
  'min-h-11 w-full rounded-xl border border-line bg-white px-4 text-base aria-[invalid=true]:border-red-600';

function Field({ label, error, hint, required, children, id }: {
  label: string; error?: string; hint?: ReactNode; required?: boolean; children: ReactNode; id: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label} {required ? <span aria-hidden className="text-red-700">*</span> : <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-sm text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}

export default function NewEventPage() {
  const navigate = useNavigate();
  const ids = { name: useId(), template: useId(), date: useId(), end: useId(), location: useId(), budget: useId(), currency: useId() };
  const user = useCurrentUser();
  const templates = useTemplates();
  const currencies = useCurrencies();
  const [form, setForm] = useState<FormState>({ name: '', templateId: '', eventDate: '', endDate: '', location: '', budget: '', currencyId: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [progress, setProgress] = useState<CloneProgress | null>(null);
  const create = useCreateEvent(setProgress);
  const templateTasks = useTemplateTasks(form.templateId || undefined);

  // Default currency: USD when available, else the first one (derived, not stored).
  const currencyId =
    form.currencyId || (currencies.data?.find((c) => c.code === 'USD') ?? currencies.data?.[0])?.id || '';

  const plan = useMemo(
    () => (form.templateId && form.eventDate && templateTasks.data ? planTasks(form.eventDate, templateTasks.data) : null),
    [form.templateId, form.eventDate, templateTasks.data],
  );
  const today = todayDateOnly();
  const pastDue = plan?.filter((t) => t.dueDate < today).length ?? 0;
  const firstDue = plan?.reduce<string | null>((min, t) => (!min || t.dueDate < min ? t.dueDate : min), null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    const firstInvalid = (Object.keys(found) as (keyof FormState)[])[0];
    if (firstInvalid) {
      const idFor: Record<keyof FormState, string> = {
        name: ids.name, templateId: ids.template, eventDate: ids.date, endDate: ids.end, location: ids.location, budget: ids.budget, currencyId: ids.currency,
      };
      document.getElementById(idFor[firstInvalid])?.focus();
      return;
    }
    if (!user.data) return;
    const template = templates.data?.find((t) => t.id === form.templateId);
    create.mutate(
      {
        name: form.name.trim(),
        eventDate: form.eventDate,
        endDate: form.endDate,
        location: form.location.trim(),
        budget: form.budget === '' ? null : Number(form.budget),
        currencyId: currencyId || null,
        templateId: form.templateId || null,
        templateName: template?.name,
        ownerId: user.data.id,
      },
      {
        onSuccess: ({ taskCount }) =>
          navigate('/events', { state: { created: { name: form.name.trim(), taskCount } } }),
      },
    );
  };

  const back = (
    <Link to="/events" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">
      <ChevronLeft className="size-4" aria-hidden /> Events
    </Link>
  );

  if (user.isPending) {
    return <LoadingRegion label="Loading"><Skeleton className="h-10 w-64" /><Skeleton className="mt-6 h-96" /></LoadingRegion>;
  }
  if (user.isError) return <ErrorState error={user.error} onRetry={() => void user.refetch()} />;
  if (!user.data.isManager) {
    return (
      <>
        {back}
        <PageHeader title="New event" />
        <EmptyState icon={<Lock className="size-6" />} title="Managers only" description="Only EPM Managers can create events. Ask a manager if you need one." />
      </>
    );
  }

  const busy = create.isPending;
  const describe = (id: string, key: keyof FormState, hasHint = false) =>
    errors[key] ? `${id}-error` : hasHint ? `${id}-hint` : undefined;

  return (
    <>
      {back}
      <PageHeader title="New event" subtitle="Create an event and generate its checklist from a template" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card as="div">
          <form noValidate onSubmit={onSubmit} className="space-y-5" aria-busy={busy}>
            <Field id={ids.name} label="Event name" required error={errors.name}>
              <input id={ids.name} className={inputClass} value={form.name} maxLength={200} disabled={busy}
                aria-invalid={Boolean(errors.name)} aria-describedby={describe(ids.name, 'name')}
                onChange={(e) => set('name', e.target.value)} autoComplete="off" />
            </Field>

            <Field id={ids.template} label="Template" error={errors.templateId}
              hint={templates.isError ? `Couldn't load templates: ${errorMessage(templates.error)}` : 'Tasks are copied from the template.'}>
              <select id={ids.template} className={inputClass} value={form.templateId} disabled={busy || templates.isPending}
                aria-describedby={describe(ids.template, 'templateId', true)} onChange={(e) => set('templateId', e.target.value)}>
                <option value="">{templates.isPending ? 'Loading templates…' : 'No template (empty checklist)'}</option>
                {templates.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id={ids.date} label="Start date" required error={errors.eventDate} hint="Task due dates count back from this day.">
                <input id={ids.date} type="date" className={inputClass} value={form.eventDate} disabled={busy}
                  aria-invalid={Boolean(errors.eventDate)} aria-describedby={describe(ids.date, 'eventDate', true)}
                  onChange={(e) => {
                    const next = e.target.value;
                    // Keep a one-day event one day: move the end along when it's unset, equal, or would fall before the start.
                    if (next && (!form.endDate || form.endDate === form.eventDate || form.endDate < next)) set('endDate', next);
                    set('eventDate', next);
                  }} />
              </Field>
              <Field id={ids.end} label="End date" required error={errors.endDate} hint="Same as the start date for a one-day event.">
                <input id={ids.end} type="date" className={inputClass} value={form.endDate} min={form.eventDate || undefined} disabled={busy}
                  aria-invalid={Boolean(errors.endDate)} aria-describedby={describe(ids.end, 'endDate', true)}
                  onChange={(e) => set('endDate', e.target.value)} />
              </Field>
            </div>

            <Field id={ids.location} label="Location" error={errors.location}>
              <input id={ids.location} className={inputClass} value={form.location} maxLength={200} disabled={busy}
                aria-invalid={Boolean(errors.location)} aria-describedby={describe(ids.location, 'location')}
                onChange={(e) => set('location', e.target.value)} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id={ids.budget} label="Budget" error={errors.budget}>
                <input id={ids.budget} type="number" inputMode="decimal" min={0} step="0.01" className={`tabular ${inputClass}`}
                  value={form.budget} disabled={busy} aria-invalid={Boolean(errors.budget)} aria-describedby={describe(ids.budget, 'budget')}
                  onChange={(e) => set('budget', e.target.value)} />
              </Field>
              <Field id={ids.currency} label="Currency" error={errors.currencyId}>
                <select id={ids.currency} className={inputClass} value={currencyId} disabled={busy || currencies.isPending}
                  onChange={(e) => set('currencyId', e.target.value)}>
                  {currencies.isPending && <option value="">Loading…</option>}
                  {currencies.data?.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
                </select>
              </Field>
            </div>

            {create.isError && (
              <div role="alert" className="flex gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                <AlertTriangle className="size-5 shrink-0" aria-hidden />
                <div>
                  <p className="font-bold">The event wasn't created.</p>
                  <p className="mt-1 break-words">{errorMessage(create.error)}</p>
                  <p className="mt-1">Anything created so far was removed. You can try again.</p>
                </div>
              </div>
            )}

            {busy && progress && (
              <div role="status" aria-live="polite" className="rounded-2xl bg-navy-50 p-4">
                <p className="text-sm font-semibold text-navy-900">
                  {progress.total === 0 ? 'Creating event…' : `Creating tasks… ${progress.done} of ${progress.total}`}
                </p>
                {progress.total > 0 && <ProgressBar className="mt-2" value={progress.done} max={progress.total} label="Task creation progress" />}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate('/events')} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</Button>
            </div>
          </form>
        </Card>

        <Card aria-labelledby="preview-heading" className="h-fit">
          <h2 id="preview-heading" className="text-base font-bold">Checklist preview</h2>
          {!form.templateId ? (
            <p className="mt-2 text-sm text-muted">Pick a template to see the tasks it will create.</p>
          ) : templateTasks.isPending ? (
            <div className="mt-3 space-y-2" aria-hidden><Skeleton className="h-4" /><Skeleton className="h-4 w-2/3" /></div>
          ) : templateTasks.isError ? (
            <p className="mt-2 text-sm text-red-700">{errorMessage(templateTasks.error)}</p>
          ) : !form.eventDate ? (
            <p className="mt-2 text-sm text-secondary">
              {pluralize(templateTasks.data.length, 'task')} in this template. Choose the start date to see due dates.
            </p>
          ) : plan && plan.length === 0 ? (
            <p className="mt-2 text-sm text-muted">This template has no tasks yet.</p>
          ) : plan ? (
            <>
              <p className="mt-2 text-sm text-secondary">
                <span className="font-bold text-ink">{pluralize(plan.length, 'task')}</span> assigned to you
                {firstDue && <>, first due {formatDateOnly(firstDue)}</>}.
              </p>
              {pastDue > 0 && (
                <p className="mt-3 flex gap-2 rounded-xl bg-orange-50 p-3 text-sm text-orange-900">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden /> {pluralize(pastDue, 'task')} will already be overdue.
                </p>
              )}
              <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1 text-sm">
                {[...plan].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((t, i) => (
                  <li key={`${t.title}-${i}`} className="flex justify-between gap-3 border-b border-line pb-2 last:border-0">
                    <span className="min-w-0 truncate">{t.title}</span>
                    <span className={`tabular shrink-0 ${t.dueDate < today ? 'font-semibold text-red-700' : 'text-muted'}`}>{formatDateOnly(t.dueDate, 'MMM d')}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>
      </div>
    </>
  );
}
