/**
 * Change an event's template: pick a template (or none), preview what is added / skipped / kept,
 * then apply. Existing tasks are never changed or removed.
 */
import { useId, useMemo, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useChangeEventTemplate } from '@/hooks/mutations';
import { useCurrentUser, useTasks, useTemplateTaskCounts, useTemplates, useTemplateTasks } from '@/hooks/queries';
import type { CloneProgress } from '@/services/eventCreationService';
import { previewTemplateChange, type TemplateChangeMode } from '@/services/templateChangeService';
import type { EpmEvent, EventTemplate } from '@/types/entities';
import { formatDateOnly, PHASES } from '@/utils/dates';
import { errorMessage, pluralize } from '@/utils/format';
import { colorForTemplate } from '@/utils/templateColors';

const NONE = 'none';

export interface TemplateChangeResult {
  mode: TemplateChangeMode;
  templateName: string | null;
  added: number;
}

export function ChangeTemplateDialog({ event, onClose, onChanged }: {
  event: EpmEvent;
  onClose: () => void;
  onChanged: (result: TemplateChangeResult) => void;
}) {
  const groupName = useId();
  const templates = useTemplates();
  const counts = useTemplateTaskCounts();
  const tasks = useTasks({ eventId: event.id });
  const user = useCurrentUser();
  const [choice, setChoice] = useState<string | null>(null);
  const [skipPastDue, setSkipPastDue] = useState(false);
  const [progress, setProgress] = useState<CloneProgress | null>(null);
  const apply = useChangeEventTemplate(setProgress);
  const chosenId = choice && choice !== NONE ? choice : undefined;
  const templateTasks = useTemplateTasks(chosenId);
  const busy = apply.isPending;

  const currentId = event.template?.id ?? null;
  const { options, currentTemplate } = useMemo(() => {
    const list = [...(templates.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    // Keep the current template first, even if it's no longer in the active list.
    const current: EventTemplate | null = list.find((t) => t.id === currentId)
      ?? (event.template ? { id: event.template.id, name: event.template.name, color: null } : null);
    return { options: current ? [current, ...list.filter((t) => t.id !== current.id)] : list, currentTemplate: current };
  }, [templates.data, currentId, event.template]);

  const preview = useMemo(() => {
    if (choice === null || !tasks.data) return null;
    if (choice === NONE) return previewTemplateChange(event, tasks.data, null, []);
    if (!templateTasks.data) return null;
    return previewTemplateChange(event, tasks.data, choice, templateTasks.data);
  }, [choice, event, tasks.data, templateTasks.data]);

  const chosen = options.find((t) => t.id === chosenId) ?? null;
  const ready = preview?.ok ? preview : null;
  const adding = ready ? (skipPastDue ? ready.toAdd.filter((t) => !t.isPastDue).length : ready.toAdd.length) : 0;
  const nothingToDo = !ready || (ready.mode === 'clear' && !currentId) || (ready.mode === 'addMissing' && adding === 0);
  const applyLabel = !ready ? 'Change template'
    : ready.mode === 'clear' ? 'Remove template'
      : ready.mode === 'addMissing' ? (adding ? `Add ${pluralize(adding, 'task')}` : 'Nothing to add')
        : 'Change template';

  const submit = () => {
    if (!ready || !user.data || nothingToDo) return;
    apply.mutate(
      { event, newTemplate: chosen ? { id: chosen.id, name: chosen.name } : null, toAdd: ready.toAdd, assigneeId: user.data.id, skipPastDue },
      { onSuccess: ({ added }) => onChanged({ mode: ready.mode, templateName: chosen?.name ?? null, added }) },
    );
  };

  const baseError = templates.error ?? tasks.error;
  const currentColor = colorForTemplate(currentTemplate);

  return (
    <Dialog open onClose={() => { if (!busy) onClose(); }} title="Change template"
      description="Adds the chosen template's tasks to this event. Existing tasks are never changed or removed."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="secondary" onClick={submit} disabled={busy || nothingToDo || !user.data}>{busy ? 'Working…' : applyLabel}</Button>
        </>
      }>
      {baseError ? (
        <ErrorState error={baseError} title="Couldn't load templates or tasks" onRetry={() => { void templates.refetch(); void tasks.refetch(); }} />
      ) : templates.isPending || tasks.isPending ? (
        <LoadingRegion label="Loading templates">{[0, 1, 2].map((i) => <Skeleton key={i} className="mt-2 h-12 rounded-xl" />)}</LoadingRegion>
      ) : (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-secondary">
            Current:
            {currentTemplate ? <Chip className={`${currentColor.bg} ${currentColor.text}`}>{currentTemplate.name}</Chip> : <Chip tone="outline">No template</Chip>}
          </p>

          <fieldset disabled={busy}>
            <legend className="mb-2 text-sm font-bold">Choose a template</legend>
            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {[...options.map((t) => ({ id: t.id, name: t.name, color: colorForTemplate(t), count: counts.data?.get(t.id) })),
                { id: NONE, name: 'No template', color: null, count: undefined }].map((o) => {
                const checked = choice === o.id;
                return (
                  <label key={o.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm has-focus-visible:outline-2 has-focus-visible:outline-navy-700 ${
                    checked ? 'border-navy-700 bg-navy-50' : 'border-line hover:bg-page'}`}>
                    <input type="radio" name={groupName} className="sr-only" checked={checked} onChange={() => { setChoice(o.id); setSkipPastDue(false); }} />
                    <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${checked ? 'border-navy-700 bg-navy-700 text-white' : 'border-line'}`} aria-hidden>
                      {checked && <Check className="size-3" />}
                    </span>
                    {o.color ? <span className={`size-2.5 shrink-0 rounded-full ${o.color.solid}`} aria-hidden /> : <span className="size-2.5 shrink-0 rounded-full border border-muted" aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{o.name}</span>
                      {o.id === currentId && <span className="block text-xs text-muted">Current — add missing tasks</span>}
                    </span>
                    {o.count !== undefined && <span className="tabular shrink-0 text-xs text-muted">{pluralize(o.count, 'task')}</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <section aria-live="polite" className="mt-4">
            {choice === null ? null : chosenId && templateTasks.isPending ? (
              <LoadingRegion label="Building preview"><Skeleton className="h-16 rounded-2xl" /></LoadingRegion>
            ) : chosenId && templateTasks.isError ? (
              <ErrorState error={templateTasks.error} title="Couldn't load the template's tasks" onRetry={() => void templateTasks.refetch()} />
            ) : preview && !preview.ok ? (
              <p role="alert" className="flex gap-2 rounded-2xl bg-orange-50 p-3 text-sm text-orange-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{preview.error}</p>
            ) : ready?.mode === 'clear' ? (
              <p className="rounded-2xl bg-page p-3 text-sm text-secondary">
                {currentId ? 'The template will be removed from this event. No tasks are added or removed.' : 'This event already has no template.'}
              </p>
            ) : ready ? (
              <div className="space-y-3">
                <p className="rounded-2xl bg-page p-3 text-sm text-secondary">
                  Adds <strong className="tabular text-ink">{adding}</strong> task{adding === 1 ? '' : 's'}
                  {' · '}skips <strong className="tabular text-ink">{ready.skipped.length}</strong> already in the checklist
                  {' · '}keeps all <strong className="tabular text-ink">{ready.keptCount}</strong> current task{ready.keptCount === 1 ? '' : 's'}
                </p>
                {ready.pastDueCount > 0 && (
                  <div className="rounded-2xl bg-orange-50 p-3 text-sm text-orange-900">
                    <p><strong className="tabular">{ready.pastDueCount}</strong> of these {ready.pastDueCount === 1 ? 'is' : 'are'} already past {ready.pastDueCount === 1 ? 'its' : 'their'} due date.</p>
                    <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
                      <input type="checkbox" className="size-4 accent-navy-700" checked={skipPastDue} disabled={busy} onChange={(e) => setSkipPastDue(e.target.checked)} />
                      Skip tasks whose due date has passed
                    </label>
                  </div>
                )}
                {ready.toAdd.length > 0 && (
                  <details className="rounded-2xl border border-line">
                    <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">Tasks to add ({ready.toAdd.length})</summary>
                    <div className="max-h-60 overflow-y-auto px-3 pb-3">
                      {PHASES.map((ph) => {
                        const list = ready.toAdd.filter((t) => t.phase === ph.key);
                        if (!list.length) return null;
                        return (
                          <div key={ph.key} className="mt-2">
                            <h4 className="text-xs font-bold tracking-wider text-secondary uppercase">{ph.label} · {list.length}</h4>
                            <ul className="mt-1 space-y-1 text-sm">
                              {list.map((t) => (
                                <li key={t.templateTaskId} className={`flex justify-between gap-3 ${skipPastDue && t.isPastDue ? 'text-muted line-through' : ''}`}>
                                  <span className="min-w-0 truncate">{t.title}</span>
                                  <span className={`tabular shrink-0 ${t.isPastDue ? 'font-semibold text-red-700' : 'text-muted'}`}>{formatDateOnly(t.dueDate, 'MMM d')}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
                {ready.skipped.length > 0 && (
                  <details className="rounded-2xl border border-line">
                    <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-semibold">Skipped ({ready.skipped.length})</summary>
                    <ul className="max-h-48 space-y-1 overflow-y-auto px-3 pb-3 text-sm">
                      {ready.skipped.map((s, i) => (
                        <li key={`${s.title}-${i}`}><span className="font-semibold">{s.title}</span> <span className="text-muted">— {s.reason}</span></li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ) : null}
          </section>

          {busy && progress && progress.total > 0 && (
            <div role="status" className="mt-4 rounded-2xl bg-navy-50 p-3">
              <p className="tabular text-sm font-semibold text-navy-900">Adding tasks… {progress.done} of {progress.total}</p>
              <ProgressBar className="mt-2" value={progress.done} max={progress.total} label="Adding tasks" />
            </div>
          )}
          {apply.isError && (
            <p role="alert" className="mt-4 flex gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{errorMessage(apply.error)}
            </p>
          )}
        </>
      )}
    </Dialog>
  );
}
