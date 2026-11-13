const express = require("express");
const protect = require("../middleware/authMiddleware");
const chat = require("../controllers/chatController");

const router = express.Router();
router.use(protect);

router.get("/", chat.getChats);
router.post("/", chat.accessChat);
router.post("/group", chat.createGroupChat);

router.get("/:chatId", chat.getChat);
router.delete("/:chatId", chat.deleteChat);
router.put("/:chatId/group", chat.updateGroup);
router.put("/:chatId/members/add", chat.addMembers);
router.put("/:chatId/members/remove", chat.removeFromGroup);
router.put("/:chatId/admins", chat.setAdmin);
router.post("/:chatId/leave", chat.leaveGroup);
router.put("/:chatId/prefs", chat.updatePrefs);
router.put("/:chatId/read", chat.markRead);
router.put("/:chatId/clear", chat.clearChat);

module.exports = router;
