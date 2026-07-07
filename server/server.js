const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const http = require("http");
const { Server } = require("socket.io");
const userRoutes = require("./routes/userRoutes");


dotenv.config();

connectDB();

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));


app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/user", userRoutes);

app.get("/", (req, res) => {
  res.send("API Running");
});

const PORT = process.env.PORT || 5000;

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
});

app.set("io", io);

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  socket.on("setup", async (userData) => {
  if (!userData || !userData.id) return;

  socket.join(userData.id);

  onlineUsers.set(userData.id, socket.id);

  const Message = require("./models/Message");
  const Chat = require("./models/Chat");

  const chats = await Chat.find({
    users: userData.id,
  }).select("_id");

  const chatIds = chats.map((chat) => chat._id);

  const pendingMessages = await Message.find({
    chat: { $in: chatIds },
    sender: { $ne: userData.id },
    delivered: false,
  });

  for (const message of pendingMessages) {
    message.delivered = true;
    await message.save();

    io.to(message.sender.toString()).emit(
      "message delivered",
      message._id
    );
  }

  io.emit("online users", [...onlineUsers.keys()]);

  console.log(`${userData.name} joined`);

  socket.emit("connected");
});

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined chat ${room}`);
  });

  socket.on("typing", (room) => {
  socket.to(room).emit("typing");
});

socket.on("message delivered", async (messageId) => {
  try {
    const Message = require("./models/Message");

    const message = await Message.findByIdAndUpdate(
      messageId,
      {
        delivered: true,
      },
      {
        new: true,
      }
    )
      .populate("sender", "_id")
      .populate({
        path: "chat",
        populate: {
          path: "users",
          select: "_id",
        },
      });

    if (!message) return;

    // Notify ONLY the sender
    io.to(message.sender._id.toString()).emit(
      "message delivered",
      messageId
    );
  } catch (err) {
    console.error(err);
  }
});

socket.on("stop typing", (room) => {
  socket.to(room).emit("stop typing");
});

  socket.on("disconnect", () => {
    console.log("User Disconnected:", socket.id);

    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }

    io.emit("online users", [...onlineUsers.keys()]);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});