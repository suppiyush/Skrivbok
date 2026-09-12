/**
 * Modal dialog.
 *
 * Built on the native `<dialog>` element, which gives focus trapping, the
 * top layer, inert background content and Escape-to-close for free — all of
 * which are laborious and easy to get subtly wrong by hand.
 *
 * One thing it deliberately does not do: close on a click outside the panel.
 * These dialogs hold forms, and a form half filled in is the worst thing to
 * lose to a stray click beside it. Escape and the close button still close,
 * and both go through `onClose` so the decision is the caller's.
 */
import { useEffect, useLayoutEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  onSubmit,
  size = 'md',
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** When given, the body is wrapped in a form and Enter submits. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  size?: 'sm' | 'md' | 'lg';
  /** Blocks dismissal while a write is in flight. */
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // Layout, not passive: a passive effect runs after the browser has painted,
  // so a dialog that opens as its page mounts would be one frame late — the
  // page behind it appears first and the dialog snaps in over it. This puts
  // `showModal()` before the paint, so the dialog is in the first frame.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // Escape and the form's own close both fire `cancel`/`close`; route them
    // through onClose so React state stays the single source of truth.
    const onCancel = (event: Event) => {
      event.preventDefault();
      if (!busy) onClose();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [onClose, busy]);

  const WIDTH = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[760px]' };

  const bodyContent = (
    <>
      <header className="flex items-start gap-4 border-b border-line px-5 py-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] leading-tight font-bold">{title}</h2>
          {description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="press grid size-8 flex-none place-items-center rounded-lg text-ink-4 transition hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        >
          <Icon name="close" size={19} />
        </button>
      </header>

      <div className="max-h-[min(62vh,560px)] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

      {footer ? (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-5 px-5 py-4 sm:px-6">
          {footer}
        </footer>
      ) : null}
    </>
  );

  return (
    <dialog
      ref={ref}
      className={`animate-scale-in m-auto w-[calc(100vw-2rem)] ${WIDTH[size]} rounded-[20px] border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/35 backdrop:backdrop-blur-[2px]`}
    >
      {onSubmit ? (
        <form onSubmit={onSubmit} noValidate>
          {bodyContent}
        </form>
      ) : (
        bodyContent
      )}
    </dialog>
  );
}

/**
 * Destructive confirmation.
 *
 * Names the thing being deleted in the body rather than saying "this item":
 * the commonest cause of an unwanted delete is a dialog that does not say what
 * it is about to delete.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  what,
  confirmLabel = 'Delete',
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  what: string;
  confirmLabel?: string;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={busy}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[14px] leading-relaxed text-ink-3">
        <span className="font-semibold text-ink">{what}</span> will be permanently removed. This
        cannot be undone.
      </p>
    </Modal>
  );
}
