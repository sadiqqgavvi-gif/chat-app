const mongoose = require("mongoose");

const userRef = { type: mongoose.Schema.Types.ObjectId, ref: "User" };
const dateMap = { type: Map, of: Date, default: {} };

const chatSchema = new mongoose.Schema(
  {
    chatName: { type: String, trim: true, maxlength: 60 },
    isGroupChat: { type: Boolean, default: false },
    description: { type: String, trim: true, default: "", maxlength: 300 },
    avatar: { type: String, default: "" },

    users: [userRef],
    // Creator of the group. `admins` is the list that grants permissions.
    groupAdmin: userRef,
    admins: [userRef],

    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    // Per-user watermarks, keyed by user id. A message counts as
    // delivered to / read by a user when its createdAt is not after that
    // user's watermark, so receipts never need a write per message.
    readAt: dateMap,
    deliveredAt: dateMap,
    // Messages at or before this moment are hidden from that user
    // ("clear chat", "delete chat", or joining a group late).
    clearedAt: dateMap,

    // Per-user preferences.
    pinnedBy: [userRef],
    archivedBy: [userRef],
    mutedBy: [userRef],
    unreadBy: [userRef],
    hiddenFor: [userRef],
  },
  { timestamps: true }
);

chatSchema.index({ users: 1, updatedAt: -1 });

module.exports = mongoose.model("Chat", chatSchema);
