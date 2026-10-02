import { New_epm_expensesService } from '@/generated/services/New_epm_expensesService';
import type { New_epm_expensesBase } from '@/generated/models/New_epm_expensesModel';
import { deleteRecord, unwrap, unwrapList } from '@/api/dataverseClient';
import { and, anyGuid, asRow, bindRef, dateOnly, eqGuid, formatted, num, str, strOrNull, type Row } from '@/api/odata';
import { ACTIVE_STATE, COLUMNS, ENTITY_SETS, ExpenseCategory, ExpenseStatus } from '@/types/schema';
import type { DateOnly, Expense } from '@/types/entities';

const C = COLUMNS.expense;
const SELECT = [C.id, C.name, C.category, C.estimated, C.estimatedBase, C.actual, C.actualBase, C.status, C.vendor,
  C.paymentDate, C.eventId, C.eventTaskId, C.currencyId];

function pick<T extends number>(value: number | null, all: Record<string, T>, fallback: T): T {
  return value !== null && (Object.values(all) as number[]).includes(value) ? (value as T) : fallback;
}

export function toExpense(r: Row): Expense {
  return {
    id: str(r, C.id),
    eventId: str(r, C.eventId),
    eventTaskId: strOrNull(r, C.eventTaskId),
    name: str(r, C.name),
    category: pick(num(r, C.category), ExpenseCategory, ExpenseCategory.Other),
    estimatedAmount: num(r, C.estimated),
    estimatedAmountBase: num(r, C.estimatedBase),
    actualAmount: num(r, C.actual),
    actualAmountBase: num(r, C.actualBase),
    status: pick(num(r, C.status), ExpenseStatus, ExpenseStatus.Estimated),
    vendor: str(r, C.vendor),
    paymentDate: dateOnly(r, C.paymentDate),
    currencyName: formatted(r, C.currencyId),
  };
}

export interface ExpenseInput {
  eventId: string;
  name: string;
  category: ExpenseCategory;
  status: ExpenseStatus;
  eventTaskId?: string | null;
  estimatedAmount?: number | null;
  actualAmount?: number | null;
  vendor?: string;
  paymentDate?: DateOnly | null;
}

type Nullable<T, K extends keyof T> = Omit<T, K> & { [P in K]?: T[P] | null };
/** `undefined` = leave unchanged, `null` = clear the column / remove the lookup link. */
type ExpenseRecord = Nullable<Omit<New_epm_expensesBase, 'new_epm_expenseid'>,
  'new_estimatedamount' | 'new_actualamount' | 'new_paymentdate' | 'new_EventTaskId@odata.bind'>;
/** What the generated service declares; `null` is still sent to Dataverse as-is at runtime. */
type SdkRecord = Omit<New_epm_expensesBase, 'new_epm_expenseid'>;

function toRecord(input: Partial<ExpenseInput>): Partial<ExpenseRecord> {
  const rec: Partial<ExpenseRecord> = {};
  if (input.name !== undefined) rec.new_expensename = input.name.trim();
  if (input.category !== undefined) rec.new_category = input.category;
  if (input.status !== undefined) rec.new_expensestatus = input.status;
  if (input.estimatedAmount !== undefined) rec.new_estimatedamount = input.estimatedAmount;
  if (input.actualAmount !== undefined) rec.new_actualamount = input.actualAmount;
  if (input.vendor !== undefined) rec.new_vendor = input.vendor.trim();
  if (input.paymentDate !== undefined) rec.new_paymentdate = input.paymentDate || null;
  if (input.eventId) rec['new_EventId@odata.bind'] = bindRef(ENTITY_SETS.event, input.eventId);
  if (input.eventTaskId !== undefined) {
    rec['new_EventTaskId@odata.bind'] = input.eventTaskId ? bindRef(ENTITY_SETS.eventTask, input.eventTaskId) : null;
  }
  return rec;
}

export const expensesService = {
  /** Active expenses, optionally limited to some events. */
  async list(eventIds?: string[]): Promise<Expense[]> {
    const rows = await unwrapList('List expenses', New_epm_expensesService.getAll({
      select: SELECT,
      filter: and(`${COLUMNS.common.stateCode} eq ${ACTIVE_STATE}`, eventIds?.length ? anyGuid(C.eventId, eventIds) : undefined),
    }));
    return rows.map((r) => toExpense(asRow(r)));
  },

  async listByTask(eventTaskId: string): Promise<Expense[]> {
    const rows = await unwrapList('List task expenses', New_epm_expensesService.getAll({
      select: SELECT, filter: and(`${COLUMNS.common.stateCode} eq ${ACTIVE_STATE}`, eqGuid(C.eventTaskId, eventTaskId)),
    }));
    return rows.map((r) => toExpense(asRow(r)));
  },

  async create(input: ExpenseInput): Promise<string> {
    const record: ExpenseRecord = {
      ...toRecord(input),
      new_expensename: input.name.trim(),
      new_category: input.category,
      new_expensestatus: input.status,
      'new_EventId@odata.bind': bindRef(ENTITY_SETS.event, input.eventId),
      statecode: ACTIVE_STATE,
    };
    const created = await unwrap('Create expense', New_epm_expensesService.create(record as SdkRecord));
    return str(asRow(created), C.id);
  },

  async update(id: string, patch: Partial<ExpenseInput>): Promise<void> {
    await unwrap('Update expense', New_epm_expensesService.update(id, toRecord(patch) as Partial<SdkRecord>));
  },

  async remove(id: string): Promise<void> {
    await deleteRecord('Delete expense', ENTITY_SETS.expense, id);
  },
};
