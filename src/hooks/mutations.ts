/** Write hooks. Each invalidates the queries it affects. */
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { createEventFromTemplate, type CloneProgress, type NewEventInput } from '@/services/eventCreationService';
import type { EventTaskInput } from '@/services/eventTasksService';
import { eventsService, type EventInput } from '@/services/eventsService';
import { deleteEvent } from '@/services/eventDeletionService';
import { applyTemplateChange, type ApplyTemplateChangeInput } from '@/services/templateChangeService';
import { attachmentsService } from '@/services/attachmentsService';
import { expenseOperations } from '@/services/expenseOperationsService';import { eventTemplatesService, templateTasksService, type TemplateTaskInput } from '@/services/templatesService';
import type { ExpenseInput } from '@/services/expensesService';
import { taskOperations, type TaskChanges } from '@/services/taskOperationsService';
import { MeetingStatus, TaskStatus, type TemplateColor } from '@/types/schema';
import { meetingsService } from '@/services/meetingsService';
import { queryKeys } from '@/hooks/queries';
import type { EventTask, Expense } from '@/types/entities';
import { todayDateOnly } from '@/utils/dates';

/** Patch one task inside every cached task list / detail. */
function patchCachedTask(task: EventTask) {
  return (data: unknown): unknown => {
    if (Array.isArray(data)) return data.map((t: EventTask) => (t.id === task.id ? task : t));
    if (data && typeof data === 'object' && 'id' in data && data.id === task.id) return task;
    return data;
  };
}

export function useSetTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ task, status }: { task: EventTask; status: TaskStatus }) => taskOperations.changeStatus(task, status),
    onMutate: async ({ task, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const snapshot: [QueryKey, unknown][] = queryClient.getQueriesData({ queryKey: ['tasks'] });
      const optimistic: EventTask = { ...task, status, completedOn: status === TaskStatus.Completed ? todayDateOnly() : null };
      queryClient.setQueriesData({ queryKey: ['tasks'] }, patchCachedTask(optimistic));
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: (_data, _error, { task }) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['history', task.id] });
    },
  });
}

export function useSaveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ task, changes }: { task: EventTask; changes: TaskChanges }) => taskOperations.saveChanges(task, changes),
    onSettled: (_d, _e, { task }) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['history', task.id] });
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: string }) => taskOperations.addComment(taskId, body),
    onSuccess: (_d, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: ['comments'] });
      void queryClient.invalidateQueries({ queryKey: ['history', taskId] });
    },
  });
}

function useInvalidateTaskActivity() {
  const queryClient = useQueryClient();
  return (taskId: string) => {
    void queryClient.invalidateQueries({ queryKey: ['attachments'] });
    void queryClient.invalidateQueries({ queryKey: ['history', taskId] });
  };
}

export function useAttachFile() {
  const invalidate = useInvalidateTaskActivity();
  return useMutation({
    mutationFn: ({ taskId, file }: { taskId: string; file: File }) => taskOperations.attachFile(taskId, file),
    onSettled: (_d, _e, { taskId }) => invalidate(taskId),
  });
}

export function useRemoveFile() {
  const invalidate = useInvalidateTaskActivity();
  return useMutation({
    mutationFn: ({ taskId, attachment }: { taskId: string; attachment: { id: string; fileName: string } }) =>
      taskOperations.removeFile(taskId, attachment),
    onSettled: (_d, _e, { taskId }) => invalidate(taskId),
  });
}

/** Fetch an attachment's content and hand it to the browser as a download. */
export async function downloadAttachment(id: string): Promise<void> {
  const file = await attachmentsService.download(id);
  const bytes = Uint8Array.from(atob(file.documentBody), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType || 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.fileName || 'attachment';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function useInvalidateBudget() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['expenses'] });
    void queryClient.invalidateQueries({ queryKey: ['history'] });
  };
}

