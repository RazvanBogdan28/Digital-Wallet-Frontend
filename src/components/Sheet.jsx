import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[tabindex]',
  '[contenteditable="true"]',
].join(',');

export default function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  const backdropRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    const backdrop = backdropRef.current;

    if (!dialog || !backdrop) return;

    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const background = [...document.body.children]
        .filter((element) => element !== backdrop)
        .map((element) => ({
          element,
          inert: element.inert,
        }));

    for (const { element } of background) {
      element.inert = true;
    }

    document.body.style.overflow = 'hidden';

    function focusableElements() {
      return [...dialog.querySelectorAll(FOCUSABLE)].filter(
          (element) =>
              element.tabIndex >= 0 &&
              !element.matches(':disabled') &&
              !element.closest('[inert]') &&
              element.getClientRects().length > 0 &&
              getComputedStyle(element).visibility !== 'hidden',
      );
    }

    function focusInside() {
      const elements = focusableElements();
      const field = elements.find((element) =>
          element.matches('input, select, textarea'),
      );

      (field || elements[0] || dialog).focus();
    }

    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const elements = focusableElements();

      if (!elements.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      const outside = !elements.includes(active);

      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }

    function onFocus(event) {
      if (!dialog.contains(event.target)) {
        focusInside();
      }
    }

    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    focusInside();

    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      document.body.style.overflow = previousOverflow;

      for (const { element, inert } of background) {
        element.inert = inert;
      }

      if (previous?.isConnected) {
        previous.focus?.();
      }
    };
  }, []);

  return createPortal(
      <div
          className="sheet-backdrop"
          ref={backdropRef}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
      >
        <section
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            ref={ref}
        >
          <header className="sheet-head">
            <h2>{title}</h2>
            <button
                type="button"
                className="icon-btn"
                onClick={onClose}
                aria-label="Close"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          {children}
        </section>
      </div>,
      document.body,
  );
}