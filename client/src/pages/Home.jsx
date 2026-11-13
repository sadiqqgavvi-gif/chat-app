import { FiLock, FiMessageCircle } from "react-icons/fi";
import Sidebar from "../components/sidebar/Sidebar";
import ChatWindow from "../components/chat/ChatWindow";
import CallOverlay from "../components/call/CallOverlay";
import { ChatProvider } from "../context/ChatContext";
import { CallProvider } from "../context/CallContext";
import { useChat } from "../context/contexts";

function EmptyState() {
  return (
    <div className="hidden min-w-0 flex-1 flex-col items-center justify-center bg-soft p-8 text-center md:flex">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand/10 text-4xl text-brand">
        <FiMessageCircle />
      </div>
      <h2 className="text-xl font-semibold text-ink">Your messages</h2>
      <p className="mt-2 max-w-sm text-sm text-muted">
        Pick a chat from the list, or start a new one, to send messages, photos, files and
        voice notes in real time.
      </p>
      <p className="mt-8 flex items-center gap-1.5 text-xs text-faint">
        <FiLock /> Only people in a chat can see its messages.
      </p>
    </div>
  );
}

function Layout() {
  const { selectedChat, connected, chatsLoading } = useChat();

  return (
    <div className="mx-auto flex h-dvh max-w-[1600px] flex-col overflow-hidden bg-panel shadow-xl">
      {!connected && !chatsLoading && (
        <div className="bg-amber-500 px-4 py-1 text-center text-xs font-medium text-white">
          Connection lost. Reconnecting…
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {/* On phones only one of the two columns is visible at a time. */}
        <Sidebar className={selectedChat ? "hidden md:flex" : "flex"} />
        {selectedChat ? <ChatWindow key={selectedChat._id} /> : <EmptyState />}
      </div>
      <CallOverlay />
    </div>
  );
}

function Home() {
  return (
    <ChatProvider>
      <CallProvider>
        <Layout />
      </CallProvider>
    </ChatProvider>
  );
}

export default Home;
