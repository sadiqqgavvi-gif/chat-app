const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { fail } = require("../utils/http");
const { selfUser } = require("../utils/serialize");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authResponse = (user) => ({
  token: generateToken(user._id),
  user: selfUser(user),
});

// Emails are stored lowercase, but accounts created before that rule may
// have mixed case, so look them up case-insensitively.
const findByEmail = (email) =>
  User.findOne({ email }).collation({ locale: "en", strength: 2 });

const registerUser = async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const { password } = req.body;

  if (!name || !email || typeof password !== "string") {
    fail(400, "All fields are required");
  }
  if (name.length > 50) fail(400, "Name must be 50 characters or fewer");
  if (!EMAIL_PATTERN.test(email)) fail(400, "Enter a valid email address");
  if (password.length < 6) {
    fail(400, "Password must be at least 6 characters");
  }
  if (await findByEmail(email)) {
    fail(409, "An account with this email already exists");
  }

  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 10),
  });

  res.status(201).json(authResponse(user));
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || typeof password !== "string") {
    fail(400, "Email and password are required");
  }

  const user = await findByEmail(email.trim().toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.password))) {
    fail(401, "Incorrect email or password");
  }

  res.json(authResponse(user));
};

const getMe = async (req, res) => {
  res.json(selfUser(req.user));
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    fail(400, "Current and new password are required");
  }
  if (newPassword.length < 6) {
    fail(400, "New password must be at least 6 characters");
  }

  const user = await User.findById(req.user._id);
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    fail(400, "Current password is incorrect");
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ success: true });
};

module.exports = { registerUser, loginUser, getMe, changePassword };
