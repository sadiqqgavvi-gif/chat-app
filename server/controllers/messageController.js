const Message = require("../models/Message");
const Chat = require("../models/Chat");

const emitToChatParticipants = async (
  req,
  chatId,
  eventName,
  payload
) => {
  const chat = await Chat.findById(chatId).select("users");

  if (!chat) return;

  const io = req.app.get("io");

  chat.users.forEach((userId) => {
    io.to(userId.toString()).emit(eventName, payload);
  });

  io.to(chatId.toString()).emit(eventName, payload);
};

const sendMessage = async (req, res) => {
  try {
    const {
      content,
      chatId,
      attachments = [],
      replyTo,
    } = req.body;
    const trimmedContent = content?.trim();
    const safeAttachments = Array.isArray(attachments)
      ? attachments.filter((attachment) => attachment?.url)
      : [];

    if (!chatId) {
      return res.status(400).json({
        message: "ChatId required",
      });
    }

    if (!trimmedContent && safeAttachments.length === 0) {
      return res.status(400).json({
        message: "Message content or attachment required",
      });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      users: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    if (replyTo) {
      const replyMessage = await Message.findOne({
        _id: replyTo,
        chat: chatId,
      });

      if (!replyMessage) {
        return res.status(400).json({
          message: "Replied message not found in this chat",
        });
      }
    }

    const messageType = safeAttachments[0]?.mimeType?.startsWith(
      "image/"
    )
      ? "image"
      : safeAttachments[0]?.mimeType?.startsWith("audio/")
      ? "voice"
      : safeAttachments.length > 0
      ? "file"
      : "text";

    let message = await Message.create({
      sender: req.user._id,
      content: trimmedContent || "",
      messageType,
      chat: chatId,
      attachments: safeAttachments,
      replyTo: replyTo || undefined,
    });

    message = await Message.findById(message._id)
      .populate("sender", "name email")
      .populate("replyTo", "content messageType attachments sender")
      .populate({
        path: "chat",
        populate: {
          path: "users",
          select: "_id name",
        },
      });

    // Increase unread count for everyone except sender
    message.chat.users.forEach((user) => {
      if (user._id.toString() !== req.user._id.toString()) {
        const current =
          chat.unreadCounts.get(user._id.toString()) || 0;

        chat.unreadCounts.set(
          user._id.toString(),
          current + 1
        );
      }
    });

    chat.latestMessage = message._id;

    await chat.save();

    const io = req.app.get("io");

    message.chat.users.forEach((user) => {
      if (user._id.toString() !== req.user._id.toString()) {
        io.to(user._id.toString()).emit(
          "message received",
          message
        );
      }
    });

    io.to(req.user._id.toString()).emit(
      "message received",
      message
    );

    res.status(201).json(message);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const getMessages = async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      users: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    const messages = await Message.find({
      chat: req.params.chatId,
      deletedFor: {
        $ne: req.user._id,
      },
    })
      .populate("sender", "name email")
      .populate({
        path: "replyTo",
        select: "content messageType attachments sender",
        populate: {
          path: "sender",
          select: "name",
        },
      })
      .populate("chat")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.body;

    const chat = await Chat.findOne({
      _id: chatId,
      users: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: req.user._id },
        read: false,
      },
      {
        $set: {
          read: true,
        },
      }
    );

    await Chat.findByIdAndUpdate(chatId, {
      $set: {
        [`unreadCounts.${req.user._id}`]: 0,
      },
    });

    await emitToChatParticipants(
      req,
      chatId,
      "messages read",
      {
        chatId,
        readerId: req.user._id.toString(),
      }
    );

    res.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const deleteMessageForMe = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    const chat = await Chat.findOne({
      _id: message.chat,
      users: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (
      !message.deletedFor.some(
        (id) => id.toString() === req.user._id.toString()
      )
    ) {
      message.deletedFor.push(req.user._id);
      await message.save();
    }

    res.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const deleteMessageForEveryone = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (
      message.sender.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "Not allowed",
      });
    }

    message.deletedForEveryone = true;
    message.content = "This message was deleted";
    message.attachments = [];
    message.messageType = "text";

    await message.save();

    await emitToChatParticipants(
      req,
      message.chat,
      "message deleted",
      message._id
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const trimmedContent = req.body.content?.trim();

    if (!trimmedContent) {
      return res.status(400).json({
        message: "Message cannot be empty",
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (
      message.sender.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "Not allowed",
      });
    }

    if (message.deletedForEveryone) {
      return res.status(400).json({
        message: "Deleted messages can't be edited",
      });
    }

    if (message.messageType !== "text") {
      return res.status(400).json({
        message: "Only text messages can be edited",
      });
    }

    message.content = trimmedContent;
    message.edited = true;
    message.editedAt = new Date();

    await message.save();

    const updatedMessage = await Message.findById(message._id)
      .populate("sender", "name email")
      .populate({
        path: "replyTo",
        select: "content messageType attachments sender",
        populate: {
          path: "sender",
          select: "name",
        },
      })
      .populate({
        path: "chat",
        populate: {
          path: "users",
          select: "_id name",
        },
      });

    await emitToChatParticipants(
      req,
      message.chat,
      "message edited",
      updatedMessage
    );

    res.json(updatedMessage);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  markMessagesAsRead,
  deleteMessageForMe,
  deleteMessageForEveryone,
  editMessage,
};
