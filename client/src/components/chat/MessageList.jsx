import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiChevronDown } from "react-icons/fi";
import MessageBubble from "./MessageBubble";
import Spinner from "../ui/Spinner";
import { useChat } from "../../context/contexts";
import { formatDay, isSameDay, receiptStatus, senderId } from "../../lib/format";

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 120;

function DayDivider({ date }) {
  return (
    <div className="sticky top-2 z-10 my-3 flex justify-center">
      <span className="rounded-lg bg-panel/95 px-3 py-1 text-xs font-medium text-muted shadow-sm">
        {formatDay(date)}
      </span>
    </div>
  );
}

function MessageList({ chat, actions }) {
  const { me, thread, loadOlder, jumpTarget, unreadMarker, typing } = useChat();
  const { messages, loaded, loading, hasMore, loadingOlder } = thread;

  const scrollerRef = useRef(null);
  const contentRef = useRef(null);
  // Whether the view should follow new content to the bottom.
  const stickRef = useRef(true);
  const snapshot = useRef({ ready: false, firstId: null, lastId: null, height: 0 });

  const [showJumpDown, setShowJumpDown] = useState(false);
  // Last message that was on screen when the user was at the bottom;
  // anything after it is "new" while they are scrolled up.
  const [seenUpToId, setSeenUpToId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);

  const typingIds = typing[chat._id];
  const someoneTyping = typingIds?.length > 0;

  const scrollToBottom = useCallback((smooth = false) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    stickRef.current = true;
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  const firstUnreadId = useMemo(() => {
    if (unreadMarker?.chatId !== chat._id) return null;
    const since = new Date(unreadMarker.since).getTime();
    return (
      messages.find(
        (message) =>
          senderId(message) !== me &&
          message.messageType !== "system" &&
          new Date(message.createdAt).getTime() > since,
      )?._id || null
    );
  }, [messages, unreadMarker, chat._id, me]);

  // Keep the scroll position sensible whenever the list changes.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !loaded) return;

    const previous = snapshot.current;
    const firstId = messages[0]?._id || null;
    const last = messages[messages.length - 1];
    const lastId = last?._id || null;

    if (!previous.ready) {
      // First paint of this chat: start at the unread divider if there
      // is one, otherwise at the newest message.
      const divider = scroller.querySelector("[data-unread-divider]");
      if (divider) {
        stickRef.current = false;
        divider.scrollIntoView({ block: "center" });
      } else {
        scroller.scrollTop = scroller.scrollHeight;
      }
    } else if (firstId !== previous.firstId && lastId === previous.lastId) {
      // Older messages were added above: stay on the same message.
      scroller.scrollTop += scroller.scrollHeight - previous.height;
    } else if (lastId !== previous.lastId && last) {
      if (senderId(last) === me || stickRef.current) {
        scrollToBottom(previous.ready && stickRef.current);
      }
    }

    snapshot.current = { ready: true, firstId, lastId, height: scroller.scrollHeight };
  }, [messages, loaded, me, scrollToBottom]);

  // Images, reactions and the typing bubble change the height after
  // render; keep following the bottom if that is where the user is.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return undefined;

    const observer = new ResizeObserver(() => {
      if (stickRef.current) scroller.scrollTop = scroller.scrollHeight;
      snapshot.current.height = scroller.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [loaded]);

  // If the first page does not fill the screen, fetch more right away.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (
      loaded &&
      hasMore &&
      !loadingOlder &&
      scroller.scrollHeight <= scroller.clientHeight + 200
    ) {
      loadOlder(chat._id);
    }
  }, [loaded, hasMore, loadingOlder, messages.length, chat._id, loadOlder]);

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;

    stickRef.current = distance < NEAR_BOTTOM_PX;
    setShowJumpDown(distance > 400);
    if (stickRef.current) setSeenUpToId(messages[messages.length - 1]?._id || null);
    if (scroller.scrollTop < 400 && hasMore && !loadingOlder) loadOlder(chat._id);
  };

  // Scroll to and flash a specific message (reply quote, search, star).
  useEffect(() => {
    if (!jumpTarget || !loaded) return undefined;
    const element = scrollerRef.current?.querySelector(
      `[data-mid="${CSS.escape(jumpTarget.id)}"]`,
    );
    if (!element) return undefined;

    stickRef.current = false;
    element.scrollIntoView({ block: "center" });
    setHighlightId(jumpTarget.id);
    const timer = setTimeout(() => setHighlightId(null), 1700);
    return () => clearTimeout(timer);
  }, [jumpTarget, loaded]);

  const seenIndex = messages.findIndex((message) => message._id === seenUpToId);
  const newBelow =
    showJumpDown && seenIndex !== -1
      ? messages.slice(seenIndex + 1).filter((message) => senderId(message) !== me).length
      : 0;

  const rows = [];
  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    const newDay = !previous || !isSameDay(previous.createdAt, message.createdAt);

    if (newDay)
      rows.push(<DayDivider key={`day-${message._id}`} date={message.createdAt} />);
    if (message._id === firstUnreadId) {
      rows.push(
        <div key="unread" data-unread-divider className="my-3 flex justify-center">
          <span className="rounded-full bg-panel px-4 py-1 text-xs font-medium text-brand shadow-sm">
            {unreadMarker.count} unread message{unreadMarker.count === 1 ? "" : "s"}
          </span>
        </div>,
      );
    }

    const sameSender =
      previous &&
      !newDay &&
      previous.messageType !== "system" &&
      senderId(previous) === senderId(message);
    const grouped =
      sameSender &&
      message._id !== firstUnreadId &&
      new Date(message.createdAt) - new Date(previous.createdAt) < GROUP_WINDOW_MS;

    rows.push(
      <MessageBubble
        key={message._id}
        message={message}
        me={me}
        isGroup={chat.isGroupChat}
        status={senderId(message) === me ? receiptStatus(message, chat, me) : null}
        showName={!sameSender}
        grouped={grouped}
        highlighted={highlightId === message._id}
        {...actions}
      />,
    );
  });

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="chat-wallpaper h-full overflow-y-auto overscroll-contain pb-3"
      >
        <div ref={contentRef}>
          {loadingOlder && (
            <div className="flex justify-center py-3 text-muted">
              <Spinner className="h-4 w-4" />
            </div>
          )}

          {!loaded && loading ? (
            <div className="flex justify-center pt-16 text-muted">
              <Spinner />
            </div>
          ) : loaded && messages.length === 0 ? (
            <div className="flex justify-center px-6 pt-16">
              <p className="rounded-xl bg-panel px-5 py-3 text-center text-sm text-muted shadow-sm">
                No messages here yet. Say hello 👋
              </p>
            </div>
          ) : (
            rows
          )}

          {someoneTyping && (
            <div className="mt-2.5 flex px-3 sm:px-[5%]">
              <div
                className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-bubble-in px-3.5 py-3 shadow-sm"
                aria-label="Typing"
              >
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
              </div>
            </div>
          )}
        </div>
      </div>

      {showJumpDown && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 right-4 flex h-10 w-10 animate-pop items-center justify-center rounded-full bg-panel text-xl text-muted shadow-lg hover:text-ink"
          aria-label="Scroll to latest messages"
        >
          <FiChevronDown />
          {newBelow > 0 && (
            <span className="absolute -top-1.5 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-white">
              {newBelow}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

export default MessageList;
