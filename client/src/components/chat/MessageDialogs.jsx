import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiPlus } from "react-icons/fi";
import Modal, { Button } from "../ui/Modal";
import Avatar from "../ui/Avatar";
import EmojiPicker from "../ui/EmojiPicker";
import Spinner from "../ui/Spinner";
import Ticks from "../ui/Ticks";
import { SearchInput } from "../sidebar/PanelHeader";
import { useChat, useToast } from "../../context/contexts";
import { QUICK_REACTIONS } from "../../lib/emoji";
import { chatTitle, messagePreview, otherUserOf, senderId } from "../../lib/format";

// Small floating bar of quick reactions that expands to the full picker.
export function ReactionPopover({ rect, current, onPick, onClose }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    const { offsetWidth: width, offsetHeight: height } = ref.current;
    const margin = 8;
    const left = rect.left + rect.width / 2 - width / 2;
    const top = rect.top - height - 8 < margin ? rect.bottom + 8 : rect.top - height - 8;
    setPosition({
      left: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(top, window.innerHeight - height - margin)),
    });
  }, [rect, expanded]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) onClose();
    };
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[60] animate-pop"
      style={position || { left: 0, top: 0, visibility: "hidden" }}
    >
      {expanded ? (
        <div className="w-80 max-w-[calc(100vw-1rem)]">
          <EmojiPicker onSelect={onPick} />
        </div>
      ) : (
        <div className="flex items-center gap-0.5 rounded-full border border-line bg-panel p-1 shadow-xl">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onPick(emoji)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-2xl transition-transform hover:scale-125 ${
                current === emoji ? "bg-selected" : ""
              }`}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-muted hover:bg-hover"
            aria-label="More emoji"
          >
            <FiPlus />
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}

export function DeleteMessageDialog({ message, me, onClose }) {
  const { removeMessage } = useChat();
  const [busy, setBusy] = useState(false);

  const canDeleteForEveryone =
    senderId(message) === me &&
    !message.deletedForEveryone &&
    message.messageType !== "call";

  const run = async (scope) => {
    setBusy(true);
    await removeMessage(message, scope);
    onClose();
  };

  return (
    <Modal title="Delete message?" onClose={onClose} size="sm">
      <div className="flex flex-col gap-2 p-5">
        {canDeleteForEveryone && (
          <Button variant="danger" disabled={busy} onClick={() => run("everyone")}>
            Delete for everyone
          </Button>
        )}
        <Button variant="outline" disabled={busy} onClick={() => run("me")}>
          Delete for me
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

export function ForwardDialog({ message, onClose }) {
  const { me, chats, forward } = useChat();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  const options = useMemo(() => {
    const term = query.trim().toLowerCase();
    return chats.filter(
      (chat) => !chat.blockedByOther && chatTitle(chat, me).toLowerCase().includes(term),
    );
  }, [chats, me, query]);

  const toggle = (chatId) =>
    setSelected((current) =>
      current.includes(chatId)
        ? current.filter((id) => id !== chatId)
        : current.length < 5
          ? [...current, chatId]
          : current,
    );

  const send = async () => {
    setBusy(true);
    if (await forward([message._id], selected)) {
      toast(`Forwarded to ${selected.length} chat${selected.length === 1 ? "" : "s"}`);
      onClose();
    } else {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Forward message to"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto self-center text-xs text-muted">
            {selected.length}/5 selected
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={selected.length === 0 || busy} onClick={send}>
            {busy && <Spinner className="h-4 w-4" />}
            Forward
          </Button>
        </>
      }
    >
      <div className="p-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search chats"
          autoFocus
        />
      </div>
      <div className="min-h-48 pb-2">
        {options.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted">No chats found.</p>
        )}
        {options.map((chat) => {
          const other = chat.isGroupChat ? null : otherUserOf(chat, me);
          const checked = selected.includes(chat._id);
          return (
            <button
              key={chat._id}
              type="button"
              onClick={() => toggle(chat._id)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover"
            >
              <Avatar
                src={chat.isGroupChat ? chat.avatar : other?.avatar}
                name={chatTitle(chat, me)}
                id={chat.isGroupChat ? chat._id : other?._id}
                group={chat.isGroupChat}
              />
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
                {chatTitle(chat, me)}
              </span>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                  checked ? "border-brand bg-brand text-white" : "border-faint"
                }`}
              >
                {checked && <FiCheck />}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// Who has read / received one of my messages.
export function MessageInfoDialog({ message, chat, me, onClose }) {
  const created = new Date(message.createdAt).getTime();
  const reached = (marks, user) =>
    marks?.[user._id] && new Date(marks[user._id]).getTime() >= created;

  const others = chat.users.filter((user) => user._id !== me);
  const read = others.filter((user) => reached(chat.readAt, user));
  const delivered = others.filter(
    (user) => !read.includes(user) && reached(chat.deliveredAt, user),
  );
  const waiting = others.filter(
    (user) => !read.includes(user) && !delivered.includes(user),
  );

  const group = (title, status, users) =>
    users.length > 0 && (
      <div className="border-t border-line py-2">
        <p className="flex items-center gap-2 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Ticks status={status} /> {title}
        </p>
        {users.map((user) => (
          <div key={user._id} className="flex items-center gap-3 px-5 py-1.5">
            <Avatar src={user.avatar} name={user.name} id={user._id} size="sm" />
            <span className="truncate text-sm text-ink">{user.name}</span>
          </div>
        ))}
      </div>
    );

  return (
    <Modal title="Message info" onClose={onClose} size="sm">
      <p className="mx-5 my-4 line-clamp-3 rounded-xl bg-bubble-out px-3 py-2 text-sm text-white">
        {messagePreview(message, me)}
      </p>
      {group("Read by", "read", read)}
      {group("Delivered to", "delivered", delivered)}
      {group("Not delivered yet", "sent", waiting)}
    </Modal>
  );
}
