import { useId, useState, type FormEvent } from 'react';
import { AlertTriangle, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useTemplateAdmin } from '@/hooks/mutations';
import { useTemplates, useTemplateTasks } from '@/hooks/queries';
import type { EventTemplate, TemplateColor, TemplateTask } from '@/types/entities';
import { PHASES, phaseFor } from '@/utils/dates';
import { errorMessage } from '@/utils/format';
import { automaticColor, colorForTemplate, TEMPLATE_COLOR_OPTIONS, TEMPLATE_PALETTE } from '@/utils/templateColors';

const inputClass = 'min-h-11 rounded-xl border border-line bg-white px-3 text-sm aria-[invalid=true]:border-red-600';
const validDays = (v: string) => /^\d{1,3}$/.test(v) && Number(v) <= 365;

function TaskRow({ task, canEdit, onError }: { task: TemplateTask; canEdit: boolean; onError: (m: string | null) => void }) {
  const { updateTask, deleteTask } = useTemplateAdmin();
  const [title, setTitle] = useState(task.title);
  const [days, setDays] = useState(String(task.daysBefore));
  const dirty = title.trim() !== task.title || days !== String(task.daysBefore);
  const invalid = !title.trim() || !validDays(days);

  if (!canEdit) {
    return (
      <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <span className="min-w-0 truncate">{task.title}</span>
        <span className="tabular shrink-0 text-muted">{task.daysBefore} days before</span>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-2">
      <label className="sr-only" htmlFor={`t-${task.id}`}>Task title</label>
      <input id={`t-${task.id}`} className={`${inputClass} min-w-0 flex-1 basis-48`} value={title} maxLength={200}
        aria-invalid={!title.trim()} onChange={(e) => setTitle(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-secondary">
        <input type="number" inputMode="numeric" min={0} max={365} className={`${inputClass} tabular w-20`} value={days}
          aria-invalid={!validDays(days)} aria-label="Days before the event" onChange={(e) => setDays(e.target.value)} />
        days before
      </label>
      <span className="flex">
        <Button variant="ghost" size="icon" aria-label={`Save ${task.title}`} disabled={!dirty || invalid || updateTask.isPending}
          onClick={() => { onError(null); updateTask.mutate({ id: task.id, title, daysBefore: Number(days) }, { onError: (e) => onError(errorMessage(e)) }); }}
          icon={<Check className="size-4" aria-hidden />} />
        <Button variant="ghost" size="icon" aria-label={`Delete ${task.title}`} disabled={deleteTask.isPending}
          onClick={() => {
            if (!window.confirm(`Delete "${task.title}" from this template? Events already created keep their tasks.`)) return;
            onError(null);
            deleteTask.mutate(task.id, { onError: (e) => onError(errorMessage(e)) });
          }}
          icon={<Trash2 className="size-4" aria-hidden />} />
      </span>
    </li>
  );
}

function AddTaskRow({ templateId, onError }: { templateId: string; onError: (m: string | null) => void }) {
  const { addTask } = useTemplateAdmin();
  const titleId = useId();
  const [title, setTitle] = useState('');
  const [days, setDays] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !validDays(days)) return;
    onError(null);
    addTask.mutate({ templateId, title, daysBefore: Number(days) }, {
      onSuccess: () => { setTitle(''); setDays(''); document.getElementById(titleId)?.focus(); },
      onError: (err) => onError(errorMessage(err)),
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 border-t border-line bg-page px-4 py-3">
      <label className="sr-only" htmlFor={titleId}>New task title</label>
      <input id={titleId} className={`${inputClass} min-w-0 flex-1 basis-48`} placeholder="New task title" value={title} maxLength={200}
        disabled={addTask.isPending} onChange={(e) => setTitle(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-secondary">
        <input type="number" inputMode="numeric" min={0} max={365} className={`${inputClass} tabular w-20`} placeholder="0" value={days}
          aria-label="Days before the event" disabled={addTask.isPending} onChange={(e) => setDays(e.target.value)} />
        days before
      </label>
      <Button type="submit" variant="secondary" disabled={!title.trim() || !validDays(days) || addTask.isPending} icon={<Plus className="size-4" aria-hidden />}>
        {addTask.isPending ? 'Adding…' : 'Add task'}
      </Button>
    </form>
  );
}

function ColorPicker({ template, others }: { template: EventTemplate; others: EventTemplate[] }) {
  const { setColor } = useTemplateAdmin();
  const hintId = useId();
  // Show the requested value while saving so the radio doesn't jump back.
  const value = setColor.isPending && setColor.variables ? setColor.variables.color : template.color;
  const automatic = automaticColor(template.id);
  const effective = colorForTemplate({ id: template.id, color: value });
  const sharedWith = value === null ? [] : others.filter((t) => colorForTemplate(t).key === effective.key).map((t) => t.name);

  const choose = (color: TemplateColor | null) => {
    if (color === template.color) return;
    setColor.mutate({ id: template.id, color });
  };

  const swatch = (key: string, label: string, solid: string, checked: boolean, color: TemplateColor | null) => (
    <label key={key}
      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border bg-white py-1.5 pr-3 pl-1.5 text-sm font-semibold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-navy-700 ${
        checked ? 'border-navy-700 ring-2 ring-navy-700' : 'border-line hover:bg-navy-50'
      }`}>
      <input type="radio" name={`color-${template.id}`} className="sr-only" checked={checked} disabled={setColor.isPending}
        onChange={() => choose(color)} />
      <span className={`flex size-7 items-center justify-center rounded-full text-white ${solid}`} aria-hidden>
        {checked && <Check className="size-4" />}
      </span>
      {label}
    </label>
  );

  return (
    <fieldset aria-describedby={hintId} className="border-t border-line px-5 py-4">
      <legend className="sr-only">Color</legend>
      <p aria-hidden className="text-sm font-bold">Color</p>
      <p id={hintId} className="mb-3 text-sm text-muted">Used for this template's events in the Calendar.</p>
      <div className="flex flex-wrap gap-2">
        {swatch('auto', `Automatic (${automatic.label})`, automatic.solid, value === null, null)}
        {TEMPLATE_COLOR_OPTIONS.map((o) => {
          const p = TEMPLATE_PALETTE[o.key];
          return swatch(o.key, p.label, p.solid, value === o.value, o.value);
        })}
      </div>
      {sharedWith.length > 0 && (
        <p className="mt-3 flex gap-2 text-sm text-orange-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Also used by {sharedWith.join(', ')} — their events will look the same in the Calendar.
        </p>
      )}
      {setColor.isError && <p role="alert" className="mt-3 text-sm text-red-700">Color not saved: {errorMessage(setColor.error)}</p>}
    </fieldset>
  );
}

export function TemplateEditor({ template, usedBy, canEdit, onDeleted }: {
  template: EventTemplate; usedBy: number; canEdit: boolean; onDeleted: () => void;
}) {
  const tasks = useTemplateTasks(template.id);
  const templates = useTemplates();
  const others = (templates.data ?? []).filter((t) => t.id !== template.id);
  const color = colorForTemplate(template);
  const { renameTemplate, deleteTemplate } = useTemplateAdmin();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(template.name);
  const [problem, setProblem] = useState<string | null>(null);

  const saveName = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setProblem(null);
    renameTemplate.mutate({ id: template.id, name }, { onSuccess: () => setRenaming(false), onError: (err) => setProblem(errorMessage(err)) });
  };
  const remove = () => {
    const note = usedBy > 0 ? ` ${usedBy} event${usedBy === 1 ? '' : 's'} created from it keep their tasks.` : '';
    if (!window.confirm(`Delete the template "${template.name}" and all its tasks?${note}`)) return;
    setProblem(null);
    deleteTemplate.mutate(template.id, { onSuccess: onDeleted, onError: (err) => setProblem(errorMessage(err)) });
  };

  const list = tasks.data ?? [];
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        {renaming ? (
          <form onSubmit={saveName} className="flex min-w-0 flex-1 items-center gap-2">
            <label className="sr-only" htmlFor={`name-${template.id}`}>Template name</label>
            <input id={`name-${template.id}`} className={`${inputClass} min-w-0 flex-1 text-base font-bold`} value={name} maxLength={200} autoFocus
              onChange={(e) => setName(e.target.value)} />
            <Button type="submit" variant="secondary" size="icon" aria-label="Save name" disabled={!name.trim() || renameTemplate.isPending} icon={<Check className="size-4" aria-hidden />} />
            <Button variant="ghost" size="icon" aria-label="Cancel rename" onClick={() => { setRenaming(false); setName(template.name); }} icon={<X className="size-4" aria-hidden />} />
          </form>
        ) : (
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-extrabold break-words">
              <span className={`size-3 shrink-0 rounded-full ${color.solid}`} aria-hidden />
              {template.name}
            </h2>
            <p className="mt-1 flex flex-wrap gap-2 text-sm text-muted">
              <Chip tone="navy">{list.length} task{list.length === 1 ? '' : 's'}</Chip>
              <Chip tone="outline">Used by {usedBy} event{usedBy === 1 ? '' : 's'}</Chip>
            </p>
          </div>
        )}
        {canEdit && !renaming && (
          <span className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label="Rename template" onClick={() => setRenaming(true)} icon={<Pencil className="size-4" aria-hidden />} />
            <Button variant="ghost" size="icon" aria-label="Delete template" disabled={deleteTemplate.isPending} onClick={remove} icon={<Trash2 className="size-4" aria-hidden />} />
          </span>
        )}
      </div>
      {problem && <p role="alert" className="mx-5 mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{problem}</p>}
      {canEdit && <ColorPicker template={template} others={others} />}

      {tasks.isPending ? (
        <LoadingRegion label="Loading template tasks"><div className="space-y-2 px-5 pb-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11" />)}</div></LoadingRegion>
      ) : tasks.isError ? (
        <div className="p-5"><ErrorState error={tasks.error} title="Couldn't load tasks" onRetry={() => void tasks.refetch()} /></div>
      ) : list.length === 0 ? (
        <div className="px-5 pb-5"><EmptyState title="No tasks yet" description={canEdit ? 'Add the first task below. "Days before" sets its due date relative to the event.' : 'This template has no tasks.'} /></div>
      ) : (
        PHASES.map((p) => {
          const inPhase = list.filter((t) => phaseFor(t.daysBefore) === p.key);
          if (inPhase.length === 0) return null;
          return (
            <section key={p.key} aria-label={p.label} className="border-t border-line">
              <h3 className="bg-page px-4 py-2 text-xs font-bold tracking-wider text-secondary uppercase">{p.label} · {inPhase.length}</h3>
              <ul className="divide-y divide-line">
                {inPhase.map((t) => <TaskRow key={`${t.id}-${t.title}-${t.daysBefore}`} task={t} canEdit={canEdit} onError={setProblem} />)}
              </ul>
            </section>
          );
        })
      )}
      {canEdit && <AddTaskRow templateId={template.id} onError={setProblem} />}
    </Card>
  );
}
