import { useRef, useState } from "react";
import { FiCamera, FiCheck, FiX } from "react-icons/fi";
import PanelHeader, { SearchInput, UserRow } from "./PanelHeader";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import { Button } from "../ui/Modal";
import { useChat, useToast } from "../../context/contexts";
import { useUserSearch } from "../../lib/hooks";
import { fileToAvatar } from "../../lib/media";
import { errorMessage } from "../../lib/api";
import { createGroup } from "../../services/chatService";

function NewGroupPanel({ onBack, onDone }) {
  const { upsertChat, selectChat } = useChat();
  const { toastError } = useToast();
  const fileRef = useRef(null);

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState([]);
  const [creating, setCreating] = useState(false);
  const { users, loading } = useUserSearch(query);

  const toggle = (user) =>
    setMembers((current) =>
      current.some((member) => member._id === user._id)
        ? current.filter((member) => member._id !== user._id)
        : [...current, user],
    );

  const pickAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setAvatar(await fileToAvatar(file));
    } catch (err) {
      toastError(err.message);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const response = await createGroup({
        chatName: name.trim(),
        avatar,
        users: members.map((member) => member._id),
      });
      upsertChat(response.data);
      selectChat(response.data._id);
      onDone();
    } catch (err) {
      toastError(errorMessage(err, "Could not create the group."));
      setCreating(false);
    }
  };

  const ready = name.trim() && members.length > 0 && !creating;

  return (
    <>
      <PanelHeader title="New group" onBack={onBack} />

      <div className="flex items-center gap-3 border-b border-line p-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-soft text-xl text-muted hover:bg-hover"
          aria-label="Choose group icon"
        >
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <FiCamera />
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
        <input
          type="text"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder="Group name"
          autoFocus
          className="min-w-0 flex-1 border-b-2 border-line bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-faint focus:border-brand"
        />
      </div>

      {members.length > 0 && (
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto border-b border-line p-3">
          {members.map((member) => (
            <button
              key={member._id}
              type="button"
              onClick={() => toggle(member)}
              className="flex items-center gap-1.5 rounded-full bg-soft py-1 pl-1 pr-2 text-sm text-ink hover:bg-hover"
            >
              <Avatar src={member.avatar} name={member.name} id={member._id} size="xs" />
              <span className="max-w-28 truncate">{member.name}</span>
              <FiX className="text-muted" />
            </button>
          ))}
        </div>
      )}

      <div className="p-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search people to add"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center p-6 text-muted">
            <Spinner />
          </div>
        ) : users.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">No one found.</p>
        ) : (
          users.map((user) => {
            const selected = members.some((member) => member._id === user._id);
            return (
              <UserRow
                key={user._id}
                user={user}
                onClick={() => toggle(user)}
                right={
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                      selected ? "border-brand bg-brand text-white" : "border-faint"
                    }`}
                  >
                    {selected && <FiCheck />}
                  </span>
                }
              />
            );
          })
        )}
      </div>

      <div className="border-t border-line p-3">
        <Button className="w-full py-2.5" disabled={!ready} onClick={create}>
          {creating && <Spinner className="h-4 w-4" />}
          Create group{members.length > 0 ? ` (${members.length + 1} members)` : ""}
        </Button>
      </div>
    </>
  );
}

export default NewGroupPanel;
