import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible demo dialog: focus-trapped, Esc-to-close, backdrop click,
 * and focus restored to the triggering element on unmount.
 */
export const DemoModal = ({ title, body, actionLabel = 'Understood', closeLabel = 'Close dialog', onClose }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="demo-modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="demo-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-modal-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="demo-modal-header">
          <h3 id="demo-modal-title">{title}</h3>
          <button type="button" className="demo-modal-close" onClick={onClose} aria-label={closeLabel}>
            <X size={16} />
          </button>
        </div>
        <p className="demo-modal-body">{body}</p>
        <button type="button" className="demo-modal-btn" onClick={onClose}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
};
