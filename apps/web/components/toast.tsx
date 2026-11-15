'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

/** Toasts: bottom centre, about 2 seconds, 180 ms in (design "States" board). */

interface ToastOptions {
  tone?: 'ok' | 'error';
  action?: { label: string; onClick: () => void };
  duration?: number;
}

interface ToastState extends ToastOptions {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string, options?: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const nextId = useRef(0);

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    clearTimeout(timer.current);
    nextId.current += 1;
    setToast({ id: nextId.current, message, ...options });
    timer.current = setTimeout(() => setToast(null), options.duration ?? 2200);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role={toast?.tone === 'error' ? 'alert' : 'status'}
        aria-live={toast?.tone === 'error' ? 'assertive' : 'polite'}
        className="pointer-events-none fixed inset-x-4 bottom-24 z-[60] flex justify-center md:bottom-8"
      >
        {toast && (
          <div
            key={toast.id}
            className={`toast toast-in pointer-events-auto ${toast.action ? '' : 'toast-plain'}`}
          >
            <Icon
              name={toast.tone === 'error' ? 'alertCircle' : 'check'}
              className={toast.tone === 'error' ? 'bad' : 'ok'}
            />
            {toast.message}
            {toast.action && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

/** Copy text and confirm with a toast; offers Retry when the clipboard refuses. */
export function useCopy() {
  const toast = useToast();
  return useCallback(
    async function copy(value: string, message = 'Copied') {
      try {
        await navigator.clipboard.writeText(value);
        toast(message);
        return true;
      } catch {
        toast("Couldn't copy", {
          tone: 'error',
          action: { label: 'Retry', onClick: () => void copy(value, message) },
        });
        return false;
      }
    },
    [toast],
  );
}
