const express = require("express");
const rateLimit = require("express-rate-limit");
const protect = require("../middleware/authMiddleware");
const { upload, uploadFile, getFile } = require("../controllers/fileController");

const router = express.Router();

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many uploads, please slow down" },
});

router.post("/upload", protect, uploadLimiter, upload, uploadFile);
router.get("/files/:id/:key", getFile);

module.exports = router;
