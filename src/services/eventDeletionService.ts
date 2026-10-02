/**
 * Delete an event. Dataverse cascades (verified with scripts/check-event-cascades.mjs) remove its
 * tasks, comments, history, expenses, meetings, attendees and Notes, so this is ONE delete.
 * Blocked while the event has an upcoming Scheduled meeting: the Teams connector can't cancel the
 * invitation, so the user cancels it in Outlook/Teams first and marks the meeting Cancelled here.
 */
import { parseISO } from 'date-fns';
import { DataverseError } from '@/api/dataverseClient';
import { attachmentsService } from '@/services/attachmentsService';
import { eventsService } from '@/services/eventsService';
import { eventTasksService } from '@/services/eventTasksService';
import { expensesService } from '@/services/expensesService';
import { meetingAttendeesService, meetingsService } from '@/services/meetingsService';
import { taskCommentsService, taskHistoryService } from '@/services/taskActivityService';
import { ExpenseStatus, MeetingStatus, TaskStatus } from '@/types/schema';
import type { IsoDateTime, Meeting } from '@/types/entities';

export interface BlockingMeeting {
  id: string;
  subject: string;
  start: IsoDateTime;
  end: IsoDateTime;
}

/** Counts of what a delete removes, plus the meetings that prevent it. */
export interface DeletionImpact {
  tasks: number;
  completedTasks: number;
  expenses: number;
  paidExpenses: number;
  meetings: number;
  attendees: number;
  comments: number;
  historyEntries: number;
  /** Notes (files/receipts) on the event's tasks and expenses. */
  attachments: number;
  blockingMeetings: BlockingMeeting[];
}

/**
 * Scheduled meetings that haven't ended yet (end ≥ now). Compares real instants parsed from the
 * ISO UTC values — never date-only strings. Pure; exported for testing.
 */
export function blockingMeetingsOf(meetings: Meeting[], now: Date = new Date()): BlockingMeeting[] {
  return meetings
    .filter((m) => m.status === MeetingStatus.Scheduled && !!m.end && parseISO(m.end).getTime() >= now.getTime())
    .map(({ id, subject, start, end }) => ({ id, subject, start, end }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export async function getDeletionImpact(eventId: string): Promise<DeletionImpact> {
  const [tasks, expenses, meetings] = await Promise.all([
    eventTasksService.list({ eventId }),
    expensesService.list([eventId]),
    meetingsService.list([eventId]),
  ]);
  const taskIds = tasks.map((t) => t.id);
  const [comments, history, attachments, attendeeLists] = await Promise.all([
    taskCommentsService.listByTasks(taskIds),
    taskHistoryService.listByTasks(taskIds),
    attachmentsService.listByParents([...taskIds, ...expenses.map((x) => x.id)]),
    Promise.all(meetings.map((m) => meetingAttendeesService.listByMeeting(m.id))),
  ]);
  return {
    tasks: tasks.length,
    completedTasks: tasks.filter((t) => t.status === TaskStatus.Completed).length,
    expenses: expenses.length,
    paidExpenses: expenses.filter((x) => x.status === ExpenseStatus.Paid).length,
    meetings: meetings.length,
    attendees: attendeeLists.reduce((sum, list) => sum + list.length, 0),
    comments: comments.length,
    historyEntries: history.length,
    attachments: attachments.length,
    blockingMeetings: blockingMeetingsOf(meetings),
  };
}

/**
 * Re-checks blocking meetings with a fresh read (not the React Query cache) right before
 * deleting — a meeting scheduled in another tab still blocks — then deletes the event once.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  const blocking = blockingMeetingsOf(await meetingsService.list([eventId]));
  const first = blocking[0];
  if (first) {
    const more = blocking.length > 1 ? ` and ${blocking.length - 1} more` : '';
    throw new DataverseError(
      'Delete event',
      `Delete event failed: "${first.subject}"${more} is still scheduled. Cancel the Teams meeting in Outlook or Teams, mark it Cancelled in the Meetings tab, then try again.`,
    );
  }
  await eventsService.remove(eventId);
}
