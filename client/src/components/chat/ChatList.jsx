import { useEffect, useState } from "react";
import { FiUsers } from "react-icons/fi";
import { fetchChats } from "../../services/chatService";
import { useAuth } from "../../context/useAuth";
import { useChat } from "../../context/useChat";

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getLatestPreview(chat) {
  const message = chat.latestMessage;

  if (!message) return "No messages yet";
  if (message.deletedForEveryone) return "This message was deleted";
  if (message.content) {
    const sender = message.sender?.name
      ? `${message.sender.name}: `
      : "";

    return chat.isGroupChat
      ? `${sender}${message.content}`
      : message.content;
  }
  if (message.attachments?.[0]?.mimeType?.startsWith("image/")) {
    return chat.isGroupChat
      ? `${message.sender?.name || "Someone"}: Photo`
      : "Photo";
  }
  if (message.attachments?.[0]?.mimeType?.startsWith("audio/")) {
    return chat.isGroupChat
      ? `${message.sender?.name || "Someone"}: Voice note`
      : "Voice note";
  }

  return chat.isGroupChat
    ? `${message.sender?.name || "Someone"}: Attachment`
    : "Attachment";
}

function getUnreadCount(chat, userId) {
  return (
    chat.unreadCount ??
    chat.unreadCounts?.[userId] ??
    chat.unreadCounts?.get?.(userId) ??
    0
  );
}

function ChatList() {
  const { token, user } = useAuth();

  const {
    chats,
    setChats,
    selectedChat,
    setSelectedChat,
    setReplyMessage,
    onlineUsers,
  } = useChat();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;

    const loadChats = async () => {
      try {
        setLoading(true);

        const response = await fetchChats(token);

        setChats(response.data);
      } catch (err) {
        console.error("Error loading chats:", err);
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, [token, setChats]);

  if (!token) {
    return <div className="p-4 text-gray-500">Loading user...</div>;
  }

  if (loading) {
    return <div className="p-4 text-gray-500">Loading chats...</div>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {chats.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">
          Search for people or create a group to start chatting.
        </div>
      ) : (
        chats.map((chat) => {
          const otherUser = chat.users.find(
            (currentUser) => currentUser._id !== user.id
          );
          const isGroup = chat.isGroupChat;
          const title = isGroup
            ? chat.chatName
            : otherUser?.name || "Unknown user";
          const unread = getUnreadCount(chat, user.id);
          const selected = selectedChat?._id === chat._id;
          const online =
            !isGroup && onlineUsers.includes(otherUser?._id);

          return (
            <button
              key={chat._id}
              type="button"
              onClick={() => {
                setSelectedChat(chat);
                setReplyMessage(null);
              }}
              className={`flex w-full items-center gap-3 border-b border-gray-200 px-4 py-3 text-left transition hover:bg-gray-100 ${
                selected ? "bg-blue-50" : "bg-white"
              }`}
            >
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                {isGroup ? (
                  <FiUsers />
                ) : otherUser?.avatar ? (
                  <img
                    src={otherUser.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(title) || "U"
                )}

                {online && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-gray-950">
                    {title}
                  </span>

                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-green-500 px-1.5 text-xs font-semibold text-white">
                      {unread}
                    </span>
                  )}
                </div>

                <p className="mt-0.5 truncate text-sm text-gray-500">
                  {getLatestPreview(chat)}
                </p>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

export default ChatList;
