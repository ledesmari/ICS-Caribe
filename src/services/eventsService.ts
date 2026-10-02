import { New_epm_eventsService } from '@/generated/services/New_epm_eventsService';
import type { New_epm_eventsBase } from '@/generated/models/New_epm_eventsModel';
import { deleteRecord, unwrap, unwrapList } from '@/api/dataverseClient';
import { asRow, bindRef, dateOnly, eqGuid, lookup, num, str, type Row } from '@/api/odata';
import { ACTIVE_STATE, COLUMNS, ENTITY_SETS, EventStatus } from '@/types/schema';
import type { DateOnly, EpmEvent } from '@/types/entities';

const C = COLUMNS.event;
const SELECT = [C.id, C.name, C.eventDate, C.endDate, C.location, C.status, C.budget, C.budgetBase, C.templateId, C.currencyId,
  COLUMNS.common.ownerId];

function toStatus(value: number | null): EventStatus {
  const all = Object.values(EventStatus) as number[];
  return (value !== null && all.includes(value) ? value : EventStatus.Planning) as EventStatus;
}

export function toEvent(r: Row): EpmEvent {
  return {
    id: str(r, C.id),
    name: str(r, C.name),
    eventDate: dateOnly(r, C.eventDate) ?? '',
    endDate: dateOnly(r, C.endDate) ?? dateOnly(r, C.eventDate) ?? '',
    location: str(r, C.location),
    status: toStatus(num(r, C.status)),
    template: lookup(r, C.templateId),
    budget: num(r, C.budget),
    budgetBase: num(r, C.budgetBase),
    currency: lookup(r, C.currencyId),
    ownerId: str(r, COLUMNS.common.ownerId),
  };
}

export interface EventInput {
  name: string;
  eventDate: DateOnly;
  endDate?: DateOnly;
  location?: string;
  status?: EventStatus;
  templateId?: string | null;
  budget?: number | null;
  currencyId?: string | null;
}

type EventRecord = Omit<New_epm_eventsBase, 'new_epm_eventid'>;

function toRecord(input: Partial<EventInput>): Partial<EventRecord> {
  const rec: Partial<EventRecord> = {};
  if (input.name !== undefined) rec.new_name = input.name.trim();
  if (input.eventDate !== undefined) rec.new_eventdate = input.eventDate;
  if (input.endDate !== undefined) rec.new_enddate = input.endDate;
  if (input.location !== undefined) rec.new_location = input.location.trim();
  if (input.status !== undefined) rec.new_status = input.status;
  // null clears the budget on update (the generated type omits null, but Dataverse accepts it).
  if (input.budget !== undefined) rec.new_budget = input.budget as number;
  if (input.templateId) rec['new_TemplateId@odata.bind'] = bindRef(ENTITY_SETS.eventTemplate, input.templateId);
  if (input.currencyId) rec['transactioncurrencyid@odata.bind'] = bindRef(ENTITY_SETS.transactionCurrency, input.currencyId);
  return rec;
}

export const eventsService = {
  async list(): Promise<EpmEvent[]> {
    const rows = await unwrapList('List events', New_epm_eventsService.getAll({
      select: SELECT, filter: `${COLUMNS.common.stateCode} eq ${ACTIVE_STATE}`, orderBy: [`${C.eventDate} asc`],
    }));
    return rows.map((r) => toEvent(asRow(r)));
  },

  async get(id: string): Promise<EpmEvent> {
    const row = await unwrap('Get event', New_epm_eventsService.get(id, { select: SELECT }));
    return toEvent(asRow(row));
  },

  async create(input: EventInput): Promise<string> {
    const record: EventRecord = {
      ...toRecord(input),
      new_name: input.name.trim(),
      new_eventdate: input.eventDate,
      new_enddate: input.endDate ?? input.eventDate,
      new_status: input.status ?? EventStatus.Planning,
      statecode: ACTIVE_STATE,
    };
    const created = await unwrap('Create event', New_epm_eventsService.create(record));
    return str(asRow(created), C.id);
  },

  /** `templateId: null` clears the template link (only on update — create treats null as "no template"). */
  async update(id: string, patch: Partial<EventInput>): Promise<void> {
    const record = toRecord(patch);
    // Web API clears a lookup with a null bind; the generated type omits null.
    if (patch.templateId === null) record['new_TemplateId@odata.bind'] = null as unknown as string;
    await unwrap('Update event', New_epm_eventsService.update(id, record));
  },

  async remove(id: string): Promise<void> {
    await deleteRecord('Delete event', ENTITY_SETS.event, id);
  },

  /** Events using a template (for template admin). */
  async listByTemplate(templateId: string): Promise<EpmEvent[]> {
    const rows = await unwrapList('List events by template', New_epm_eventsService.getAll({
      select: SELECT, filter: eqGuid(C.templateId, templateId),
    }));
    return rows.map((r) => toEvent(asRow(r)));
  },
};
