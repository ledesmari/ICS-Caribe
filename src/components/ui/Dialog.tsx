import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

/**
 * Modal dialog on the native <dialog> element: the browser traps focus, makes the page inert,
 * and closes on Esc. Focus returns to the element that opened it.
 */
export function Dialog({ open, onClose, title, description, children, footer, variant = 'center' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** 'sheet' = bottom sheet on phones, centered dialog from `sm` up. */
  variant?: 'center' | 'sheet';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // backdrop click
      }}
      className={variant === 'sheet'
        ? 'mx-0 mt-auto mb-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-white p-0 text-ink shadow-xl backdrop:bg-ink/50 sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:rounded-3xl'
        : 'm-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl bg-white p-0 text-ink shadow-xl backdrop:bg-ink/50'}
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-xl font-extrabold">{title}</h2>
              {description && <p id={descId} className="mt-1 text-sm text-secondary">{description}</p>}
            </div>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="-mt-2 -mr-2" icon={<X className="size-5" aria-hidden />} />
          </div>
          {children}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
