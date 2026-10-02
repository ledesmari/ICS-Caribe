/**
 * Schedule a meeting: Dataverse meeting + attendees + "Meeting Scheduled" history on each task
 * to review, then (for online meetings) the Teams invite LAST — sent invites can't be recalled,
 * so every Dataverse step must succeed first. If the Teams call fails, the meeting record is
 * deleted (attendees cascade) and the history rows are reverted.
 *
 * The SDK can't associate N:N rows, so "tasks reviewed in this meeting" is recorded as
 * Meeting Scheduled history rows whose newValue holds the meeting id.
 */
import { MicrosoftTeamsService } from '@/generated/services/MicrosoftTeamsService';
import { Office365UsersService } from '@/generated/services/Office365UsersService';
import { DataverseError, runSequence, unwrap, type SequenceStep } from '@/api/dataverseClient';
import { asRow, str } from '@/api/odata';
import { meetingAttendeesService, meetingsService } from '@/services/meetingsService';
import { taskHistoryService } from '@/services/taskActivityService';
import { HistoryAction } from '@/types/schema';
import type { IsoDateTime } from '@/types/entities';
import { formatDateTime } from '@/utils/dates';

export interface Person {
  name: string;
  email: string;
}

export interface ScheduleMeetingInput {
  eventId: string;
  subject: string;
  start: IsoDateTime;
  end: IsoDateTime;
  isOnline: boolean;
  location: string;
  agenda: string;
  attendees: Person[];
  taskIds: string[];
}

export interface ScheduleResult {
  meetingId: string;
  joinUrl: string;
  /** Set when the invite went out but saving its link/id afterwards failed. */
  warning: string | null;
}

/** "2026-10-20T14:00:00.000Z" → "2026-10-20T14:00:00" (the connector takes the zone separately). */
const utcLocal = (iso: string) => new Date(iso).toISOString().slice(0, 19);

/** The connector is typed as void but returns the created event; read it defensively. */
function readCreatedEvent(data: unknown): { id: string; joinUrl: string } {
  const row = asRow(data);
  const online = asRow(row.onlineMeeting);
  return {
    id: str(row, 'id') || str(row, 'Id'),
    joinUrl: str(online, 'joinUrl') || str(row, 'onlineMeetingUrl') || str(row, 'joinUrl') || str(row, 'webLink'),
  };
}

export const peopleService = {
  /** Directory search (Office 365 Users). Returns people with an email address. */
  async search(term: string): Promise<Person[]> {
    const q = term.trim();
    if (q.length < 2) return [];
    const res = await unwrap('Search people', Office365UsersService.SearchUserV2(q, 10, true));
    return (res.value ?? [])
      .filter((u) => u.AccountEnabled !== false && (u.Mail || u.UserPrincipalName))
      .map((u) => ({ name: u.DisplayName ?? u.Mail ?? '', email: (u.Mail || u.UserPrincipalName || '').toLowerCase() }));
  },
};

export async function scheduleMeeting(input: ScheduleMeetingInput): Promise<ScheduleResult> {
  if (new Date(input.end) <= new Date(input.start)) throw new Error('The meeting must end after it starts.');
  const when = formatDateTime(input.start, 'MMM d, h:mm a');

  const steps: SequenceStep[] = [
    {
      label: 'Save meeting',
      run: () => meetingsService.create({
        eventId: input.eventId, subject: input.subject, start: input.start, end: input.end,
        isOnline: input.isOnline, location: input.isOnline ? 'Microsoft Teams' : input.location, agenda: input.agenda,
      }),
      undo: (id) => meetingsService.remove(String(id)), // attendees are removed by the parental cascade
    },
    ...input.attendees.map((p): SequenceStep => ({
      label: `Add attendee ${p.email}`,
      run: ([meetingId]) => meetingAttendeesService.create({ meetingId: String(meetingId), name: p.name, email: p.email }),
    })),
    ...input.taskIds.map((taskId): SequenceStep => ({
      label: 'Write history',
      run: ([meetingId]) => taskHistoryService.add({
        eventTaskId: taskId, action: HistoryAction.MeetingScheduled,
        summary: `Scheduled for review in "${input.subject}" (${when})`, fieldName: 'Meeting', newValue: String(meetingId),
      }),
      undo: (id) => taskHistoryService.revert(String(id)),
    })),
  ];

  let created = { id: '', joinUrl: '' };
  if (input.isOnline) {
    steps.push({
      label: 'Send Teams invite',
      run: async () => {
        const data = await unwrap('Create Teams meeting', MicrosoftTeamsService.CreateTeamsMeeting('Calendar', {
          subject: input.subject,
          body: { content: input.agenda || input.subject, contentType: 'text' },
          timeZone: 'UTC',
          start: { dateTime: utcLocal(input.start) },
          end: { dateTime: utcLocal(input.end) },
          requiredAttendees: input.attendees.map((p) => p.email).join(';'),
          isOnlineMeeting: true,
          onlineMeetingProvider: 'teamsForBusiness',
          responseRequested: true,
        }));
        created = readCreatedEvent(data);
        return created;
      },
    });
  }

  const [meetingId] = (await runSequence(steps)) as [string];
  if (!meetingId) throw new DataverseError('Schedule meeting', 'The meeting was not saved.');

  // After the invite is out nothing can be rolled back; a failure here is reported, not undone.
  let warning: string | null = null;
  if (input.isOnline && (created.id || created.joinUrl)) {
    try {
      await meetingsService.update(meetingId, { outlookEventId: created.id, joinUrl: created.joinUrl });
    } catch {
      warning = 'The Teams invite was sent, but its join link could not be saved to the meeting.';
    }
  } else if (input.isOnline) {
    warning = 'The Teams invite was sent, but Teams did not return a join link to save.';
  }
  return { meetingId, joinUrl: created.joinUrl, warning };
}
