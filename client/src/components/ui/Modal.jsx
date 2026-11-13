import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import IconButton from "./IconButton";

function Modal({ title, onClose, children, footer, size = "md" }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[90dvh] w-full animate-pop flex-col overflow-hidden rounded-t-2xl bg-panel text-ink shadow-2xl sm:rounded-2xl ${
          size === "sm" ? "sm:max-w-sm" : "sm:max-w-md"
        }`}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 border-b border-line py-2 pl-5 pr-2">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <FiX />
            </IconButton>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="px-5 py-4 text-sm text-muted">{message}</p>
    </Modal>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-ink hover:bg-hover",
  outline: "border border-line text-ink hover:bg-hover",
};

export function Button({ variant = "primary", className = "", children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Modal;
