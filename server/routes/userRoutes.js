const express = require("express");
const protect = require("../middleware/authMiddleware");
const {
  searchUsers,
  updateProfile,
  blockUser,
  unblockUser,
  getBlockedUsers,
} = require("../controllers/userController");

const router = express.Router();
router.use(protect);

router.get("/", searchUsers);
router.get("/blocked", getBlockedUsers);
router.put("/profile", updateProfile);
router.put("/block", blockUser);
router.put("/unblock", unblockUser);

module.exports = router;
