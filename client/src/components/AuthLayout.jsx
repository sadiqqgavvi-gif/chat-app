import { useId, useState } from "react";
import { FiEye, FiEyeOff, FiMessageCircle } from "react-icons/fi";

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-app p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl text-white shadow-lg shadow-brand/30">
            <FiMessageCircle />
          </div>
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm">
          {children}
        </div>

        <p className="mt-5 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}

export function Field({ label, type = "text", error, ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          aria-invalid={Boolean(error)}
          className={`w-full rounded-lg border bg-panel px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20 ${
            error ? "border-danger" : "border-line"
          } ${isPassword ? "pr-10" : ""}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-ink"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <FiEyeOff /> : <FiEye />}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
    >
      {children}
    </div>
  );
}
