/**
 * Meeting-scheduling hooks, kept apart from queries.ts / mutations.ts so the Teams and
 * Office 365 connector code only loads with the screens that schedule meetings.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { peopleService, scheduleMeeting, type ScheduleMeetingInput } from '@/services/meetingSchedulingService';

export function useScheduleMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleMeetingInput) => scheduleMeeting(input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['meetings'] });
      void queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

/** Directory search for meeting attendees; runs once the term has 2+ characters. */
export function usePeopleSearch(term: string) {
  const q = term.trim().toLowerCase();
  return useQuery({
    queryKey: ['people', q] as const,
    queryFn: () => peopleService.search(q),
    enabled: q.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}
