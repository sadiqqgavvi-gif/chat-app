const Chat = require("../models/Chat");
const Message = require("../models/Message");
const User = require("../models/User");
const { fail, requireId, isId, sameId } = require("../utils/http");
const {
  populateChat,
  serializeChat,
  chatForUser,
  loadChat,
  adminIds,
} = require("../utils/serialize");
const {
  emitToUser,
  emitToUsers,
  invalidateMembers,
} = require("../utils/realtime");
const { systemMessage } = require("../utils/messages");
const { isValidAvatar } = require("./userController");

const MAX_GROUP_SIZE = 256;

const findMyChat = async (req, extraFilter = {}) => {
  requireId(req.params.chatId, "chat id");
  const chat = await populateChat(
    Chat.findOne({ _id: req.params.chatId, users: req.user._id, ...extraFilter })
  );
  if (!chat) fail(404, "Chat not found");
  return chat;
};

const requireAdmin = (chat, userId) => {
  if (!adminIds(chat).includes(String(userId))) {
    fail(403, "Only group admins can do this");
  }
};

// Sends every member their own view of the shared chat fields. The
// preview and unread count are left out so clients keep their own.
const broadcastChat = (chat, event = "chat updated") => {
  chat.users.forEach((user) => {
    emitToUser(user._id, event, serializeChat(chat, user._id));
  });
};

const accessChat = async (req, res) => {
  const userId = requireId(req.body.userId, "user id");
  if (sameId(userId, req.user._id)) fail(400, "You can't chat with yourself");
  if (!(await User.exists({ _id: userId }))) fail(404, "User not found");

  let chat = await Chat.findOne({
    isGroupChat: false,
    users: { $all: [req.user._id, userId], $size: 2 },
  });

  let status = 200;
  if (!chat) {
    const now = new Date();
    chat = await Chat.create({
      isGroupChat: false,
      users: [req.user._id, userId],
      readAt: { [req.user._id]: now, [userId]: now },
    });
    status = 201;
  } else if (chat.hiddenFor.some((id) => sameId(id, req.user._id))) {
    chat.hiddenFor.pull(req.user._id);
    await chat.save({ timestamps: false });
  }

  res.status(status).json(await chatForUser(await loadChat(chat._id), req.user._id));
};

const getChats = async (req, res) => {
  const chats = await populateChat(
    Chat.find({ users: req.user._id, hiddenFor: { $ne: req.user._id } })
  );

  res.json(
    await Promise.all(chats.map((chat) => chatForUser(chat, req.user._id)))
  );
};

const getChat = async (req, res) => {
  res.json(await chatForUser(await findMyChat(req), req.user._id));
};

const createGroupChat = async (req, res) => {
  const { chatName, users, avatar = "", description = "" } = req.body;

  if (typeof chatName !== "string" || !chatName.trim()) {
    fail(400, "Group name is required");
  }
  if (!Array.isArray(users) || !users.every(isId)) {
    fail(400, "Choose at least one member");
  }
  if (!isValidAvatar(avatar)) fail(400, "That image can't be used");

  const me = String(req.user._id);
  const memberIds = [...new Set(users)].filter((id) => id !== me);
  if (memberIds.length === 0) fail(400, "Choose at least one member");
  if (memberIds.length + 1 > MAX_GROUP_SIZE) {
    fail(400, `Groups can have up to ${MAX_GROUP_SIZE} members`);
  }

  const found = await User.countDocuments({ _id: { $in: memberIds } });
  if (found !== memberIds.length) fail(400, "Some members were not found");

  const now = new Date();
  const allIds = [me, ...memberIds];
  const created = await Chat.create({
    chatName: chatName.trim().slice(0, 60),
    description: String(description).trim().slice(0, 300),
    avatar,
    isGroupChat: true,
    users: allIds,
    groupAdmin: me,
    admins: [me],
    readAt: Object.fromEntries(allIds.map((id) => [id, now])),
  });

  const chat = await loadChat(created._id);
  for (const user of chat.users) {
    emitToUser(user._id, "chat created", await chatForUser(chat, user._id));
  }
  await systemMessage(chat, me, "created");

  res.status(201).json(await chatForUser(chat, me));
};

