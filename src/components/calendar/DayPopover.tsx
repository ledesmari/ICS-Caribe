/** Everything on one day ("+N more" / Enter on a busy day). Picking an event opens its popover. */
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Popover } from '@/components/ui/Popover';
import type { CalendarEvent } from '@/hooks/useCalendarData';
import type { DateOnly } from '@/types/entities';
import { formatDateOnly } from '@/utils/dates';
import { CalendarChip } from './CalendarChip';

export function DayPopover({ day, items, anchor, onPick, onClose }: {
  day: DateOnly;
  items: CalendarEvent[];
  anchor: HTMLElement;
  onPick: (item: CalendarEvent) => void;
  onClose: () => void;
}) {
  const title = formatDateOnly(day, 'EEEE, MMMM d');
  return (
    <Popover anchor={anchor} onClose={onClose} label={title} width={300}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="hidden text-base font-extrabold sm:block">{title}</h3>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="-mt-2 -mr-2 hidden sm:inline-flex" icon={<X className="size-5" aria-hidden />} />
      </div>
      <ul className="space-y-1.5">
        {items.map((c) => (
          <li key={c.id}>
            <CalendarChip item={c} active={false} className="h-11 w-full text-sm" onOpen={() => onPick(c)} />
          </li>
        ))}
      </ul>
    </Popover>
  );
}
