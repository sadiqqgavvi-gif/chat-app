const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  accessChat,
  getChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
} = require("../controllers/chatController");

router.post("/", protect, accessChat);
router.get("/", protect, getChats);
router.post("/group", protect, createGroupChat);
router.put("/group/rename", protect, renameGroup);
router.put("/group/add", protect, addToGroup);
router.put("/group/remove", protect, removeFromGroup);

module.exports = router;
