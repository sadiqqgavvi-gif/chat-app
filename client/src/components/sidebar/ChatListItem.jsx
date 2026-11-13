import { memo } from "react";
import { FiBellOff, FiChevronDown } from "react-icons/fi";
import { BsPinAngleFill } from "react-icons/bs";
import Avatar from "../ui/Avatar";
import Ticks from "../ui/Ticks";
import {
  chatPreview,
  chatTitle,
  formatListTime,
  otherUserOf,
  receiptStatus,
  senderId,
} from "../../lib/format";

function ChatListItem({ chat, me, selected, online, typingNames, onSelect, onMenu }) {
  const other = chat.isGroupChat ? null : otherUserOf(chat, me);
  const latest = chat.latestMessage;
  const unread = chat.unreadCount || 0;
  const highlighted = unread > 0 || chat.markedUnread;

  const showTicks =
    latest &&
    senderId(latest) === me &&
    !latest.deletedForEveryone &&
    !["system", "call"].includes(latest.messageType);

  const openMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onMenu(chat, event);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(chat._id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect(chat._id);
      }}
      onContextMenu={openMenu}
      className={`group flex cursor-pointer items-center gap-3 px-3 py-2.5 outline-none transition-colors focus-visible:bg-hover ${
        selected ? "bg-selected" : "hover:bg-hover"
      }`}
    >
      <Avatar
        src={chat.isGroupChat ? chat.avatar : other?.avatar}
        name={chatTitle(chat, me)}
        id={chat.isGroupChat ? chat._id : other?._id}
        group={chat.isGroupChat}
        size="lg"
        online={online}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-medium text-ink">
            {chatTitle(chat, me)}
          </span>
          <span
            className={`shrink-0 text-xs ${
              highlighted ? "font-medium text-brand" : "text-muted"
            }`}
          >
            {formatListTime(latest?.createdAt)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5">
          <p
            className={`flex min-w-0 flex-1 items-center gap-1 text-sm ${
              highlighted ? "text-ink" : "text-muted"
            }`}
          >
            {typingNames ? (
              <span className="truncate text-brand">{typingNames}</span>
            ) : (
              <>
                {showTicks && (
                  <span className="shrink-0">
                    <Ticks
                      status={
                        latest.pending ? "pending" : receiptStatus(latest, chat, me)
                      }
                    />
                  </span>
                )}
                <span
                  className={`truncate ${latest?.deletedForEveryone ? "italic" : ""}`}
                >
                  {chatPreview(chat, me)}
                </span>
              </>
            )}
          </p>

          {chat.muted && (
            <FiBellOff className="shrink-0 text-xs text-faint" title="Muted" />
          )}
          {chat.pinned && (
            <BsPinAngleFill className="shrink-0 text-xs text-faint" title="Pinned" />
          )}
          {highlighted && (
            <span
              className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white ${
                chat.muted ? "bg-faint" : "bg-brand"
              }`}
              aria-label={unread > 0 ? `${unread} unread messages` : "Marked as unread"}
            >
              {unread > 0 ? (unread > 99 ? "99+" : unread) : ""}
            </span>
          )}
          <button
            type="button"
            onClick={openMenu}
            aria-label="Chat options"
            className="hidden shrink-0 rounded text-muted hover:text-ink group-hover:block pointer-coarse:hidden"
          >
            <FiChevronDown />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ChatListItem);
