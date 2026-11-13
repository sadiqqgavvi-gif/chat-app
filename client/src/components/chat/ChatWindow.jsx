import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiArrowLeft,
  FiBell,
  FiBellOff,
  FiCopy,
  FiCornerUpLeft,
  FiCornerUpRight,
  FiDownload,
  FiEdit2,
  FiInfo,
  FiLogOut,
  FiMoreVertical,
  FiPhone,
  FiSearch,
  FiSlash,
  FiSmile,
  FiStar,
  FiTrash2,
  FiUploadCloud,
  FiUser,
  FiUsers,
  FiVideo,
  FiXCircle,
} from "react-icons/fi";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import ChatInfoPanel from "./ChatInfoPanel";
import SearchPanel from "./SearchPanel";
import Lightbox from "./Lightbox";
import {
  DeleteMessageDialog,
  ForwardDialog,
  MessageInfoDialog,
  ReactionPopover,
} from "./MessageDialogs";
import Avatar from "../ui/Avatar";
import IconButton from "../ui/IconButton";
import Menu from "../ui/Menu";
import { useChatConfirm } from "./useChatConfirm";
import { useAuth, useCall, useChat, useToast } from "../../context/contexts";
import { fileUrl } from "../../lib/api";
import { chatTitle, formatLastSeen, otherUserOf, senderId } from "../../lib/format";

const toLightboxItem = (message, me) => {
  const attachment = message.attachments[0];
  return {
    id: message._id,
    url: attachment.localUrl || fileUrl(attachment.url),
    downloadUrl: attachment.url ? fileUrl(attachment.url, { download: true }) : null,
    name: attachment.name,
    video: attachment.mimeType.startsWith("video/"),
    caption: message.content,
    sender: senderId(message) === me ? "You" : message.sender?.name || "",
    createdAt: message.createdAt,
  };
};

const isMediaMessage = (message) =>
  !message.deletedForEveryone && ["image", "video"].includes(message.messageType);

