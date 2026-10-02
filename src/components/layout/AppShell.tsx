import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Outlet, useLocation, useMatches } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useCurrentUser } from '@/hooks/queries';
import { NavContent } from './NavContent';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function hasTitle(handle: unknown): handle is { title: string } {
  return typeof handle === 'object' && handle !== null && 'title' in handle && typeof handle.title === 'string';
}

function usePageTitle(): string {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i]?.handle;
    if (hasTitle(handle)) return handle.title;
  }
  return 'EPM';
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink/50" aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        onKeyDown={onKeyDown}
        className="sidebar-panel absolute inset-y-0 left-0 flex w-[312px] max-w-[85vw] flex-col overflow-y-auto rounded-r-3xl bg-sidebar shadow-2xl"
      >
        <div className="flex justify-end px-4 pt-4">
          <Button variant="ghost" size="icon" className="sidebar-icon-btn" aria-label="Close navigation" onClick={onClose} icon={<X className="size-5" aria-hidden />} />
        </div>
        <div className="flex-1">
          <NavContent onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const title = usePageTitle();
  const user = useCurrentUser();

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    document.title = title === 'EPM' ? 'EPM · Caribbean Area Events' : `${title} · EPM`;
  }, [title]);

  // Move focus to the page on navigation so keyboard/screen-reader users land on new content.
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[280px_1fr]">
      <a href="#main" className="sr-only z-50 rounded-full bg-navy-700 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh p-3 lg:block">
        <div className="sidebar-panel h-full overflow-y-auto rounded-3xl bg-sidebar shadow-lg shadow-navy-900/10 ring-1 ring-sidebar-line">
          <NavContent />
        </div>
      </aside>

      <div className="min-w-0" inert={drawerOpen}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-page/95 px-2 backdrop-blur lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-navy-50"
          >
            <Menu className="size-6" aria-hidden />
          </button>
          <p className="flex-1 truncate text-lg font-bold">{title}</p>
          {user.data && <Avatar person={{ id: user.data.id, name: user.data.name }} className="mr-2" />}
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] px-4 pt-6 pb-24 outline-none sm:px-6 lg:px-10 lg:pt-10">
          <Outlet />
        </main>
      </div>

      <MobileDrawer open={drawerOpen} onClose={closeDrawer} />
    </div>
  );
}
