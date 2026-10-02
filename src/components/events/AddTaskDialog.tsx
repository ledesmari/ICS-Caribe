import { useId, useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useAddTask } from '@/hooks/mutations';
import { useAssignableUsers, useCurrentUser } from '@/hooks/queries';
import { daysBeforeEvent } from '@/utils/dates';
import { errorMessage } from '@/utils/format';

const inputClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-4 text-base aria-[invalid=true]:border-red-600';

export function AddTaskDialog({ open, onClose, eventId, eventDate, defaultDueDate, phaseLabel }: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  eventDate: string;
  defaultDueDate: string;
  phaseLabel?: string;
}) {
  const ids = { title: useId(), due: useId(), assignee: useId(), description: useId() };
  const user = useCurrentUser();
  const users = useAssignableUsers();
  const addTask = useAddTask();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [assigneeId, setAssigneeId] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ title?: string; dueDate?: string }>({});

  const effectiveAssignee = assigneeId || user.data?.id || '';
  const offset = dueDate && eventDate ? daysBeforeEvent(dueDate, eventDate) : null;

  const close = () => {
    if (addTask.isPending) return;
    setTitle('');
    setDescription('');
    setAssigneeId('');
    setDueDate(defaultDueDate);
    setErrors({});
    addTask.reset();
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!title.trim()) found.title = 'Enter a task title.';
    else if (title.trim().length > 200) found.title = 'Use 200 characters or fewer.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) found.dueDate = 'Choose a due date.';
    setErrors(found);
    if (found.title) return document.getElementById(ids.title)?.focus();
    if (found.dueDate) return document.getElementById(ids.due)?.focus();
    addTask.mutate(
      { eventId, title: title.trim(), dueDate, description: description.trim() || undefined, assigneeId: effectiveAssignee || undefined },
      { onSuccess: close },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add task"
      description={phaseLabel ? `Adds a task to the "${phaseLabel}" phase.` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={addTask.isPending}>Cancel</Button>
          <Button type="submit" form={`${ids.title}-form`} disabled={addTask.isPending}>{addTask.isPending ? 'Adding…' : 'Add task'}</Button>
        </>
      }
    >
      <form id={`${ids.title}-form`} noValidate onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor={ids.title} className="mb-1.5 block text-sm font-semibold">Title <span aria-hidden className="text-red-700">*</span></label>
          <input id={ids.title} className={inputClass} value={title} maxLength={200} autoFocus disabled={addTask.isPending}
            aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? `${ids.title}-err` : undefined}
            onChange={(e) => setTitle(e.target.value)} />
          {errors.title && <p id={`${ids.title}-err`} className="mt-1 text-sm font-semibold text-red-700">{errors.title}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={ids.due} className="mb-1.5 block text-sm font-semibold">Due date <span aria-hidden className="text-red-700">*</span></label>
            <input id={ids.due} type="date" className={inputClass} value={dueDate} disabled={addTask.isPending}
              aria-invalid={Boolean(errors.dueDate)} aria-describedby={`${ids.due}-hint`} onChange={(e) => setDueDate(e.target.value)} />
            <p id={`${ids.due}-hint`} className={`mt-1 text-sm ${errors.dueDate ? 'font-semibold text-red-700' : 'text-muted'}`}>
              {errors.dueDate ?? (offset === null ? '' : offset > 0 ? `${offset} days before the event` : offset === 0 ? 'On the event day' : `${-offset} days after the event`)}
            </p>
          </div>
          <div>
            <label htmlFor={ids.assignee} className="mb-1.5 block text-sm font-semibold">Assignee</label>
            <select id={ids.assignee} className={inputClass} value={effectiveAssignee} disabled={addTask.isPending || users.isPending}
              onChange={(e) => setAssigneeId(e.target.value)}>
              {users.isPending && <option value={effectiveAssignee}>{user.data?.name ?? 'Loading…'}</option>}
              {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === user.data?.id ? ' (you)' : ''}</option>)}
            </select>
            {users.isError && <p className="mt-1 text-sm text-red-700">Couldn't load people; the task will be assigned to you.</p>}
          </div>
        </div>
        <div>
          <label htmlFor={ids.description} className="mb-1.5 block text-sm font-semibold">Description <span className="font-normal text-muted">(optional)</span></label>
          <textarea id={ids.description} rows={3} maxLength={4000} className={`${inputClass} py-2`} value={description}
            disabled={addTask.isPending} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {addTask.isError && (
          <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> {errorMessage(addTask.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}
