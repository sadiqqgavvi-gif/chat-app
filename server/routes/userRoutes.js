const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const {
  searchUsers,
  updateProfile,
} = require("../controllers/userController");

router.get("/", protect, searchUsers);
router.put("/profile", protect, updateProfile);

module.exports = router;
