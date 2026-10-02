/**
 * Change an event's template ("option B"): keep every current task, add the new template's tasks,
 * skip duplicates. Nothing is ever removed. Writes: tasks (+ "Created" history) FIRST, the event's
 * template lookup LAST; if anything fails, the tasks created in this run are deleted again
 * (their history goes with them by cascade).
 */
import { DataverseError, runSequence } from '@/api/dataverseClient';
import { planTasks, pool, type CloneProgress } from '@/services/eventCreationService';
import { eventsService } from '@/services/eventsService';
import { eventTasksService } from '@/services/eventTasksService';
import { taskHistoryService } from '@/services/taskActivityService';
import { HistoryAction, TaskStatus } from '@/types/schema';
import type { DateOnly, EpmEvent, EventTask, Ref, TemplateTask } from '@/types/entities';
import { phaseFor, todayDateOnly, type PhaseKey } from '@/utils/dates';

export type TemplateChangeMode =
  /** Switch to another template. */
  | 'change'
  /** Same template again: add tasks that were added to the template after the event was created. */
  | 'addMissing'
  /** No template: clear the link; no tasks added or removed. */
  | 'clear';

export interface PlannedTask {
  title: string;
  dueDate: DateOnly;
  daysBefore: number;
  phase: PhaseKey;
  isPastDue: boolean;
  templateTaskId: string;
}

export interface SkippedTask {
  title: string;
  reason: string;
}

export type TemplateChangePreview =
  | { ok: false; error: string }
  | { ok: true; mode: TemplateChangeMode; toAdd: PlannedTask[]; skipped: SkippedTask[]; keptCount: number; pastDueCount: number };

/** Title key for duplicate detection: trimmed, lower-case, inner whitespace collapsed. */
export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function modeFor(currentTemplateId: string | undefined, newTemplateId: string | null): TemplateChangeMode {
  if (newTemplateId === null) return 'clear';
  return currentTemplateId === newTemplateId ? 'addMissing' : 'change';
}

/**
 * Pure preview (testable). `templateTasks` are the NEW template's tasks (ignored for null).
 * A planned task is a duplicate when an existing task has the same template task id, or else the
 * same normalized title. Due date = event START date − days before.
 */
export function previewTemplateChange(
  event: Pick<EpmEvent, 'eventDate' | 'template'>,
  currentTasks: Pick<EventTask, 'title' | 'templateTaskId'>[],
  newTemplateId: string | null,
  templateTasks: TemplateTask[],
  today: DateOnly = todayDateOnly(),
): TemplateChangePreview {
  const keptCount = currentTasks.length;
  const mode = modeFor(event.template?.id, newTemplateId);
  if (mode === 'clear') return { ok: true, mode, toAdd: [], skipped: [], keptCount, pastDueCount: 0 };
  if (!event.eventDate) return { ok: false, error: 'Set the event date before adding template tasks.' };

  const linked = new Set(currentTasks.map((t) => t.templateTaskId).filter((id): id is string => !!id));
  const titles = new Set(currentTasks.map((t) => normalizeTitle(t.title)));
  const toAdd: PlannedTask[] = [];
  const skipped: SkippedTask[] = [];
  for (const p of planTasks(event.eventDate, templateTasks)) {
    if (linked.has(p.templateTaskId)) { skipped.push({ title: p.title, reason: 'Already in the checklist (same template task)' }); continue; }
    const key = normalizeTitle(p.title);
    if (titles.has(key)) { skipped.push({ title: p.title, reason: 'A task with the same title already exists' }); continue; }
    titles.add(key); // the template itself may repeat a title — add it once
    toAdd.push({ ...p, phase: phaseFor(p.daysBefore), isPastDue: p.dueDate < today });
  }
  return { ok: true, mode, toAdd, skipped, keptCount, pastDueCount: toAdd.filter((t) => t.isPastDue).length };
}

export interface ApplyTemplateChangeInput {
  event: Pick<EpmEvent, 'id' | 'template'>;
  /** New template, or null to remove it. */
  newTemplate: Ref | null;
  toAdd: PlannedTask[];
  /** systemuserid that owns the new tasks (current user, like cloning). */
  assigneeId: string;
  skipPastDue: boolean;
}

export async function applyTemplateChange(input: ApplyTemplateChangeInput, onProgress?: (p: CloneProgress) => void): Promise<{ added: number }> {
  const { event, newTemplate } = input;
  const mode = modeFor(event.template?.id, newTemplate?.id ?? null);
  const tasks = mode === 'clear' ? [] : input.skipPastDue ? input.toAdd.filter((t) => !t.isPastDue) : input.toAdd;
  const oldName = event.template?.name;
  const summary = mode === 'change' && oldName
    ? `Added when the template changed from "${oldName}" to "${newTemplate?.name ?? ''}"`
    : `Added from template "${newTemplate?.name ?? ''}"`;

  const created: string[] = [];
  /** Delete every task created in this run; their history rows go with them (parental cascade). */
  const removeCreated = async () => {
    const failed: string[] = [];
    await Promise.all(created.splice(0).map((id) => eventTasksService.remove(id).catch(() => { failed.push(id); })));
    if (failed.length) throw new DataverseError('Change template', `${failed.length} of the tasks added in this run couldn't be removed.`);
  };

  onProgress?.({ done: 0, total: tasks.length });
  try {
    await runSequence([
      {
        label: 'Add tasks',
        run: async () => {
          let done = 0;
          try {
            await pool(tasks, async (t) => {
              const taskId = await eventTasksService.create({
                eventId: event.id, title: t.title, dueDate: t.dueDate, status: TaskStatus.Pending,
                assigneeId: input.assigneeId, templateTaskId: t.templateTaskId,
              });
              created.push(taskId);
              await taskHistoryService.add({
                eventTaskId: taskId, action: HistoryAction.Created, summary, fieldName: 'Status', newValue: 'Pending',
              });
              onProgress?.({ done: ++done, total: tasks.length });
            });
          } catch (error) {
            // runSequence only undoes completed steps, so a partly finished step cleans up here.
            const count = created.length;
            let rollback = count ? `The ${count} task${count === 1 ? '' : 's'} added before the error ${count === 1 ? 'was' : 'were'} removed.` : '';
            try { await removeCreated(); } catch (e) { rollback = e instanceof Error ? e.message : String(e); }
            const base = error instanceof Error ? error.message : String(error);
            throw new DataverseError('Change template', `${base} ${rollback}`.trim(), error instanceof DataverseError ? error.status : null, { cause: error });
          }
        },
        undo: removeCreated,
      },
      // Same template ("add missing tasks"): the lookup already points at it.
      ...(mode === 'addMissing' ? [] : [{
        label: 'Update event template',
        run: () => eventsService.update(event.id, { templateId: newTemplate?.id ?? null }),
      }]),
    ]);
  } catch (error) {
    if (error instanceof DataverseError && error.operation === 'Change template') throw error; // already explains the rollback
    const base = error instanceof Error ? error.message : String(error);
    const incomplete = base.includes('rollback incomplete');
    const note = tasks.length && !incomplete ? ` The ${tasks.length} task${tasks.length === 1 ? '' : 's'} added in this run ${tasks.length === 1 ? 'was' : 'were'} removed.` : '';
    throw new DataverseError('Change template', `${base}${note}`, error instanceof DataverseError ? error.status : null, { cause: error });
  }
  return { added: tasks.length };
}
