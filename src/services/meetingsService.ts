/** Meetings and attendees. Outlook/Teams scheduling is a later milestone. */
import { New_epm_meetingattendeesService } from '@/generated/services/New_epm_meetingattendeesService';
import { New_epm_meetingsService } from '@/generated/services/New_epm_meetingsService';
import type { New_epm_meetingsBase } from '@/generated/models/New_epm_meetingsModel';
import { deleteRecord, unwrap, unwrapList } from '@/api/dataverseClient';
import { and, anyGuid, asRow, bindRef, bool, eqGuid, num, str, strOrNull, type Row } from '@/api/odata';
import { ACTIVE_STATE, AttendeeResponse, COLUMNS, ENTITY_SETS, MeetingStatus } from '@/types/schema';
import type { IsoDateTime, Meeting, MeetingAttendee } from '@/types/entities';

const M = COLUMNS.meeting;
const MA = COLUMNS.meetingAttendee;
const ACTIVE = `${COLUMNS.common.stateCode} eq ${ACTIVE_STATE}`;
const SELECT = [M.id, M.subject, M.start, M.end, M.isOnline, M.location, M.agenda, M.outlookEventId, M.joinUrl, M.status, M.eventId];

function pick<T extends number>(value: number | null, all: Record<string, T>, fallback: T): T {
  return value !== null && (Object.values(all) as number[]).includes(value) ? (value as T) : fallback;
}

export function toMeeting(r: Row): Meeting {
  return {
    id: str(r, M.id),
    eventId: strOrNull(r, M.eventId),
    subject: str(r, M.subject),
    start: str(r, M.start),
    end: str(r, M.end),
    isOnline: bool(r, M.isOnline),
    location: str(r, M.location),
    agenda: str(r, M.agenda),
    outlookEventId: str(r, M.outlookEventId),
    joinUrl: str(r, M.joinUrl),
    status: pick(num(r, M.status), MeetingStatus, MeetingStatus.Scheduled),
  };
}

export function toAttendee(r: Row): MeetingAttendee {
  return {
    id: str(r, MA.id),
    meetingId: str(r, MA.meetingId),
    userId: strOrNull(r, MA.userId),
    name: str(r, MA.name),
    email: str(r, MA.email),
    response: pick(num(r, MA.response), AttendeeResponse, AttendeeResponse.None),
  };
}

export interface MeetingInput {
  subject: string;
  start: IsoDateTime;
  end: IsoDateTime;
  eventId?: string | null;
  isOnline?: boolean;
  location?: string;
  agenda?: string;
  outlookEventId?: string;
  joinUrl?: string;
  status?: MeetingStatus;
}

type MeetingRecord = Omit<New_epm_meetingsBase, 'new_epm_meetingid'>;

function toRecord(input: Partial<MeetingInput>): Partial<MeetingRecord> {
  const rec: Partial<MeetingRecord> = {};
  if (input.subject !== undefined) rec.new_meetingname = input.subject.trim();
  if (input.start !== undefined) rec.new_start = input.start;
  if (input.end !== undefined) rec.new_end = input.end;
  if (input.isOnline !== undefined) rec.new_isonline = input.isOnline;
  if (input.location !== undefined) rec.new_location = input.location;
  if (input.agenda !== undefined) rec.new_agenda = input.agenda;
  if (input.outlookEventId !== undefined) rec.new_outlookeventid = input.outlookEventId;
  if (input.joinUrl !== undefined) rec.new_joinurl = input.joinUrl;
  if (input.status !== undefined) rec.new_meetingstatus = input.status;
  if (input.eventId) rec['new_EventId@odata.bind'] = bindRef(ENTITY_SETS.event, input.eventId);
  return rec;
}

export const meetingsService = {
  async list(eventIds?: string[]): Promise<Meeting[]> {
    const rows = await unwrapList('List meetings', New_epm_meetingsService.getAll({
      select: SELECT,
      filter: and(ACTIVE, eventIds?.length ? anyGuid(M.eventId, eventIds) : undefined),
      orderBy: [`${M.start} asc`],
    }));
    return rows.map((r) => toMeeting(asRow(r)));
  },

  async get(id: string): Promise<Meeting> {
    return toMeeting(asRow(await unwrap('Get meeting', New_epm_meetingsService.get(id, { select: SELECT }))));
  },

  async create(input: MeetingInput): Promise<string> {
    if (new Date(input.end) <= new Date(input.start)) throw new Error('Meeting end must be after its start.');
    const record: MeetingRecord = {
      ...toRecord(input),
      new_meetingname: input.subject.trim(),
      new_start: input.start,
      new_end: input.end,
      new_meetingstatus: input.status ?? MeetingStatus.Scheduled,
      statecode: ACTIVE_STATE,
    };
    const created = await unwrap('Create meeting', New_epm_meetingsService.create(record));
    return str(asRow(created), M.id);
  },

  async update(id: string, patch: Partial<MeetingInput>): Promise<void> {
    await unwrap('Update meeting', New_epm_meetingsService.update(id, toRecord(patch)));
  },

  async remove(id: string): Promise<void> {
    await deleteRecord('Delete meeting', ENTITY_SETS.meeting, id);
  },
};

export interface AttendeeInput {
  meetingId: string;
  name: string;
  email: string;
  userId?: string | null;
  response?: AttendeeResponse;
}

export const meetingAttendeesService = {
  async listByMeeting(meetingId: string): Promise<MeetingAttendee[]> {
    const rows = await unwrapList('List attendees', New_epm_meetingattendeesService.getAll({
      select: [MA.id, MA.name, MA.email, MA.response, MA.meetingId, MA.userId],
      filter: and(ACTIVE, eqGuid(MA.meetingId, meetingId)),
    }));
    return rows.map((r) => toAttendee(asRow(r)));
  },

  async create(input: AttendeeInput): Promise<string> {
    const created = await unwrap('Add attendee', New_epm_meetingattendeesService.create({
      new_attendeename: input.name.trim(),
      new_email: input.email.trim(),
      new_response: input.response ?? AttendeeResponse.None,
      'new_MeetingId@odata.bind': bindRef(ENTITY_SETS.meeting, input.meetingId),
      ...(input.userId ? { 'new_UserId@odata.bind': bindRef(ENTITY_SETS.systemUser, input.userId) } : {}),
      statecode: ACTIVE_STATE,
    }));
    return str(asRow(created), MA.id);
  },

  async remove(id: string): Promise<void> {
    await deleteRecord('Remove attendee', ENTITY_SETS.meetingAttendee, id);
  },
};
