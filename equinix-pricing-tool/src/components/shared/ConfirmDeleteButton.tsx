import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

interface Props {
  /** Called when the user confirms deletion */
  onDelete: () => void;
  /** Whether to require confirmation (true = configured item). Defaults to true. */
  requiresConfirm?: boolean;
  /** The trigger button content */
  children: ReactNode;
  /** Prompt shown between Cancel and Confirm. Defaults to 'Delete?' */
  confirmLabel?: string;
  /** CSS class for the trigger button */
  className?: string;
  title?: string;
  /** Extra class applied to the confirm row wrapper */
  confirmClassName?: string;
}

/**
 * A two-step delete button. When requiresConfirm is true (the element is
 * configured) clicking shows an inline "Delete? [No] [Yes]" confirmation.
 * When requiresConfirm is false the delete fires immediately.
 */
export function ConfirmDeleteButton({
  onDelete,
  requiresConfirm = true,
  children,
  confirmLabel = 'Delete?',
  className,
  title,
  confirmClassName = '',
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss confirmation after 4 s of inactivity
  useEffect(() => {
    if (confirming) {
      timerRef.current = setTimeout(() => setConfirming(false), 4000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [confirming]);

  const handleTrigger = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!requiresConfirm) {
      onDelete();
    } else {
      setConfirming(true);
    }
  }, [requiresConfirm, onDelete]);

  const handleCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(false);
  }, []);

  const handleConfirm = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(false);
    onDelete();
  }, [onDelete]);

  if (confirming) {
    return (
      <span className={`flex items-center gap-1 ${confirmClassName}`}>
        <span className="text-xs font-medium opacity-80 whitespace-nowrap">{confirmLabel}</span>
        <button
          onClick={handleCancel}
          title="Cancel deletion"
          className="text-xs px-2.5 py-1 rounded bg-white/20 hover:bg-white/30 font-medium whitespace-nowrap min-h-[28px]"
        >
          No
        </button>
        <button
          onClick={handleConfirm}
          title="Confirm deletion"
          className="text-xs px-2.5 py-1 rounded bg-red-500 hover:bg-red-600 text-white font-medium whitespace-nowrap min-h-[28px]"
        >
          Yes
        </button>
      </span>
    );
  }

  return (
    <button onClick={handleTrigger} className={className} title={title}>
      {children}
    </button>
  );
}
