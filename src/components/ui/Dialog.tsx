import { useEffect, useId, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned action row under the scrolling content. */
  footer?: ReactNode;
  role?: 'dialog' | 'alertdialog';
}

/**
 * Native <dialog> as a modal sheet: focus is trapped, Escape closes, and the
 * page behind does not scroll. The content scrolls inside the sheet so a
 * focused field stays visible above the iPhone keyboard.
 */
export function Dialog({ open, title, onClose, children, footer, role = 'dialog' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      document.documentElement.classList.add('modal-open');
    } else if (!open && el.open) {
      el.close();
    }
    return () => document.documentElement.classList.remove('modal-open');
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      role={role}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => document.documentElement.classList.remove('modal-open')}
    >
      {open ? (
        <div className="sheet__inner">
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          <div className="sheet__body">{children}</div>
          {footer ? <div className="sheet__footer">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
