import { memo } from "react";
import {
  FiAlertCircle,
  FiChevronDown,
  FiCornerUpLeft,
  FiCornerUpRight,
  FiFile,
  FiPhone,
  FiPhoneMissed,
  FiPlay,
  FiSlash,
  FiSmile,
  FiVideo,
} from "react-icons/fi";
import { FaStar } from "react-icons/fa";
import AudioPlayer from "./AudioPlayer";
import Ticks from "../ui/Ticks";
import Spinner from "../ui/Spinner";
import { fileUrl } from "../../lib/api";
import { isEmojiOnly } from "../../lib/emoji";
import { renderRichText } from "../../lib/richText";
import {
  callText,
  colorFor,
  formatBytes,
  formatDuration,
  formatTime,
  messagePreview,
  senderId,
  systemText,
} from "../../lib/format";

const attachmentSrc = (attachment) => attachment.localUrl || fileUrl(attachment.url);

function UploadOverlay({ message }) {
  if (!message.pending) return null;
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
      <span className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs">
        <Spinner className="h-3.5 w-3.5" />
        {Math.round((message.progress || 0) * 100)}%
      </span>
    </span>
  );
}

function Media({ message, attachment, onOpen }) {
  const video = attachment.mimeType.startsWith("video/");
  const { width, height } = attachment;
  // Reserve the final size up front so the list does not jump on load.
  const ratio = width && height ? Math.min(Math.max(width / height, 0.6), 2.2) : 4 / 3;
  const displayWidth = Math.min(330, Math.max(180, width || 330));

  return (
    <button
      type="button"
      onClick={() => onOpen(message)}
      disabled={message.pending}
      className="relative block max-w-full overflow-hidden rounded-xl bg-black/10"
      style={{ width: displayWidth, aspectRatio: ratio }}
      aria-label={video ? "Play video" : "Open photo"}
    >
      {video ? (
        <>
          <video
            src={`${attachmentSrc(attachment)}#t=0.1`}
            preload="metadata"
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-xl text-white">
              <FiPlay className="translate-x-0.5" />
            </span>
          </span>
          {attachment.duration > 0 && (
            <span className="absolute bottom-1.5 left-2 rounded bg-black/55 px-1.5 text-[11px] text-white">
              {formatDuration(attachment.duration)}
            </span>
          )}
        </>
      ) : (
        <img
          src={attachmentSrc(attachment)}
          alt={attachment.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
      <UploadOverlay message={message} />
    </button>
  );
}

function FileCard({ message, attachment, mine }) {
  const body = (
    <>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${
          mine ? "bg-white/20" : "bg-brand/10 text-brand"
        }`}
      >
        {message.pending ? <Spinner className="h-4 w-4" /> : <FiFile />}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{attachment.name}</span>
        <span className="block text-xs opacity-70">
          {formatBytes(attachment.size)}
          {message.pending ? ` · ${Math.round((message.progress || 0) * 100)}%` : ""}
        </span>
      </span>
    </>
  );
  const className = `flex w-64 max-w-full items-center gap-3 rounded-xl p-2 ${
    mine ? "bg-white/10 hover:bg-white/20" : "bg-soft hover:bg-hover"
  }`;

  if (message.pending || !attachment.url) return <div className={className}>{body}</div>;
  return (
    <a
      href={fileUrl(attachment.url, { download: true })}
      download={attachment.name}
      className={className}
      title="Download"
    >
      {body}
    </a>
  );
}

function ReplyQuote({ reply, mine, me, onJump }) {
  const thumb = reply.attachments?.[0];
  const isImage = thumb?.mimeType?.startsWith("image/") && !reply.deletedForEveryone;

  return (
    <button
      type="button"
      onClick={() => onJump(reply._id)}
      className={`mb-1 flex w-full items-stretch overflow-hidden rounded-lg border-l-4 text-left text-xs ${
        mine ? "border-white/70 bg-white/15" : "border-brand bg-black/5 dark:bg-white/5"
      }`}
    >
      <span className="min-w-0 flex-1 px-2.5 py-1.5">
        <span className={`block font-semibold ${mine ? "" : "text-brand"}`}>
          {senderId(reply) === me ? "You" : reply.sender?.name || "Message"}
        </span>
        <span className="line-clamp-2 opacity-80">{messagePreview(reply, me)}</span>
      </span>
      {isImage && (
        <img
          src={attachmentSrc(thumb)}
          alt=""
          className="h-12 w-12 shrink-0 object-cover"
        />
      )}
    </button>
  );
}

function Reactions({ message, mine, me, onReact }) {
  if (!message.reactions?.length) return null;

  const groups = new Map();
  message.reactions.forEach((reaction) => {
    const group = groups.get(reaction.emoji) || { count: 0, mine: false };
    group.count += 1;
    if (String(reaction.user) === me) group.mine = true;
    groups.set(reaction.emoji, group);
  });

  return (
    <div className={`-mt-1.5 flex flex-wrap gap-1 px-2 ${mine ? "justify-end" : ""}`}>
      {[...groups].map(([emoji, group]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(message, emoji)}
          title={group.mine ? "Remove your reaction" : "React with this too"}
          className={`relative flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs shadow-sm ${
            group.mine
              ? "border-brand bg-selected text-ink"
              : "border-line bg-panel text-muted"
          }`}
        >
          <span className="text-sm leading-none">{emoji}</span>
          {group.count > 1 && <span>{group.count}</span>}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  me,
  isGroup,
  status,
  showName,
  grouped,
  highlighted,
  onMenu,
  onReply,
  onReactClick,
  onReact,
  onOpenMedia,
  onJump,
  onRetry,
  onDiscard,
}) {
  const mine = senderId(message) === me;

  if (message.messageType === "system") {
    return (
      <div className="my-2 flex justify-center px-4" data-mid={message._id}>
        <span className="max-w-[85%] rounded-lg bg-panel/90 px-3 py-1 text-center text-xs text-muted shadow-sm">
          {systemText(message, me)}
        </span>
      </div>
    );
  }

  const deleted = message.deletedForEveryone;
  const isCall = message.messageType === "call";
  const attachment = deleted ? null : message.attachments?.[0];
  const mime = attachment?.mimeType || "";
  const isMedia = mime.startsWith("image/") || mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");
  const jumbo = !attachment && !deleted && !isCall && isEmojiOnly(message.content);
  const interactive = !message.clientId && !deleted;

  const openMenu = (event) => {
    if (message.clientId) return;
    event.preventDefault();
    onMenu(message, { x: event.clientX, y: event.clientY });
  };

  // Invisible spacer that keeps the last line of text clear of the
  // time/ticks, which sit in the bubble's bottom-right corner.
  const metaWidth =
    3.4 + (mine ? 1.2 : 0) + (message.edited ? 2.6 : 0) + (message.starred ? 0.9 : 0);

  const meta = (
    <span
      className={`absolute bottom-1 right-2 flex items-center gap-1 text-[11px] leading-none ${
        mine ? "text-white/80" : "text-muted"
      }`}
    >
      {message.starred && <FaStar className="text-[9px]" title="Starred" />}
      {message.edited && !deleted && <span>Edited</span>}
      <span>{formatTime(message.createdAt)}</span>
      {mine && !deleted && !isCall && (
        <Ticks status={message.pending ? "pending" : status} onBubble />
      )}
    </span>
  );

  let body;
  if (deleted) {
    body = (
      <p className="flex items-center gap-1.5 text-sm italic opacity-75">
        <FiSlash className="shrink-0" />
        {mine ? "You deleted this message" : "This message was deleted"}
        <span className="inline-block" style={{ width: `${metaWidth}rem` }} />
      </p>
    );
  } else if (isCall) {
    const missed = message.call?.status !== "completed";
    const Icon = message.call?.video ? FiVideo : missed ? FiPhoneMissed : FiPhone;
    body = (
      <div className="flex items-center gap-3 pb-3 pr-6">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
            mine
              ? "bg-white/20"
              : missed
                ? "bg-danger/10 text-danger"
                : "bg-brand/10 text-brand"
          }`}
        >
          <Icon />
        </span>
        <span>
          <span className="block text-sm font-medium">{callText(message, me)}</span>
          {message.call?.status === "completed" && (
            <span className="block text-xs opacity-75">
              {formatDuration(message.call.duration)}
            </span>
          )}
        </span>
      </div>
    );
  } else {
    body = (
      <>
        {message.replyTo && (
          <ReplyQuote reply={message.replyTo} mine={mine} me={me} onJump={onJump} />
        )}
        {isMedia && (
          <Media message={message} attachment={attachment} onOpen={onOpenMedia} />
        )}
        {isAudio && (
          <AudioPlayer
            src={attachmentSrc(attachment)}
            duration={attachment.duration}
            mine={mine}
          />
        )}
        {attachment && !isMedia && !isAudio && (
          <FileCard message={message} attachment={attachment} mine={mine} />
        )}
        {message.content ? (
          <p
            className={`whitespace-pre-wrap break-words ${
              jumbo ? "text-4xl leading-tight" : "text-[14.5px] leading-snug"
            } ${attachment ? "mt-1.5 px-1" : ""}`}
            dir="auto"
          >
            {renderRichText(message.content, {
              linkClass: mine ? "text-white" : "text-brand",
            })}
            <span className="inline-block" style={{ width: `${metaWidth}rem` }} />
          </p>
        ) : (
          attachment && !isMedia && <div className="h-3.5" />
        )}
      </>
    );
  }

  const mediaOnly = isMedia && !message.content && !message.replyTo;

  return (
    <div
      data-mid={message._id}
      className={`group flex px-3 sm:px-[5%] ${mine ? "justify-end" : "justify-start"} ${
        grouped ? "mt-0.5" : "mt-2.5"
      } ${highlighted ? "animate-flash" : ""}`}
    >
      <div
        className={`flex min-w-0 max-w-[88%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}
      >
        <div
          className={`flex max-w-full items-center gap-1 ${mine ? "flex-row-reverse" : ""}`}
        >
          <div
            onContextMenu={openMenu}
            className={`relative min-w-0 shadow-sm ${mediaOnly ? "p-1" : "px-2.5 py-1.5"} ${
              mine
                ? `rounded-2xl bg-bubble-out text-white ${grouped ? "" : "rounded-tr-md"}`
                : `rounded-2xl bg-bubble-in text-ink ${grouped ? "" : "rounded-tl-md"}`
            } ${message.failed ? "opacity-80" : ""}`}
          >
            {isGroup && !mine && showName && (
              <p
                className={`mb-0.5 text-[13px] font-semibold ${mediaOnly ? "px-1.5 pt-0.5" : ""}`}
                style={{ color: colorFor(senderId(message)) }}
              >
                {message.sender?.name || "Unknown"}
              </p>
            )}
            {message.forwarded && !deleted && (
              <p
                className={`mb-0.5 flex items-center gap-1 text-xs italic opacity-70 ${mediaOnly ? "px-1.5" : ""}`}
              >
                <FiCornerUpRight /> Forwarded
              </p>
            )}
            {body}
            {mediaOnly ? (
              <span className="absolute bottom-2 right-2.5 flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[11px] leading-none text-white">
                {message.starred && <FaStar className="text-[9px]" />}
                {formatTime(message.createdAt)}
                {mine && <Ticks status={message.pending ? "pending" : status} onBubble />}
              </span>
            ) : (
              meta
            )}
          </div>

          {interactive && (
            <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-60">
              <button
                type="button"
                onClick={(event) =>
                  onReactClick(message, event.currentTarget.getBoundingClientRect())
                }
                className="rounded-full p-1.5 text-muted hover:bg-panel hover:text-ink pointer-coarse:hidden"
                aria-label="React"
                title="React"
              >
                <FiSmile />
              </button>
              <button
                type="button"
                onClick={() => onReply(message)}
                className="rounded-full p-1.5 text-muted hover:bg-panel hover:text-ink pointer-coarse:hidden"
                aria-label="Reply"
                title="Reply"
              >
                <FiCornerUpLeft />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  onMenu(message, { x: rect.left, y: rect.bottom + 4 });
                }}
                className="rounded-full p-1.5 text-muted hover:bg-panel hover:text-ink"
                aria-label="Message options"
                title="More"
              >
                <FiChevronDown />
              </button>
            </div>
          )}
        </div>

        {!deleted && (
          <Reactions message={message} mine={mine} me={me} onReact={onReact} />
        )}

        {message.failed && (
          <p className="mt-1 flex items-center gap-2 text-xs text-danger">
            <FiAlertCircle />
            {message.error || "Not sent."}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => onRetry(message._id)}
            >
              Retry
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => onDiscard(message.chat, message._id)}
            >
              Delete
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(MessageBubble);
