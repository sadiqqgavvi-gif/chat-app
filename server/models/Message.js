const mongoose = require("mongoose");

const userRef = { type: mongoose.Schema.Types.ObjectId, ref: "User" };

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: "Attachment" },
    mimeType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    duration: Number,
    width: Number,
    height: Number,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    sender: userRef,
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    content: { type: String, trim: true, default: "" },
    messageType: {
      type: String,
      enum: [
        "text",
        "image",
        "video",
        "audio",
        "voice",
        "file",
        "system",
        "call",
      ],
      default: "text",
    },
    attachments: [attachmentSchema],
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    forwarded: { type: Boolean, default: false },

    reactions: [
      {
        _id: false,
        user: userRef,
        emoji: { type: String, maxlength: 16 },
      },
    ],
    starredBy: [userRef],

    // Group events ("Ali added Sara"). `sender` is the actor.
    system: {
      kind: String,
      targets: [userRef],
      text: String,
    },
    // Call log entries. `sender` is the caller.
    call: {
      video: Boolean,
      status: { type: String, enum: ["completed", "missed", "declined"] },
      duration: Number,
    },

    edited: { type: Boolean, default: false },
    editedAt: Date,
    deletedForEveryone: { type: Boolean, default: false },
    deletedFor: [userRef],

    // Legacy per-message receipt flags from before per-user watermarks.
    delivered: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ starredBy: 1 });

module.exports = mongoose.model("Message", messageSchema);
