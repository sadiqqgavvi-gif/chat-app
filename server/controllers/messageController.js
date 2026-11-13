const Chat = require("../models/Chat");
const Message = require("../models/Message");
const { fail, requireId, isId, sameId, escapeRegex } = require("../utils/http");
const {
  populateChat,
  populateMessage,
  serializeMessage,
  visibleFilter,
} = require("../utils/serialize");
const { emitToUsers } = require("../utils/realtime");
const { createMessage, isBlockedChat } = require("../utils/messages");

const PAGE_SIZE = 40;
const MAX_CONTENT_LENGTH = 5000;
const MAX_ATTACHMENTS = 10;
const FILE_URL_PATTERN = /^\/api\/files\/[a-f0-9]{24}\/[a-f0-9]{32}$/;

const findMyChat = async (chatId, userId) => {
  requireId(chatId, "chat id");
  const chat = await populateChat(Chat.findOne({ _id: chatId, users: userId }));
  if (!chat) fail(404, "Chat not found");
  return chat;
};

// Loads a message together with its chat, checking that the user is a
// member and can still see the message.
const findMyMessage = async (messageId, userId) => {
  requireId(messageId, "message id");
  const message = await Message.findById(messageId);
  if (!message) fail(404, "Message not found");

  const chat = await Chat.findOne({ _id: message.chat, users: userId });
  const cleared = chat?.clearedAt?.get(String(userId));
  const hidden =
    !chat ||
    message.deletedFor.some((id) => sameId(id, userId)) ||
    (cleared && message.createdAt <= cleared);
  if (hidden) fail(404, "Message not found");

  return { message, chat };
};

const cleanAttachments = (attachments) => {
  if (attachments === undefined) return [];
  if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS) {
    fail(400, `You can attach up to ${MAX_ATTACHMENTS} files`);
  }

  return attachments.map((item) => {
    if (typeof item?.url !== "string" || !FILE_URL_PATTERN.test(item.url)) {
      fail(400, "Invalid attachment");
    }
    const number = (value) =>
      Number.isFinite(value) && value >= 0 ? value : undefined;

    return {
      url: item.url,
      name: String(item.name || "Attachment").slice(0, 200),
      mimeType: String(item.mimeType || "application/octet-stream").slice(0, 100),
      size: number(item.size) || 0,
      duration: number(item.duration),
      width: number(item.width),
      height: number(item.height),
    };
  });
};

const typeFor = (attachments, voice) => {
  const mime = attachments[0]?.mimeType || "";
  if (!mime) return "text";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return voice ? "voice" : "audio";
  return "file";
};

const broadcastUpdate = async (chat, messageId) => {
  const populated = await populateMessage(Message.findById(messageId));
  const payload = serializeMessage(populated);
  emitToUsers(chat.users, "message updated", payload);
  return populated;
};

const sendMessage = async (req, res) => {
  const { chatId, replyTo, clientId, voice } = req.body;
  const content =
    typeof req.body.content === "string" ? req.body.content.trim() : "";
  const attachments = cleanAttachments(req.body.attachments);

  if (!content && attachments.length === 0) {
    fail(400, "Message can't be empty");
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    fail(400, `Messages can be up to ${MAX_CONTENT_LENGTH} characters`);
  }

  const chat = await findMyChat(chatId, req.user._id);
  if (isBlockedChat(chat)) fail(403, "You can't send messages in this chat");

  if (replyTo) {
    requireId(replyTo, "reply id");
    if (!(await Message.exists({ _id: replyTo, chat: chat._id }))) {
      fail(400, "The message you replied to no longer exists");
    }
  }

  const message = await createMessage(
    chat,
    req.user._id,
    {
      content,
      attachments,
      messageType: typeFor(attachments, voice),
      replyTo: replyTo || undefined,
    },
    typeof clientId === "string" ? clientId.slice(0, 64) : undefined
  );

  res.status(201).json(message);
};

