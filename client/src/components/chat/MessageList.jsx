import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiCheck,
  FiCopy,
  FiCornerUpLeft,
  FiEdit3,
  FiDownload,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import {
  fetchMessages,
  markMessagesAsRead,
  deleteMessageForMe,
  deleteMessageForEveryone,
  editMessage,
} from "../../services/messageService";
import { useChat } from "../../context/useChat";
import { useAuth } from "../../context/useAuth";
import socket from "../../socket";

const MENU_WIDTH = 220;
const MENU_ITEM_HEIGHT = 40;

function getSenderId(message) {
  return message?.sender?._id || message?.sender;
}

function getChatId(message) {
  return message?.chat?._id || message?.chat;
}

function getMessagePreview(message) {
  if (!message) return "";
  if (message.content) return message.content;

  const attachment = message.attachments?.[0];
  if (!attachment) return "Message";
  if (attachment.mimeType?.startsWith("image/")) return "Photo";
  if (attachment.mimeType?.startsWith("audio/")) return "Voice note";

  return attachment.name || "Attachment";
}

function MessageList() {
  const { token, user } = useAuth();

  const {
    selectedChat,
    messages,
    setMessages,
    setChats,
    setReplyMessage,
  } = useChat();

  const bottomRef = useRef(null);
  const joinedChatRef = useRef(null);
  const editInputRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [editedText, setEditedText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [actionError, setActionError] = useState("");
  const [menu, setMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    message: null,
  });

  const selectedChatId = selectedChat?._id;

  const updateMessage = useCallback((updatedMessage) => {
    setMessages((prev) =>
      prev.map((message) =>
        message._id === updatedMessage._id
          ? {
              ...message,
              ...updatedMessage,
            }
          : message
      )
    );

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.latestMessage?._id === updatedMessage._id
          ? {
              ...chat,
              latestMessage: {
                ...chat.latestMessage,
                ...updatedMessage,
              },
            }
          : chat
      )
    );
  }, [setChats, setMessages]);

  const closeMenu = () => {
    setMenu((prev) => ({
      ...prev,
      visible: false,
      message: null,
    }));
  };

  const openMenu = (event, message) => {
    event.preventDefault();
    event.stopPropagation();

    const isOwnMessage = getSenderId(message) === user.id;
    const menuItemsCount =
      3 + (isOwnMessage && !message.deletedForEveryone ? 2 : 0);
    const menuHeight = menuItemsCount * MENU_ITEM_HEIGHT + 16;
    const maxX = window.innerWidth - MENU_WIDTH - 12;
    const maxY = window.innerHeight - menuHeight - 12;

    setActionError("");
    setMenu({
      visible: true,
      x: Math.max(12, Math.min(event.clientX, maxX)),
      y: Math.max(12, Math.min(event.clientY, maxY)),
      message,
    });
  };

  const beginEdit = (message) => {
    setEditingId(message._id);
    setEditedText(message.content || "");
    closeMenu();
  };

  const beginReply = (message) => {
    setReplyMessage(message);
    closeMenu();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditedText("");
    setSavingEdit(false);
    setActionError("");
  };

  const saveEdit = async () => {
    const trimmedText = editedText.trim();

    if (!editingId || savingEdit) return;

    if (!trimmedText) {
      setActionError("Message cannot be empty.");
      return;
    }

    try {
      setSavingEdit(true);
      setActionError("");

      const response = await editMessage(
        editingId,
        trimmedText,
        token
      );

      updateMessage(response.data);
      cancelEdit();
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          "Could not edit this message."
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteForMe = async (messageId) => {
    try {
      setActionError("");
      closeMenu();
      await deleteMessageForMe(messageId, token);

      setMessages((prev) =>
        prev.filter((message) => message._id !== messageId)
      );
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          "Could not delete this message."
      );
    }
  };

  const handleDeleteForEveryone = async (messageId) => {
    try {
      setActionError("");
      closeMenu();
      await deleteMessageForEveryone(messageId, token);
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          "Could not delete this message for everyone."
      );
    }
  };

  const copyMessage = async (message) => {
    try {
      setActionError("");
      closeMenu();

      if (!message.content || message.deletedForEveryone) return;

      await navigator.clipboard.writeText(message.content);
    } catch {
      setActionError("Could not copy this message.");
    }
  };

  const getMenuActions = () => {
    const message = menu.message;
    if (!message) return [];

    const isOwnMessage = getSenderId(message) === user.id;
    const canEdit =
      isOwnMessage &&
      !message.deletedForEveryone &&
      (message.messageType || "text") === "text";

    const actions = [];

    if (!message.deletedForEveryone) {
      actions.push({
        label: "Reply",
        icon: FiCornerUpLeft,
        onClick: () => beginReply(message),
      });

      actions.push({
        label: "Copy",
        icon: FiCopy,
        onClick: () => copyMessage(message),
      });
    }

    if (canEdit) {
      actions.push({
        label: "Edit",
        icon: FiEdit3,
        onClick: () => beginEdit(message),
      });
    }

    actions.push({
      label: "Delete for me",
      icon: FiTrash2,
      onClick: () => handleDeleteForMe(message._id),
    });

    if (isOwnMessage && !message.deletedForEveryone) {
      actions.push({
        label: "Delete for everyone",
        icon: FiTrash2,
        danger: true,
        onClick: () => handleDeleteForEveryone(message._id),
      });
    }

    return actions;
  };

  useEffect(() => {
    if (!selectedChatId) return;

    if (joinedChatRef.current !== selectedChatId) {
      socket.emit("join chat", selectedChatId);
      joinedChatRef.current = selectedChatId;
    }

    const loadMessages = async () => {
      try {
        const response = await fetchMessages(selectedChatId, token);

        setMessages(response.data);
        await markMessagesAsRead(selectedChatId, token);
        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat._id === selectedChatId
              ? {
                  ...chat,
                  unreadCount: 0,
                  unreadCounts: {
                    ...chat.unreadCounts,
                    [user.id]: 0,
                  },
                }
              : chat
          )
        );
      } catch (err) {
        console.error(err);
      }
    };

    loadMessages();

    const handleMessageReceived = async (newMessage) => {
      setChats((prevChats) => {
        const updatedChats = prevChats.map((chat) =>
          chat._id === getChatId(newMessage)
            ? {
                ...chat,
                latestMessage: newMessage,
              }
            : chat
        );

        updatedChats.sort((a, b) => {
          const aTime = a.latestMessage
            ? new Date(a.latestMessage.createdAt)
            : 0;
          const bTime = b.latestMessage
            ? new Date(b.latestMessage.createdAt)
            : 0;

          return bTime - aTime;
        });

        return updatedChats;
      });

      if (getChatId(newMessage) === selectedChatId) {
        setMessages((prev) =>
          prev.some((message) => message._id === newMessage._id)
            ? prev
            : [...prev, newMessage]
        );

        if (getSenderId(newMessage) !== user.id) {
          socket.emit("message delivered", newMessage._id);
          await markMessagesAsRead(selectedChatId, token);
        }
      }
    };

    const handleMessageDelivered = (messageId) => {
      setMessages((prev) =>
        prev.map((message) =>
          message._id === messageId
            ? {
                ...message,
                delivered: true,
              }
            : message
        )
      );
    };

    const handleMessagesRead = (payload) => {
      const chatId =
        typeof payload === "string" ? payload : payload.chatId;
      const readerId =
        typeof payload === "string" ? null : payload.readerId;

      if (chatId !== selectedChatId || readerId === user.id) return;

      setMessages((prev) =>
        prev.map((message) =>
          getSenderId(message) === user.id
            ? {
                ...message,
                read: true,
              }
            : message
        )
      );
    };

    const handleMessageEdited = (updatedMessage) => {
      updateMessage(updatedMessage);
    };

    const handleMessageDeleted = (messageId) => {
      const deletedMessage = {
        _id: messageId,
        content: "This message was deleted",
        deletedForEveryone: true,
      };

      updateMessage(deletedMessage);
    };

    socket.on("message received", handleMessageReceived);
    socket.on("message delivered", handleMessageDelivered);
    socket.on("messages read", handleMessagesRead);
    socket.on("message edited", handleMessageEdited);
    socket.on("message deleted", handleMessageDeleted);

    return () => {
      socket.off("message received", handleMessageReceived);
      socket.off("message delivered", handleMessageDelivered);
      socket.off("messages read", handleMessagesRead);
      socket.off("message edited", handleMessageEdited);
      socket.off("message deleted", handleMessageDeleted);

      joinedChatRef.current = null;
    };
  }, [
    selectedChatId,
    token,
    updateMessage,
    user.id,
    setChats,
    setMessages,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  useEffect(() => {
    const handleDismiss = () => closeMenu();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeMenu();
        cancelEdit();
      }
    };

    window.addEventListener("mousedown", handleDismiss);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handleDismiss);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!selectedChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900 text-gray-400">
        Select a chat to start messaging
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-y-auto bg-gray-900 p-5 text-left">
      {actionError && (
        <div className="sticky top-0 z-20 mx-auto mb-4 max-w-md rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 shadow">
          {actionError}
        </div>
      )}

      {messages.map((message) => {
        const isOwnMessage = getSenderId(message) === user.id;
        const isEditing = editingId === message._id;
        const isDeleted = message.deletedForEveryone;

        return (
          <div
            key={message._id}
            onContextMenu={(event) => openMenu(event, message)}
            className={`mb-4 flex ${
              isOwnMessage ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[min(24rem,80%)] rounded-2xl px-4 py-2 shadow-sm ${
                isOwnMessage
                  ? "rounded-br-md bg-blue-600 text-white"
                  : "rounded-bl-md bg-gray-200 text-gray-950"
              }`}
            >
              {message.replyTo && !isDeleted && (
                <div
                  className={`mb-2 rounded-md border-l-4 px-3 py-2 text-xs ${
                    isOwnMessage
                      ? "border-white/70 bg-white/15 text-white"
                      : "border-blue-500 bg-white/80 text-gray-700"
                  }`}
                >
                  <div className="font-semibold">
                    {message.replyTo.sender?.name || "Replied message"}
                  </div>
                  <div className="truncate opacity-80">
                    {getMessagePreview(message.replyTo)}
                  </div>
                </div>
              )}

              {isEditing ? (
                <div className="min-w-64">
                  <textarea
                    ref={editInputRef}
                    value={editedText}
                    rows={2}
                    onChange={(event) =>
                      setEditedText(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        saveEdit();
                      }

                      if (event.key === "Escape") {
                        cancelEdit();
                      }
                    }}
                    className="w-full resize-none rounded-md border border-white/40 bg-white/10 px-3 py-2 text-sm text-inherit outline-none placeholder:text-white/70 focus:border-white"
                  />

                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
                      title="Cancel edit"
                      aria-label="Cancel edit"
                    >
                      <FiX />
                    </button>

                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={savingEdit}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Save edit"
                      aria-label="Save edit"
                    >
                      <FiCheck />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {(isDeleted || message.content) && (
                    <p
                      className={`wrap-break-word text-sm leading-relaxed ${
                        isDeleted ? "italic text-gray-400" : ""
                      }`}
                    >
                      {isDeleted
                        ? "This message was deleted"
                        : message.content}
                    </p>
                  )}

                  {!isDeleted &&
                    message.attachments?.map((attachment, index) => (
                      <div
                        key={`${message._id}-${attachment.name}-${index}`}
                        className={message.content ? "mt-2" : ""}
                      >
                        {attachment.mimeType?.startsWith("image/") ? (
                          <a
                            href={attachment.url}
                            download={attachment.name}
                            className="block overflow-hidden rounded-lg"
                          >
                            <img
                              src={attachment.url}
                              alt={attachment.name}
                              className="max-h-72 w-full object-cover"
                            />
                          </a>
                        ) : attachment.mimeType?.startsWith(
                            "audio/"
                          ) ? (
                          <audio
                            controls
                            src={attachment.url}
                            className="max-w-full"
                          >
                            <track kind="captions" />
                          </audio>
                        ) : (
                          <a
                            href={attachment.url}
                            download={attachment.name}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                              isOwnMessage
                                ? "bg-white/15 hover:bg-white/25"
                                : "bg-white hover:bg-gray-50"
                            }`}
                          >
                            <FiDownload className="shrink-0" />
                            <span className="truncate">
                              {attachment.name}
                            </span>
                          </a>
                        )}
                      </div>
                    ))}
                </>
              )}

              <div className="mt-1 flex items-center justify-end gap-1">
                {message.edited && !isDeleted && (
                  <span className="text-[10px] italic opacity-75">
                    (edited)
                  </span>
                )}

                <span className="text-[10px] opacity-80">
                  {new Date(message.createdAt).toLocaleTimeString(
                    [],
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                </span>

                {isOwnMessage && !isDeleted && (
                  <span
                    className={`text-[11px] ${
                      message.read
                        ? "text-green-300"
                        : "text-white/90"
                    }`}
                    title={
                      message.read
                        ? "Read"
                        : message.delivered
                        ? "Delivered"
                        : "Sent"
                    }
                  >
                    {message.read
                      ? "\u2713\u2713"
                      : message.delivered
                      ? "\u2713\u2713"
                      : "\u2713"}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {menu.visible && (
        <div
          className="fixed z-50 w-55 overflow-hidden rounded-md border border-gray-200 bg-white py-2 text-sm text-gray-800 shadow-xl"
          style={{
            left: menu.x,
            top: menu.y,
          }}
          onMouseDown={(event) => event.stopPropagation()}
          role="menu"
        >
          {getMenuActions().map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={`flex h-10 w-full items-center gap-3 px-3 text-left hover:bg-gray-100 ${
                  action.danger ? "text-red-600" : ""
                }`}
                role="menuitem"
              >
                <Icon className="shrink-0" />
                <span className="truncate">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div ref={bottomRef}></div>
    </div>
  );
}

export default MessageList;
