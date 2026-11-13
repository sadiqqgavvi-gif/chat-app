import { useEffect, useRef, useState } from "react";
import {
  FiBell,
  FiBellOff,
  FiCamera,
  FiCheck,
  FiFile,
  FiLogOut,
  FiMessageSquare,
  FiPlay,
  FiSearch,
  FiShield,
  FiSlash,
  FiTrash2,
  FiUserMinus,
  FiUserPlus,
  FiX,
} from "react-icons/fi";
import Avatar from "../ui/Avatar";
import EditableField from "../ui/EditableField";
import IconButton from "../ui/IconButton";
import Menu from "../ui/Menu";
import Modal, { Button } from "../ui/Modal";
import { useChatConfirm } from "./useChatConfirm";
import Spinner from "../ui/Spinner";
import { SearchInput, UserRow } from "../sidebar/PanelHeader";
import { useAuth, useChat, useToast } from "../../context/contexts";
import { errorMessage, fileUrl } from "../../lib/api";
import { useUserSearch } from "../../lib/hooks";
import {
  formatBytes,
  formatLastSeen,
  formatListTime,
  otherUserOf,
} from "../../lib/format";
import { fileToAvatar } from "../../lib/media";
import * as chatApi from "../../services/chatService";
import { fetchMedia } from "../../services/messageService";

