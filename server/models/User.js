const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true },
    avatar: { type: String, default: "" },
    about: {
      type: String,
      default: "Hey there! I am using Chat App.",
      trim: true,
      maxlength: 140,
    },
    lastSeen: { type: Date },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
