import { useState } from "react";
import { FiUsers } from "react-icons/fi";
import PanelHeader, { SearchInput, UserRow } from "./PanelHeader";
import Spinner from "../ui/Spinner";
import { useChat } from "../../context/contexts";
import { useUserSearch } from "../../lib/hooks";

function NewChatPanel({ onBack, onNewGroup }) {
  const { openChatWith } = useChat();
  const [query, setQuery] = useState("");
  const { users, loading } = useUserSearch(query);

  const start = async (userId) => {
    if (await openChatWith(userId)) onBack();
  };

  return (
    <>
      <PanelHeader title="New chat" onBack={onBack} />
      <div className="p-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by name or email"
          autoFocus
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!query && (
          <button
            type="button"
            onClick={onNewGroup}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-lg text-white">
              <FiUsers />
            </span>
            <span className="text-[15px] font-medium text-ink">New group</span>
          </button>
        )}

        <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
          {query ? "Results" : "People on Chat App"}
        </p>

        {loading ? (
          <div className="flex justify-center p-6 text-muted">
            <Spinner />
          </div>
        ) : users.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            {query ? `No one found for "${query}".` : "No one else has joined yet."}
          </p>
        ) : (
          users.map((user) => (
            <UserRow key={user._id} user={user} onClick={() => start(user._id)} />
          ))
        )}
      </div>
    </>
  );
}

export default NewChatPanel;