const forwardMessages = async (req, res) => {
  const { messageIds, chatIds } = req.body;
  const valid = (list, max) =>
    Array.isArray(list) &&
    list.length > 0 &&
    list.length <= max &&
    list.every(isId);

  if (!valid(messageIds, 30) || !valid(chatIds, 5)) {
    fail(400, "Choose messages and up to 5 chats to forward to");
  }

  const sources = [];
  for (const id of messageIds) {
    const { message } = await findMyMessage(id, req.user._id);
    const forwardable =
      !message.deletedForEveryone &&
      !["system", "call"].includes(message.messageType);
    if (forwardable) sources.push(message);
  }
  if (sources.length === 0) fail(400, "Nothing to forward");
  sources.sort((a, b) => a.createdAt - b.createdAt);

  const chats = [];
  for (const chatId of new Set(chatIds)) {
    const chat = await findMyChat(chatId, req.user._id);
    if (isBlockedChat(chat)) fail(403, "You can't send messages in one of those chats");
    chats.push(chat);
  }

  for (const chat of chats) {
    for (const source of sources) {
      await createMessage(chat, req.user._id, {
        content: source.content,
        attachments: source.attachments.map((item) => item.toObject()),
        messageType: source.messageType,
        forwarded: !sameId(source.sender, req.user._id) || source.forwarded,
      });
    }
  }

  res.status(201).json({ success: true });
};

// Newest page by default; `before` pages backwards. `around` loads from
// a little before the given message up to now, for jumping to a search
// result or a quoted message that is not loaded yet.
const getMessages = async (req, res) => {
  const chat = await findMyChat(req.params.chatId, req.user._id);
  const filter = visibleFilter(chat, req.user._id);
  const { before, around } = req.query;
  const createdAt = { ...filter.createdAt };

  const olderThan = async (date, limit) => {
    const docs = await populateMessage(
      Message.find({ ...filter, createdAt: { ...createdAt, $lt: date } })
        .sort({ createdAt: -1 })
        .limit(limit + 1)
    );
    return { hasMore: docs.length > limit, docs: docs.slice(0, limit).reverse() };
  };

  let page;
  if (isId(around)) {
    const target = await Message.findOne({ ...filter, _id: around });
    if (!target) fail(404, "Message not found");

    const older = await olderThan(target.createdAt, 15);
    const newer = await populateMessage(
      Message.find({
        ...filter,
        createdAt: { ...createdAt, $gte: target.createdAt },
      })
        .sort({ createdAt: 1 })
        .limit(2000)
    );
    page = { hasMore: older.hasMore, docs: [...older.docs, ...newer] };
  } else {
    let date = new Date(8.64e15);
    if (isId(before)) {
      const cursor = await Message.findById(before).select("createdAt");
      if (cursor) date = cursor.createdAt;
    }
    page = await olderThan(date, PAGE_SIZE);
  }

  res.json({
    messages: page.docs.map((doc) => serializeMessage(doc, req.user._id)),
    hasMore: page.hasMore,
  });
};

const searchMessages = async (req, res) => {
  const chat = await findMyChat(req.params.chatId, req.user._id);
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2) return res.json([]);

  const messages = await populateMessage(
    Message.find({
      ...visibleFilter(chat, req.user._id),
      deletedForEveryone: false,
      messageType: { $nin: ["system", "call"] },
      content: new RegExp(escapeRegex(query.slice(0, 80)), "i"),
    })
      .sort({ createdAt: -1 })
      .limit(50)
  );

  res.json(messages.map((doc) => serializeMessage(doc, req.user._id)));
};

const getMedia = async (req, res) => {
  const chat = await findMyChat(req.params.chatId, req.user._id);

  const messages = await populateMessage(
    Message.find({
      ...visibleFilter(chat, req.user._id),
      deletedForEveryone: false,
      messageType: { $in: ["image", "video", "file", "audio"] },
    })
      .sort({ createdAt: -1 })
      .limit(300)
  );

  res.json(messages.map((doc) => serializeMessage(doc, req.user._id)));
};

