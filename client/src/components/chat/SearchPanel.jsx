import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import IconButton from "../ui/IconButton";
import Spinner from "../ui/Spinner";
import { SearchInput } from "../sidebar/PanelHeader";
import { useChat } from "../../context/contexts";
import { useDebounced } from "../../lib/hooks";
import { formatListTime, senderId } from "../../lib/format";
import { searchMessages } from "../../services/messageService";

function Highlight({ text, term }) {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return text;
  // Show the text around the match rather than the start of a long message.
  const start = Math.max(0, index - 30);
  return (
    <>
      {start > 0 && "…"}
      {text.slice(start, index)}
      <mark className="rounded bg-brand/20 px-0.5 text-inherit">
        {text.slice(index, index + term.length)}
      </mark>
      {text.slice(index + term.length)}
    </>
  );
}

function SearchPanel({ chat, onClose }) {
  const { me, jumpToMessage } = useChat();
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim(), 300);
  const [state, setState] = useState({ term: "", results: [] });

  useEffect(() => {
    if (term.length < 2) return undefined;
    const controller = new AbortController();
    searchMessages(chat._id, term, controller.signal)
      .then((response) => setState({ term, results: response.data }))
      .catch((err) => {
        if (err.code !== "ERR_CANCELED") setState({ term, results: [] });
      });
    return () => controller.abort();
  }, [chat._id, term]);

  const ready = term.length >= 2;
  const loading = ready && state.term !== term;

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-2">
        <IconButton label="Close search" onClick={onClose}>
          <FiX />
        </IconButton>
        <h2 className="text-lg font-semibold text-ink">Search messages</h2>
      </div>
      <div className="p-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search in this chat"
          autoFocus
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!ready ? (
          <p className="px-6 py-8 text-center text-sm text-muted">
            Type at least 2 characters to search this chat.
          </p>
        ) : loading ? (
          <div className="flex justify-center p-6 text-muted">
            <Spinner />
          </div>
        ) : state.results.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">
            No messages found for "{term}".
          </p>
        ) : (
          state.results.map((message) => (
            <button
              key={message._id}
              type="button"
              onClick={() => jumpToMessage(chat._id, message._id)}
              className="block w-full border-b border-line px-4 py-3 text-left hover:bg-hover"
            >
              <div className="flex justify-between gap-2 text-xs text-muted">
                <span className="truncate">
                  {senderId(message) === me ? "You" : message.sender?.name}
                </span>
                <span className="shrink-0">{formatListTime(message.createdAt)}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 break-words text-sm text-ink">
                <Highlight text={message.content} term={term} />
              </p>
            </button>
          ))
        )}
      </div>
    </>
  );
}

export default SearchPanel;
