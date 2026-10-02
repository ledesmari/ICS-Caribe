/** Icon + tone per history action, shared by the task timeline and the event Activity tab. */
import { CalendarClock, MessageSquare, Paperclip, Pencil, Plus, Receipt, RefreshCw, Trash2, UserPlus, type LucideIcon } from 'lucide-react';
import { HistoryAction } from '@/types/schema';

export const ACTION_ICON: Record<HistoryAction, { icon: LucideIcon; tone: string }> = {
  [HistoryAction.Created]: { icon: Plus, tone: 'bg-navy-100 text-navy-700' },
  [HistoryAction.StatusChanged]: { icon: RefreshCw, tone: 'bg-green-50 text-green-700' },
  [HistoryAction.Updated]: { icon: Pencil, tone: 'bg-pending-bg text-pending' },
  [HistoryAction.Assigned]: { icon: UserPlus, tone: 'bg-orange-50 text-orange-900' },
  [HistoryAction.CommentAdded]: { icon: MessageSquare, tone: 'bg-navy-100 text-navy-700' },
  [HistoryAction.FileAttached]: { icon: Paperclip, tone: 'bg-navy-100 text-navy-700' },
  [HistoryAction.FileRemoved]: { icon: Trash2, tone: 'bg-red-50 text-red-700' },
  [HistoryAction.MeetingScheduled]: { icon: CalendarClock, tone: 'bg-navy-100 text-navy-700' },
  [HistoryAction.ExpenseLinked]: { icon: Receipt, tone: 'bg-orange-50 text-orange-900' },
};

/** Whether a history row has old → new values worth showing as chips. */
export function showsChange(action: HistoryAction, fieldName: string): boolean {
  return action === HistoryAction.StatusChanged || action === HistoryAction.Assigned || fieldName === 'Due date';
}
