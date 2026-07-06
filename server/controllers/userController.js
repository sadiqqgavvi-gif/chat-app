const User = require("../models/User");

const searchUsers = async (req, res) => {
  try {
    const keyword = req.query.search
      ? {
          $or: [
            {
              name: {
                $regex: req.query.search,
                $options: "i",
              },
            },
            {
              email: {
                $regex: req.query.search,
                $options: "i",
              },
            },
          ],
        }
      : {};

    const users = await User.find(keyword)
      .find({
        _id: { $ne: req.user._id },
      })
      .select("-password");

    res.json(users);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        message: "Name is required",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.name = name.trim();
    user.avatar = avatar || "";

    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      blockedUsers: user.blockedUsers,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const blockUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId || userId === req.user._id.toString()) {
      return res.status(400).json({
        message: "Valid user id is required",
      });
    }

    const user = await User.findById(req.user._id);
    const userToBlock = await User.findById(userId);

    if (!user || !userToBlock) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (
      !user.blockedUsers.some(
        (blockedId) => blockedId.toString() === userId
      )
    ) {
      user.blockedUsers.push(userId);
      await user.save();
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      blockedUsers: user.blockedUsers,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

const unblockUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: "User id is required",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.blockedUsers = user.blockedUsers.filter(
      (blockedId) => blockedId.toString() !== userId
    );

    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      blockedUsers: user.blockedUsers,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

module.exports = {
  searchUsers,
  updateProfile,
  blockUser,
  unblockUser,
};
