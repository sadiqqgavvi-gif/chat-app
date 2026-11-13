const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ quiet: true });

const connectDB = require("./config/db");
const migrate = require("./utils/migrate");
const { initRealtime } = require("./utils/realtime");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const isProduction = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET) {
  if (isProduction) {
    console.error("JWT_SECRET is required in production");
    process.exit(1);
  }
  process.env.JWT_SECRET = "dev-only-secret-change-me";
  console.warn("JWT_SECRET not set - using an insecure development secret");
}

// CLIENT_URL may list several allowed origins separated by commas.
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const corsOptions = { origin: allowedOrigins, credentials: true };

const app = express();
const server = http.createServer(app);

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    // Uploaded media is embedded by the client, which may be on another origin.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later" },
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/message", require("./routes/messageRoutes"));
app.use("/api", require("./routes/fileRoutes"));
app.use("/api", notFound);

// When the client has been built (npm run build in /client) this server
// can serve it too, so the whole app deploys as a single service.
const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
  app.get(/^\/(?!api\/|socket\.io\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.get("/", (req, res) => res.send("Chat App API is running"));
}

app.use(errorHandler);

const start = async () => {
  await connectDB();
  await migrate();
  initRealtime(server, corsOptions);

  const port = process.env.PORT || 5000;
  server.listen(port, () => console.log(`Server running on port ${port}`));
};

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
