import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Paperclip, Receipt, Send, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button, ButtonLink } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/States';
import { useAddComment, useSaveTask } from '@/hooks/mutations';
import { useAssignableUsers, useTaskExpenses } from '@/hooks/queries';
import type { TaskStatus } from '@/types/schema';
import type { EventTask, Ref, TaskComment } from '@/types/entities';
import { daysBeforeEvent, formatDateTime } from '@/utils/dates';
import { EXPENSE_CATEGORY_LABEL, errorMessage, formatCurrency, TASK_STATUS_OPTIONS } from '@/utils/format';

const inputClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-4 text-sm disabled:bg-page disabled:text-secondary';

export function TaskQuickEdit({ task, eventDate, isManager, isOwner, attachmentCount, latestComment, onClose }: {
  task: EventTask;
  eventDate: string;
  isManager: boolean;
  isOwner: boolean;
  attachmentCount: number;
  latestComment: TaskComment | null;
  onClose: () => void;
}) {
  const ids = { title: useId(), assignee: useId(), due: useId(), desc: useId(), comment: useId() };
  const users = useAssignableUsers();
  const expenses = useTaskExpenses(task.id);
  const save = useSaveTask();
  const addComment = useAddComment();
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [assignee, setAssignee] = useState<Ref>(task.assignee);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [description, setDescription] = useState(task.description);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);

  const canEdit = isManager || isOwner;
  const dirty = title.trim() !== task.title || status !== task.status || assignee.id !== task.assignee.id || dueDate !== task.dueDate || description !== task.description;
  const offset = dueDate && eventDate ? daysBeforeEvent(dueDate, eventDate) : null;
  const titleInvalid = !title.trim();

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    if (titleInvalid) return document.getElementById(ids.title)?.focus();
    setSaved(false);
    save.mutate(
      { task, changes: { title, status, assignee, dueDate, description } },
      { onSuccess: () => setSaved(true) },
    );
  };

  const onComment = (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    addComment.mutate({ taskId: task.id, body: comment }, { onSuccess: () => setComment('') });
  };

  return (
    <aside aria-label={`Edit ${task.title}`} className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-3xl border border-line bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-wider text-muted uppercase">Quick edit</p>
          <Link to={`/events/${task.eventId}`} className="mt-1 block truncate text-sm font-semibold text-navy-700 hover:underline">{task.eventName}</Link>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close quick edit" onClick={onClose} className="-mt-2 -mr-2" icon={<X className="size-5" aria-hidden />} />
      </div>

      <form onSubmit={onSave} noValidate className="space-y-4">
        <div>
          <label htmlFor={ids.title} className="mb-1 block text-sm font-semibold">Title</label>
          <input id={ids.title} className={`${inputClass} font-semibold`} value={title} maxLength={200} disabled={!isManager || save.isPending}
            aria-invalid={titleInvalid} onChange={(e) => setTitle(e.target.value)} />
          {titleInvalid && <p className="mt-1 text-sm font-semibold text-red-700">Enter a title.</p>}
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold" id={`${ids.title}-status`}>Status</p>
          <SegmentedControl<TaskStatus>
            label="Status"
            value={status}
            onChange={setStatus}
            options={TASK_STATUS_OPTIONS.map((o) => ({ ...o, disabled: !canEdit || save.isPending }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor={ids.assignee} className="mb-1 block text-sm font-semibold">Assignee</label>
            <select id={ids.assignee} className={inputClass} value={assignee.id} disabled={!isManager || save.isPending || users.isPending}
              onChange={(e) => {
                const u = users.data?.find((x) => x.id === e.target.value);
                if (u) setAssignee(u);
              }}>
              {!users.data?.some((u) => u.id === assignee.id) && <option value={assignee.id}>{assignee.name || 'Unknown user'}</option>}
              {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={ids.due} className="mb-1 block text-sm font-semibold">Due date</label>
            <input id={ids.due} type="date" className={inputClass} value={dueDate} disabled={!isManager || save.isPending}
              aria-describedby={`${ids.due}-hint`} onChange={(e) => setDueDate(e.target.value)} />
            <p id={`${ids.due}-hint`} className="mt-1 text-xs text-muted">
              {offset === null ? '' : offset > 0 ? `${offset} days before the event` : offset === 0 ? 'On the event day' : `${-offset} days after the event`}
            </p>
          </div>
        </div>

        <div>
          <label htmlFor={ids.desc} className="mb-1 block text-sm font-semibold">Description</label>
          <textarea id={ids.desc} rows={3} maxLength={4000} className={`${inputClass} py-2`} value={description}
            disabled={!canEdit || save.isPending} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-page p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-secondary"><Paperclip className="size-3.5" aria-hidden /> Files</p>
            <p className="tabular mt-1 font-bold">{attachmentCount}</p>
          </div>
          <div className="rounded-2xl bg-page p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-secondary"><Receipt className="size-3.5" aria-hidden /> Expense</p>
            {expenses.isPending ? <Skeleton className="mt-1 h-4 w-16" /> : expenses.data?.[0] ? (
              <p className="mt-1 truncate font-bold" title={EXPENSE_CATEGORY_LABEL[expenses.data[0].category]}>
                {formatCurrency(expenses.data[0].actualAmount ?? expenses.data[0].estimatedAmount)}
              </p>
            ) : <p className="mt-1 text-muted">None</p>}
          </div>
        </div>

        {save.isError && (
          <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> Not saved: {errorMessage(save.error)}
          </p>
        )}
        {saved && !dirty && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700">
            <CheckCircle2 className="size-4" aria-hidden /> Changes saved.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/tasks/${task.id}`} variant="outline" className="flex-1 justify-center">Open full task</ButtonLink>
          {canEdit && (
            <Button type="submit" variant="secondary" className="flex-1 justify-center" disabled={!dirty || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          )}
        </div>
      </form>

      <section aria-labelledby={`${ids.comment}-h`} className="mt-6 border-t border-line pt-4">
        <h3 id={`${ids.comment}-h`} className="text-sm font-bold">Latest comment</h3>
        {latestComment ? (
          <div className="mt-2 flex gap-2">
            <Avatar person={latestComment.author} size="sm" />
            <div className="min-w-0 text-sm">
              <p><span className="font-semibold">{latestComment.author.name}</span> <span className="text-xs text-muted">{formatDateTime(latestComment.createdOn)}</span></p>
              <p className="line-clamp-3 break-words text-secondary">{latestComment.body}</p>
            </div>
          </div>
        ) : <p className="mt-1 text-sm text-muted">No comments yet.</p>}
        {canEdit && (
          <form onSubmit={onComment} className="mt-3 flex gap-2">
            <label htmlFor={ids.comment} className="sr-only">Add a comment</label>
            <input id={ids.comment} className={inputClass} placeholder="Add a comment" value={comment} maxLength={4000}
              disabled={addComment.isPending} onChange={(e) => setComment(e.target.value)} />
            <Button type="submit" variant="secondary" size="icon" aria-label="Send comment" disabled={!comment.trim() || addComment.isPending}
              icon={<Send className="size-4" aria-hidden />} />
          </form>
        )}
        {addComment.isError && <p role="alert" className="mt-2 text-sm text-red-700">Comment not sent: {errorMessage(addComment.error)}</p>}
      </section>
    </aside>
  );
}