function AddMembersDialog({ chat, onClose }) {
  const { upsertChat } = useChat();
  const { toastError } = useToast();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const { users, loading } = useUserSearch(query);

  const memberIds = new Set(chat.users.map((user) => user._id));
  const candidates = users.filter((user) => !memberIds.has(user._id));

  const add = async () => {
    setBusy(true);
    try {
      const response = await chatApi.addMembers(chat._id, picked);
      upsertChat(response.data);
      onClose();
    } catch (err) {
      toastError(errorMessage(err, "Could not add members."));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add members"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={picked.length === 0 || busy} onClick={add}>
            {busy && <Spinner className="h-4 w-4" />}
            Add{picked.length > 0 ? ` (${picked.length})` : ""}
          </Button>
        </>
      }
    >
      <div className="p-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search people"
          autoFocus
        />
      </div>
      <div className="min-h-48 pb-2">
        {loading ? (
          <div className="flex justify-center p-6 text-muted">
            <Spinner />
          </div>
        ) : candidates.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No one to add.</p>
        ) : (
          candidates.map((user) => {
            const checked = picked.includes(user._id);
            return (
              <UserRow
                key={user._id}
                user={user}
                onClick={() =>
                  setPicked((current) =>
                    checked
                      ? current.filter((id) => id !== user._id)
                      : [...current, user._id],
                  )
                }
                right={
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                      checked ? "border-brand bg-brand text-white" : "border-faint"
                    }`}
                  >
                    {checked && <FiCheck />}
                  </span>
                }
              />
            );
          })
        )}
      </div>
    </Modal>
  );
}

function SharedMedia({ chat, onOpenMedia }) {
  const [items, setItems] = useState(null);
  const [tab, setTab] = useState("media");
  const latestId = chat.latestMessage?._id;

  useEffect(() => {
    let active = true;
    fetchMedia(chat._id)
      .then((response) => active && setItems(response.data))
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, [chat._id, latestId]);

  const media = (items || []).filter((message) =>
    ["image", "video"].includes(message.messageType),
  );
  const docs = (items || []).filter(
    (message) => !["image", "video"].includes(message.messageType),
  );
  const list = tab === "media" ? media : docs;

  return (
    <section className="border-b border-line py-4">
      <div className="mb-3 flex gap-2 px-5">
        {[
          ["media", `Media${items ? ` (${media.length})` : ""}`],
          ["docs", `Files${items ? ` (${docs.length})` : ""}`],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1 text-sm ${
              tab === id
                ? "bg-brand/15 font-medium text-brand"
                : "bg-soft text-muted hover:bg-hover"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {items === null ? (
        <div className="flex justify-center py-4 text-muted">
          <Spinner className="h-4 w-4" />
        </div>
      ) : list.length === 0 ? (
        <p className="px-5 text-sm text-muted">
          {tab === "media" ? "No photos or videos shared yet." : "No files shared yet."}
        </p>
      ) : tab === "media" ? (
        <div className="grid max-h-72 grid-cols-3 gap-1 overflow-y-auto px-5">
          {media.map((message) => {
            const attachment = message.attachments[0];
            return (
              <button
                key={message._id}
                type="button"
                onClick={() => onOpenMedia(message, media)}
                className="relative aspect-square overflow-hidden rounded-lg bg-soft"
              >
                {message.messageType === "video" ? (
                  <>
                    <video
                      src={`${fileUrl(attachment.url)}#t=0.1`}
                      preload="metadata"
                      muted
                      className="h-full w-full object-cover"
                    />
                    <FiPlay className="absolute inset-0 m-auto text-xl text-white drop-shadow" />
                  </>
                ) : (
                  <img
                    src={fileUrl(attachment.url)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          {docs.map((message) => {
            const attachment = message.attachments[0];
            return (
              <a
                key={message._id}
                href={fileUrl(attachment.url, { download: true })}
                download={attachment.name}
                className="flex items-center gap-3 px-5 py-2 hover:bg-hover"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <FiFile />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {attachment.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {formatBytes(attachment.size)} · {formatListTime(message.createdAt)}
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ActionRow({ icon: Icon, label, danger = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 px-5 py-3 text-left text-[15px] hover:bg-hover ${
        danger ? "text-danger" : "text-ink"
      }`}
    >
      <Icon className="text-lg" />
      {label}
    </button>
  );
}

function ChatInfoPanel({ chat, onClose, onSearch, onOpenMedia }) {
  const { user } = useAuth();
  const { me, onlineIds, upsertChat, openChatWith, setPrefs, setBlocked } = useChat();
  const { toastError } = useToast();
  const fileRef = useRef(null);

  const [adding, setAdding] = useState(false);
  const [memberMenu, setMemberMenu] = useState(null);
  const [askConfirm, confirmDialog] = useChatConfirm();

  const isGroup = chat.isGroupChat;
  const other = isGroup ? null : otherUserOf(chat, me);
  const isAdmin = isGroup && chat.admins.includes(me);
  const blockedByMe = other && user.blockedUsers?.includes(other._id);

  // Runs a group API call and applies the updated chat it returns.
  const groupAction = async (action, fallback) => {
    try {
      const response = await action();
      if (response.data?._id) upsertChat(response.data);
      return true;
    } catch (err) {
      toastError(errorMessage(err, fallback));
      return false;
    }
  };

  const saveGroup = (changes) =>
    groupAction(
      () => chatApi.updateGroup(chat._id, changes),
      "Could not update the group.",
    );

  const pickIcon = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await saveGroup({ avatar: await fileToAvatar(file) });
    } catch (err) {
      toastError(err.message);
    }
  };

  const memberMenuItems = (member) => {
    const memberIsAdmin = chat.admins.includes(member._id);
    return [
      {
        label: `Message ${member.name.split(" ")[0]}`,
        icon: FiMessageSquare,
        onClick: () => openChatWith(member._id),
      },
      isAdmin && {
        label: memberIsAdmin ? "Dismiss as admin" : "Make group admin",
        icon: FiShield,
        onClick: () =>
          groupAction(
            () => chatApi.setAdmin(chat._id, member._id, !memberIsAdmin),
            "Could not change admin rights.",
          ),
      },
      isAdmin && {
        label: "Remove from group",
        icon: FiUserMinus,
        danger: true,
        onClick: () =>
          groupAction(
            () => chatApi.removeMember(chat._id, member._id),
            "Could not remove this member.",
          ),
      },
    ];
  };

  const members = isGroup
    ? [...chat.users].sort((a, b) => {
        if (a._id === me) return -1;
        if (b._id === me) return 1;
        return (
          chat.admins.includes(b._id) - chat.admins.includes(a._id) ||
          a.name.localeCompare(b.name)
        );
      })
    : [];

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-2">
        <IconButton label="Close" onClick={onClose}>
          <FiX />
        </IconButton>
        <h2 className="text-lg font-semibold text-ink">
          {isGroup ? "Group info" : "Contact info"}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="flex flex-col items-center border-b border-line px-5 py-6 text-center">
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => fileRef.current?.click()}
            className="group relative rounded-full disabled:cursor-default"
            aria-label={isAdmin ? "Change group icon" : undefined}
          >
            <Avatar
              src={isGroup ? chat.avatar : other?.avatar}
              name={isGroup ? chat.chatName : other?.name}
              id={isGroup ? chat._id : other?._id}
              group={isGroup}
              size="2xl"
            />
            {isAdmin && (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <FiCamera className="text-xl" />
                Change icon
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickIcon} />

          {isGroup ? (
            <>
              <div className="mt-3 w-full text-left">
                <EditableField
                  label="Group name"
                  value={chat.chatName}
                  maxLength={60}
                  readOnly={!isAdmin}
                  onSave={(chatName) => (chatName ? saveGroup({ chatName }) : false)}
                />
              </div>
              <p className="text-sm text-muted">Group · {chat.users.length} members</p>
            </>
          ) : (
            <>
              <h3 className="mt-4 text-xl font-semibold text-ink">
                {other?.name || "Unknown user"}
              </h3>
              <p className="text-sm text-muted">{other?.email}</p>
              <p className="mt-1 text-xs text-muted">
                {onlineIds.has(other?._id) ? "online" : formatLastSeen(other?.lastSeen)}
              </p>
            </>
          )}
        </section>

        <section className="border-b border-line px-5 py-4">
          {isGroup ? (
            <EditableField
              label="Description"
              value={chat.description}
              maxLength={300}
              placeholder={isAdmin ? "Add a group description" : "No description"}
              readOnly={!isAdmin}
              onSave={(description) => saveGroup({ description })}
            />
          ) : (
            <>
              <p className="text-xs text-muted">About</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-ink">
                {other?.about || "—"}
              </p>
            </>
          )}
        </section>

        <SharedMedia chat={chat} onOpenMedia={onOpenMedia} />

        <section className="border-b border-line py-2">
          <ActionRow icon={FiSearch} label="Search messages" onClick={onSearch} />
          <ActionRow
            icon={chat.muted ? FiBell : FiBellOff}
            label={chat.muted ? "Unmute notifications" : "Mute notifications"}
            onClick={() => setPrefs(chat._id, { muted: !chat.muted })}
          />
        </section>

        {isGroup && (
          <section className="border-b border-line py-3">
            <p className="px-5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {chat.users.length} members
            </p>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-lg text-white">
                  <FiUserPlus />
                </span>
                <span className="text-[15px] font-medium text-ink">Add members</span>
              </button>
            )}
            {members.map((member) => (
              <UserRow
                key={member._id}
                user={member}
                title={member._id === me ? "You" : member.name}
                onClick={(event) => {
                  if (member._id === me) return;
                  setMemberMenu({
                    member,
                    point: { x: event.clientX, y: event.clientY },
                  });
                }}
                right={
                  chat.admins.includes(member._id) && (
                    <span className="shrink-0 rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-medium text-brand">
                      Admin
                    </span>
                  )
                }
              />
            ))}
          </section>
        )}

        <section className="py-2">
          {other && (
            <ActionRow
              icon={FiSlash}
              danger
              label={blockedByMe ? `Unblock ${other.name}` : `Block ${other.name}`}
              onClick={() =>
                blockedByMe ? setBlocked(other._id, false) : askConfirm("block", chat)
              }
            />
          )}
          <ActionRow
            icon={FiTrash2}
            danger
            label="Clear chat"
            onClick={() => askConfirm("clear", chat)}
          />
          <ActionRow
            icon={isGroup ? FiLogOut : FiTrash2}
            danger
            label={isGroup ? "Exit group" : "Delete chat"}
            onClick={() => askConfirm("remove", chat)}
          />
        </section>
      </div>

      {adding && <AddMembersDialog chat={chat} onClose={() => setAdding(false)} />}
      {memberMenu && (
        <Menu
          point={memberMenu.point}
          items={memberMenuItems(memberMenu.member)}
          onClose={() => setMemberMenu(null)}
        />
      )}
      {confirmDialog}
    </>
  );
}

export default ChatInfoPanel;
