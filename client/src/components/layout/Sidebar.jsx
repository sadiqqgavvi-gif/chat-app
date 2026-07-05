import { useState } from "react";
import { FiPlus, FiSearch, FiUsers, FiX } from "react-icons/fi";
import ChatList from "../chat/ChatList";
import { useAuth } from "../../context/useAuth";
import { searchUsers } from "../../services/userService";
import {
  createChat,
  createGroupChat,
} from "../../services/chatService";
import { useChat } from "../../context/useChat";

function Sidebar() {
  const { token } = useAuth();
  const {
    setSelectedChat,
    setChats,
    setReplyMessage,
  } = useChat();

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [error, setError] = useState("");

  const handleSearch = async (value) => {
    setSearch(value);
    setError("");

    if (!value.trim()) {
      setResults([]);
      return;
    }

    try {
      const response = await searchUsers(value, token);
      setResults(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not search users."
      );
    }
  };

  const resetComposer = () => {
    setSearch("");
    setResults([]);
    setGroupName("");
    setSelectedUsers([]);
    setError("");
  };

  const handleCreateChat = async (userId) => {
    try {
      const response = await createChat(userId, token);

      setReplyMessage(null);
      setSelectedChat(response.data);
      setChats((prev) =>
        prev.some((chat) => chat._id === response.data._id)
          ? prev
          : [response.data, ...prev]
      );

      resetComposer();
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not open chat."
      );
    }
  };

  const toggleGroupUser = (user) => {
    setSelectedUsers((prev) =>
      prev.some((selected) => selected._id === user._id)
        ? prev.filter((selected) => selected._id !== user._id)
        : [...prev, user]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError("Group name is required.");
      return;
    }

    if (selectedUsers.length < 2) {
      setError("Choose at least two members.");
      return;
    }

    try {
      const response = await createGroupChat(
        groupName,
        selectedUsers.map((selectedUser) => selectedUser._id),
        token
      );

      setChats((prev) =>
        prev.some((chat) => chat._id === response.data._id)
          ? prev
          : [response.data, ...prev]
      );
      setReplyMessage(null);
      setSelectedChat(response.data);
      setGroupMode(false);
      resetComposer();
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not create group."
      );
    }
  };

  return (
    <aside className="flex w-80 min-w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-50 max-md:w-72">
      <div className="border-b border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Chats
          </h2>

          <button
            type="button"
            onClick={() => {
              setGroupMode((prev) => !prev);
              resetComposer();
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
            title={groupMode ? "Close group creator" : "New group"}
            aria-label={
              groupMode ? "Close group creator" : "New group"
            }
          >
            {groupMode ? <FiX /> : <FiUsers />}
          </button>
        </div>

        {groupMode && (
          <input
            type="text"
            placeholder="Group name"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        )}

        {selectedUsers.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedUsers.map((selectedUser) => (
              <button
                key={selectedUser._id}
                type="button"
                onClick={() => toggleGroupUser(selectedUser)}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800"
              >
                <span className="truncate">{selectedUser.name}</span>
                <FiX />
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={
              groupMode ? "Search members..." : "Search users..."
            }
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {error && (
          <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-left text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="border-b border-gray-200 bg-white">
          {results.map((resultUser) => {
            const selected = selectedUsers.some(
              (selectedUser) => selectedUser._id === resultUser._id
            );

            return (
              <button
                type="button"
                key={resultUser._id}
                onClick={() =>
                  groupMode
                    ? toggleGroupUser(resultUser)
                    : handleCreateChat(resultUser._id)
                }
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-100"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">
                    {resultUser.name}
                  </div>

                  <div className="truncate text-xs text-gray-500">
                    {resultUser.email}
                  </div>
                </div>

                {groupMode && (
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                      selected
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 text-gray-400"
                    }`}
                  >
                    {selected ? "\u2713" : <FiPlus />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {groupMode && (
        <div className="border-b border-gray-200 bg-white p-4">
          <button
            type="button"
            onClick={handleCreateGroup}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create group
          </button>
        </div>
      )}

      <ChatList />
    </aside>
  );
}

export default Sidebar;