const updateGroup = async (req, res) => {
  const chat = await findMyChat(req, { isGroupChat: true });
  requireAdmin(chat, req.user._id);

  const { chatName, description, avatar } = req.body;
  const events = [];

  if (chatName !== undefined) {
    if (typeof chatName !== "string" || !chatName.trim()) {
      fail(400, "Group name is required");
    }
    const next = chatName.trim().slice(0, 60);
    if (next !== chat.chatName) {
      chat.chatName = next;
      events.push(["renamed", { text: next }]);
    }
  }
  if (description !== undefined) {
    const next = String(description).trim().slice(0, 300);
    if (next !== chat.description) {
      chat.description = next;
      events.push(["description"]);
    }
  }
  if (avatar !== undefined) {
    if (!isValidAvatar(avatar)) fail(400, "That image can't be used");
    if (avatar !== chat.avatar) {
      chat.avatar = avatar;
      events.push(["icon"]);
    }
  }

  await chat.save();
  broadcastChat(chat);
  for (const [kind, extra] of events) {
    await systemMessage(chat, req.user._id, kind, extra);
  }

  res.json(serializeChat(chat, req.user._id));
};

const addMembers = async (req, res) => {
  const chat = await findMyChat(req, { isGroupChat: true });
  requireAdmin(chat, req.user._id);

  const { userIds } = req.body;
  if (!Array.isArray(userIds) || !userIds.every(isId)) {
    fail(400, "Choose at least one member");
  }

  const existing = new Set(chat.users.map((user) => String(user._id)));
  const newIds = [...new Set(userIds)].filter((id) => !existing.has(id));
  if (newIds.length === 0) fail(400, "Those people are already in the group");
  if (existing.size + newIds.length > MAX_GROUP_SIZE) {
    fail(400, `Groups can have up to ${MAX_GROUP_SIZE} members`);
  }

  const found = await User.countDocuments({ _id: { $in: newIds } });
  if (found !== newIds.length) fail(400, "Some members were not found");

  // New members start with an empty history, like joining a room.
  const now = new Date();
  const set = {};
  newIds.forEach((id) => {
    set[`clearedAt.${id}`] = now;
    set[`readAt.${id}`] = now;
  });

  await Chat.updateOne(
    { _id: chat._id },
    { $addToSet: { users: { $each: newIds } }, $set: set }
  );
  invalidateMembers(chat._id);

  const updated = await loadChat(chat._id);
  for (const user of updated.users) {
    const isNew = newIds.includes(String(user._id));
    emitToUser(
      user._id,
      isNew ? "chat created" : "chat updated",
      isNew
        ? await chatForUser(updated, user._id)
        : serializeChat(updated, user._id)
    );
  }
  await systemMessage(updated, req.user._id, "added", { targets: newIds });

  res.json(serializeChat(updated, req.user._id));
};

// Shared by "remove member" and "exit group".
const removeMember = async (chat, actorId, targetId) => {
  const leaving = sameId(actorId, targetId);
  const remaining = chat.users
    .map((user) => String(user._id))
    .filter((id) => id !== String(targetId));

  if (remaining.length === 0) {
    await Message.deleteMany({ chat: chat._id });
    await Chat.deleteOne({ _id: chat._id });
    invalidateMembers(chat._id);
    emitToUser(targetId, "chat removed", String(chat._id));
    return null;
  }

  let admins = adminIds(chat).filter((id) => id !== String(targetId));
  if (admins.length === 0) admins = [remaining[0]];

  // The event is written while the member is still in the group, so the
  // person leaving sees it too before the chat disappears for them.
  await systemMessage(chat, actorId, leaving ? "left" : "removed", {
    targets: leaving ? [] : [targetId],
  });

  await Chat.updateOne(
    { _id: chat._id },
    {
      $set: { users: remaining, admins },
      $pull: {
        pinnedBy: targetId,
        archivedBy: targetId,
        mutedBy: targetId,
        unreadBy: targetId,
      },
      $unset: {
        [`readAt.${targetId}`]: "",
        [`deliveredAt.${targetId}`]: "",
        [`clearedAt.${targetId}`]: "",
      },
    }
  );
  invalidateMembers(chat._id);

  const updated = await loadChat(chat._id);
  broadcastChat(updated);
  emitToUser(targetId, "chat removed", String(chat._id));
  return updated;
};

const removeFromGroup = async (req, res) => {
  const chat = await findMyChat(req, { isGroupChat: true });
  const userId = requireId(req.body.userId, "user id");

  if (!sameId(userId, req.user._id)) requireAdmin(chat, req.user._id);
  if (!chat.users.some((user) => sameId(user, userId))) {
    fail(404, "That person is not in this group");
  }

  const updated = await removeMember(chat, req.user._id, userId);
  res.json(updated ? serializeChat(updated, req.user._id) : { removed: true });
};

