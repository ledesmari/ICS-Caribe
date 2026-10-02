import type { Ref } from '@/types/entities';
import { avatarColor, initials } from '@/utils/format';

const SIZES = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-11 text-sm' } as const;

export function Avatar({ person, size = 'md', className = '' }: { person: Ref; size?: keyof typeof SIZES; className?: string }) {
  const label = person.name || 'Unassigned';
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold ${SIZES[size]} ${avatarColor(person.id || label)} ${className}`}
    >
      {initials(label)}
    </span>
  );
}

/** Overlapping avatars with a "+N" overflow bubble. */
export function AvatarStack({ people, max = 3, size = 'sm' }: { people: Ref[]; max?: number; size?: keyof typeof SIZES }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  if (people.length === 0) return null;
  return (
    <span className="flex items-center" aria-label={`${people.length} assignee${people.length === 1 ? '' : 's'}: ${people.map((p) => p.name).join(', ')}`} role="group">
      {shown.map((p, i) => (
        <Avatar key={p.id} person={p} size={size} className={`ring-2 ring-white ${i > 0 ? '-ml-2' : ''}`} />
      ))}
      {extra > 0 && (
        <span className={`-ml-2 inline-flex items-center justify-center rounded-full bg-pending-bg font-bold text-secondary ring-2 ring-white ${SIZES[size]}`} aria-hidden>
          +{extra}
        </span>
      )}
    </span>
  );
}
