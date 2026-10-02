/**
 * SINGLE source of Dataverse physical names (publisher prefix `new_`).
 * UI code must never reference these strings directly — only services/ and entities.ts.
 * Entity sets are owned by the generated services in src/generated; here we keep
 * columns, navigation (bind) properties and choice values.
 */

export const ENTITY_SETS = {
  eventTemplate: 'new_epm_eventtemplates',
  templateTask: 'new_epm_templatetasks',
  event: 'new_epm_events',
  eventTask: 'new_epm_eventtasks',
  expense: 'new_epm_expenses',
  meeting: 'new_epm_meetings',
  meetingAttendee: 'new_epm_meetingattendees',
  taskComment: 'new_epm_taskcomments',
  taskHistory: 'new_epm_taskhistories',
  annotation: 'annotations',
  systemUser: 'systemusers',
  transactionCurrency: 'transactioncurrencies',
} as const;

export const COLUMNS = {
  eventTemplate: { id: 'new_epm_eventtemplateid', name: 'new_name', color: 'new_color' },
  templateTask: {
    id: 'new_epm_templatetaskid', title: 'new_title', daysBefore: 'new_daysbefore',
    templateId: '_new_templateid_value', templateBind: 'new_TemplateId@odata.bind',
  },
  event: {
    id: 'new_epm_eventid', name: 'new_name', eventDate: 'new_eventdate', endDate: 'new_enddate', location: 'new_location',
    status: 'new_status', budget: 'new_budget', budgetBase: 'new_budget_base',
    templateId: '_new_templateid_value', templateBind: 'new_TemplateId@odata.bind',
    currencyId: '_transactioncurrencyid_value', currencyBind: 'transactioncurrencyid@odata.bind',
  },
  eventTask: {
    id: 'new_epm_eventtaskid', title: 'new_title', description: 'new_description', dueDate: 'new_duedate',
    status: 'new_status', completedOn: 'new_completedon',
    eventId: '_new_eventid_value', eventBind: 'new_EventId@odata.bind',
    ownerId: '_ownerid_value', ownerBind: 'ownerid@odata.bind',
    /** Template task it was created from (optional; RemoveLink when the template task is deleted). */
    templateTaskId: '_new_templatetaskid_value', templateTaskBind: 'new_TemplateTaskId@odata.bind',
  },
  expense: {
    id: 'new_epm_expenseid', name: 'new_expensename', category: 'new_category',
    estimated: 'new_estimatedamount', estimatedBase: 'new_estimatedamount_base',
    actual: 'new_actualamount', actualBase: 'new_actualamount_base',
    status: 'new_expensestatus', vendor: 'new_vendor', paymentDate: 'new_paymentdate',
    eventId: '_new_eventid_value', eventBind: 'new_EventId@odata.bind',
    eventTaskId: '_new_eventtaskid_value', eventTaskBind: 'new_EventTaskId@odata.bind',
    currencyId: '_transactioncurrencyid_value',
  },
  meeting: {
    id: 'new_epm_meetingid', subject: 'new_meetingname', start: 'new_start', end: 'new_end',
    isOnline: 'new_isonline', location: 'new_location', agenda: 'new_agenda',
    outlookEventId: 'new_outlookeventid', joinUrl: 'new_joinurl', status: 'new_meetingstatus',
    eventId: '_new_eventid_value', eventBind: 'new_EventId@odata.bind',
    tasksNav: 'new_epm_meeting_eventtask_tasks',
  },
  meetingAttendee: {
    id: 'new_epm_meetingattendeeid', name: 'new_attendeename', email: 'new_email', response: 'new_response',
    meetingId: '_new_meetingid_value', meetingBind: 'new_MeetingId@odata.bind',
    userId: '_new_userid_value', userBind: 'new_UserId@odata.bind',
  },
  taskComment: {
    id: 'new_epm_taskcommentid', name: 'new_commenttext', body: 'new_comment',
    eventTaskId: '_new_eventtask_value', eventTaskBind: 'new_EventTask@odata.bind',
  },
  taskHistory: {
    id: 'new_epm_taskhistoryid', summary: 'new_summary', action: 'new_action', fieldName: 'new_fieldname',
    oldValue: 'new_oldvalue', newValue: 'new_newvalue',
    eventTaskId: '_new_eventtaskid_value', eventTaskBind: 'new_EventTaskId@odata.bind',
  },
  annotation: {
    id: 'annotationid', subject: 'subject', fileName: 'filename', fileSize: 'filesize', mimeType: 'mimetype',
    documentBody: 'documentbody', isDocument: 'isdocument', objectId: '_objectid_value',
    eventTaskBind: 'objectid_new_epm_eventtask@odata.bind', expenseBind: 'objectid_new_epm_expense@odata.bind',
  },
  common: { createdOn: 'createdon', createdBy: '_createdby_value', ownerId: '_ownerid_value', stateCode: 'statecode' },
} as const;

/** OData annotation that carries the display label of a lookup/choice/money value. */
export const FORMATTED = '@OData.Community.Display.V1.FormattedValue';

/** Template color (new_epm_eventtemplate.new_color). Display classes live in utils/templateColors.ts. */
export const TemplateColor = {
  Teal: 100000000, Violet: 100000001, Sky: 100000002, Magenta: 100000003, Olive: 100000004, Brown: 100000005,
} as const;
export type TemplateColor = (typeof TemplateColor)[keyof typeof TemplateColor];

export const EventStatus = { Planning: 100000000, Active: 100000001, Completed: 100000002, Cancelled: 100000003 } as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const TaskStatus = { Pending: 100000000, InProgress: 100000001, Completed: 100000002 } as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const ExpenseCategory = {
  Airfare: 100000000, Lodging: 100000001, Meals: 100000002, AvEquipmentRental: 100000003,
  GroundTransportation: 100000004, Venue: 100000005, MaterialsAndPrinting: 100000006, Other: 100000007,
} as const;
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const ExpenseStatus = { Estimated: 100000000, Approved: 100000001, Paid: 100000002, Cancelled: 100000003 } as const;
export type ExpenseStatus = (typeof ExpenseStatus)[keyof typeof ExpenseStatus];

export const MeetingStatus = { Scheduled: 100000000, Completed: 100000001, Cancelled: 100000002 } as const;
export type MeetingStatus = (typeof MeetingStatus)[keyof typeof MeetingStatus];

export const AttendeeResponse = { None: 100000000, Accepted: 100000001, Tentative: 100000002, Declined: 100000003 } as const;
export type AttendeeResponse = (typeof AttendeeResponse)[keyof typeof AttendeeResponse];

export const HistoryAction = {
  Created: 100000000, StatusChanged: 100000001, Updated: 100000002, Assigned: 100000003, CommentAdded: 100000004,
  FileAttached: 100000005, FileRemoved: 100000006, MeetingScheduled: 100000007, ExpenseLinked: 100000008,
} as const;
export type HistoryAction = (typeof HistoryAction)[keyof typeof HistoryAction];

/** Security role names (Dataverse `role.name`). */
export const ROLE_NAMES = {
  manager: 'EPM Manager',
  member: 'EPM Member',
  /** Admins get manager UI until the EPM roles are assigned. */
  systemAdministrator: 'System Administrator',
} as const;

/** Statecode for active rows. */
export const ACTIVE_STATE = 0;
