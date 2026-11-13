const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const Chat = require("../models/Chat");
const User = require("../models/User");
const { sameId, isId } = require("./http");

let io;

// userId -> Set of socket ids. A user is online while the set is non-empty.
const sockets = new Map();
// chatId -> { users, expires }. Saves a query on every typing event.
const memberCache = new Map();
// callId -> call state (see registerCallHandlers).
const calls = new Map();

const RING_TIMEOUT_MS = 40_000;
const room = (userId) => `user:${userId}`;

const isOnline = (userId) => sockets.has(String(userId));

const emitToUser = (userId, event, payload) => {
  io?.to(room(userId)).emit(event, payload);
};

const emitToUsers = (userIds, event, payload) => {
  userIds.forEach((id) => emitToUser(id._id || id, event, payload));
};

const getMembers = async (chatId) => {
  const cached = memberCache.get(chatId);
  if (cached && cached.expires > Date.now()) return cached.users;

  const chat = await Chat.findById(chatId).select("users");
  const users = chat ? chat.users.map(String) : [];
  memberCache.set(chatId, { users, expires: Date.now() + 30_000 });
  return users;
};

const invalidateMembers = (chatId) => memberCache.delete(String(chatId));

// Everyone who shares at least one chat with this user.
const getContactIds = async (userId) => {
  const ids = await Chat.distinct("users", { users: userId });
  return ids.map(String).filter((id) => id !== String(userId));
};

// Coming online means every message waiting for this user is delivered.
const markAllDelivered = async (userId) => {
  const now = new Date();
  const key = `deliveredAt.${userId}`;
  const chats = await Chat.find({
    users: userId,
    $expr: { $gt: ["$updatedAt", { $ifNull: [`$${key}`, new Date(0)] }] },
  }).select("users");

  if (chats.length === 0) return;

  await Chat.updateMany(
    { _id: { $in: chats.map((chat) => chat._id) } },
    { $set: { [key]: now } },
    { timestamps: false }
  );

  chats.forEach((chat) => {
    emitToUsers(chat.users, "chat receipt", {
      chatId: String(chat._id),
      deliveredAt: { [userId]: now },
    });
  });
};

const endCall = async (call, reason, endedBy) => {
  if (!calls.delete(call.id)) return;
  clearTimeout(call.ringTimer);

  emitToUser(call.caller, "call:ended", { callId: call.id, reason });
  emitToUser(call.callee, "call:ended", { callId: call.id, reason });

  const status = call.answeredAt
    ? "completed"
    : sameId(endedBy, call.callee)
    ? "declined"
    : "missed";

  try {
    const { createMessage } = require("./messages");
    const chat = await Chat.findById(call.chatId);
    if (!chat) return;

    await createMessage(chat, call.caller, {
      messageType: "call",
      call: {
        video: call.video,
        status,
        duration: call.answeredAt
          ? Math.round((Date.now() - call.answeredAt) / 1000)
          : 0,
      },
    });
  } catch (err) {
    console.error("Could not log call:", err.message);
  }
};

const isBusy = (userId) =>
  [...calls.values()].some(
    (call) => sameId(call.caller, userId) || sameId(call.callee, userId)
  );

