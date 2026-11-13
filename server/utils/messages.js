const Chat = require("../models/Chat");
const Message = require("../models/Message");
const { sameId } = require("./http");
const { populateMessage, serializeMessage } = require("./serialize");
const { isOnline, emitToUsers } = require("./realtime");

// Single place where messages are born: stores the message, moves the
// chat's watermarks and tells every member about it. Used for user
// messages, forwards, group events and call logs alike.
const createMessage = async (chat, senderId, fields, clientId) => {
  const message = await Message.create({
    ...fields,
    chat: chat._id,
    sender: senderId,
  });

  const now = message.createdAt;
  const sender = String(senderId);
  const delivered = { [sender]: now };

  chat.users.forEach((user) => {
    const id = String(user._id || user);
    if (id !== sender && isOnline(id)) delivered[id] = now;
  });

  const set = {
    latestMessage: message._id,
    hiddenFor: [],
    [`readAt.${sender}`]: now,
  };
  Object.keys(delivered).forEach((id) => {
    set[`deliveredAt.${id}`] = now;
  });

  await Chat.updateOne(
    { _id: chat._id },
    { $set: set, $pull: { unreadBy: senderId } }
  );

  const populated = await populateMessage(Message.findById(message._id));
  const payload = serializeMessage(populated, senderId);
  const chatId = String(chat._id);

  emitToUsers(chat.users, "message new", { message: payload, clientId });
  emitToUsers(chat.users, "chat receipt", {
    chatId,
    readAt: { [sender]: now },
    deliveredAt: delivered,
  });

  return payload;
};

const systemMessage = (chat, actorId, kind, extra = {}) =>
  createMessage(chat, actorId, {
    messageType: "system",
    system: { kind, ...extra },
  });

// Direct chats are closed in both directions once either side blocks.
const isBlockedChat = (populatedChat) => {
  if (populatedChat.isGroupChat || populatedChat.users.length !== 2) {
    return false;
  }
  const [a, b] = populatedChat.users;
  return (
    (a.blockedUsers || []).some((id) => sameId(id, b)) ||
    (b.blockedUsers || []).some((id) => sameId(id, a))
  );
};

module.exports = { createMessage, systemMessage, isBlockedChat };
