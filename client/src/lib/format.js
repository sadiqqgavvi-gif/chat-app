// Small pure helpers shared across the UI.

export const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const AVATAR_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#0d9488",
  "#16a34a",
  "#ca8a04",
  "#0891b2",
  "#9333ea",
  "#e11d48",
];

// Stable colour per user/chat id, used for avatars and group sender names.
export const colorFor = (id = "") => {
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const daysAgo = (date) =>
  Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);

export const formatTime = (value) =>
  new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// "Today" / "Yesterday" / "Monday" / "12 Mar 2026" for day separators.
export const formatDay = (value) => {
  const date = new Date(value);
  const days = daysAgo(date);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Compact timestamp for the chat list.
export const formatListTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const days = daysAgo(date);
  if (days === 0) return formatTime(date);
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  });
};

export const formatLastSeen = (value) => {
  if (!value) return "offline";
  const date = new Date(value);
  const days = daysAgo(date);
  const time = formatTime(date);
  if (days === 0) return `last seen today at ${time}`;
  if (days === 1) return `last seen yesterday at ${time}`;
  if (days < 7) {
    return `last seen ${date.toLocaleDateString([], { weekday: "long" })} at ${time}`;
  }
  return `last seen ${date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`;
};

export const formatDuration = (seconds = 0) => {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
};

export const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const isSameDay = (a, b) => startOfDay(new Date(a)) === startOfDay(new Date(b));

export const senderId = (message) =>
  String(message?.sender?._id || message?.sender || "");

export const otherUserOf = (chat, meId) => chat?.users?.find((user) => user._id !== meId);

export const chatTitle = (chat, meId) =>
  chat.isGroupChat
    ? chat.chatName || "Group"
    : otherUserOf(chat, meId)?.name || "Unknown user";

const firstName = (name = "") => name.split(" ")[0];

// Text for group events such as "Ali added Sara".
export const systemText = (message, meId) => {
  const actorId = senderId(message);
  const actor = actorId === meId ? "You" : message.sender?.name || "Someone";
  const targets = (message.system?.targets || [])
    .map((user) => (user._id === meId ? "you" : user.name || "someone"))
    .join(", ");

  switch (message.system?.kind) {
    case "created":
      return `${actor} created this group`;
    case "added":
      return `${actor} added ${targets}`;
    case "removed":
      return `${actor} removed ${targets}`;
    case "left":
      return `${actor} left`;
    case "renamed":
      return `${actor} changed the group name to "${message.system.text}"`;
    case "description":
      return `${actor} changed the group description`;
    case "icon":
      return `${actor} changed the group icon`;
    case "promoted":
      return `${actor} made ${targets} an admin`;
    case "demoted":
      return `${actor} removed ${targets} as admin`;
    default:
      return "Group updated";
  }
};

export const callText = (message, meId) => {
  const outgoing = senderId(message) === meId;
  const kind = message.call?.video ? "video" : "voice";
  switch (message.call?.status) {
    case "completed":
      return `${outgoing ? "Outgoing" : "Incoming"} ${kind} call`;
    case "declined":
      return outgoing ? `Declined ${kind} call` : `Missed ${kind} call`;
    default:
      return outgoing ? `Unanswered ${kind} call` : `Missed ${kind} call`;
  }
};

// One-line summary of a message for the chat list, replies and toasts.
export const messagePreview = (message, meId) => {
  if (!message) return "";
  if (message.deletedForEveryone) {
    return senderId(message) === meId
      ? "You deleted this message"
      : "This message was deleted";
  }
  if (message.messageType === "system") return systemText(message, meId);
  if (message.messageType === "call") return `📞 ${callText(message, meId)}`;

  const attachment = message.attachments?.[0];
  const mime = attachment?.mimeType || "";
  const caption = message.content;

  if (mime.startsWith("image/")) return `📷 ${caption || "Photo"}`;
  if (mime.startsWith("video/")) return `🎥 ${caption || "Video"}`;
  if (mime.startsWith("audio/")) {
    return message.messageType === "voice"
      ? `🎤 Voice message${attachment.duration ? ` (${formatDuration(attachment.duration)})` : ""}`
      : `🎵 ${caption || attachment.name || "Audio"}`;
  }
  if (attachment) return `📄 ${caption || attachment.name || "Document"}`;
  return caption || "";
};

// Chat-list preview, prefixed with the sender in groups.
export const chatPreview = (chat, meId) => {
  const message = chat.latestMessage;
  if (!message) {
    return chat.isGroupChat ? "Group created" : "Tap to start chatting";
  }

  const text = messagePreview(message, meId);
  const plain =
    message.deletedForEveryone || ["system", "call"].includes(message.messageType);
  if (plain) return text;

  if (senderId(message) === meId) return text;
  return chat.isGroupChat
    ? `${firstName(message.sender?.name) || "Someone"}: ${text}`
    : text;
};

// "sent" | "delivered" | "read" for one of my own messages, derived from
// the other members' watermarks on the chat.
export const receiptStatus = (message, chat, meId) => {
  const others = (chat?.users || []).filter((user) => user._id !== meId);
  if (others.length === 0) return "sent";

  const created = new Date(message.createdAt).getTime();
  const reached = (marks) =>
    others.every((user) => {
      const mark = marks?.[user._id];
      return mark && new Date(mark).getTime() >= created;
    });

  if (reached(chat.readAt) || message.read) return "read";
  if (reached(chat.deliveredAt) || message.delivered) return "delivered";
  return "sent";
};

export const sortChats = (chats) =>
  [...chats].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const time = (chat) =>
      new Date(chat.latestMessage?.createdAt || chat.updatedAt || 0).getTime();
    return time(b) - time(a);
  });
