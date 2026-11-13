// End-to-end API test: boots the real server against a throwaway MongoDB
// and drives it over HTTP and Socket.io the way two clients would.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { io } = require("socket.io-client");

const PORT = 5099;
const BASE = `http://127.0.0.1:${PORT}`;
let mongod;
let server;

const api = async (method, url, token, body) => {
  const res = await fetch(`${BASE}/api${url}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

const register = async (name) => {
  const { status, data } = await api("POST", "/auth/register", null, {
    name,
    email: `${name.toLowerCase()}@example.com`,
    password: "secret123",
  });
  assert.equal(status, 201);
  return { ...data.user, token: data.token };
};

const connect = (token) =>
  new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, transports: ["websocket"] });
    socket.events = [];
    socket.onAny((event, payload) => socket.events.push({ event, payload }));
    socket.once("presence init", () => resolve(socket));
    socket.once("connect_error", reject);
  });

// Resolves with the payload of the next matching event (also looking at
// events that already arrived).
const waitFor = (socket, event, match = () => true, timeout = 4000) =>
  new Promise((resolve, reject) => {
    const check = () => {
      const index = socket.events.findIndex(
        (item) => item.event === event && match(item.payload)
      );
      if (index === -1) return false;
      resolve(socket.events.splice(index, 1)[0].payload);
      return true;
    };
    if (check()) return;
    const timer = setTimeout(() => {
      clearInterval(poll);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeout);
    const poll = setInterval(() => {
      if (check()) {
        clearTimeout(timer);
        clearInterval(poll);
      }
    }, 20);
  });

before(async () => {
  mongod = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
  server = spawn("node", ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT,
      MONGO_URI: mongod.getUri("chat-test"),
      JWT_SECRET: "test-secret",
    },
    stdio: ["ignore", "ignore", "inherit"],
  });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Server did not start");
});

after(async () => {
  server?.kill();
  await mongod?.stop();
});

test("auth validates input and protects routes", async () => {
  assert.equal((await api("GET", "/chat")).status, 401);
  assert.equal((await api("GET", "/chat", "garbage")).status, 401);

  const weak = await api("POST", "/auth/register", null, {
    name: "X",
    email: "x@example.com",
    password: "123",
  });
  assert.equal(weak.status, 400);

  const user = await register("Dupe");
  const again = await api("POST", "/auth/register", null, {
    name: "Dupe",
    email: "DUPE@example.com",
    password: "secret123",
  });
  assert.equal(again.status, 409);

  const login = await api("POST", "/auth/login", null, {
    email: "Dupe@Example.com",
    password: "secret123",
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.id, user.id);

  const injection = await api("POST", "/auth/login", null, {
    email: { $gt: "" },
    password: { $gt: "" },
  });
  assert.equal(injection.status, 400);
});

test("direct chat: messages, receipts, unread, edit, react, delete", async () => {
  const alice = await register("Alice");
  const bob = await register("Bob");
  const aliceSocket = await connect(alice.token);

  const chat = (await api("POST", "/chat", alice.token, { userId: bob.id })).data;
  assert.equal(chat.isGroupChat, false);

  // Bob is offline: sent but not delivered.
  const first = await api("POST", "/message", alice.token, {
    chatId: chat._id,
    content: "hello bob",
    clientId: "c1",
  });
  assert.equal(first.status, 201);
  const echoed = await waitFor(aliceSocket, "message new");
  assert.equal(echoed.clientId, "c1");
  let receipt = await waitFor(aliceSocket, "chat receipt");
  assert.equal(receipt.deliveredAt[bob.id], undefined);

  // Bob comes online: delivered.
  const bobSocket = await connect(bob.token);
  receipt = await waitFor(aliceSocket, "chat receipt", (p) => p.deliveredAt?.[bob.id]);
  assert.ok(new Date(receipt.deliveredAt[bob.id]) >= new Date(first.data.createdAt));
  await waitFor(aliceSocket, "presence", (p) => p.userId === bob.id && p.online);

  let bobChats = (await api("GET", "/chat", bob.token)).data;
  assert.equal(bobChats.length, 1);
  assert.equal(bobChats[0].unreadCount, 1);
  assert.equal(bobChats[0].latestMessage.content, "hello bob");

  // Bob reads: read receipt reaches Alice, unread drops to zero.
  await api("PUT", `/chat/${chat._id}/read`, bob.token);
  receipt = await waitFor(aliceSocket, "chat receipt", (p) => p.readAt?.[bob.id]);
  assert.ok(new Date(receipt.readAt[bob.id]) >= new Date(first.data.createdAt));
  bobChats = (await api("GET", "/chat", bob.token)).data;
  assert.equal(bobChats[0].unreadCount, 0);

  // Typing indicator only reaches the other member.
  bobSocket.emit("typing", { chatId: chat._id, typing: true });
  const typing = await waitFor(aliceSocket, "typing");
  assert.deepEqual(typing, { chatId: chat._id, userId: bob.id, typing: true });

  // Reply, react, edit.
  const reply = await api("POST", "/message", bob.token, {
    chatId: chat._id,
    content: "hi alice",
    replyTo: first.data._id,
  });
  assert.equal(reply.data.replyTo.content, "hello bob");

  await api("PUT", `/message/${first.data._id}/react`, bob.token, { emoji: "👍" });
  let updated = await waitFor(aliceSocket, "message updated");
  assert.equal(updated.reactions.length, 1);
  await api("PUT", `/message/${first.data._id}/react`, bob.token, { emoji: "👍" });
  updated = await waitFor(aliceSocket, "message updated");
  assert.equal(updated.reactions.length, 0);

  const notMine = await api("PUT", `/message/${first.data._id}/edit`, bob.token, {
    content: "hacked",
  });
  assert.equal(notMine.status, 403);
  const edited = await api("PUT", `/message/${first.data._id}/edit`, alice.token, {
    content: "hello bob!",
  });
  assert.equal(edited.data.edited, true);

  // Star + starred list.
  await api("PUT", `/message/${reply.data._id}/star`, alice.token, { starred: true });
  const starred = (await api("GET", "/message/starred", alice.token)).data;
  assert.equal(starred.length, 1);
  assert.equal(starred[0].chatTitle, "Bob");

  // Search.
  const found = (await api("GET", `/message/chat/${chat._id}/search?q=ALICE`, alice.token)).data;
  assert.equal(found.length, 1);

  // Delete for me hides it only for me.
  await api("DELETE", `/message/${reply.data._id}`, alice.token);
  const aliceView = (await api("GET", `/message/chat/${chat._id}`, alice.token)).data;
  const bobView = (await api("GET", `/message/chat/${chat._id}`, bob.token)).data;
  assert.equal(aliceView.messages.length, 1);
  assert.equal(bobView.messages.length, 2);

  // Delete for everyone blanks the message.
  await api("DELETE", `/message/${first.data._id}?scope=everyone`, alice.token);
  updated = await waitFor(bobSocket, "message updated", (p) => p.deletedForEveryone);
  assert.equal(updated.content, "");

  // Outsiders cannot read or post.
  const eve = await register("Eve");
  assert.equal((await api("GET", `/message/chat/${chat._id}`, eve.token)).status, 404);
  assert.equal(
    (await api("POST", "/message", eve.token, { chatId: chat._id, content: "x" })).status,
    404
  );
  assert.equal(
    (await api("PUT", `/message/${reply.data._id}/react`, eve.token, { emoji: "👍" })).status,
    404
  );

  // Blocking closes the chat both ways.
  await api("PUT", "/user/block", bob.token, { userId: alice.id });
  const blockedSend = await api("POST", "/message", alice.token, {
    chatId: chat._id,
    content: "still there?",
  });
  assert.equal(blockedSend.status, 403);
  const aliceChat = await waitFor(aliceSocket, "chat updated", (p) => p.blockedByOther);
  assert.equal(aliceChat.users.some((user) => "blockedUsers" in user), false);
  await api("PUT", "/user/unblock", bob.token, { userId: alice.id });

  // Clear chat, then delete chat; a new message brings it back empty.
  await api("PUT", `/chat/${chat._id}/clear`, bob.token);
  assert.equal(
    (await api("GET", `/message/chat/${chat._id}`, bob.token)).data.messages.length,
    0
  );
  await api("DELETE", `/chat/${chat._id}`, bob.token);
  assert.equal((await api("GET", "/chat", bob.token)).data.length, 0);
  await api("POST", "/message", alice.token, { chatId: chat._id, content: "back" });
  bobChats = (await api("GET", "/chat", bob.token)).data;
  assert.equal(bobChats.length, 1);
  assert.equal(bobChats[0].unreadCount, 1);

  // Going offline broadcasts last seen.
  bobSocket.disconnect();
  const offline = await waitFor(aliceSocket, "presence", (p) => p.userId === bob.id && !p.online);
  assert.ok(offline.lastSeen);
  aliceSocket.disconnect();
});

test("pagination returns pages oldest-first with hasMore", async () => {
  const a = await register("Pager");
  const b = await register("Pagee");
  const chat = (await api("POST", "/chat", a.token, { userId: b.id })).data;

  for (let i = 1; i <= 45; i += 1) {
    await api("POST", "/message", a.token, { chatId: chat._id, content: `m${i}` });
  }

  const latest = (await api("GET", `/message/chat/${chat._id}`, a.token)).data;
  assert.equal(latest.messages.length, 40);
  assert.equal(latest.hasMore, true);
  assert.equal(latest.messages.at(-1).content, "m45");

  const older = (
    await api("GET", `/message/chat/${chat._id}?before=${latest.messages[0]._id}`, a.token)
  ).data;
  assert.equal(older.messages.length, 5);
  assert.equal(older.hasMore, false);
  assert.equal(older.messages[0].content, "m1");

  const around = (
    await api("GET", `/message/chat/${chat._id}?around=${older.messages[2]._id}`, a.token)
  ).data;
  assert.equal(around.messages[0].content, "m1");
  assert.equal(around.messages.at(-1).content, "m45");
});

test("groups: create, admin rules, members, prefs, forward", async () => {
  const owner = await register("Owner");
  const member = await register("Member");
  const late = await register("Late");
  const memberSocket = await connect(member.token);

  const created = await api("POST", "/chat/group", owner.token, {
    chatName: "Team",
    users: [member.id],
  });
  assert.equal(created.status, 201);
  const group = created.data;
  assert.deepEqual(group.admins, [owner.id]);
  await waitFor(memberSocket, "chat created");

  // Only admins manage the group.
  const denied = await api("PUT", `/chat/${group._id}/group`, member.token, {
    chatName: "Hijacked",
  });
  assert.equal(denied.status, 403);
  await api("PUT", `/chat/${group._id}/group`, owner.token, { chatName: "Team 2" });
  const renamed = await waitFor(memberSocket, "chat updated", (p) => p.chatName === "Team 2");
  assert.equal(renamed.users.length, 2);

  await api("POST", "/message", owner.token, { chatId: group._id, content: "before late joined" });

  // A late joiner does not see earlier history.
  await api("PUT", `/chat/${group._id}/members/add`, owner.token, { userIds: [late.id] });
  const lateView = (await api("GET", `/message/chat/${group._id}`, late.token)).data;
  assert.equal(lateView.messages.length, 1);
  assert.equal(lateView.messages[0].system.kind, "added");

  // Per-user preferences are private to that user.
  const prefs = await api("PUT", `/chat/${group._id}/prefs`, member.token, {
    pinned: true,
    muted: true,
  });
  assert.equal(prefs.data.pinned, true);
  const ownerView = (await api("GET", `/chat/${group._id}`, owner.token)).data;
  assert.equal(ownerView.pinned, false);
  assert.equal(ownerView.muted, false);

  // Forwarding copies a message into another chat.
  const source = (await api("GET", `/message/chat/${group._id}`, member.token)).data.messages.find(
    (m) => m.content === "before late joined"
  );
  const direct = (await api("POST", "/chat", member.token, { userId: late.id })).data;
  const forward = await api("POST", "/message/forward", member.token, {
    messageIds: [source._id],
    chatIds: [direct._id],
  });
  assert.equal(forward.status, 201);
  const forwarded = (await api("GET", `/message/chat/${direct._id}`, late.token)).data.messages;
  assert.equal(forwarded[0].forwarded, true);
  assert.equal(forwarded[0].content, "before late joined");
  // Late cannot forward a message they are not allowed to see.
  const sneaky = await api("POST", "/message/forward", late.token, {
    messageIds: [source._id],
    chatIds: [direct._id],
  });
  assert.equal(sneaky.status, 404);

  // When the only admin leaves, someone else is promoted.
  await api("POST", `/chat/${group._id}/leave`, owner.token);
  assert.equal((await api("GET", `/chat/${group._id}`, owner.token)).status, 404);
  const afterLeave = (await api("GET", `/chat/${group._id}`, member.token)).data;
  assert.equal(afterLeave.users.length, 2);
  assert.deepEqual(afterLeave.admins, [member.id]);

  await api("PUT", `/chat/${group._id}/members/remove`, member.token, { userId: late.id });
  assert.equal((await api("GET", "/chat", late.token)).data.some((c) => c._id === group._id), false);
  memberSocket.disconnect();
});

test("uploads are stored, served with range support and never as HTML", async () => {
  const user = await register("Uploader");

  const send = async (content, type, name) => {
    const form = new FormData();
    form.append("file", new Blob([content], { type }), name);
    const res = await fetch(`${BASE}/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
      body: form,
    });
    return { status: res.status, data: await res.json() };
  };

  const text = await send("0123456789", "audio/webm", "voice.webm");
  assert.equal(text.status, 201);
  assert.match(text.data.url, /^\/api\/files\/[a-f0-9]{24}\/[a-f0-9]{32}$/);

  const full = await fetch(BASE + text.data.url);
  assert.equal(await full.text(), "0123456789");
  assert.equal(full.headers.get("content-type"), "audio/webm");

  const part = await fetch(BASE + text.data.url, { headers: { Range: "bytes=2-5" } });
  assert.equal(part.status, 206);
  assert.equal(await part.text(), "2345");
  assert.equal(part.headers.get("content-range"), "bytes 2-5/10");

  const wrongKey = await fetch(BASE + text.data.url.slice(0, -1) + "0");
  assert.equal(wrongKey.status, 404);

  const html = await send("<script>alert(1)</script>", "text/html", "x.html");
  const served = await fetch(BASE + html.data.url);
  assert.equal(served.headers.get("content-type"), "application/octet-stream");
  assert.match(served.headers.get("content-disposition"), /^attachment/);

  // Messages only accept attachment URLs issued by the upload endpoint.
  const other = await register("Receiver");
  const chat = (await api("POST", "/chat", user.token, { userId: other.id })).data;
  const bad = await api("POST", "/message", user.token, {
    chatId: chat._id,
    attachments: [{ url: "https://evil.example/x.png", mimeType: "image/png" }],
  });
  assert.equal(bad.status, 400);
  const good = await api("POST", "/message", user.token, {
    chatId: chat._id,
    voice: true,
    attachments: [{ ...text.data, duration: 3 }],
  });
  assert.equal(good.data.messageType, "voice");
});