// One-to-one WebRTC calls. The server only relays signalling between the
// two peers and writes a call-log message when the call finishes.
const registerCallHandlers = (socket, userId) => {
  socket.on("call:invite", async (data, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    try {
      const { callId, chatId, video, offer } = data || {};
      if (!isId(chatId) || typeof callId !== "string" || !offer) {
        return reply({ error: "invalid" });
      }

      const chat = await Chat.findOne({
        _id: chatId,
        users: userId,
        isGroupChat: false,
      }).populate("users", "name avatar blockedUsers");
      if (!chat || chat.users.length !== 2) return reply({ error: "invalid" });

      const me = chat.users.find((user) => sameId(user, userId));
      const other = chat.users.find((user) => !sameId(user, userId));
      const blocked =
        me.blockedUsers.some((id) => sameId(id, other)) ||
        other.blockedUsers.some((id) => sameId(id, me));
      if (blocked) return reply({ error: "blocked" });
      if (calls.has(callId) || isBusy(userId)) return reply({ error: "invalid" });

      const call = {
        id: callId,
        chatId,
        video: Boolean(video),
        caller: userId,
        callee: String(other._id),
        callerSid: socket.id,
        calleeSid: null,
        answeredAt: null,
      };

      if (!isOnline(call.callee) || isBusy(call.callee)) {
        const error = isOnline(call.callee) ? "busy" : "offline";
        calls.set(callId, call);
        await endCall(call, error, userId);
        return reply({ error });
      }

      call.ringTimer = setTimeout(
        () => endCall(call, "no_answer", userId),
        RING_TIMEOUT_MS
      );
      calls.set(callId, call);

      emitToUser(call.callee, "call:incoming", {
        callId,
        chatId,
        video: call.video,
        offer,
        from: { _id: userId, name: me.name, avatar: me.avatar },
      });
      reply({ ok: true });
    } catch (err) {
      console.error(err);
      reply({ error: "invalid" });
    }
  });

  socket.on("call:answer", ({ callId, answer } = {}) => {
    const call = calls.get(callId);
    if (!call || !sameId(call.callee, userId) || call.calleeSid) return;

    clearTimeout(call.ringTimer);
    call.calleeSid = socket.id;
    call.answeredAt = Date.now();

    io.to(call.callerSid).emit("call:answered", { callId, answer });
    // Stop the ringing in the callee's other tabs/devices.
    socket.to(room(userId)).emit("call:ended", {
      callId,
      reason: "answered_elsewhere",
    });
  });

  socket.on("call:ice", ({ callId, candidate } = {}) => {
    const call = calls.get(callId);
    if (!call || !candidate) return;

    if (socket.id === call.callerSid) {
      io.to(call.calleeSid || room(call.callee)).emit("call:ice", {
        callId,
        candidate,
      });
    } else if (sameId(call.callee, userId)) {
      io.to(call.callerSid).emit("call:ice", { callId, candidate });
    }
  });

  socket.on("call:end", ({ callId } = {}) => {
    const call = calls.get(callId);
    if (!call) return;
    if (!sameId(call.caller, userId) && !sameId(call.callee, userId)) return;
    endCall(call, "ended", userId);
  });

  socket.on("disconnect", () => {
    for (const call of calls.values()) {
      if (socket.id === call.callerSid || socket.id === call.calleeSid) {
        endCall(call, "disconnected", userId);
      }
    }
  });
};

const initRealtime = (server, corsOptions) => {
  io = new Server(server, { cors: corsOptions });

  io.use((socket, next) => {
    try {
      const { id } = jwt.verify(
        socket.handshake.auth?.token,
        process.env.JWT_SECRET
      );
      socket.data.userId = String(id);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const { userId } = socket.data;
    socket.join(room(userId));

    const cameOnline = !sockets.has(userId);
    if (cameOnline) sockets.set(userId, new Set());
    sockets.get(userId).add(socket.id);

    const sendPresence = async () => {
      const contacts = await getContactIds(userId);
      socket.emit("presence init", contacts.filter(isOnline));
      return contacts;
    };

    socket.on("presence sync", () => sendPresence().catch(console.error));

    socket.on("typing", async ({ chatId, typing } = {}) => {
      if (!isId(chatId)) return;
      const members = await getMembers(chatId).catch(() => []);
      if (!members.includes(userId)) return;

      emitToUsers(
        members.filter((id) => id !== userId),
        "typing",
        { chatId, userId, typing: Boolean(typing) }
      );
    });

    registerCallHandlers(socket, userId);

    socket.on("disconnect", async () => {
      const set = sockets.get(userId);
      set?.delete(socket.id);
      if (set && set.size > 0) return;

      sockets.delete(userId);
      const lastSeen = new Date();
      try {
        await User.updateOne({ _id: userId }, { lastSeen });
        emitToUsers(await getContactIds(userId), "presence", {
          userId,
          online: false,
          lastSeen,
        });
      } catch (err) {
        console.error(err);
      }
    });

    try {
      const contacts = await sendPresence();
      if (cameOnline) {
        emitToUsers(contacts, "presence", { userId, online: true });
      }
      await markAllDelivered(userId);
    } catch (err) {
      console.error(err);
    }
  });

  return io;
};

module.exports = {
  initRealtime,
  isOnline,
  emitToUser,
  emitToUsers,
  invalidateMembers,
};
