/**
 * Toasts.
 *
 * Confirmation that a write landed. Kept deliberately small: the app confirms
 * success with a toast and reports failure with a toast, and nothing else uses
 * them — a toast is a poor place for anything the user must act on, because it
 * disappears.
 *
 * The container is a live region so a screen reader announces the message
 * without the focus moving.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';

type Tone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: Tone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

const TONE: Record<Tone, { icon: string; className: string }> = {
  success: { icon: 'check_circle', className: 'text-[#2e7d55]' },
  error: { icon: 'error', className: 'text-danger' },
  info: { icon: 'info', className: 'text-brand' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, tone, message }]);
      // Errors stay longer: they usually carry something worth reading.
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6500 : 3800);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => {
          const t = TONE[toast.tone];
          return (
            <div
              key={toast.id}
              className="animate-fade-up pointer-events-auto flex max-w-[440px] items-start gap-2.5 rounded-[14px] border border-line bg-surface px-4 py-3 shadow-pop"
            >
              <Icon name={t.icon} size={19} className={`mt-px flex-none ${t.className}`} />
              <p className="text-[13.5px] leading-relaxed text-ink">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="press -mr-1 grid size-6 flex-none place-items-center rounded-md text-ink-4 hover:bg-surface-2"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
