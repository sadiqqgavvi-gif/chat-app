import { useEffect, useState } from "react";
import { FiStar } from "react-icons/fi";
import PanelHeader from "./PanelHeader";
import Spinner from "../ui/Spinner";
import { useChat } from "../../context/contexts";
import { fetchStarred } from "../../services/messageService";
import { formatListTime, messagePreview, senderId } from "../../lib/format";

function StarredPanel({ onBack }) {
  const { me, jumpToMessage } = useChat();
  const [messages, setMessages] = useState(null);

  useEffect(() => {
    fetchStarred()
      .then((response) => setMessages(response.data))
      .catch(() => setMessages([]));
  }, []);

  return (
    <>
      <PanelHeader title="Starred messages" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {messages === null ? (
          <div className="flex justify-center p-6 text-muted">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center px-8 py-16 text-center text-muted">
            <FiStar className="mb-3 text-4xl text-faint" />
            <p className="text-sm">
              Star a message to find it here later. Open a message's menu and choose
              "Star".
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <button
              key={message._id}
              type="button"
              onClick={() => jumpToMessage(message.chat, message._id)}
              className="block w-full border-b border-line px-4 py-3 text-left hover:bg-hover"
            >
              <div className="flex items-baseline justify-between gap-2 text-xs text-muted">
                <span className="truncate">
                  {senderId(message) === me ? "You" : message.sender?.name} ·{" "}
                  {message.chatTitle}
                </span>
                <span className="shrink-0">{formatListTime(message.createdAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-ink">
                {messagePreview(message, me)}
              </p>
            </button>
          ))
        )}
      </div>
    </>
  );
}

export default StarredPanel;
