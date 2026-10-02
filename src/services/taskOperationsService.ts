/**
 * History-aware task writes. Every change writes a Task History row; if that write fails the
 * task change is reverted (the SDK has no $batch, so this replaces one atomic changeset).
 */
import { runSequence } from '@/api/dataverseClient';
import { attachmentsService } from '@/services/attachmentsService';
import { eventTasksService, type EventTaskInput } from '@/services/eventTasksService';
import { taskCommentsService, taskHistoryService } from '@/services/taskActivityService';
import { HistoryAction, TaskStatus } from '@/types/schema';
import type { DateOnly, EventTask, NewHistoryEntry, Ref } from '@/types/entities';

export interface TaskChanges {
  status?: TaskStatus;
  assignee?: Ref;
  dueDate?: DateOnly;
  title?: string;
  description?: string;
}
import { todayDateOnly } from '@/utils/dates';
import { TASK_STATUS_OPTIONS } from '@/utils/format';

const statusLabel = (s: TaskStatus) => TASK_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? String(s);

export const taskOperations = {
  /** PATCH status (+ set/clear completed-on) and insert a "Status Changed" history row. */
  async changeStatus(task: EventTask, next: TaskStatus): Promise<void> {
    if (task.status === next) return;
    const completedOn = next === TaskStatus.Completed ? todayDateOnly() : null;
    await runSequence([
      {
        label: 'Update task status',
        run: () => eventTasksService.update(task.id, { status: next, completedOn }),
        undo: () => eventTasksService.update(task.id, { status: task.status, completedOn: task.completedOn }),
      },
      {
        label: 'Write history',
        run: () =>
          taskHistoryService.add({
            eventTaskId: task.id,
            action: HistoryAction.StatusChanged,
            summary: `Status changed from ${statusLabel(task.status)} to ${statusLabel(next)}`,
            fieldName: 'Status',
            oldValue: statusLabel(task.status),
            newValue: statusLabel(next),
          }),
      },
    ]);
  },

  /**
   * Save several field edits at once: one task PATCH plus one history row per changed field.
   * On failure the task is restored and any history rows already written are removed.
   */
  async saveChanges(task: EventTask, changes: TaskChanges): Promise<void> {
    const entries: NewHistoryEntry[] = [];
    const patch: Partial<EventTaskInput> = {};
    if (changes.status !== undefined && changes.status !== task.status) {
      patch.status = changes.status;
      patch.completedOn = changes.status === TaskStatus.Completed ? todayDateOnly() : null;
      entries.push({ eventTaskId: task.id, action: HistoryAction.StatusChanged, summary: `Status changed from ${statusLabel(task.status)} to ${statusLabel(changes.status)}`,
        fieldName: 'Status', oldValue: statusLabel(task.status), newValue: statusLabel(changes.status) });
    }
    if (changes.assignee && changes.assignee.id !== task.assignee.id) {
      patch.assigneeId = changes.assignee.id;
      entries.push({ eventTaskId: task.id, action: HistoryAction.Assigned, summary: `Reassigned from ${task.assignee.name || 'nobody'} to ${changes.assignee.name}`,
        fieldName: 'Assignee', oldValue: task.assignee.name, newValue: changes.assignee.name });
    }
    if (changes.dueDate !== undefined && changes.dueDate !== task.dueDate) {
      patch.dueDate = changes.dueDate;
      entries.push({ eventTaskId: task.id, action: HistoryAction.Updated, summary: 'Due date changed', fieldName: 'Due date', oldValue: task.dueDate, newValue: changes.dueDate });
    }
    if (changes.title !== undefined && changes.title.trim() !== task.title) {
      patch.title = changes.title.trim();
      entries.push({ eventTaskId: task.id, action: HistoryAction.Updated, summary: 'Title changed', fieldName: 'Title', oldValue: task.title, newValue: patch.title });
    }
    if (changes.description !== undefined && changes.description !== task.description) {
      patch.description = changes.description;
      entries.push({ eventTaskId: task.id, action: HistoryAction.Updated, summary: 'Description updated', fieldName: 'Description' });
    }
    if (entries.length === 0) return;

    await runSequence([
      {
        label: 'Update task',
        run: () => eventTasksService.update(task.id, patch),
        undo: () => eventTasksService.update(task.id, {
          status: task.status, completedOn: task.completedOn, title: task.title, description: task.description,
          dueDate: task.dueDate, assigneeId: task.assignee.id || undefined,
        }),
      },
      ...entries.map((entry) => ({
        label: `History: ${entry.fieldName}`,
        run: () => taskHistoryService.add(entry),
        undo: (id: unknown) => taskHistoryService.revert(String(id)),
      })),
    ]);
  },

  /** Add a comment plus its "Comment Added" history row. */
  async addComment(taskId: string, body: string): Promise<void> {
    await runSequence([
      { label: 'Add comment', run: () => taskCommentsService.add(taskId, body), undo: (id) => taskCommentsService.remove(String(id)) },
      {
        label: 'Write history',
        run: () => taskHistoryService.add({ eventTaskId: taskId, action: HistoryAction.CommentAdded, summary: 'Comment added', newValue: body.trim().slice(0, 100) }),
      },
    ]);
  },

  /** Upload a file as a Note on the task + "File Attached" history; the note is removed if history fails. */
  async attachFile(taskId: string, file: File): Promise<void> {
    await runSequence([
      { label: 'Upload file', run: () => attachmentsService.upload({ kind: 'eventTask', id: taskId }, file), undo: (id) => attachmentsService.remove(String(id)) },
      {
        label: 'Write history',
        run: () => taskHistoryService.add({ eventTaskId: taskId, action: HistoryAction.FileAttached, summary: `Attached "${file.name}"`, fieldName: 'Attachment', newValue: file.name }),
      },
    ]);
  },

  /**
   * Remove an attachment + "File Removed" history. History is written first because a deleted
   * note can't be restored; if the delete then fails, that history row is reverted.
   */
  async removeFile(taskId: string, attachment: { id: string; fileName: string }): Promise<void> {
    await runSequence([
      {
        label: 'Write history',
        run: () => taskHistoryService.add({ eventTaskId: taskId, action: HistoryAction.FileRemoved, summary: `Removed "${attachment.fileName}"`, fieldName: 'Attachment', oldValue: attachment.fileName }),
        undo: (id) => taskHistoryService.revert(String(id)),
      },
      { label: 'Delete file', run: () => attachmentsService.remove(attachment.id) },
    ]);
  },

  /** Create a task and its "Created" history row; deletes the task if the history write fails. */
  async addTask(input: EventTaskInput): Promise<string> {
    const [taskId] = (await runSequence([
      {
        label: 'Create task',
        run: () => eventTasksService.create({ ...input, status: input.status ?? TaskStatus.Pending }),
        undo: (id) => eventTasksService.remove(String(id)),
      },
      {
        label: 'Write history',
        run: ([id]) =>
          taskHistoryService.add({
            eventTaskId: String(id),
            action: HistoryAction.Created,
            summary: 'Task added to the checklist',
            fieldName: 'Status',
            newValue: statusLabel(input.status ?? TaskStatus.Pending),
          }),
      },
    ])) as [string, string];
    return taskId;
  },
};
