import { useState } from "react";
import { FiCheck, FiEdit2 } from "react-icons/fi";

// A value that turns into an input when its pencil is clicked.
function EditableField({
  label,
  value,
  maxLength,
  placeholder,
  onSave,
  readOnly = false,
}) {
  const [draft, setDraft] = useState(null);
  const editing = draft !== null;

  const save = async () => {
    const next = draft.trim();
    if (next === value || (await onSave(next))) setDraft(null);
  };

  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={maxLength}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
              if (event.key === "Escape") setDraft(null);
            }}
            className="min-w-0 flex-1 border-b-2 border-brand bg-transparent py-1 text-[15px] text-ink outline-none"
          />
        ) : (
          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words py-1 text-[15px] text-ink">
            {value || <span className="text-faint">{placeholder}</span>}
          </p>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={() => (editing ? save() : setDraft(value))}
            className="rounded-full p-2 text-muted hover:bg-hover hover:text-ink"
            aria-label={editing ? `Save ${label}` : `Edit ${label}`}
          >
            {editing ? <FiCheck /> : <FiEdit2 />}
          </button>
        )}
      </div>
    </div>
  );
}

export default EditableField;
