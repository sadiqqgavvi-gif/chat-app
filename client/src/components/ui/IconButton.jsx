function IconButton({ label, children, className = "", active = false, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg transition-colors hover:bg-hover disabled:opacity-40 ${
        active ? "bg-hover text-brand" : "text-muted"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default IconButton;