export function useSaveExpense() {
  const invalidate = useInvalidateBudget();
  return useMutation({
    mutationFn: ({ expense, input }: { expense: Expense | null; input: ExpenseInput }) =>
      expense ? expenseOperations.update(expense, input).then(() => expense.id) : expenseOperations.create(input),
    onSettled: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateBudget();
  return useMutation({ mutationFn: (expense: Expense) => expenseOperations.remove(expense), onSettled: invalidate });
}

/** Receipts are Notes on the expense (no task history: they belong to the expense). */
export function useReceipts() {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['attachments'] });
  const upload = useMutation({
    mutationFn: ({ expenseId, file }: { expenseId: string; file: File }) => attachmentsService.upload({ kind: 'expense', id: expenseId }, file),
    onSettled: refresh,
  });
  const remove = useMutation({ mutationFn: (id: string) => attachmentsService.remove(id), onSettled: refresh });
  return { upload, remove };
}

/** Template admin writes; all refresh the ['templates', …] queries (list, counts, tasks). */
export function useTemplateAdmin() {
  const queryClient = useQueryClient();
  const onSettled = () => void queryClient.invalidateQueries({ queryKey: ['templates'] });
  return {
    createTemplate: useMutation({ mutationFn: (name: string) => eventTemplatesService.create(name), onSettled }),
    renameTemplate: useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => eventTemplatesService.rename(id, name), onSettled }),
    deleteTemplate: useMutation({ mutationFn: (id: string) => eventTemplatesService.remove(id), onSettled }),
    /** Color shows on events too (Calendar, event chips), so refresh both. */
    setColor: useMutation({
      mutationFn: ({ id, color }: { id: string; color: TemplateColor | null }) => eventTemplatesService.setColor(id, color),
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.templates });
        void queryClient.invalidateQueries({ queryKey: queryKeys.events });
      },
    }),
    addTask: useMutation({ mutationFn: (input: TemplateTaskInput) => templateTasksService.create(input), onSettled }),
    updateTask: useMutation({
      mutationFn: ({ id, title, daysBefore }: { id: string; title?: string; daysBefore?: number }) => templateTasksService.update(id, { title, daysBefore }),
      onSettled,
    }),
    deleteTask: useMutation({ mutationFn: (id: string) => templateTasksService.remove(id), onSettled }),
  };
}

export function useAddTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventTaskInput) => taskOperations.addTask(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<EventInput> }) => eventsService.update(id, patch),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
}

/**
 * Mark a meeting Cancelled in the app. The Teams connector can't cancel the Outlook/Teams
 * invitation, so the UI reminds the user to cancel it there first. Unblocks "Delete event".
 */
export function useCancelMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) => meetingsService.update(meetingId, { status: MeetingStatus.Cancelled }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['meetings'] });
      void queryClient.invalidateQueries({ queryKey: ['deletionImpact'] });
    },
  });
}

/**
 * Delete an event (cascade removes its children). The deleted event's own detail query is dropped,
 * not refetched — a refetch would 404 on the page being left. Everything else that could list the
 * event or its children is refreshed (Events, Tasks, sidebar, Calendar, Reports share these keys).
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => deleteEvent(eventId),
    onSuccess: (_data, eventId) => {
      queryClient.removeQueries({ queryKey: queryKeys.event(eventId), exact: true });
      queryClient.removeQueries({ queryKey: queryKeys.deletionImpact(eventId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events, predicate: (q) => q.queryKey[1] !== eventId });
      for (const key of [['tasks'], ['expenses'], ['meetings'], ['comments'], ['history'], ['attachments']]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/**
 * Change (or remove, or re-apply) an event's template: adds the new template's missing tasks, then
 * updates the lookup. Refreshes the event (detail + lists + Calendar), its tasks and history.
 */
export function useChangeEventTemplate(onProgress?: (p: CloneProgress) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplyTemplateChangeInput) => applyTemplateChange(input, onProgress),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.events });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

export function useCreateEvent(onProgress?: (p: CloneProgress) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewEventInput) => createEventFromTemplate(input, onProgress),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
