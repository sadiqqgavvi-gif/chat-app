import { useCallback, useMemo, useState } from "react";
import {
  FiArchive,
  FiBell,
  FiBellOff,
  FiEdit,
  FiLogOut,
  FiMail,
  FiMoon,
  FiMoreVertical,
  FiSettings,
  FiStar,
  FiSun,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { BsPinAngle } from "react-icons/bs";
import ChatListItem from "./ChatListItem";
import NewChatPanel from "./NewChatPanel";
import NewGroupPanel from "./NewGroupPanel";
import SettingsPanel from "./SettingsPanel";
import StarredPanel from "./StarredPanel";
import PanelHeader, { SearchInput, UserRow } from "./PanelHeader";
import Avatar from "../ui/Avatar";
import IconButton from "../ui/IconButton";
import Menu from "../ui/Menu";
import Spinner from "../ui/Spinner";
import { useChatConfirm } from "../chat/useChatConfirm";
import { useAuth, useChat, useTheme } from "../../context/contexts";
import { useUserSearch } from "../../lib/hooks";
import { chatTitle, otherUserOf } from "../../lib/format";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "groups", label: "Groups" },
];

function Sidebar({ className = "" }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const {
    me,
    chats,
    chatsLoading,
    selectedChatId,
    onlineIds,
    typing,
    selectChat,
    markRead,
    openChatWith,
    setPrefs,
  } = useChat();

  const [panel, setPanel] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [menu, setMenu] = useState(null);
  const [askConfirm, confirmDialog] = useChatConfirm();

  const term = query.trim().toLowerCase();
  const searching = term.length > 0;
  const { users: foundUsers, loading: searchingUsers } = useUserSearch(
    query,
    term.length >= 2,
  );

  const archivedChats = useMemo(() => chats.filter((chat) => chat.archived), [chats]);
  const archivedUnread = archivedChats.filter((chat) => chat.unreadCount > 0).length;

  const visibleChats = useMemo(() => {
    const showArchived = panel === "archived";
    return chats.filter((chat) => {
      if (searching) return chatTitle(chat, me).toLowerCase().includes(term);
      if (chat.archived !== showArchived) return false;
      if (filter === "unread") return chat.unreadCount > 0 || chat.markedUnread;
      if (filter === "groups") return chat.isGroupChat;
      return true;
    });
  }, [chats, me, term, searching, filter, panel]);

  // People matching the search that I don't have a direct chat with yet.
  const newPeople = useMemo(() => {
    const known = new Set(
      chats.filter((chat) => !chat.isGroupChat).map((chat) => otherUserOf(chat, me)?._id),
    );
    return foundUsers.filter((item) => !known.has(item._id));
  }, [chats, foundUsers, me]);

  const openChatMenu = useCallback((chat, event) => {
    setMenu({ kind: "chat", chat, point: { x: event.clientX, y: event.clientY } });
  }, []);

  const typingLabel = (chat) => {
    const ids = typing[chat._id];
    if (!ids?.length) return null;
    if (!chat.isGroupChat) return "typing…";
    const name = chat.users.find((item) => item._id === ids[0])?.name?.split(" ")[0];
    return `${name || "Someone"} is typing…`;
  };

  const chatMenuItems = (chat) => {
    const unread = chat.unreadCount > 0 || chat.markedUnread;
    return [
      {
        label: chat.archived ? "Unarchive chat" : "Archive chat",
        icon: FiArchive,
        onClick: () => setPrefs(chat._id, { archived: !chat.archived }),
      },
      {
        label: chat.muted ? "Unmute notifications" : "Mute notifications",
        icon: chat.muted ? FiBell : FiBellOff,
        onClick: () => setPrefs(chat._id, { muted: !chat.muted }),
      },
      !chat.archived && {
        label: chat.pinned ? "Unpin chat" : "Pin chat",
        icon: BsPinAngle,
        onClick: () => setPrefs(chat._id, { pinned: !chat.pinned }),
      },
      {
        label: unread ? "Mark as read" : "Mark as unread",
        icon: FiMail,
        onClick: () =>
          unread ? markRead(chat._id) : setPrefs(chat._id, { markedUnread: true }),
      },
      { divider: true, key: "divider" },
      {
        label: chat.isGroupChat ? "Exit group" : "Delete chat",
        icon: chat.isGroupChat ? FiLogOut : FiTrash2,
        danger: true,
        onClick: () => askConfirm("remove", chat),
      },
    ];
  };

  const mainMenuItems = [
    { label: "New group", icon: FiUsers, onClick: () => setPanel("new-group") },
    { label: "Starred messages", icon: FiStar, onClick: () => setPanel("starred") },
    { label: "Settings", icon: FiSettings, onClick: () => setPanel("settings") },
    {
      label: isDark ? "Light mode" : "Dark mode",
      icon: isDark ? FiSun : FiMoon,
      onClick: toggleTheme,
    },
    { divider: true, key: "divider" },
    { label: "Log out", icon: FiLogOut, onClick: logout },
  ];

  const renderChats = (list) =>
    list.map((chat) => (
      <ChatListItem
        key={chat._id}
        chat={chat}
        me={me}
        selected={chat._id === selectedChatId}
        online={!chat.isGroupChat && onlineIds.has(otherUserOf(chat, me)?._id)}
        typingNames={typingLabel(chat)}
        onSelect={selectChat}
        onMenu={openChatMenu}
      />
    ));

  let content;
  if (panel === "new-chat") {
    content = (
      <NewChatPanel
        onBack={() => setPanel(null)}
        onNewGroup={() => setPanel("new-group")}
      />
    );
  } else if (panel === "new-group") {
    content = (
      <NewGroupPanel onBack={() => setPanel(null)} onDone={() => setPanel(null)} />
    );
  } else if (panel === "settings") {
    content = <SettingsPanel onBack={() => setPanel(null)} />;
  } else if (panel === "starred") {
    content = <StarredPanel onBack={() => setPanel(null)} />;
  } else if (panel === "archived") {
    content = (
      <>
        <PanelHeader title="Archived" onBack={() => setPanel(null)} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleChats.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted">
              No archived chats.
            </p>
          ) : (
            renderChats(visibleChats)
          )}
        </div>
      </>
    );
  } else {
    content = (
      <>
        <div className="flex h-16 shrink-0 items-center gap-2 px-3">
          <button
            type="button"
            onClick={() => setPanel("settings")}
            className="rounded-full"
            title="Profile and settings"
            aria-label="Profile and settings"
          >
            <Avatar src={user.avatar} name={user.name} id={user.id} size="sm" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-ink">Chats</h1>
          <IconButton label="New chat" onClick={() => setPanel("new-chat")}>
            <FiEdit />
          </IconButton>
          <IconButton
            label="Menu"
            onClick={(event) =>
              setMenu({
                kind: "main",
                anchorRect: event.currentTarget.getBoundingClientRect(),
              })
            }
          >
            <FiMoreVertical />
          </IconButton>
        </div>

        <div className="px-3 pb-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search or start a new chat"
          />
        </div>

        {!searching && (
          <div className="flex gap-2 px-3 pb-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  filter === item.id
                    ? "bg-brand/15 font-medium text-brand"
                    : "bg-soft text-muted hover:bg-hover"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!searching && filter === "all" && archivedChats.length > 0 && (
            <button
              type="button"
              onClick={() => setPanel("archived")}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-hover"
            >
              <span className="flex h-12 w-12 items-center justify-center text-lg text-muted">
                <FiArchive />
              </span>
              <span className="flex-1 text-[15px] font-medium text-ink">Archived</span>
              <span className="pr-1 text-xs font-medium text-brand">
                {archivedUnread || archivedChats.length}
              </span>
            </button>
          )}

          {chatsLoading ? (
            <div className="flex justify-center p-8 text-muted">
              <Spinner />
            </div>
          ) : (
            <>
              {searching && visibleChats.length > 0 && (
                <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Chats
                </p>
              )}
              {renderChats(visibleChats)}

              {searching && newPeople.length > 0 && (
                <>
                  <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    Start a new chat
                  </p>
                  {newPeople.map((item) => (
                    <UserRow
                      key={item._id}
                      user={item}
                      onClick={async () => {
                        if (await openChatWith(item._id)) setQuery("");
                      }}
                    />
                  ))}
                </>
              )}

              {visibleChats.length === 0 && newPeople.length === 0 && !searchingUsers && (
                <div className="px-6 py-10 text-center text-sm text-muted">
                  {searching ? (
                    `No chats or people found for "${query.trim()}".`
                  ) : filter !== "all" ? (
                    filter === "unread" ? (
                      "You're all caught up."
                    ) : (
                      "You're not in any groups yet."
                    )
                  ) : (
                    <>
                      <p className="mb-3">No chats yet. Find someone to talk to.</p>
                      <button
                        type="button"
                        onClick={() => setPanel("new-chat")}
                        className="font-semibold text-brand hover:underline"
                      >
                        Start a new chat
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <aside
      className={`w-full shrink-0 flex-col border-r border-line bg-panel md:w-[340px] lg:w-[400px] ${className}`}
    >
      <div
        key={panel || "main"}
        className={`flex min-h-0 flex-1 flex-col ${panel ? "animate-slide-in" : ""}`}
      >
        {content}
      </div>

      {menu && (
        <Menu
          items={menu.kind === "chat" ? chatMenuItems(menu.chat) : mainMenuItems}
          point={menu.point}
          anchorRect={menu.anchorRect}
          onClose={() => setMenu(null)}
        />
      )}

      {confirmDialog}
    </aside>
  );
}

export default Sidebar;