const getStarred = async (req, res) => {
  const chats = await Chat.find({ users: req.user._id }).select(
    "chatName isGroupChat users clearedAt"
  ).populate("users", "name");
  const byId = new Map(chats.map((chat) => [String(chat._id), chat]));

  const messages = await populateMessage(
    Message.find({
      chat: { $in: chats.map((chat) => chat._id) },
      starredBy: req.user._id,
      deletedFor: { $ne: req.user._id },
      deletedForEveryone: false,
    })
      .sort({ createdAt: -1 })
      .limit(200)
  );

  res.json(
    messages.map((doc) => {
      const chat = byId.get(String(doc.chat));
      const other = chat.users.find((user) => !sameId(user, req.user._id));
      return {
        ...serializeMessage(doc, req.user._id),
        chatTitle: chat.isGroupChat ? chat.chatName : other?.name || "Chat",
      };
    })
  );
};

const editMessage = async (req, res) => {
  const { message, chat } = await findMyMessage(req.params.messageId, req.user._id);
  const content =
    typeof req.body.content === "string" ? req.body.content.trim() : "";

  if (!sameId(message.sender, req.user._id)) fail(403, "Not allowed");
  if (message.deletedForEveryone) fail(400, "Deleted messages can't be edited");
  if (["system", "call", "voice"].includes(message.messageType)) {
    fail(400, "This message can't be edited");
  }
  if (!content && message.attachments.length === 0) {
    fail(400, "Message can't be empty");
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    fail(400, `Messages can be up to ${MAX_CONTENT_LENGTH} characters`);
  }

  if (content !== message.content) {
    message.content = content;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();
  }

  const updated = await broadcastUpdate(chat, message._id);
  res.json(serializeMessage(updated, req.user._id));
};

const reactToMessage = async (req, res) => {
  const { message, chat } = await findMyMessage(req.params.messageId, req.user._id);
  const { emoji } = req.body;

  if (emoji !== null && (typeof emoji !== "string" || !emoji || emoji.length > 16)) {
    fail(400, "Invalid reaction");
  }
  if (message.deletedForEveryone || message.messageType === "system") {
    fail(400, "You can't react to this message");
  }

  // One reaction per person; picking the same emoji again removes it.
  const existing = message.reactions.find((item) =>
    sameId(item.user, req.user._id)
  );
  message.reactions = message.reactions.filter(
    (item) => !sameId(item.user, req.user._id)
  );
  if (emoji && existing?.emoji !== emoji) {
    message.reactions.push({ user: req.user._id, emoji });
  }
  await message.save({ timestamps: false });

  const updated = await broadcastUpdate(chat, message._id);
  res.json(serializeMessage(updated, req.user._id));
};

const starMessage = async (req, res) => {
  const { message } = await findMyMessage(req.params.messageId, req.user._id);
  const starred = Boolean(req.body.starred);

  await Message.updateOne(
    { _id: message._id },
    starred
      ? { $addToSet: { starredBy: req.user._id } }
      : { $pull: { starredBy: req.user._id } },
    { timestamps: false }
  );

  res.json({ _id: String(message._id), starred });
};

const deleteMessage = async (req, res) => {
  const { message, chat } = await findMyMessage(req.params.messageId, req.user._id);

  if (req.query.scope === "everyone") {
    if (!sameId(message.sender, req.user._id)) fail(403, "Not allowed");
    if (["system", "call"].includes(message.messageType)) {
      fail(400, "This message can't be deleted for everyone");
    }

    message.deletedForEveryone = true;
    message.content = "";
    message.attachments = [];
    message.reactions = [];
    message.starredBy = [];
    message.replyTo = undefined;
    message.messageType = "text";
    await message.save({ timestamps: false });
    await broadcastUpdate(chat, message._id);
  } else {
    await Message.updateOne(
      { _id: message._id },
      {
        $addToSet: { deletedFor: req.user._id },
        $pull: { starredBy: req.user._id },
      },
      { timestamps: false }
    );
  }

  res.json({ success: true });
};

module.exports = {
  sendMessage,
  forwardMessages,
  getMessages,
  searchMessages,
  getMedia,
  getStarred,
  editMessage,
  reactToMessage,
  starMessage,
  deleteMessage,
};
