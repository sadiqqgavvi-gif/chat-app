import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatContext, useAuth, useToast } from "./contexts";
import socket from "../lib/socket";
import { errorMessage } from "../lib/api";
import { chatTitle, messagePreview, senderId, sortChats } from "../lib/format";
import { playMessageSound, showDesktopNotification } from "../lib/notify";
import * as chatApi from "../services/chatService";
import * as messageApi from "../services/messageService";
import { blockUser, unblockUser } from "../services/userService";

const EMPTY_THREAD = {
  messages: [],
  hasMore: false,
  loaded: false,
  loading: false,
  loadingOlder: false,
};

const isVisible = () => document.visibilityState === "visible";

const messageTypeFor = (files, voice) => {
  const mime = files[0]?.mimeType || "";
  if (!mime) return "text";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return voice ? "voice" : "audio";
  return "file";
};

// Owns everything the chat UI shows: the chat list, loaded message
// threads, presence and typing state. It is the only place that talks
// to the socket for chat data, so components stay simple.
export function ChatProvider({ children }) {
  const { user, updateUser } = useAuth();
  const { toastError } = useToast();
  const me = user.id;

  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [threads, setThreads] = useState({});
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [typing, setTyping] = useState({});
  const [connected, setConnected] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [jumpTarget, setJumpTarget] = useState(null);
  // Where the "unread messages" divider goes in the open chat.
  const [unreadMarker, setUnreadMarker] = useState(null);

  // Mirrors of state for socket handlers, which must not be re-bound on
  // every render.
  const chatsRef = useRef(chats);
  const threadsRef = useRef(threads);
  const selectedRef = useRef(selectedChatId);
  const userRef = useRef(user);
  useEffect(() => {
    chatsRef.current = chats;
    threadsRef.current = threads;
    selectedRef.current = selectedChatId;
    userRef.current = user;
  });

  const jobs = useRef(new Map());
  const typingTimers = useRef(new Map());

  /* ------------------------------ chat list ------------------------------ */

  const patchChat = useCallback((chatId, patch) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat._id === chatId
          ? { ...chat, ...(typeof patch === "function" ? patch(chat) : patch) }
          : chat,
      ),
    );
  }, []);

  const upsertChat = useCallback((chat) => {
    setChats((prev) =>
      prev.some((item) => item._id === chat._id)
        ? prev.map((item) => (item._id === chat._id ? { ...item, ...chat } : item))
        : [chat, ...prev],
    );
  }, []);

  const dropChat = useCallback((chatId) => {
    setChats((prev) => prev.filter((chat) => chat._id !== chatId));
    setThreads((prev) => {
      const rest = { ...prev };
      delete rest[chatId];
      return rest;
    });
    setSelectedChatId((current) => (current === chatId ? null : current));
  }, []);

  const refreshChat = useCallback(
    async (chatId) => {
      try {
        const response = await chatApi.fetchChat(chatId);
        upsertChat(response.data);
        socket.emit("presence sync");
        return response.data;
      } catch (err) {
        if (err.response?.status === 404) dropChat(chatId);
        return null;
      }
    },
    [upsertChat, dropChat],
  );

  /* ------------------------------- threads ------------------------------- */

  const patchThread = useCallback((chatId, patch) => {
    setThreads((prev) => {
      const thread = prev[chatId] || EMPTY_THREAD;
      const changes = typeof patch === "function" ? patch(thread) : patch;
      return changes ? { ...prev, [chatId]: { ...thread, ...changes } } : prev;
    });
  }, []);

  const patchMessage = useCallback(
    (chatId, messageId, patch) => {
      patchThread(chatId, (thread) => ({
        messages: thread.messages.map((message) =>
          message._id === messageId ? { ...message, ...patch } : message,
        ),
      }));
    },
    [patchThread],
  );

  const loadThread = useCallback(
    async (chatId, around) => {
      patchThread(chatId, { loading: true });
      try {
        const response = await messageApi.fetchMessages(
          chatId,
          around ? { around } : undefined,
        );
        patchThread(chatId, (thread) => ({
          // Keep messages that are still being sent from this tab.
          messages: [
            ...response.data.messages,
            ...thread.messages.filter((message) => message.clientId),
          ],
          hasMore: response.data.hasMore,
          loaded: true,
          loading: false,
        }));
        return true;
      } catch (err) {
        patchThread(chatId, { loading: false });
        if (err.response?.status !== 404) {
          toastError(errorMessage(err, "Could not load messages."));
        }
        return false;
      }
    },
    [patchThread, toastError],
  );

  const loadOlder = useCallback(
    async (chatId) => {
      const thread = threadsRef.current[chatId];
      if (!thread?.loaded || !thread.hasMore || thread.loadingOlder) return;

      const oldest = thread.messages.find((message) => !message.clientId);
      if (!oldest) return;

      patchThread(chatId, { loadingOlder: true });
      try {
        const response = await messageApi.fetchMessages(chatId, {
          before: oldest._id,
        });
        patchThread(chatId, (current) => {
          const known = new Set(current.messages.map((message) => message._id));
          return {
            messages: [
              ...response.data.messages.filter((message) => !known.has(message._id)),
              ...current.messages,
            ],
            hasMore: response.data.hasMore,
            loadingOlder: false,
          };
        });
      } catch {
        patchThread(chatId, { loadingOlder: false });
      }
    },
    [patchThread],
  );

  const markRead = useCallback(
    (chatId) => {
      if (!isVisible()) return;
      const chat = chatsRef.current.find((item) => item._id === chatId);
      if (!chat || (!chat.unreadCount && !chat.markedUnread)) return;

      patchChat(chatId, { unreadCount: 0, markedUnread: false });
      chatApi.markChatRead(chatId).catch(() => {});
    },
    [patchChat],
  );

  /* ------------------------------ selection ------------------------------ */

  const selectChat = useCallback(
    (chatId) => {
      if (selectedRef.current === chatId) return;

      const chat = chatsRef.current.find((item) => item._id === chatId);
      setUnreadMarker(
        chat?.unreadCount
          ? { chatId, since: chat.readAt?.[me] || 0, count: chat.unreadCount }
          : null,
      );
      setReplyTo(null);
      setEditing(null);
      setJumpTarget(null);
      setSelectedChatId(chatId);

      // Lets the phone's back button return to the chat list.
      if (!window.history.state?.chatOpen) {
        window.history.pushState({ chatOpen: true }, "");
      }

      if (!threadsRef.current[chatId]?.loaded) loadThread(chatId);
      markRead(chatId);
    },
    [me, loadThread, markRead],
  );

  const closeChat = useCallback(() => {
    if (window.history.state?.chatOpen) window.history.back();
    else setSelectedChatId(null);
  }, []);

  useEffect(() => {
    const onPopState = () => setSelectedChatId(null);
    const onVisible = () => {
      if (isVisible() && selectedRef.current) markRead(selectedRef.current);
    };
    window.addEventListener("popstate", onPopState);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [markRead]);

  const openChatWith = useCallback(
    async (userId) => {
      try {
        const response = await chatApi.accessChat(userId);
        upsertChat(response.data);
        chatsRef.current = [
          response.data,
          ...chatsRef.current.filter((chat) => chat._id !== response.data._id),
        ];
        socket.emit("presence sync");
        selectChat(response.data._id);
        return response.data;
      } catch (err) {
        toastError(errorMessage(err, "Could not open that chat."));
        return null;
      }
    },
    [upsertChat, selectChat, toastError],
  );

  const jumpToMessage = useCallback(
    async (chatId, messageId) => {
      selectChat(chatId);
      const loaded = threadsRef.current[chatId]?.messages.some(
        (message) => message._id === messageId,
      );
      if (!loaded && !(await loadThread(chatId, messageId))) {
        toastError("That message is no longer available.");
        return;
      }
      setJumpTarget({ id: messageId, nonce: Date.now() });
    },
    [selectChat, loadThread, toastError],
  );

  /* --------------------------- incoming messages -------------------------- */

  // Adds a server message to its thread, replacing the optimistic copy
  // (matched by clientId) if this tab sent it.
  const receiveMessage = useCallback(
    (message, clientId) => {
      patchThread(message.chat, (thread) => {
        if (!thread.loaded) return null;

        const temp = clientId
          ? thread.messages.find((item) => item._id === clientId)
          : null;
        const exists = thread.messages.some((item) => item._id === message._id);

        if (exists) {
          return temp
            ? { messages: thread.messages.filter((item) => item !== temp) }
            : null;
        }
        if (temp) {
          // Keep showing the local file while the uploaded copy loads.
          const merged = {
            ...message,
            attachments: message.attachments.map((attachment, index) => ({
              ...attachment,
              localUrl: temp.attachments[index]?.localUrl,
            })),
          };
          return {
            messages: thread.messages.map((item) => (item === temp ? merged : item)),
          };
        }
        return { messages: [...thread.messages, message] };
      });
    },
    [patchThread],
  );

  const applyMessageUpdate = useCallback(
    (updated) => {
      patchThread(updated.chat, (thread) => ({
        messages: thread.messages.map((message) => {
          if (message._id === updated._id) {
            return {
              ...message,
              ...updated,
              starred: updated.starred ?? message.starred,
            };
          }
          if (message.replyTo?._id === updated._id) {
            return {
              ...message,
              replyTo: {
                ...message.replyTo,
                content: updated.content,
                attachments: updated.attachments,
                messageType: updated.messageType,
                deletedForEveryone: updated.deletedForEveryone,
              },
            };
          }
          return message;
        }),
      }));
      patchChat(updated.chat, (chat) =>
        chat.latestMessage?._id === updated._id
          ? { latestMessage: { ...chat.latestMessage, ...updated } }
          : {},
      );
    },
    [patchThread, patchChat],
  );

  const notify = useCallback(
    (chat, message) => {
      if (chat.muted) return;
      playMessageSound();
      if (isVisible()) return;

      const title = chatTitle(chat, me);
      const preview = messagePreview(message, me);
      showDesktopNotification({
        title,
        body:
          chat.isGroupChat && message.sender?.name
            ? `${message.sender.name}: ${preview}`
            : preview,
        icon: message.sender?.avatar || undefined,
        tag: chat._id,
        onClick: () => selectChat(chat._id),
      });
    },
    [me, selectChat],
  );

  /* -------------------------------- socket -------------------------------- */

  useEffect(() => {
    let connectedOnce = false;

    const loadChats = () =>
      chatApi
        .fetchChats()
        .then((response) => {
          setChats(response.data);
          socket.emit("presence sync");
        })
        .catch((err) => toastError(errorMessage(err, "Could not load your chats.")))
        .finally(() => setChatsLoading(false));

    const onConnect = () => {
      setConnected(true);
      if (connectedOnce) {
        // Catch up on anything missed while offline.
        loadChats();
        const open = selectedRef.current;
        setThreads((prev) => (open && prev[open] ? { [open]: prev[open] } : {}));
        if (open) loadThread(open);
      }
      connectedOnce = true;
    };

    const onMessageNew = async ({ message, clientId }) => {
      const chatId = message.chat;
      const mine = senderId(message) === me;
      const counts = !mine && message.messageType !== "system";
      let chat = chatsRef.current.find((item) => item._id === chatId);

      if (!chat) {
        // First message of a chat we have not seen (or had deleted).
        chat = await refreshChat(chatId);
        if (chat && counts) notify(chat, message);
        return;
      }

      receiveMessage(message, clientId);
      setTyping((prev) => {
        if (!prev[chatId]?.includes(senderId(message))) return prev;
        return {
          ...prev,
          [chatId]: prev[chatId].filter((id) => id !== senderId(message)),
        };
      });

      const viewing = selectedRef.current === chatId && isVisible();
      patchChat(chatId, (current) => ({
        latestMessage: message,
        unreadCount:
          counts && !viewing ? (current.unreadCount || 0) + 1 : current.unreadCount || 0,
      }));

      if (counts && viewing) chatApi.markChatRead(chatId).catch(() => {});
      if (counts && !viewing) notify(chat, message);
    };

    const onReceipt = ({ chatId, readAt = {}, deliveredAt = {} }) => {
      patchChat(chatId, (chat) => ({
        readAt: { ...chat.readAt, ...readAt },
        deliveredAt: { ...chat.deliveredAt, ...deliveredAt },
        // Read in another tab or device.
        ...(readAt[me] ? { unreadCount: 0, markedUnread: false } : {}),
      }));
    };

    const onChatUpdated = (chat) => {
      if (chatsRef.current.some((item) => item._id === chat._id)) {
        upsertChat(chat);
      } else {
        refreshChat(chat._id);
      }
    };

    const onChatCreated = (chat) => {
      upsertChat(chat);
      socket.emit("presence sync");
    };

    const onChatCleared = (chatId) => {
      patchThread(chatId, { messages: [], hasMore: false, loaded: true });
      patchChat(chatId, { latestMessage: null, unreadCount: 0 });
    };

    const onUserUpdated = (updated) => {
      setChats((prev) =>
        prev.map((chat) =>
          chat.users.some((item) => item._id === updated._id)
            ? {
                ...chat,
                users: chat.users.map((item) =>
                  item._id === updated._id ? { ...item, ...updated } : item,
                ),
              }
            : chat,
        ),
      );
      if (updated._id === me) updateUser(updated);
    };

    const onPresenceInit = (ids) => setOnlineIds(new Set(ids));

    const onPresence = ({ userId, online, lastSeen }) => {
      setOnlineIds((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
      if (!online && lastSeen) onUserUpdated({ _id: userId, lastSeen });
    };

    const onTyping = ({ chatId, userId, typing: isTyping }) => {
      const key = `${chatId}:${userId}`;
      clearTimeout(typingTimers.current.get(key));

      const update = (active) =>
        setTyping((prev) => {
          const others = (prev[chatId] || []).filter((id) => id !== userId);
          return { ...prev, [chatId]: active ? [...others, userId] : others };
        });

      update(isTyping);
      if (isTyping) {
        // Safety net in case the "stopped typing" event never arrives.
        typingTimers.current.set(
          key,
          setTimeout(() => update(false), 6000),
        );
      }
    };

    const onDisconnect = () => {
      setConnected(false);
      setTyping({});
    };

    const handlers = {
      connect: onConnect,
      disconnect: onDisconnect,
      "message new": onMessageNew,
      "message updated": applyMessageUpdate,
      "chat receipt": onReceipt,
      "chat created": onChatCreated,
      "chat updated": onChatUpdated,
      "chat removed": dropChat,
      "chat cleared": onChatCleared,
      "user updated": onUserUpdated,
      "presence init": onPresenceInit,
      presence: onPresence,
      typing: onTyping,
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));
    socket.connect();
    loadChats();

    const timers = typingTimers.current;
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
      socket.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [
    me,
    toastError,
    loadThread,
    refreshChat,
    receiveMessage,
    applyMessageUpdate,
    notify,
    patchChat,
    patchThread,
    upsertChat,
    dropChat,
    updateUser,
  ]);

  /* ------------------------------- sending -------------------------------- */

  const runJob = useCallback(
    async (clientId) => {
      const job = jobs.current.get(clientId);
      if (!job) return;

      const update = (patch) => patchMessage(job.chatId, clientId, patch);
      update({ pending: true, failed: false, progress: 0 });

      try {
        job.uploaded ||= [];
        for (let index = job.uploaded.length; index < job.files.length; index += 1) {
          const file = job.files[index];
          const response = await messageApi.uploadFile(file.blob, file.name, (progress) =>
            update({ progress }),
          );
          job.uploaded.push({
            ...response.data,
            duration: file.duration,
            width: file.width,
            height: file.height,
          });
        }

        const response = await messageApi.sendMessage({
          chatId: job.chatId,
          content: job.content,
          attachments: job.uploaded,
          replyTo: job.replyTo?._id,
          voice: job.voice,
          clientId,
        });
        jobs.current.delete(clientId);
        receiveMessage(response.data, clientId);
        patchChat(job.chatId, (chat) =>
          chat.latestMessage?._id === clientId ? { latestMessage: response.data } : {},
        );
      } catch (err) {
        update({
          pending: false,
          failed: true,
          error: errorMessage(err, "Message not sent."),
        });
      }
    },
    [patchMessage, receiveMessage, patchChat],
  );

  // Shows the message immediately, then uploads any files and sends it.
  const sendMessage = useCallback(
    (chatId, { content = "", files = [], reply = null, voice = false }) => {
      const clientId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const sender = userRef.current;

      const temp = {
        _id: clientId,
        clientId,
        pending: true,
        chat: chatId,
        sender: { _id: me, name: sender.name, avatar: sender.avatar },
        content,
        messageType: messageTypeFor(files, voice),
        attachments: files.map((file) => ({
          url: "",
          localUrl: file.previewUrl,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          duration: file.duration,
          width: file.width,
          height: file.height,
        })),
        replyTo: reply,
        reactions: [],
        createdAt: new Date().toISOString(),
      };

      jobs.current.set(clientId, { chatId, content, files, replyTo: reply, voice });
      patchThread(chatId, (thread) => ({ messages: [...thread.messages, temp] }));
      patchChat(chatId, { latestMessage: temp });
      setUnreadMarker(null);
      runJob(clientId);
    },
    [me, patchThread, patchChat, runJob],
  );

  const discardMessage = useCallback(
    (chatId, clientId) => {
      jobs.current.delete(clientId);
      patchThread(chatId, (thread) => ({
        messages: thread.messages.filter((message) => message._id !== clientId),
      }));
      refreshChat(chatId);
    },
    [patchThread, refreshChat],
  );

  /* ---------------------------- message actions --------------------------- */

  const guard = useCallback(
    async (action, fallback) => {
      try {
        return await action();
      } catch (err) {
        toastError(errorMessage(err, fallback));
        return null;
      }
    },
    [toastError],
  );

  const reactTo = useCallback(
    (message, emoji) =>
      guard(async () => {
        const response = await messageApi.reactToMessage(message._id, emoji);
        applyMessageUpdate(response.data);
      }, "Could not add your reaction."),
    [guard, applyMessageUpdate],
  );

  const toggleStar = useCallback(
    (message) => {
      const starred = !message.starred;
      patchMessage(message.chat, message._id, { starred });
      return guard(async () => {
        await messageApi.starMessage(message._id, starred);
        return true;
      }, "Could not update the star.").then((ok) => {
        if (!ok) patchMessage(message.chat, message._id, { starred: !starred });
        return ok;
      });
    },
    [guard, patchMessage],
  );

  const saveEdit = useCallback(
    (message, content) =>
      guard(async () => {
        const response = await messageApi.editMessage(message._id, content);
        applyMessageUpdate(response.data);
        return true;
      }, "Could not edit this message."),
    [guard, applyMessageUpdate],
  );

  const removeMessage = useCallback(
    (message, scope) =>
      guard(async () => {
        await messageApi.deleteMessage(message._id, scope);
        if (scope !== "everyone") {
          patchThread(message.chat, (thread) => ({
            messages: thread.messages.filter((item) => item._id !== message._id),
          }));
          const chat = chatsRef.current.find((item) => item._id === message.chat);
          if (chat?.latestMessage?._id === message._id) refreshChat(message.chat);
        }
        return true;
      }, "Could not delete this message."),
    [guard, patchThread, refreshChat],
  );

  const forward = useCallback(
    (messageIds, chatIds) =>
      guard(async () => {
        await messageApi.forwardMessages(messageIds, chatIds);
        return true;
      }, "Could not forward the message."),
    [guard],
  );

  /* ----------------------------- chat actions ----------------------------- */

  const setPrefs = useCallback(
    (chatId, prefs) => {
      patchChat(chatId, prefs);
      return guard(async () => {
        const response = await chatApi.updateChatPrefs(chatId, prefs);
        upsertChat(response.data);
        return true;
      }, "Could not update this chat.").then((ok) => {
        if (!ok) refreshChat(chatId);
        return ok;
      });
    },
    [guard, patchChat, upsertChat, refreshChat],
  );

  const clearMessages = useCallback(
    (chatId) =>
      guard(async () => {
        await chatApi.clearChat(chatId);
        patchThread(chatId, { messages: [], hasMore: false, loaded: true });
        patchChat(chatId, { latestMessage: null, unreadCount: 0 });
        return true;
      }, "Could not clear this chat."),
    [guard, patchThread, patchChat],
  );

  const removeChat = useCallback(
    (chat) =>
      guard(
        async () => {
          if (chat.isGroupChat) await chatApi.leaveGroup(chat._id);
          else await chatApi.deleteChat(chat._id);
          dropChat(chat._id);
          return true;
        },
        chat.isGroupChat ? "Could not exit the group." : "Could not delete this chat.",
      ),
    [guard, dropChat],
  );

  const setBlocked = useCallback(
    (userId, blocked) =>
      guard(async () => {
        const response = await (blocked ? blockUser(userId) : unblockUser(userId));
        updateUser(response.data);
        return true;
      }, "Could not update the block list."),
    [guard, updateUser],
  );

  /* -------------------------------- derived ------------------------------- */

  const sortedChats = useMemo(() => sortChats(chats), [chats]);
  const selectedChat = useMemo(
    () => chats.find((chat) => chat._id === selectedChatId) || null,
    [chats, selectedChatId],
  );
  const thread = (selectedChatId && threads[selectedChatId]) || EMPTY_THREAD;

  const unreadChats = useMemo(
    () =>
      chats.filter((chat) => !chat.muted && (chat.unreadCount > 0 || chat.markedUnread))
        .length,
    [chats],
  );

  useEffect(() => {
    document.title = unreadChats > 0 ? `(${unreadChats}) Chat App` : "Chat App";
    return () => {
      document.title = "Chat App";
    };
  }, [unreadChats]);

  const value = {
    me,
    chats: sortedChats,
    chatsLoading,
    connected,
    selectedChat,
    selectedChatId,
    thread,
    onlineIds,
    typing,
    replyTo,
    setReplyTo,
    editing,
    setEditing,
    jumpTarget,
    unreadMarker,

    selectChat,
    closeChat,
    openChatWith,
    upsertChat,
    refreshChat,
    loadOlder,
    jumpToMessage,
    markRead,

    sendMessage,
    retryMessage: runJob,
    discardMessage,
    reactTo,
    toggleStar,
    saveEdit,
    removeMessage,
    forward,

    setPrefs,
    clearMessages,
    removeChat,
    setBlocked,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
