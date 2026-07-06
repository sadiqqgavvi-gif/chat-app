const Chat = require("../models/Chat");
const Message = require("../models/Message");

const emitChatToUsers = (req, eventName, chat) => {
  const io = req.app.get("io");

  chat.users.forEach((user) => {
    io.to(user._id.toString()).emit(eventName, chat);
  });

  io.to(chat._id.toString()).emit(eventName, chat);
};

const accessChat = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "UserId is required",
      });
    }

    let chat = await Chat.findOne({
      isGroupChat: false,
      users: {
        $all: [req.user._id, userId],
      },
    })
      .populate("users", "-password")
      .populate("latestMessage");

    if (chat) {
      return res.status(200).json(chat);
    }

    const newChat = await Chat.create({
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId],
    });

    const fullChat = await Chat.findById(newChat._id)
      .populate("users", "-password");

    res.status(201).json(fullChat);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      users: { $elemMatch: { $eq: req.user._id } },
    })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate({
        path: "latestMessage",
        populate: {
          path: "sender",
          select: "name email",
        },
      })
      .sort({ updatedAt: -1 });

    const formattedChats = await Promise.all(
      chats.map(async (chat) => {
        const [unreadCount, latestVisibleMessage] =
          await Promise.all([
            Message.countDocuments({
              chat: chat._id,
              sender: { $ne: req.user._id },
              read: false,
              deletedFor: { $ne: req.user._id },
            }),
            Message.findOne({
              chat: chat._id,
              deletedFor: { $ne: req.user._id },
            })
              .sort({ createdAt: -1 })
              .populate("sender", "name email"),
          ]);

        return {
          ...chat.toObject(),
          latestMessage: latestVisibleMessage,
          unreadCount,
        };
      })
    );

    res.status(200).json(formattedChats);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const createGroupChat = async (req, res) => {
  try {
    const { chatName, users } = req.body;

    if (!chatName?.trim() || !Array.isArray(users)) {
      return res.status(400).json({
        message: "Group name and users are required",
      });
    }

    const uniqueUserIds = [
      ...new Set([
        req.user._id.toString(),
        ...users.map((userId) => userId.toString()),
      ]),
    ];

    if (uniqueUserIds.length < 3) {
      return res.status(400).json({
        message: "A group needs at least 3 members including you",
      });
    }

    const groupChat = await Chat.create({
      chatName: chatName.trim(),
      isGroupChat: true,
      users: uniqueUserIds,
      groupAdmin: req.user._id,
    });

    const fullGroupChat = await Chat.findById(groupChat._id)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    emitChatToUsers(req, "chat created", fullGroupChat);

    res.status(201).json(fullGroupChat);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const renameGroup = async (req, res) => {
  try {
    const { chatId, chatName } = req.body;

    if (!chatId || !chatName?.trim()) {
      return res.status(400).json({
        message: "Chat id and name are required",
      });
    }

    const chat = await Chat.findById(chatId);

    if (!chat || !chat.isGroupChat) {
      return res.status(404).json({
        message: "Group chat not found",
      });
    }

    if (chat.groupAdmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Only the group admin can rename this group",
      });
    }

    chat.chatName = chatName.trim();
    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate({
        path: "latestMessage",
        populate: {
          path: "sender",
          select: "name email",
        },
      });

    emitChatToUsers(req, "chat updated", updatedChat);

    res.json(updatedChat);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const addToGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    const chat = await Chat.findById(chatId);

    if (!chat || !chat.isGroupChat) {
      return res.status(404).json({
        message: "Group chat not found",
      });
    }

    if (chat.groupAdmin.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Only the group admin can add members",
      });
    }

    if (!chat.users.some((id) => id.toString() === userId)) {
      chat.users.push(userId);
      await chat.save();
    }

    const updatedChat = await Chat.findById(chat._id)
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate({
        path: "latestMessage",
        populate: {
          path: "sender",
          select: "name email",
        },
      });

    emitChatToUsers(req, "chat updated", updatedChat);

    res.json(updatedChat);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const removeFromGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    const chat = await Chat.findById(chatId);

    if (!chat || !chat.isGroupChat) {
      return res.status(404).json({
        message: "Group chat not found",
      });
    }

    const isAdmin =
      chat.groupAdmin.toString() === req.user._id.toString();
    const isLeavingSelf =
      userId.toString() === req.user._id.toString();

    if (!isAdmin && !isLeavingSelf) {
      return res.status(403).json({
        message: "Only the group admin can remove members",
      });
    }

    chat.users = chat.users.filter(
      (id) => id.toString() !== userId.toString()
    );

    if (chat.groupAdmin.toString() === userId.toString()) {
      chat.groupAdmin = chat.users[0];
    }

    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate({
        path: "latestMessage",
        populate: {
          path: "sender",
          select: "name email",
        },
      });

    emitChatToUsers(req, "chat updated", updatedChat);
    req.app
      .get("io")
      .to(userId.toString())
      .emit("chat removed", chat._id.toString());

    res.json(updatedChat);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

module.exports = {
  accessChat,
  getChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
};
