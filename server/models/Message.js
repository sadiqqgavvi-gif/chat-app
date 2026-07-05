const mongoose = require("mongoose");

const messageSchema = mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    content: {
      type: String,
      trim: true,
      default: "",
    },

    messageType: {
      type: String,
      enum: ["text", "image", "file", "voice"],
      default: "text",
    },

    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
    },

    attachments: [
      {
        url: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          default: "Attachment",
        },
        mimeType: {
          type: String,
          default: "application/octet-stream",
        },
        size: {
          type: Number,
          default: 0,
        },
      },
    ],

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    delivered: {
      type: Boolean,
      default: false,
    },

    read: {
      type: Boolean,
      default: false,
    },

    deletedForEveryone: {
      type: Boolean,
      default: false,
    },

    edited: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
    },

    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Message", messageSchema);
