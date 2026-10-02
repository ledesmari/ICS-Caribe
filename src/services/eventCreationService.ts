/**
 * New event + template cloning.
 * The SDK has no $batch, so writes run in order with compensation: if any task or history
 * write fails, the new event is deleted — its parental cascade removes every task and
 * history row already created, leaving nothing half-built.
 */
import { TransactioncurrenciesService } from '@/generated/services/TransactioncurrenciesService';
import { DataverseError, runSequence, unwrapList } from '@/api/dataverseClient';
import { asRow, str } from '@/api/odata';
import { eventsService, type EventInput } from '@/services/eventsService';
import { eventTasksService } from '@/services/eventTasksService';
import { taskHistoryService } from '@/services/taskActivityService';
import { templateTasksService } from '@/services/templatesService';
import { ACTIVE_STATE, HistoryAction, TaskStatus } from '@/types/schema';
import type { TemplateTask } from '@/types/entities';
import { addDaysDateOnly } from '@/utils/dates';

export interface Currency {
  id: string;
  code: string;
  name: string;
}

export const currenciesService = {
  async list(): Promise<Currency[]> {
    const rows = await unwrapList('List currencies', TransactioncurrenciesService.getAll({
      select: ['transactioncurrencyid', 'isocurrencycode', 'currencyname'],
      filter: `statecode eq ${ACTIVE_STATE}`,
      orderBy: ['isocurrencycode asc'],
    }));
    return rows.map((r) => {
      const row = asRow(r);
      return { id: str(row, 'transactioncurrencyid'), code: str(row, 'isocurrencycode'), name: str(row, 'currencyname') };
    });
  },
};

export interface NewEventInput extends EventInput {
  templateId?: string | null;
  templateName?: string;
  /** systemuserid that owns the cloned tasks. */
  ownerId: string;
}

export interface CloneProgress {
  done: number;
  total: number;
}

/** Due date = event (start) date − days before. Keeps the template task id for the event task's link. */
export function planTasks(eventDate: string, templateTasks: TemplateTask[]) {
  return templateTasks.map((t) => ({
    title: t.title, dueDate: addDaysDateOnly(eventDate, -t.daysBefore), daysBefore: t.daysBefore, templateTaskId: t.id,
  }));
}

const CONCURRENCY = 4;

/** Runs `work` over items with a small concurrency limit; rejects on the first failure. */
export async function pool<T>(items: T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  let failed: unknown = null;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (failed === null && next < items.length) {
      const item = items[next++] as T;
      try {
        await work(item);
      } catch (error) {
        failed ??= error;
      }
    }
  });
  await Promise.all(runners);
  if (failed !== null) throw failed;
}

export async function createEventFromTemplate(
  input: NewEventInput,
  onProgress?: (p: CloneProgress) => void,
): Promise<{ eventId: string; taskCount: number }> {
  const templateTasks = input.templateId ? await templateTasksService.listByTemplate(input.templateId) : [];
  const planned = planTasks(input.eventDate, templateTasks);
  onProgress?.({ done: 0, total: planned.length });

  const [eventId] = (await runSequence([
    {
      label: 'Create event',
      run: () => eventsService.create(input),
      undo: (id) => eventsService.remove(String(id)),
    },
    {
      label: 'Create tasks',
      run: async ([id]) => {
        let done = 0;
        await pool(planned, async (task) => {
          const taskId = await eventTasksService.create({
            eventId: String(id),
            title: task.title,
            dueDate: task.dueDate,
            status: TaskStatus.Pending,
            assigneeId: input.ownerId,
            templateTaskId: task.templateTaskId,
          });
          await taskHistoryService.add({
            eventTaskId: taskId,
            action: HistoryAction.Created,
            summary: input.templateName ? `Created from template "${input.templateName}"` : 'Task created',
            fieldName: 'Status',
            newValue: 'Pending',
          });
          onProgress?.({ done: ++done, total: planned.length });
        });
      },
    },
  ])) as [string, void];

  if (!eventId) throw new DataverseError('Create event', 'The event was created but no id was returned.');
  return { eventId, taskCount: planned.length };
}
