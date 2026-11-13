const Chat = require("../models/Chat");

// One-off upgrades for data written by older versions of the app. Each
// step only touches documents that still need it, so it is safe (and
// cheap) to run on every start.
const migrate = async () => {
  const now = new Date();

  // Receipts moved from per-message flags to per-user watermarks. Treat
  // everything that existed before the switch as already read.
  const legacy = await Chat.find({ readAt: { $exists: false } })
    .select("users groupAdmin isGroupChat")
    .lean();

  for (const chat of legacy) {
    const marks = Object.fromEntries(chat.users.map((id) => [String(id), now]));
    await Chat.updateOne(
      { _id: chat._id },
      { $set: { readAt: marks, deliveredAt: marks } },
      { timestamps: false }
    );
  }

  // Groups used to have a single admin.
  const adminless = await Chat.find({
    isGroupChat: true,
    groupAdmin: { $exists: true },
    $or: [{ admins: { $exists: false } }, { admins: { $size: 0 } }],
  })
    .select("groupAdmin")
    .lean();

  for (const chat of adminless) {
    await Chat.updateOne(
      { _id: chat._id },
      { $set: { admins: [chat.groupAdmin] } },
      { timestamps: false }
    );
  }

  if (legacy.length || adminless.length) {
    console.log(
      `Upgraded ${legacy.length + adminless.length} chat(s) to the current data format`
    );
  }
};

module.exports = migrate;
