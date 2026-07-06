const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  sendMessage,
  getMessages,
  markMessagesAsRead,
  deleteMessageForMe,
  deleteMessageForEveryone,
  editMessage,
  clearChat,
} = require("../controllers/messageController");

router.post("/", protect, sendMessage);

router.get("/:chatId", protect, getMessages);

router.put("/read", protect, markMessagesAsRead);

router.put("/delete/:messageId", protect, deleteMessageForMe);

router.put(
  "/delete-everyone/:messageId",
  protect,
  deleteMessageForEveryone
);

router.put(
  "/edit/:messageId",
  protect,
  editMessage
);

router.put("/clear/:chatId", protect, clearChat);

module.exports = router;
