import { useEffect, useRef } from "react";
import Header from "../components/layout/Header";
import Sidebar from "../components/layout/Sidebar";
import ChatWindow from "../components/chat/ChatWindow";
import socket from "../socket";
import { useAuth } from "../context/useAuth";
import { useChat } from "../context/useChat";

function getChatId(chat) {
  return chat?._id || chat;
}

function getMessageChatId(message) {
  return message?.chat?._id || message?.chat;
}

function sortChats(chats) {
  return [...chats].sort((a, b) => {
    const aTime = new Date(
      a.latestMessage?.createdAt || a.updatedAt || 0
    );
    const bTime = new Date(
      b.latestMessage?.createdAt || b.updatedAt || 0
    );

    return bTime - aTime;
  });
}

function Home() {
  const { user } = useAuth();
  const {
    selectedChat,
    setSelectedChat,
    setChats,
    setOnlineUsers,
  } = useChat();
  const selectedChatRef = useRef(null);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    if (!user) return;

    socket.connect();

    const onConnect = () => {
      socket.emit("setup", user);
    };

    const onOnlineUsers = (users) => {
      setOnlineUsers(users);
    };

    const onChatCreated = (chat) => {
      setChats((prev) =>
        prev.some((currentChat) => currentChat._id === chat._id)
          ? prev
          : sortChats([chat, ...prev])
      );
    };

    const onChatUpdated = (chat) => {
      setChats((prev) =>
        sortChats(
          prev.map((currentChat) =>
            currentChat._id === chat._id ? chat : currentChat
          )
        )
      );

      if (selectedChatRef.current?._id === chat._id) {
        setSelectedChat(chat);
      }
    };

    const onChatRemoved = (chatId) => {
      setChats((prev) =>
        prev.filter((currentChat) => currentChat._id !== chatId)
      );

      if (selectedChatRef.current?._id === chatId) {
        setSelectedChat(null);
      }
    };

    const onMessageReceived = (message) => {
      const chatId = getMessageChatId(message);
      const incoming = message.sender?._id !== user.id;
      const selected = selectedChatRef.current?._id === chatId;

      setChats((prev) => {
        const chatExists = prev.some(
          (currentChat) => currentChat._id === chatId
        );

        const nextChats = chatExists
          ? prev.map((currentChat) =>
              currentChat._id === chatId
                ? {
                    ...currentChat,
                    latestMessage: message,
                    unreadCount:
                      selected
                        ? 0
                        : incoming
                        ? (currentChat.unreadCount || 0) + 1
                        : currentChat.unreadCount || 0,
                  }
                : currentChat
            )
          : [
              {
                ...message.chat,
                _id: getChatId(message.chat),
                latestMessage: message,
                unreadCount: incoming && !selected ? 1 : 0,
              },
              ...prev,
            ];

        return sortChats(nextChats);
      });
    };

    socket.on("connect", onConnect);
    socket.on("online users", onOnlineUsers);
    socket.on("chat created", onChatCreated);
    socket.on("chat updated", onChatUpdated);
    socket.on("chat removed", onChatRemoved);
    socket.on("message received", onMessageReceived);

    if (socket.connected) {
      socket.emit("setup", user);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("online users", onOnlineUsers);
      socket.off("chat created", onChatCreated);
      socket.off("chat updated", onChatUpdated);
      socket.off("chat removed", onChatRemoved);
      socket.off("message received", onMessageReceived);
      socket.disconnect();
    };
  }, [
    user,
    setChats,
    setOnlineUsers,
    setSelectedChat,
  ]);

  return (
    <div className="flex h-screen min-w-0 flex-col overflow-hidden bg-gray-100 dark:bg-slate-950">
      <Header />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />

        <ChatWindow />
      </div>
    </div>
  );
}

export default Home;
