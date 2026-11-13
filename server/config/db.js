const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

// Without a MONGO_URI in development we start a local MongoDB that keeps
// its data in server/.data, so the app runs with zero setup.
const startLocalMongo = async () => {
  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require("mongodb-memory-server"));
  } catch {
    throw new Error("MONGO_URI is not set");
  }

  const dbPath = path.join(__dirname, "..", ".data");
  fs.mkdirSync(dbPath, { recursive: true });

  const mongod = await MongoMemoryServer.create({
    binary: { version: "7.0.14" },
    instance: { dbPath, storageEngine: "wiredTiger", dbName: "chat-app" },
  });

  const stop = () => mongod.stop({ doCleanup: false }).finally(() => process.exit(0));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  console.log("No MONGO_URI set - using local development database in server/.data");
  return mongod.getUri("chat-app");
};

const connectDB = async () => {
  let uri = process.env.MONGO_URI;

  if (!uri) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MONGO_URI is required in production");
    }
    uri = await startLocalMongo();
  }

  await mongoose.connect(uri);
  console.log("MongoDB connected");
};

module.exports = connectDB;
