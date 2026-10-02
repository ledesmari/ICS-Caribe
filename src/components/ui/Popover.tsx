import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from './Dialog';

/** Below `sm` the popover is a bottom sheet (content can hide its own title/close with `hidden sm:…`). */
const PHONE_QUERY = '(max-width: 639px)';
const GAP = 8;
const MARGIN = 12;

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
const isPhone = () => window.matchMedia(PHONE_QUERY).matches;

/**
 * Non-modal popover anchored next to `anchor` (prefers the right side, flips left, clamps to the
 * viewport). Esc or a click outside closes it and focus returns to the anchor. On phones it renders
 * as a bottom sheet (Dialog, titled `label`). `label` names the dialog for screen readers.
 */
export function Popover({ anchor, onClose, label, width = 340, children }: {
  anchor: HTMLElement;
  onClose: () => void;
  label: string;
  width?: number;
  children: ReactNode;
}) {
  const phone = useSyncExternalStore(subscribe, isPhone, () => false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Return focus to the anchor when the popover goes away.
  useEffect(() => () => { if (anchor.isConnected) anchor.focus(); }, [anchor]);

  useLayoutEffect(() => {
    if (phone) return;
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const a = anchor.getBoundingClientRect();
      const h = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = a.right + GAP;
      if (left + width > vw - MARGIN) left = a.left - GAP - width;
      if (left < MARGIN) left = Math.min(Math.max(MARGIN, a.left), vw - width - MARGIN);
      let top = a.top;
      if (top + h > vh - MARGIN) top = Math.max(MARGIN, vh - h - MARGIN);
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, phone, width]);

  useEffect(() => {
    if (phone) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [anchor, onClose, phone]);

  if (phone) {
    return <Dialog open onClose={onClose} title={label} variant="sheet">{children}</Dialog>;
  }

  return createPortal(
    <div ref={ref} role="dialog" aria-label={label} tabIndex={-1}
      style={{ width, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className="fixed z-40 max-h-[calc(100dvh-24px)] overflow-y-auto rounded-3xl border border-line bg-white p-5 text-ink shadow-xl outline-none">
      {children}
    </div>,
    document.body,
  );
}