function ChatWindow() {
  const { user } = useAuth();
  const { toast, toastError } = useToast();
  const { startCall } = useCall();
  const {
    me,
    selectedChat: chat,
    thread,
    onlineIds,
    typing,
    closeChat,
    setReplyTo,
    setEditing,
    reactTo,
    toggleStar,
    jumpToMessage,
    retryMessage,
    discardMessage,
    setPrefs,
    setBlocked,
  } = useChat();

  const inputRef = useRef(null);
  const dragDepth = useRef(0);

  const [sidePanel, setSidePanel] = useState(null); // "info" | "search"
  const [headerMenu, setHeaderMenu] = useState(null);
  const [messageMenu, setMessageMenu] = useState(null);
  const [reactionFor, setReactionFor] = useState(null);
  const [dialog, setDialog] = useState(null); // { type, message }
  const [lightbox, setLightbox] = useState(null);
  const [askConfirm, confirmDialog] = useChatConfirm();
  const [dragging, setDragging] = useState(false);

  const isGroup = chat.isGroupChat;
  const other = isGroup ? null : otherUserOf(chat, me);
  const title = chatTitle(chat, me);
  const blockedByMe = other && user.blockedUsers?.includes(other._id);
  const canCall = other && !blockedByMe && !chat.blockedByOther;

  const typingIds = typing[chat._id] || [];
  let subtitle;
  if (typingIds.length > 0) {
    const name = chat.users
      .find((item) => item._id === typingIds[0])
      ?.name?.split(" ")[0];
    subtitle = isGroup ? `${name || "Someone"} is typing…` : "typing…";
  } else if (isGroup) {
    subtitle = chat.users
      .map((item) => (item._id === me ? "You" : item.name.split(" ")[0]))
      .join(", ");
  } else if (blockedByMe || chat.blockedByOther) {
    subtitle = "";
  } else {
    subtitle = onlineIds.has(other?._id) ? "online" : formatLastSeen(other?.lastSeen);
  }

  /* ---------------------------- message actions --------------------------- */

  // Read through a ref so the callbacks handed to every bubble stay stable.
  const messagesRef = useRef(thread.messages);
  useEffect(() => {
    messagesRef.current = thread.messages;
  });

  const openMedia = useCallback(
    (message, source) => {
      const list = (source || messagesRef.current).filter(isMediaMessage);
      // Thread order is oldest-first; the shared-media grid is newest-first.
      const ordered = source ? [...list].reverse() : list;
      const index = ordered.findIndex((item) => item._id === message._id);
      if (index !== -1) {
        setLightbox({ items: ordered.map((item) => toLightboxItem(item, me)), index });
      }
    },
    [me],
  );

  const chatId = chat._id;
  const bubbleActions = useMemo(
    () => ({
      onMenu: (message, point) => setMessageMenu({ message, point }),
      onReply: (message) => {
        setEditing(null);
        setReplyTo(message);
      },
      onReactClick: (message, rect) => setReactionFor({ message, rect }),
      onReact: reactTo,
      onJump: (messageId) => jumpToMessage(chatId, messageId),
      onRetry: retryMessage,
      onDiscard: discardMessage,
    }),
    [
      setEditing,
      setReplyTo,
      reactTo,
      jumpToMessage,
      chatId,
      retryMessage,
      discardMessage,
    ],
  );
  const actions = useMemo(
    () => ({ ...bubbleActions, onOpenMedia: (message) => openMedia(message) }),
    [bubbleActions, openMedia],
  );

  const copyMessage = async (message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast("Message copied");
    } catch {
      toastError("Could not copy the message.");
    }
  };

  const messageMenuItems = (message) => {
    const mine = senderId(message) === me;
    const deleted = message.deletedForEveryone;
    const isCall = message.messageType === "call";
    const attachment = message.attachments?.[0];
    const normal = !deleted && !isCall;

    return [
      normal && {
        label: "Reply",
        icon: FiCornerUpLeft,
        onClick: () => bubbleActions.onReply(message),
      },
      normal && {
        label: "React",
        icon: FiSmile,
        onClick: () => {
          const { x, y } = messageMenu.point;
          setReactionFor({ message, rect: { left: x, width: 0, top: y, bottom: y } });
        },
      },
      normal && {
        label: "Forward",
        icon: FiCornerUpRight,
        onClick: () => setDialog({ type: "forward", message }),
      },
      normal &&
        message.content && {
          label: "Copy text",
          icon: FiCopy,
          onClick: () => copyMessage(message),
        },
      normal &&
        attachment?.url && {
          label: "Download",
          icon: FiDownload,
          onClick: () => {
            const link = document.createElement("a");
            link.href = fileUrl(attachment.url, { download: true });
            link.download = attachment.name;
            link.click();
          },
        },
      normal && {
        label: message.starred ? "Unstar" : "Star",
        icon: FiStar,
        onClick: () => toggleStar(message),
      },
      normal &&
        mine &&
        message.messageType !== "voice" && {
          label: "Edit",
          icon: FiEdit2,
          onClick: () => {
            setReplyTo(null);
            setEditing(message);
          },
        },
      normal &&
        mine && {
          label: "Message info",
          icon: FiInfo,
          onClick: () => setDialog({ type: "info", message }),
        },
      {
        label: "Delete",
        icon: FiTrash2,
        danger: true,
        onClick: () => setDialog({ type: "delete", message }),
      },
    ];
  };

  /* ------------------------------ chat actions ---------------------------- */

  const headerMenuItems = [
    {
      label: isGroup ? "Group info" : "Contact info",
      icon: isGroup ? FiUsers : FiUser,
      onClick: () => setSidePanel("info"),
    },
    { label: "Search messages", icon: FiSearch, onClick: () => setSidePanel("search") },
    {
      label: chat.muted ? "Unmute notifications" : "Mute notifications",
      icon: chat.muted ? FiBell : FiBellOff,
      onClick: () => setPrefs(chat._id, { muted: !chat.muted }),
    },
    { label: "Close chat", icon: FiXCircle, onClick: closeChat },
    { divider: true, key: "divider" },
    other && {
      label: blockedByMe ? "Unblock" : "Block",
      icon: FiSlash,
      danger: true,
      onClick: () =>
        blockedByMe ? setBlocked(other._id, false) : askConfirm("block", chat),
    },
    {
      label: "Clear chat",
      icon: FiTrash2,
      danger: true,
      onClick: () => askConfirm("clear", chat),
    },
    {
      label: isGroup ? "Exit group" : "Delete chat",
      icon: isGroup ? FiLogOut : FiTrash2,
      danger: true,
      onClick: () => askConfirm("remove", chat),
    },
  ];

  /* ------------------------------ drag & drop ----------------------------- */

  const hasFiles = (event) => event.dataTransfer?.types?.includes("Files");
  const dragHandlers = {
    onDragEnter: (event) => {
      if (!hasFiles(event)) return;
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragLeave: (event) => {
      if (!hasFiles(event)) return;
      dragDepth.current -= 1;
      if (dragDepth.current <= 0) setDragging(false);
    },
    onDragOver: (event) => {
      if (hasFiles(event)) event.preventDefault();
    },
    onDrop: (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      inputRef.current?.addFiles(event.dataTransfer.files);
    },
  };

  return (
    <div className="flex min-w-0 flex-1">
      <div
        className={`relative min-w-0 flex-1 flex-col ${sidePanel ? "hidden lg:flex" : "flex"}`}
        {...dragHandlers}
      >
        <header className="flex h-16 shrink-0 items-center gap-1 border-b border-line bg-panel px-2">
          <IconButton label="Back to chats" onClick={closeChat} className="md:hidden">
            <FiArrowLeft />
          </IconButton>

          <button
            type="button"
            onClick={() => setSidePanel("info")}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1 text-left hover:bg-hover"
            title={isGroup ? "Group info" : "Contact info"}
          >
            <Avatar
              src={isGroup ? chat.avatar : other?.avatar}
              name={title}
              id={isGroup ? chat._id : other?._id}
              group={isGroup}
              size="sm"
              online={!isGroup && onlineIds.has(other?._id)}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-ink">
                {title}
              </span>
              <span
                className={`block truncate text-xs ${
                  typingIds.length > 0 ? "text-brand" : "text-muted"
                }`}
              >
                {subtitle}
              </span>
            </span>
          </button>

          {canCall && (
            <>
              <IconButton label="Video call" onClick={() => startCall(chat, true)}>
                <FiVideo />
              </IconButton>
              <IconButton label="Voice call" onClick={() => startCall(chat, false)}>
                <FiPhone />
              </IconButton>
            </>
          )}
          <IconButton
            label="Search messages"
            className="hidden sm:inline-flex"
            onClick={() => setSidePanel("search")}
          >
            <FiSearch />
          </IconButton>
          <IconButton
            label="Chat options"
            onClick={(event) =>
              setHeaderMenu(event.currentTarget.getBoundingClientRect())
            }
          >
            <FiMoreVertical />
          </IconButton>
        </header>

        <MessageList chat={chat} actions={actions} />
        <MessageInput ref={inputRef} chat={chat} />

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-brand/90 text-white">
            <FiUploadCloud className="text-5xl" />
            <p className="text-lg font-medium">Drop files to attach them</p>
          </div>
        )}
      </div>

      {sidePanel && (
        <aside className="flex w-full min-w-0 animate-fade-in flex-col border-l border-line bg-panel lg:w-[360px] lg:shrink-0">
          {sidePanel === "info" ? (
            <ChatInfoPanel
              chat={chat}
              onClose={() => setSidePanel(null)}
              onSearch={() => setSidePanel("search")}
              onOpenMedia={openMedia}
            />
          ) : (
            <SearchPanel chat={chat} onClose={() => setSidePanel(null)} />
          )}
        </aside>
      )}

      {headerMenu && (
        <Menu
          anchorRect={headerMenu}
          items={headerMenuItems}
          onClose={() => setHeaderMenu(null)}
        />
      )}
      {messageMenu && (
        <Menu
          point={messageMenu.point}
          items={messageMenuItems(messageMenu.message)}
          onClose={() => setMessageMenu(null)}
        />
      )}
      {reactionFor && (
        <ReactionPopover
          rect={reactionFor.rect}
          current={
            reactionFor.message.reactions?.find((item) => String(item.user) === me)?.emoji
          }
          onPick={(emoji) => {
            reactTo(reactionFor.message, emoji);
            setReactionFor(null);
          }}
          onClose={() => setReactionFor(null)}
        />
      )}

      {dialog?.type === "delete" && (
        <DeleteMessageDialog
          message={dialog.message}
          me={me}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "forward" && (
        <ForwardDialog message={dialog.message} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "info" && (
        <MessageInfoDialog
          message={dialog.message}
          chat={chat}
          me={me}
          onClose={() => setDialog(null)}
        />
      )}
      {lightbox && (
        <Lightbox
          items={lightbox.items}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
      {confirmDialog}
    </div>
  );
}

export default ChatWindow;
