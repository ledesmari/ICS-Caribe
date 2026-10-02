/** Connectivity probes for the Diagnostics page: one tiny read per data source. */
import type { IOperationResult } from '@microsoft/power-apps/data';
import type { IGetAllOptions } from '@/generated/models/CommonModels';
import { AnnotationsService } from '@/generated/services/AnnotationsService';
import { New_epm_eventsService } from '@/generated/services/New_epm_eventsService';
import { New_epm_eventtasksService } from '@/generated/services/New_epm_eventtasksService';
import { New_epm_eventtemplatesService } from '@/generated/services/New_epm_eventtemplatesService';
import { New_epm_expensesService } from '@/generated/services/New_epm_expensesService';
import { New_epm_meetingattendeesService } from '@/generated/services/New_epm_meetingattendeesService';
import { New_epm_meetingsService } from '@/generated/services/New_epm_meetingsService';
import { New_epm_taskcommentsService } from '@/generated/services/New_epm_taskcommentsService';
import { New_epm_taskhistoriesService } from '@/generated/services/New_epm_taskhistoriesService';
import { New_epm_templatetasksService } from '@/generated/services/New_epm_templatetasksService';
import { RolesService } from '@/generated/services/RolesService';
import { SystemusersService } from '@/generated/services/SystemusersService';
import { WhoAmIService } from '@/generated/services/WhoAmIService';
import { unwrap } from '@/api/dataverseClient';
import { asRow, str } from '@/api/odata';
import { COLUMNS } from '@/types/schema';

export interface Probe {
  key: string;
  label: string;
  run: () => Promise<string>;
}

type GetAll = (options?: IGetAllOptions) => Promise<IOperationResult<unknown[]>>;

function tableProbe(key: string, label: string, getAll: GetAll, idColumn: string): Probe {
  return {
    key,
    label,
    run: async () => {
      const result = await getAll({ select: [idColumn], top: 1, count: true });
      const rows = await unwrap(`Read ${label}`, Promise.resolve(result));
      const total = result.count ?? rows.length;
      return `${total} row${total === 1 ? '' : 's'} visible`;
    },
  };
}

export const probes: Probe[] = [
  tableProbe('eventTemplates', 'Event templates', (o) => New_epm_eventtemplatesService.getAll(o), COLUMNS.eventTemplate.id),
  tableProbe('templateTasks', 'Template tasks', (o) => New_epm_templatetasksService.getAll(o), COLUMNS.templateTask.id),
  tableProbe('events', 'Events', (o) => New_epm_eventsService.getAll(o), COLUMNS.event.id),
  tableProbe('eventTasks', 'Event tasks', (o) => New_epm_eventtasksService.getAll(o), COLUMNS.eventTask.id),
  tableProbe('expenses', 'Expenses', (o) => New_epm_expensesService.getAll(o), COLUMNS.expense.id),
  tableProbe('meetings', 'Meetings', (o) => New_epm_meetingsService.getAll(o), COLUMNS.meeting.id),
  tableProbe('attendees', 'Meeting attendees', (o) => New_epm_meetingattendeesService.getAll(o), COLUMNS.meetingAttendee.id),
  tableProbe('comments', 'Task comments', (o) => New_epm_taskcommentsService.getAll(o), COLUMNS.taskComment.id),
  tableProbe('history', 'Task history', (o) => New_epm_taskhistoriesService.getAll(o), COLUMNS.taskHistory.id),
  tableProbe('annotations', 'Attachments (Notes)', (o) => AnnotationsService.getAll(o), COLUMNS.annotation.id),
  tableProbe('users', 'Users', (o) => SystemusersService.getAll(o), 'systemuserid'),
  tableProbe('roles', 'Security roles', (o) => RolesService.getAll(o), 'roleid'),
  {
    key: 'whoami',
    label: 'WhoAmI',
    run: async () => `UserId ${str(asRow(await unwrap('WhoAmI', WhoAmIService.WhoAmI())), 'UserId') || '(missing)'}`,
  },
];
