import { NavLink, Link } from 'react-router-dom';
import { BarChart3, CalendarDays, CalendarRange, CheckSquare, LayoutTemplate, Settings, Users, type LucideIcon } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/States';
import { useCurrentUser } from '@/hooks/queries';
import { useComingUp, useMyTaskBadge } from '@/hooks/useNavData';
import { daysUntil, formatDateOnly } from '@/utils/dates';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: 'tasks';
}

const NAV_ITEMS: NavItem[] = [
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare, badge: 'tasks' },
  { to: '/calendar', label: 'Calendar', icon: CalendarRange },
  { to: '/meetings', label: 'Meetings', icon: Users },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-lg font-extrabold text-ink shadow-lg shadow-black/25 ${className}`}>
      E
    </span>
  );
}

function Brand() {
  return (
    <Link to="/events" className="flex items-center gap-3 rounded-2xl px-2 py-1 transition-opacity hover:opacity-90">
      <LogoMark />
      <span className="leading-tight">
        <span className="block text-lg font-extrabold text-sidebar-text">EPM</span>
        <span className="block text-xs font-medium text-sidebar-muted">Caribbean Area Events</span>
      </span>
    </Link>
  );
}

function ComingUp({ onNavigate }: { onNavigate?: () => void }) {
  const { items, isPending } = useComingUp(2);
  return (
    <section aria-labelledby="coming-up" className="border-t border-sidebar-line px-1 pt-5">
      <h2 id="coming-up" className="mb-3 px-3 text-[11px] font-bold tracking-[0.14em] text-sidebar-muted uppercase">Coming up</h2>
      {isPending ? (
        <div className="space-y-2 px-2" aria-hidden>
          <Skeleton className="sidebar-skeleton h-14" />
          <Skeleton className="sidebar-skeleton h-14" />
        </div>
      ) : items.length === 0 ? (
        <p className="px-3 text-sm text-sidebar-muted">No upcoming events.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((e) => {
            const days = daysUntil(e.eventDate);
            return (
              <li key={e.id}>
                <Link to={`/events/${e.id}`} onClick={onNavigate} className="flex min-h-14 items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-sidebar-hover">
                  <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-orange-500 leading-none text-ink">
                    <span className="text-[10px] font-bold uppercase">{formatDateOnly(e.eventDate, 'MMM')}</span>
                    <span className="tabular text-sm font-extrabold">{formatDateOnly(e.eventDate, 'd')}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-sidebar-text">{e.name}</span>
                    <span className="block text-xs text-sidebar-muted">{days === 0 ? 'Today' : `In ${days} day${days === 1 ? '' : 's'}`}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function UserCard() {
  const user = useCurrentUser();
  if (user.isPending) return <Skeleton className="sidebar-skeleton mx-1 h-16" />;
  if (!user.data) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-sidebar-line bg-white/5 p-3 transition-colors hover:bg-white/10">
      <Avatar person={{ id: user.data.id, name: user.data.name }} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-sidebar-text">{user.data.name}</span>
        <span className="block text-xs text-sidebar-muted">{user.data.isManager ? 'Manager' : 'Member'}</span>
      </span>
    </div>
  );
}

/** Shared navigation body for the desktop sidebar and the mobile drawer. */
export function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const taskBadge = useMyTaskBadge();
  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <Brand />
      <nav aria-label="Main" className="px-1">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, badge }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `relative flex min-h-11 items-center gap-3 rounded-2xl py-2 pr-3 pl-4 text-sm font-semibold transition-colors duration-150 ${
                    isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span aria-hidden className="absolute inset-y-2.5 left-0 w-1 rounded-r-full bg-orange-500" />}
                    <span className="flex size-5 shrink-0 items-center justify-center">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="flex-1 truncate">{label}</span>
                    {badge === 'tasks' && taskBadge > 0 && (
                      <span
                        className={`tabular rounded-full px-2 py-0.5 text-xs font-bold ${isActive ? 'bg-white text-navy-700' : 'bg-orange-500 text-ink'}`}
                        aria-label={`${taskBadge} due this week or overdue`}
                      >
                        {taskBadge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <ComingUp onNavigate={onNavigate} />
      <div className="mt-auto">
        <UserCard />
      </div>
    </div>
  );
}
