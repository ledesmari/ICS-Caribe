import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { buttonClasses } from './buttonStyles';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  /** Red text (destructive). */
  danger?: boolean;
  onSelect: () => void;
}

/**
 * Icon button that opens a small menu (WAI-ARIA menu button): ↓/↑/Home/End move between items,
 * Enter/Space select, Esc or Tab closes; focus returns to the button. Items are ≥ 44px tall.
 */
export function MenuButton({ label, icon, items, align = 'right' }: { label: string; icon: ReactNode; items: MenuItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onMenuKey = (e: KeyboardEvent, index: number) => {
    const last = items.length - 1;
    const keys: Record<string, number> = { ArrowDown: index === last ? 0 : index + 1, ArrowUp: index === 0 ? last : index - 1, Home: 0, End: last };
    const target = keys[e.key];
    if (target !== undefined) { e.preventDefault(); itemRefs.current[target]?.focus(); return; }
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') close(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button ref={buttonRef} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        className={buttonClasses('outline', 'icon')}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}>
        {icon}
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label}
          className={`absolute top-full z-30 mt-2 min-w-52 rounded-2xl border border-line bg-white p-1.5 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.map((item, i) => (
            <button key={item.label} ref={(el) => { itemRefs.current[i] = el; }} type="button" role="menuitem" tabIndex={-1}
              onKeyDown={(e) => onMenuKey(e, i)}
              onClick={() => { close(); item.onSelect(); }}
              className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold hover:bg-navy-50 focus-visible:bg-navy-50 focus-visible:outline-2 focus-visible:outline-navy-700 ${
                item.danger ? 'text-red-700' : 'text-ink'}`}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
