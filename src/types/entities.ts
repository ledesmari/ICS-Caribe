/**
 * Domain models (camelCase) used by hooks and UI. Services map Dataverse rows ⇄ these.
 * Date-only values are "yyyy-MM-dd" strings; date+time values are ISO strings in UTC.
 */
import type {
  AttendeeResponse, EventStatus, ExpenseCategory, ExpenseStatus, HistoryAction, MeetingStatus, TaskStatus, TemplateColor,
} from './schema';

export type { AttendeeResponse, EventStatus, ExpenseCategory, ExpenseStatus, HistoryAction, MeetingStatus, TaskStatus, TemplateColor };

/** "yyyy-MM-dd" */
export type DateOnly = string;
/** ISO 8601 timestamp in UTC */
export type IsoDateTime = string;

export interface Ref {
  id: string;
  name: string;
}

export interface EventTemplate {
  id: string;
  name: string;
  /** Chosen Calendar color; null = automatic (see utils/templateColors.ts). */
  color: TemplateColor | null;
}

export interface TemplateTask {
  id: string;
  templateId: string;
  title: string;
  daysBefore: number;
}

export interface EpmEvent {
  id: string;
  name: string;
  /** Start date (first day). Task due dates count back from it. */
  eventDate: DateOnly;
  /** Last day; equals eventDate for one-day events. */
  endDate: DateOnly;
  location: string;
  status: EventStatus;
  template: Ref | null;
  /** Amount in the row currency. */
  budget: number | null;
  /** Amount converted to base currency (for totals). */
  budgetBase: number | null;
  currency: Ref | null;
  ownerId: string;
}

export interface EventTask {
  id: string;
  eventId: string;
  eventName: string;
  title: string;
  description: string;
  dueDate: DateOnly;
  status: TaskStatus;
  completedOn: DateOnly | null;
  assignee: Ref;
  createdOn: IsoDateTime | null;
  /** Template task it was cloned from; null for tasks added by hand or created before the link existed. */
  templateTaskId: string | null;
}

export interface Expense {
  id: string;
  eventId: string;
  eventTaskId: string | null;
  name: string;
  category: ExpenseCategory;
  estimatedAmount: number | null;
  estimatedAmountBase: number | null;
  actualAmount: number | null;
  actualAmountBase: number | null;
  status: ExpenseStatus;
  vendor: string;
  paymentDate: DateOnly | null;
  currencyName: string;
}

export interface Meeting {
  id: string;
  eventId: string | null;
  subject: string;
  start: IsoDateTime;
  end: IsoDateTime;
  isOnline: boolean;
  location: string;
  agenda: string;
  outlookEventId: string;
  joinUrl: string;
  status: MeetingStatus;
}

export interface MeetingAttendee {
  id: string;
  meetingId: string;
  userId: string | null;
  name: string;
  email: string;
  response: AttendeeResponse;
}

export interface TaskComment {
  id: string;
  eventTaskId: string;
  body: string;
  author: Ref;
  createdOn: IsoDateTime;
}

export interface TaskHistoryEntry {
  id: string;
  eventTaskId: string;
  action: HistoryAction;
  summary: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  actor: Ref;
  createdOn: IsoDateTime;
}

/** Input for an insert-only history row. */
export interface NewHistoryEntry {
  eventTaskId: string;
  action: HistoryAction;
  summary: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  author: Ref;
  createdOn: IsoDateTime;
}

export interface AttachmentContent {
  fileName: string;
  mimeType: string;
  /** base64 */
  documentBody: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  isManager: boolean;
}
