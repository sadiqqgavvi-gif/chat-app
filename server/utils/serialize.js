const Chat = require("../models/Chat");
const Message = require("../models/Message");
const { sameId } = require("./http");

const USER_FIELDS = "name email avatar about lastSeen";

const publicUser = (user) => ({
  _id: String(user._id),
  name: user.name,
  email: user.email,
  avatar: user.avatar || "",
  about: user.about || "",
  lastSeen: user.lastSeen || null,
});

// Shape returned to the signed-in user about themselves.
const selfUser = (user) => ({
  ...publicUser(user),
  id: String(user._id),
  blockedUsers: (user.blockedUsers || []).map(String),
});

const populateChat = (query) =>
  query.populate("users", `${USER_FIELDS} blockedUsers`);

const populateMessage = (query) =>
  query
    .populate("sender", "name avatar")
    .populate({
      path: "replyTo",
      select: "content messageType attachments sender deletedForEveryone",
      populate: { path: "sender", select: "name" },
    })
    .populate("system.targets", "name");

const serializeMessage = (doc, me) => {
  const message = doc.toObject ? doc.toObject() : { ...doc };
  message.chat = String(message.chat?._id || message.chat);
  if (me) {
    message.starred = (message.starredBy || []).some((id) => sameId(id, me));
  }
  delete message.starredBy;
  delete message.deletedFor;
  delete message.__v;
  return message;
};

const adminIds = (chat) => {
  const admins = (chat.admins || []).map((id) => String(id._id || id));
  if (admins.length === 0 && chat.groupAdmin) {
    admins.push(String(chat.groupAdmin._id || chat.groupAdmin));
  }
  return admins;
};

// Turns a populated chat document into what one particular user should
// see: shared fields plus that user's own flags (pinned, muted, ...).
const serializeChat = (doc, me, extra = {}) => {
  const chat = doc.toObject ? doc.toObject({ flattenMaps: true }) : doc;
  const mine = (list) => (list || []).some((id) => sameId(id, me));

  const out = {
    _id: String(chat._id),
    chatName: chat.chatName,
    isGroupChat: chat.isGroupChat,
    description: chat.description || "",
    avatar: chat.avatar || "",
    users: chat.users.map(publicUser),
    admins: adminIds(chat),
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    readAt: chat.readAt || {},
    deliveredAt: chat.deliveredAt || {},
    pinned: mine(chat.pinnedBy),
    archived: mine(chat.archivedBy),
    muted: mine(chat.mutedBy),
    markedUnread: mine(chat.unreadBy),
    ...extra,
  };

  if (!chat.isGroupChat) {
    const other = chat.users.find((user) => !sameId(user, me));
    out.blockedByOther = Boolean(
      other?.blockedUsers?.some((id) => sameId(id, me))
    );
  }

  return out;
};

const visibleFilter = (chat, me) => {
  const filter = { chat: chat._id, deletedFor: { $ne: me } };
  const cleared = chat.clearedAt?.get(String(me));
  if (cleared) filter.createdAt = { $gt: cleared };
  return filter;
};

const latestVisibleMessage = async (chat, me) => {
  const message = await populateMessage(
    Message.findOne(visibleFilter(chat, me)).sort({ createdAt: -1 })
  );
  return message ? serializeMessage(message, me) : null;
};

const countUnread = (chat, me) => {
  const key = String(me);
  const since = Math.max(
    chat.readAt?.get(key)?.getTime() || 0,
    chat.clearedAt?.get(key)?.getTime() || 0
  );

  return Message.countDocuments({
    chat: chat._id,
    sender: { $ne: me },
    messageType: { $ne: "system" },
    deletedFor: { $ne: me },
    createdAt: { $gt: new Date(since) },
  });
};

// Full chat payload for one user, including preview and unread count.
const chatForUser = async (chat, me) => {
  const [latestMessage, unreadCount] = await Promise.all([
    latestVisibleMessage(chat, me),
    countUnread(chat, me),
  ]);
  return serializeChat(chat, me, { latestMessage, unreadCount });
};

const loadChat = (chatId) => populateChat(Chat.findById(chatId));

module.exports = {
  USER_FIELDS,
  publicUser,
  selfUser,
  populateChat,
  populateMessage,
  serializeMessage,
  serializeChat,
  adminIds,
  visibleFilter,
  chatForUser,
  loadChat,
};
