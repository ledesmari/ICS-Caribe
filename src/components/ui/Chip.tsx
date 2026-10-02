import type { ReactNode } from 'react';
import { EventStatus } from '@/types/schema';
import { EVENT_STATUS_LABEL, TASK_STATUS_LABEL, type TaskUiStatus } from '@/utils/format';
import { CHIP_TONES, EVENT_TONE, type ChipTone } from './chipStyles';

export type { ChipTone };

export function Chip({ tone = 'pending', icon, children, className = '' }: { tone?: ChipTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${CHIP_TONES[tone]} ${className}`}>
      {icon}
      {children}
    </span>
  );
}

const TASK_TONE: Record<TaskUiStatus, ChipTone> = {
  pending: 'pending',
  inProgress: 'navy',
  completed: 'green',
  overdue: 'red',
};

export function TaskStatusChip({ status }: { status: TaskUiStatus }) {
  return <Chip tone={TASK_TONE[status]}>{TASK_STATUS_LABEL[status]}</Chip>;
}

export function EventStatusChip({ status }: { status: EventStatus }) {
  return <Chip tone={EVENT_TONE[status]}>{EVENT_STATUS_LABEL[status]}</Chip>;
}
