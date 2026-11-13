const User = require("../models/User");
const Chat = require("../models/Chat");
const { fail, requireId, escapeRegex, sameId } = require("../utils/http");
const {
  USER_FIELDS,
  publicUser,
  selfUser,
  loadChat,
  serializeChat,
} = require("../utils/serialize");
const { emitToUser, emitToUsers } = require("../utils/realtime");

const MAX_AVATAR_LENGTH = 400_000;

const isValidAvatar = (avatar) =>
  avatar === "" ||
  (typeof avatar === "string" &&
    avatar.length <= MAX_AVATAR_LENGTH &&
    /^data:image\/(png|jpeg|webp|gif);base64,/.test(avatar));

const searchUsers = async (req, res) => {
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";
  const filter = { _id: { $ne: req.user._id } };

  if (search) {
    const pattern = new RegExp(escapeRegex(search.slice(0, 60)), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const users = await User.find(filter)
    .select(USER_FIELDS)
    .sort({ name: 1 })
    .limit(30);

  res.json(users.map(publicUser));
};

const updateProfile = async (req, res) => {
  const { name, about, avatar } = req.body;
  const user = req.user;

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) fail(400, "Name is required");
    if (name.trim().length > 50) {
      fail(400, "Name must be 50 characters or fewer");
    }
    user.name = name.trim();
  }
  if (about !== undefined) {
    if (typeof about !== "string" || about.length > 140) {
      fail(400, "About must be 140 characters or fewer");
    }
    user.about = about.trim();
  }
  if (avatar !== undefined) {
    if (!isValidAvatar(avatar)) fail(400, "That image can't be used");
    user.avatar = avatar;
  }

  await user.save();

  // Let everyone who chats with this user see the new name/photo live.
  const contacts = await Chat.distinct("users", { users: user._id });
  emitToUsers(contacts, "user updated", publicUser(user));

  res.json(selfUser(user));
};

const setBlocked = (blocked) => async (req, res) => {
  const userId = requireId(req.body.userId, "user id");
  if (sameId(userId, req.user._id)) fail(400, "You can't block yourself");
  if (!(await User.exists({ _id: userId }))) fail(404, "User not found");

  const user = await User.findByIdAndUpdate(
    req.user._id,
    blocked
      ? { $addToSet: { blockedUsers: userId } }
      : { $pull: { blockedUsers: userId } },
    { returnDocument: "after" }
  );

  // Refresh the direct chat for both sides so the composer locks/unlocks.
  const chat = await Chat.findOne({
    isGroupChat: false,
    users: { $all: [req.user._id, userId], $size: 2 },
  }).select("_id");

  if (chat) {
    const full = await loadChat(chat._id);
    [String(req.user._id), userId].forEach((id) => {
      emitToUser(id, "chat updated", serializeChat(full, id));
    });
  }

  res.json(selfUser(user));
};

const getBlockedUsers = async (req, res) => {
  const users = await User.find({ _id: { $in: req.user.blockedUsers } })
    .select(USER_FIELDS)
    .sort({ name: 1 });

  res.json(users.map(publicUser));
};

module.exports = {
  searchUsers,
  updateProfile,
  blockUser: setBlocked(true),
  unblockUser: setBlocked(false),
  getBlockedUsers,
  isValidAvatar,
};
