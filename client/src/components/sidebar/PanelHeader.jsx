import { FiArrowLeft } from "react-icons/fi";
import IconButton from "../ui/IconButton";
import Avatar from "../ui/Avatar";

function PanelHeader({ title, onBack, children }) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-2">
      <IconButton label="Back" onClick={onBack}>
        <FiArrowLeft />
      </IconButton>
      <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, autoFocus = false }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full rounded-full bg-soft px-4 py-2 text-sm text-ink outline-none placeholder:text-faint focus:ring-2 focus:ring-brand/30"
    />
  );
}

export function UserRow({ user, onClick, right, subtitle, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover"
    >
      <Avatar src={user.avatar} name={user.name} id={user._id} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">
          {title ?? user.name}
        </span>
        <span className="block truncate text-sm text-muted">
          {subtitle ?? user.about ?? user.email}
        </span>
      </span>
      {right}
    </button>
  );
}

export default PanelHeader;