const leaveGroup = async (req, res) => {
  const chat = await findMyChat(req, { isGroupChat: true });
  await removeMember(chat, req.user._id, req.user._id);
  res.json({ success: true });
};

const setAdmin = async (req, res) => {
  const chat = await findMyChat(req, { isGroupChat: true });
  requireAdmin(chat, req.user._id);

  const userId = requireId(req.body.userId, "user id");
  if (!chat.users.some((user) => sameId(user, userId))) {
    fail(404, "That person is not in this group");
  }

  const makeAdmin = Boolean(req.body.admin);
  const admins = new Set(adminIds(chat));
  if (makeAdmin === admins.has(userId)) {
    return res.json(serializeChat(chat, req.user._id));
  }

  if (makeAdmin) admins.add(userId);
  else admins.delete(userId);
  if (admins.size === 0) fail(400, "A group needs at least one admin");

  chat.admins = [...admins];
  await chat.save();
  broadcastChat(chat);
  await systemMessage(chat, req.user._id, makeAdmin ? "promoted" : "demoted", {
    targets: [userId],
  });

  res.json(serializeChat(chat, req.user._id));
};

const PREF_FIELDS = {
  pinned: "pinnedBy",
  archived: "archivedBy",
  muted: "mutedBy",
  markedUnread: "unreadBy",
};

const updatePrefs = async (req, res) => {
  const chat = await findMyChat(req);
  const update = { $addToSet: {}, $pull: {} };

  Object.entries(PREF_FIELDS).forEach(([pref, field]) => {
    if (typeof req.body[pref] !== "boolean") return;
    update[req.body[pref] ? "$addToSet" : "$pull"][field] = req.user._id;
  });
  // Archived chats are not shown among pinned ones.
  if (req.body.archived === true) update.$pull.pinnedBy = req.user._id;

  Object.keys(update).forEach((op) => {
    if (Object.keys(update[op]).length === 0) delete update[op];
  });
  if (Object.keys(update).length > 0) {
    await Chat.updateOne({ _id: chat._id }, update, { timestamps: false });
  }

  const payload = serializeChat(await loadChat(chat._id), req.user._id);
  emitToUser(req.user._id, "chat updated", payload);
  res.json(payload);
};

const markRead = async (req, res) => {
  const chat = await findMyChat(req);
  const me = String(req.user._id);
  const now = new Date();

  await Chat.updateOne(
    { _id: chat._id },
    {
      $set: { [`readAt.${me}`]: now, [`deliveredAt.${me}`]: now },
      $pull: { unreadBy: req.user._id },
    },
    { timestamps: false }
  );

  emitToUsers(chat.users, "chat receipt", {
    chatId: String(chat._id),
    readAt: { [me]: now },
    deliveredAt: { [me]: now },
  });

  res.json({ success: true });
};

const clearChat = async (req, res) => {
  const chat = await findMyChat(req);
  const me = String(req.user._id);
  const now = new Date();

  await Chat.updateOne(
    { _id: chat._id },
    { $set: { [`clearedAt.${me}`]: now, [`readAt.${me}`]: now } },
    { timestamps: false }
  );
  await Message.updateMany(
    { chat: chat._id, starredBy: req.user._id },
    { $pull: { starredBy: req.user._id } }
  );

  emitToUser(me, "chat cleared", String(chat._id));
  res.json({ success: true });
};

// Removes a direct chat from the user's list. It comes back, with empty
// history, as soon as either side sends a new message.
const deleteChat = async (req, res) => {
  const chat = await findMyChat(req);
  if (chat.isGroupChat) fail(400, "Exit the group to remove it");

  const me = String(req.user._id);
  const now = new Date();

  await Chat.updateOne(
    { _id: chat._id },
    {
      $set: { [`clearedAt.${me}`]: now, [`readAt.${me}`]: now },
      $addToSet: { hiddenFor: req.user._id },
      $pull: {
        pinnedBy: req.user._id,
        archivedBy: req.user._id,
        unreadBy: req.user._id,
      },
    },
    { timestamps: false }
  );
  await Message.updateMany(
    { chat: chat._id, starredBy: req.user._id },
    { $pull: { starredBy: req.user._id } }
  );

  emitToUser(me, "chat removed", String(chat._id));
  res.json({ success: true });
};

module.exports = {
  accessChat,
  getChats,
  getChat,
  createGroupChat,
  updateGroup,
  addMembers,
  removeFromGroup,
  leaveGroup,
  setAdmin,
  updatePrefs,
  markRead,
  clearChat,
  deleteChat,
};
