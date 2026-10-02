/** Chip tone classes (shared by <Chip> and status toggle pills). */
import { EventStatus } from '@/types/schema';

export type ChipTone = 'pending' | 'navy' | 'green' | 'red' | 'orange' | 'outline';

export const CHIP_TONES: Record<ChipTone, string> = {
  pending: 'bg-pending-bg text-pending',
  navy: 'bg-navy-100 text-navy-700',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-700',
  orange: 'bg-orange-50 text-orange-900',
  outline: 'border border-line bg-white text-secondary',
};

export const EVENT_TONE: Record<EventStatus, ChipTone> = {
  [EventStatus.Planning]: 'navy',
  [EventStatus.Active]: 'green',
  [EventStatus.Completed]: 'pending',
  [EventStatus.Cancelled]: 'outline',
};
