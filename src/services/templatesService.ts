import { New_epm_eventtemplatesService } from '@/generated/services/New_epm_eventtemplatesService';
import { New_epm_templatetasksService } from '@/generated/services/New_epm_templatetasksService';
import { deleteRecord, unwrap, unwrapList } from '@/api/dataverseClient';
import { and, asRow, bindRef, eqGuid, num, str, type Row } from '@/api/odata';
import { ACTIVE_STATE, COLUMNS, ENTITY_SETS, TemplateColor } from '@/types/schema';
import type { EventTemplate, TemplateTask } from '@/types/entities';

const T = COLUMNS.eventTemplate;
const TT = COLUMNS.templateTask;
const ACTIVE = `${COLUMNS.common.stateCode} eq ${ACTIVE_STATE}`;

const TEMPLATE_SELECT = [T.id, T.name, T.color];

function toColor(value: number | null): TemplateColor | null {
  return value !== null && (Object.values(TemplateColor) as number[]).includes(value) ? (value as TemplateColor) : null;
}

export function toTemplate(r: Row): EventTemplate {
  return { id: str(r, T.id), name: str(r, T.name), color: toColor(num(r, T.color)) };
}

export function toTemplateTask(r: Row): TemplateTask {
  return { id: str(r, TT.id), templateId: str(r, TT.templateId), title: str(r, TT.title), daysBefore: num(r, TT.daysBefore) ?? 0 };
}

export const eventTemplatesService = {
  async list(): Promise<EventTemplate[]> {
    const rows = await unwrapList('List templates', New_epm_eventtemplatesService.getAll({
      select: TEMPLATE_SELECT, filter: ACTIVE, orderBy: [`${T.name} asc`],
    }));
    return rows.map((r) => toTemplate(asRow(r)));
  },

  async get(id: string): Promise<EventTemplate> {
    return toTemplate(asRow(await unwrap('Get template', New_epm_eventtemplatesService.get(id, { select: TEMPLATE_SELECT }))));
  },

  async create(name: string): Promise<string> {
    const created = await unwrap('Create template', New_epm_eventtemplatesService.create({ new_name: name.trim(), statecode: ACTIVE_STATE }));
    return str(asRow(created), T.id);
  },

  async rename(id: string, name: string): Promise<void> {
    await unwrap('Rename template', New_epm_eventtemplatesService.update(id, { new_name: name.trim() }));
  },

  /** null clears the color (the template falls back to its automatic color). */
  async setColor(id: string, color: TemplateColor | null): Promise<void> {
    // The generated type omits null, but Dataverse accepts it to clear a choice.
    await unwrap('Set template color', New_epm_eventtemplatesService.update(id, { new_color: color as TemplateColor }));
  },

  async remove(id: string): Promise<void> {
    await deleteRecord('Delete template', ENTITY_SETS.eventTemplate, id);
  },
};

export interface TemplateTaskSummary {
  taskCount: number;
  maxDaysBefore: number;
}

export interface TemplateTaskInput {
  templateId: string;
  title: string;
  daysBefore: number;
}

export const templateTasksService = {
  /** Tasks of a template, earliest (most days before) first. */
  async listByTemplate(templateId: string): Promise<TemplateTask[]> {
    const rows = await unwrapList('List template tasks', New_epm_templatetasksService.getAll({
      select: [TT.id, TT.title, TT.daysBefore, TT.templateId],
      filter: and(ACTIVE, eqGuid(TT.templateId, templateId)),
      orderBy: [`${TT.daysBefore} desc`],
    }));
    return rows.map((r) => toTemplateTask(asRow(r)));
  },

  async create(input: TemplateTaskInput): Promise<string> {
    if (!Number.isInteger(input.daysBefore) || input.daysBefore < 0 || input.daysBefore > 365) {
      throw new Error('Days before must be a whole number between 0 and 365.');
    }
    const created = await unwrap('Create template task', New_epm_templatetasksService.create({
      new_title: input.title.trim(),
      new_daysbefore: input.daysBefore,
      'new_TemplateId@odata.bind': bindRef(ENTITY_SETS.eventTemplate, input.templateId),
      statecode: ACTIVE_STATE,
    }));
    return str(asRow(created), TT.id);
  },

  async update(id: string, patch: Partial<Omit<TemplateTaskInput, 'templateId'>>): Promise<void> {
    if (patch.daysBefore !== undefined) validateDays(patch.daysBefore);
    await unwrap('Update template task', New_epm_templatetasksService.update(id, {
      ...(patch.title !== undefined ? { new_title: patch.title.trim() } : {}),
      ...(patch.daysBefore !== undefined ? { new_daysbefore: patch.daysBefore } : {}),
    }));
  },

  async remove(id: string): Promise<void> {
    await deleteRecord('Delete template task', ENTITY_SETS.templateTask, id);
  },

  /** Per template: number of tasks and the largest "days before" (templates list, Calendar prep windows). */
  async summaryByTemplate(): Promise<Map<string, TemplateTaskSummary>> {
    const rows = await unwrapList('Summarize template tasks', New_epm_templatetasksService.getAll({
      select: [TT.id, TT.templateId, TT.daysBefore], filter: ACTIVE,
    }));
    const summary = new Map<string, TemplateTaskSummary>();
    for (const r of rows) {
      const row = asRow(r);
      const id = str(row, TT.templateId);
      if (!id) continue;
      const prev = summary.get(id) ?? { taskCount: 0, maxDaysBefore: 0 };
      summary.set(id, { taskCount: prev.taskCount + 1, maxDaysBefore: Math.max(prev.maxDaysBefore, num(row, TT.daysBefore) ?? 0) });
    }
    return summary;
  },
};

function validateDays(days: number) {
  if (!Number.isInteger(days) || days < 0 || days > 365) throw new Error('Days before must be a whole number between 0 and 365.');
}
