/** Task History (insert-only) and Task Comments. */
import { New_epm_taskcommentsService } from '@/generated/services/New_epm_taskcommentsService';
import { New_epm_taskhistoriesService } from '@/generated/services/New_epm_taskhistoriesService';
import { deleteRecord, unwrap, unwrapList } from '@/api/dataverseClient';
import { and, anyGuid, asRow, bindRef, chunk, eqGuid, formatted, num, str, type Row } from '@/api/odata';
import { ACTIVE_STATE, COLUMNS, ENTITY_SETS, HistoryAction } from '@/types/schema';
import type { NewHistoryEntry, TaskComment, TaskHistoryEntry } from '@/types/entities';

const H = COLUMNS.taskHistory;
const TC = COLUMNS.taskComment;
const { createdBy, createdOn, stateCode } = COLUMNS.common;
const ACTIVE = `${stateCode} eq ${ACTIVE_STATE}`;

/* ---------- history ---------- */

function toAction(value: number | null): HistoryAction {
  const all = Object.values(HistoryAction) as number[];
  return (value !== null && all.includes(value) ? value : HistoryAction.Updated) as HistoryAction;
}

export function toHistory(r: Row): TaskHistoryEntry {
  return {
    id: str(r, H.id),
    eventTaskId: str(r, H.eventTaskId),
    action: toAction(num(r, H.action)),
    summary: str(r, H.summary),
    fieldName: str(r, H.fieldName),
    oldValue: str(r, H.oldValue),
    newValue: str(r, H.newValue),
    actor: { id: str(r, createdBy), name: formatted(r, createdBy) },
    createdOn: str(r, createdOn),
  };
}

const clip = (value: string | undefined, max: number) => (value ?? '').slice(0, max);

export const taskHistoryService = {
  async listByTask(eventTaskId: string): Promise<TaskHistoryEntry[]> {
    const rows = await unwrapList('List history', New_epm_taskhistoriesService.getAll({
      select: [H.id, H.eventTaskId, H.action, H.summary, H.fieldName, H.oldValue, H.newValue, createdBy, createdOn],
      filter: and(ACTIVE, eqGuid(H.eventTaskId, eventTaskId)),
      orderBy: [`${createdOn} desc`],
    }));
    return rows.map((r) => toHistory(asRow(r)));
  },

  /** History for many tasks (event Activity tab), newest first; fetched in id chunks. */
  async listByTasks(eventTaskIds: string[]): Promise<TaskHistoryEntry[]> {
    if (eventTaskIds.length === 0) return [];
    const pages = await Promise.all(chunk(eventTaskIds).map((ids) => unwrapList('List activity', New_epm_taskhistoriesService.getAll({
      select: [H.id, H.eventTaskId, H.action, H.summary, H.fieldName, H.oldValue, H.newValue, createdBy, createdOn],
      filter: and(ACTIVE, anyGuid(H.eventTaskId, ids)),
      orderBy: [`${createdOn} desc`],
    }))));
    return pages.flat().map((r) => toHistory(asRow(r))).sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  },

  /** Insert-only: history rows are never updated or deleted by the app. */
  async add(entry: NewHistoryEntry): Promise<string> {
    const created = await unwrap('Add history', New_epm_taskhistoriesService.create({
      new_action: entry.action,
      new_summary: clip(entry.summary, 850),
      new_fieldname: entry.fieldName ? clip(entry.fieldName, 100) : undefined,
      new_oldvalue: entry.oldValue ? clip(entry.oldValue, 100) : undefined,
      new_newvalue: entry.newValue ? clip(entry.newValue, 100) : undefined,
      'new_EventTaskId@odata.bind': bindRef(ENTITY_SETS.eventTask, entry.eventTaskId),
      statecode: ACTIVE_STATE,
    }));
    return str(asRow(created), H.id);
  },

  /**
   * Compensation only (used by runSequence when a paired write fails) — not a user action.
   */
  async revert(id: string): Promise<void> {
    await deleteRecord('Delete history entry', ENTITY_SETS.taskHistory, id);
  },
};

/* ---------- comments ---------- */

export function toComment(r: Row): TaskComment {
  return {
    id: str(r, TC.id),
    eventTaskId: str(r, TC.eventTaskId),
    body: str(r, TC.body) || str(r, TC.name),
    author: { id: str(r, createdBy), name: formatted(r, createdBy) },
    createdOn: str(r, createdOn),
  };
}

export const taskCommentsService = {
  async listByTask(eventTaskId: string): Promise<TaskComment[]> {
    return taskCommentsService.listByTasks([eventTaskId]);
  },

  /** Comments for several tasks (for counts on checklist rows). */
  async listByTasks(eventTaskIds: string[]): Promise<TaskComment[]> {
    if (eventTaskIds.length === 0) return [];
    const pages = await Promise.all(chunk(eventTaskIds).map((ids) => unwrapList('List comments', New_epm_taskcommentsService.getAll({
      select: [TC.id, TC.eventTaskId, TC.body, TC.name, createdBy, createdOn],
      filter: and(ACTIVE, anyGuid(TC.eventTaskId, ids)),
      orderBy: [`${createdOn} asc`],
    }))));
    return pages.flat().map((r) => toComment(asRow(r))).sort((a, b) => a.createdOn.localeCompare(b.createdOn));
  },

  async add(eventTaskId: string, body: string): Promise<string> {
    const text = body.trim();
    if (!text) throw new Error('Comment cannot be empty.');
    if (text.length > 4000) throw new Error('Comment is longer than 4000 characters.');
    const created = await unwrap('Add comment', New_epm_taskcommentsService.create({
      new_comment: text,
      new_commenttext: text.slice(0, 100),
      'new_EventTask@odata.bind': bindRef(ENTITY_SETS.eventTask, eventTaskId),
      statecode: ACTIVE_STATE,
    }));
    return str(asRow(created), TC.id);
  },

  async remove(id: string): Promise<void> {
    await deleteRecord('Delete comment', ENTITY_SETS.taskComment, id);
  },
};
