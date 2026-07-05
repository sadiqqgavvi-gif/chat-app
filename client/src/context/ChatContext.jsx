import { useState } from "react";
import { ChatContext } from "./chat-context";

export function ChatProvider({ children }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyMessage, setReplyMessage] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  return (
    <ChatContext.Provider
      value={{
        chats,
        setChats,

        selectedChat,
        setSelectedChat,

        messages,
        setMessages,

        replyMessage,
        setReplyMessage,

        onlineUsers,
        setOnlineUsers,

        isTyping,
        setIsTyping,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
