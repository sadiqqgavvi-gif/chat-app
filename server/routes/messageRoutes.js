const express = require("express");
const protect = require("../middleware/authMiddleware");
const message = require("../controllers/messageController");

const router = express.Router();
router.use(protect);

router.post("/", message.sendMessage);
router.post("/forward", message.forwardMessages);
router.get("/starred", message.getStarred);

router.get("/chat/:chatId", message.getMessages);
router.get("/chat/:chatId/search", message.searchMessages);
router.get("/chat/:chatId/media", message.getMedia);

router.put("/:messageId/edit", message.editMessage);
router.put("/:messageId/react", message.reactToMessage);
router.put("/:messageId/star", message.starMessage);
router.delete("/:messageId", message.deleteMessage);

module.exports = router;
