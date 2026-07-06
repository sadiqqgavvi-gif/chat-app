const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const {
  searchUsers,
  updateProfile,
  blockUser,
  unblockUser,
} = require("../controllers/userController");

router.get("/", protect, searchUsers);
router.put("/profile", protect, updateProfile);
router.put("/block", protect, blockUser);
router.put("/unblock", protect, unblockUser);

module.exports = router;