test("calls are relayed between peers and logged in the chat", async () => {
  const caller = await register("Caller");
  const callee = await register("Callee");
  const chat = (await api("POST", "/chat", caller.token, { userId: callee.id })).data;
  const callerSocket = await connect(caller.token);

  // Callee offline -> missed call.
  const offline = await callerSocket.emitWithAck("call:invite", {
    callId: "call-1",
    chatId: chat._id,
    video: false,
    offer: { type: "offer", sdp: "x" },
  });
  assert.equal(offline.error, "offline");
  let log = await waitFor(callerSocket, "message new", (p) => p.message.messageType === "call");
  assert.equal(log.message.call.status, "missed");

  const calleeSocket = await connect(callee.token);
  const ok = await callerSocket.emitWithAck("call:invite", {
    callId: "call-2",
    chatId: chat._id,
    video: true,
    offer: { type: "offer", sdp: "x" },
  });
  assert.equal(ok.ok, true);
  const incoming = await waitFor(calleeSocket, "call:incoming");
  assert.equal(incoming.from.name, "Caller");

  calleeSocket.emit("call:answer", { callId: "call-2", answer: { type: "answer", sdp: "y" } });
  const answered = await waitFor(callerSocket, "call:answered");
  assert.equal(answered.answer.sdp, "y");

  callerSocket.emit("call:ice", { callId: "call-2", candidate: { candidate: "c" } });
  assert.equal((await waitFor(calleeSocket, "call:ice")).candidate.candidate, "c");

  calleeSocket.emit("call:end", { callId: "call-2" });
  await waitFor(callerSocket, "call:ended", (p) => p.callId === "call-2");
  log = await waitFor(callerSocket, "message new", (p) => p.message.messageType === "call");
  assert.equal(log.message.call.status, "completed");
  assert.equal(log.message.call.video, true);

  callerSocket.disconnect();
  calleeSocket.disconnect();
});
