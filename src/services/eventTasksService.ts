import { New_epm_eventtasksService } from '@/generated/services/New_epm_eventtasksService';
import type { New_epm_eventtasksBase } from '@/generated/models/New_epm_eventtasksModel';
import { deleteRecord, unwrap, unwrapList } from '@/api/dataverseClient';
import { and, anyGuid, asRow, bindRef, dateOnly, eqGuid, formatted, num, str, type Row } from '@/api/odata';
import { ACTIVE_STATE, COLUMNS, ENTITY_SETS, TaskStatus } from '@/types/schema';
import type { DateOnly, EventTask } from '@/types/entities';

const C = COLUMNS.eventTask;
const SELECT = [C.id, C.title, C.description, C.dueDate, C.status, C.completedOn, C.eventId, C.ownerId, C.templateTaskId,
  COLUMNS.common.createdOn];

function toStatus(value: number | null): TaskStatus {
  const all = Object.values(TaskStatus) as number[];
  return (value !== null && all.includes(value) ? value : TaskStatus.Pending) as TaskStatus;
}

export function toEventTask(r: Row): EventTask {
  return {
    id: str(r, C.id),
    eventId: str(r, C.eventId),
    eventName: formatted(r, C.eventId),
    title: str(r, C.title),
    description: str(r, C.description),
    dueDate: dateOnly(r, C.dueDate) ?? '',
    status: toStatus(num(r, C.status)),
    completedOn: dateOnly(r, C.completedOn),
    assignee: { id: str(r, C.ownerId), name: formatted(r, C.ownerId) },
    createdOn: str(r, COLUMNS.common.createdOn) || null,
    templateTaskId: str(r, C.templateTaskId) || null,
  };
}

export interface EventTaskInput {
  eventId: string;
  title: string;
  dueDate: DateOnly;
  description?: string;
  status?: TaskStatus;
  completedOn?: DateOnly | null;
  /** systemuserid of the assignee (record owner). */
  assigneeId?: string;
  /** Template task this task is cloned from. */
  templateTaskId?: string | null;
}

/** null clears a column in Dataverse; the generated type doesn't allow it, so widen it here. */
type EventTaskRecord = Omit<New_epm_eventtasksBase, 'new_epm_eventtaskid' | 'new_completedon'> & {
  new_completedon?: string | null;
  'ownerid@odata.bind'?: string;
};
/** What the generated service declares; `null` is still sent to Dataverse as-is at runtime. */
type SdkRecord = Omit<New_epm_eventtasksBase, 'new_epm_eventtaskid'>;

function toRecord(input: Partial<EventTaskInput>): Partial<EventTaskRecord> {
  const rec: Partial<EventTaskRecord> = {};
  if (input.title !== undefined) rec.new_title = input.title.trim();
  if (input.dueDate !== undefined) rec.new_duedate = input.dueDate;
  if (input.description !== undefined) rec.new_description = input.description;
  if (input.status !== undefined) rec.new_status = input.status;
  if (input.completedOn !== undefined) rec.new_completedon = input.completedOn;
  if (input.eventId) rec['new_EventId@odata.bind'] = bindRef(ENTITY_SETS.event, input.eventId);
  if (input.assigneeId) rec['ownerid@odata.bind'] = bindRef(ENTITY_SETS.systemUser, input.assigneeId);
  if (input.templateTaskId) rec['new_TemplateTaskId@odata.bind'] = bindRef(ENTITY_SETS.templateTask, input.templateTaskId);
  return rec;
}

export interface TaskListFilter {
  eventId?: string;
  eventIds?: string[];
  assigneeId?: string;
}

export const eventTasksService = {
  async list(filter: TaskListFilter = {}): Promise<EventTask[]> {
    const rows = await unwrapList('List tasks', New_epm_eventtasksService.getAll({
      select: SELECT,
      filter: and(
        `${COLUMNS.common.stateCode} eq ${ACTIVE_STATE}`,
        filter.eventId && eqGuid(C.eventId, filter.eventId),
        filter.eventIds?.length ? anyGuid(C.eventId, filter.eventIds) : undefined,
        filter.assigneeId && eqGuid(C.ownerId, filter.assigneeId),
      ),
      orderBy: [`${C.dueDate} asc`],
    }));
    return rows.map((r) => toEventTask(asRow(r)));
  },

  async get(id: string): Promise<EventTask> {
    const row = await unwrap('Get task', New_epm_eventtasksService.get(id, { select: SELECT }));
    return toEventTask(asRow(row));
  },

  async create(input: EventTaskInput): Promise<string> {
    const record: EventTaskRecord = {
      ...toRecord(input),
      new_title: input.title.trim(),
      new_duedate: input.dueDate,
      new_status: input.status ?? TaskStatus.Pending,
      'new_EventId@odata.bind': bindRef(ENTITY_SETS.event, input.eventId),
      statecode: ACTIVE_STATE,
    };
    const created = await unwrap('Create task', New_epm_eventtasksService.create(record as SdkRecord));
    return str(asRow(created), C.id);
  },

  /**
   * Low-level update. Prefer the history-aware operations (status change, reassign …)
   * that pair this with a Task History row.
   */
  async update(id: string, patch: Partial<EventTaskInput>): Promise<void> {
    await unwrap('Update task', New_epm_eventtasksService.update(id, toRecord(patch) as Partial<SdkRecord>));
  },

  async remove(id: string): Promise<void> {
    await deleteRecord('Delete task', ENTITY_SETS.eventTask, id);
  },
};
