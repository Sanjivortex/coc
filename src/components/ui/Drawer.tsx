'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

/** Right-hand sheet (full screen on phones). Escape, the backdrop and the close button dismiss it. */
export function Drawer({ title, subtitle, icon, onClose, children }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Parents pass a new onClose every render; keep the latest without re-running the mount effect
  // (which would steal focus from the inputs inside the drawer).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <div className="fade-in absolute inset-0 bg-black/60" onClick={() => onCloseRef.current()} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="drawer-in absolute inset-y-0 right-0 flex w-full max-w-[720px] flex-col border-l border-line bg-panel shadow-2xl"
      >
        <header className="flex items-start gap-4 border-b border-line px-5 py-4">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[13px] text-ink-3">{subtitle}</div>}
          </div>
          <button ref={closeRef} type="button" onClick={() => onCloseRef.current()} className="rounded-lg p-1.5 text-ink-3 hover:bg-hover hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
