import { useEffect, useState } from "react";
import {
  FiPlus,
  FiSettings,
  FiUserMinus,
  FiUsers,
  FiX,
} from "react-icons/fi";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { useChat } from "../../context/useChat";
import { useAuth } from "../../context/useAuth";
import { searchUsers } from "../../services/userService";
import {
  addUserToGroup,
  removeUserFromGroup,
  renameGroupChat,
} from "../../services/chatService";
import socket from "../../socket";

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ChatWindow() {
  const {
    selectedChat,
    setSelectedChat,
    setChats,
    isTyping,
    setIsTyping,
  } = useChat();

  const { user, token } = useAuth();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedChat) return;

    socket.emit("join chat", selectedChat._id);

    socket.off("typing");
    socket.off("stop typing");

    socket.on("typing", () => {
      setIsTyping(true);
    });

    socket.on("stop typing", () => {
      setIsTyping(false);
    });

    return () => {
      socket.off("typing");
      socket.off("stop typing");
      setIsTyping(false);
    };
  }, [selectedChat, setIsTyping]);

  if (!selectedChat) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-900 text-gray-400">
        Select a chat to start messaging
      </div>
    );
  }

  const otherUser = selectedChat.users.find(
    (currentUser) => currentUser._id !== user.id
  );
  const isGroup = selectedChat.isGroupChat;
  const title = isGroup
    ? selectedChat.chatName
    : otherUser?.name || "Chat";
  const subtitle = isGroup
    ? `${selectedChat.users.length} members`
    : otherUser?.email || "";
  const isAdmin = selectedChat.groupAdmin?._id === user.id;

  const openGroupSettings = () => {
    setGroupName(selectedChat.chatName || "");
    setError("");
    setMemberSearch("");
    setMemberResults([]);
    setSettingsOpen(true);
  };

  const syncUpdatedChat = (updatedChat) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat._id === updatedChat._id
          ? {
              ...chat,
              ...updatedChat,
            }
          : chat
      )
    );
    setSelectedChat(updatedChat);
  };

  const handleSearchMembers = async (value) => {
    setMemberSearch(value);
    setError("");

    if (!value.trim()) {
      setMemberResults([]);
      return;
    }

    try {
      const response = await searchUsers(value, token);
      const existingMemberIds = new Set(
        selectedChat.users.map((member) => member._id)
      );

      setMemberResults(
        response.data.filter(
          (candidate) => !existingMemberIds.has(candidate._id)
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not search users."
      );
    }
  };

  const handleRename = async () => {
    if (!groupName.trim()) {
      setError("Group name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await renameGroupChat(
        selectedChat._id,
        groupName,
        token
      );

      syncUpdatedChat(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not rename group."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (memberId) => {
    try {
      setSaving(true);
      setError("");

      const response = await addUserToGroup(
        selectedChat._id,
        memberId,
        token
      );

      syncUpdatedChat(response.data);
      setMemberSearch("");
      setMemberResults([]);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not add member."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      setSaving(true);
      setError("");

      const response = await removeUserFromGroup(
        selectedChat._id,
        memberId,
        token
      );

      if (memberId === user.id) {
        setChats((prev) =>
          prev.filter((chat) => chat._id !== selectedChat._id)
        );
        setSelectedChat(null);
        setSettingsOpen(false);
        return;
      }

      syncUpdatedChat(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not update members."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-h-16 items-center justify-between border-b border-gray-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
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
          </div>

          <div className="min-w-0 text-left">
            <h2 className="truncate text-base font-semibold text-gray-950">
              {title}
            </h2>

            <p className="truncate text-sm text-gray-500">
              {isTyping ? "Typing..." : subtitle}
            </p>
          </div>
        </div>

        {isGroup && (
          <button
            type="button"
            onClick={openGroupSettings}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
            title="Group settings"
            aria-label="Group settings"
          >
            <FiSettings />
          </button>
        )}
      </div>

      <MessageList />

      <MessageInput />

      {settingsOpen && isGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 text-left shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-950">
                  Group settings
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedChat.users.length} members
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                title="Close"
                aria-label="Close"
              >
                <FiX />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {isAdmin && (
              <div className="mb-5">
                <label
                  htmlFor="group-name"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Group name
                </label>
                <div className="flex gap-2">
                  <input
                    id="group-name"
                    type="text"
                    value={groupName}
                    onChange={(event) =>
                      setGroupName(event.target.value)
                    }
                    className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleRename}
                    disabled={saving}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="mb-5">
                <label
                  htmlFor="member-search"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Add members
                </label>
                <input
                  id="member-search"
                  type="text"
                  value={memberSearch}
                  onChange={(event) =>
                    handleSearchMembers(event.target.value)
                  }
                  placeholder="Search users..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />

                {memberResults.length > 0 && (
                  <div className="mt-2 overflow-hidden rounded-md border border-gray-200">
                    {memberResults.map((candidate) => (
                      <button
                        key={candidate._id}
                        type="button"
                        onClick={() => handleAddMember(candidate._id)}
                        disabled={saving}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900">
                            {candidate.name}
                          </span>
                          <span className="block truncate text-xs text-gray-500">
                            {candidate.email}
                          </span>
                        </span>
                        <FiPlus className="shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              {selectedChat.users.map((member) => {
                const memberIsAdmin =
                  selectedChat.groupAdmin?._id === member._id;
                const canRemove =
                  (isAdmin && member._id !== user.id) ||
                  member._id === user.id;

                return (
                  <div
                    key={member._id}
                    className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-950">
                        {member.name}
                        {member._id === user.id ? " (you)" : ""}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {memberIsAdmin ? "Admin" : member.email}
                      </div>
                    </div>

                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member._id)}
                        disabled={saving}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        title={
                          member._id === user.id
                            ? "Leave group"
                            : "Remove member"
                        }
                        aria-label={
                          member._id === user.id
                            ? "Leave group"
                            : "Remove member"
                        }
                      >
                        <FiUserMinus />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;
