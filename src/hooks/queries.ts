/** Query keys + read hooks. All server state goes through React Query. */
import { useQuery } from '@tanstack/react-query';
import { eventsService } from '@/services/eventsService';
import { getDeletionImpact } from '@/services/eventDeletionService';
import { eventTasksService, type TaskListFilter } from '@/services/eventTasksService';
import { eventTemplatesService, templateTasksService, type TemplateTaskSummary } from '@/services/templatesService';
import { expensesService } from '@/services/expensesService';
import { meetingsService, meetingAttendeesService } from '@/services/meetingsService';
import { taskCommentsService, taskHistoryService } from '@/services/taskActivityService';
import { attachmentsService } from '@/services/attachmentsService';
import { usersService } from '@/services/usersService';
import { currenciesService } from '@/services/eventCreationService';
export const queryKeys = {
  currentUser: ['currentUser'] as const,
  users: ['users'] as const,
  events: ['events'] as const,
  event: (id: string) => ['events', id] as const,
  tasks: (filter: TaskListFilter = {}) => ['tasks', filter] as const,
  task: (id: string) => ['tasks', 'detail', id] as const,
  templates: ['templates'] as const,
  templateTasks: (templateId: string) => ['templates', templateId, 'tasks'] as const,
  /** Under ['templates'] so template admin writes refresh it. */
  templateSummary: ['templates', 'summary'] as const,
  expenses: (eventIds?: string[]) => ['expenses', eventIds ?? 'all'] as const,
  meetings: (eventIds?: string[]) => ['meetings', eventIds ?? 'all'] as const,
  attendees: (meetingId: string) => ['meetings', meetingId, 'attendees'] as const,
  comments: (taskIds: string[]) => ['comments', taskIds] as const,
  history: (taskId: string) => ['history', taskId] as const,
  attachments: (parentIds: string[]) => ['attachments', parentIds] as const,
  currencies: ['currencies'] as const,
  /** Not under ['events', id]: refreshing events after a delete must not refetch it. */
  deletionImpact: (eventId: string) => ['deletionImpact', eventId] as const,
};

export function useTaskExpenses(taskId: string | undefined) {
  return useQuery({
    queryKey: ['expenses', 'task', taskId ?? ''] as const,
    queryFn: () => expensesService.listByTask(taskId ?? ''),
    enabled: Boolean(taskId),
  });
}

export function useCurrencies() {
  return useQuery({ queryKey: queryKeys.currencies, queryFn: currenciesService.list, staleTime: Infinity });
}

const FIVE_MINUTES = 5 * 60 * 1000;

export function useCurrentUser() {
  return useQuery({ queryKey: queryKeys.currentUser, queryFn: usersService.getCurrentUser, staleTime: FIVE_MINUTES });
}

export function useAssignableUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: usersService.listAssignable, staleTime: FIVE_MINUTES });
}

export function useEvents() {
  return useQuery({ queryKey: queryKeys.events, queryFn: eventsService.list });
}

export function useEvent(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.event(id ?? ''), queryFn: () => eventsService.get(id ?? ''), enabled: Boolean(id) });
}

/** What deleting an event removes + the meetings blocking it. Always fresh; only while the dialog is open. */
export function useDeletionImpact(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.deletionImpact(eventId),
    queryFn: () => getDeletionImpact(eventId),
    enabled: enabled && Boolean(eventId),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useTasks(filter: TaskListFilter = {}, enabled = true) {
  return useQuery({ queryKey: queryKeys.tasks(filter), queryFn: () => eventTasksService.list(filter), enabled });
}

export function useTask(id: string | undefined) {
  return useQuery({ queryKey: queryKeys.task(id ?? ''), queryFn: () => eventTasksService.get(id ?? ''), enabled: Boolean(id) });
}

export function useTemplates() {
  return useQuery({ queryKey: queryKeys.templates, queryFn: eventTemplatesService.list, staleTime: FIVE_MINUTES });
}

/** One request serves both hooks below (same key; `select` derives the counts). */
const templateSummaryQuery = { queryKey: queryKeys.templateSummary, queryFn: templateTasksService.summaryByTemplate };

export function useTemplateTaskSummary() {
  return useQuery(templateSummaryQuery);
}

export function useTemplateTaskCounts() {
  return useQuery({
    ...templateSummaryQuery,
    select: (summary: Map<string, TemplateTaskSummary>) => new Map([...summary].map(([id, s]) => [id, s.taskCount])),
  });
}

export function useTemplateTasks(templateId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.templateTasks(templateId ?? ''),
    queryFn: () => templateTasksService.listByTemplate(templateId ?? ''),
    enabled: Boolean(templateId),
  });
}

export function useExpenses(eventIds?: string[]) {
  return useQuery({ queryKey: queryKeys.expenses(eventIds), queryFn: () => expensesService.list(eventIds) });
}

export function useMeetings(eventIds?: string[]) {
  return useQuery({ queryKey: queryKeys.meetings(eventIds), queryFn: () => meetingsService.list(eventIds) });
}

export function useAttendees(meetingId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.attendees(meetingId ?? ''),
    queryFn: () => meetingAttendeesService.listByMeeting(meetingId ?? ''),
    enabled: Boolean(meetingId),
  });
}

export function useComments(taskIds: string[]) {
  return useQuery({ queryKey: queryKeys.comments(taskIds), queryFn: () => taskCommentsService.listByTasks(taskIds), enabled: taskIds.length > 0 });
}

export function useTaskHistory(taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.history(taskId ?? ''),
    queryFn: () => taskHistoryService.listByTask(taskId ?? ''),
    enabled: Boolean(taskId),
  });
}

/** Combined history of several tasks (event Activity tab). */
export function useActivity(taskIds: string[]) {
  return useQuery({
    queryKey: ['history', 'activity', taskIds] as const,
    queryFn: () => taskHistoryService.listByTasks(taskIds),
    enabled: taskIds.length > 0,
    // Task mutations invalidate per-task history keys only; always refetch when the tab opens.
    staleTime: 0,
  });
}

export function useAttachments(parentIds: string[]) {
  return useQuery({
    queryKey: queryKeys.attachments(parentIds),
    queryFn: () => attachmentsService.listByParents(parentIds),
    enabled: parentIds.length > 0,
  });
}
