import { useRef, useState } from "react";
import {
  FiCamera,
  FiLogOut,
  FiSave,
  FiSettings,
  FiX,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { updateProfile } from "../../services/userService";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Header() {
  const navigate = useNavigate();
  const { user, token, logout, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openSettings = () => {
    setName(user?.name || "");
    setAvatar(user?.avatar || "");
    setError("");
    setSettingsOpen(true);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleAvatar = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose an image for your profile photo.");
      return;
    }

    if (file.size > 1024 * 1024) {
      setError("Profile photo must be 1 MB or smaller.");
      return;
    }

    try {
      setError("");
      setAvatar(await fileToDataUrl(file));
    } catch {
      setError("Could not load that image.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await updateProfile(
        {
          name: name.trim(),
          avatar,
        },
        token
      );

      updateUser(response.data);
      setSettingsOpen(false);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not update profile."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-base font-semibold text-white">
          CA
        </div>

        <div className="text-left">
          <h1 className="text-lg font-semibold text-gray-950">
            Chat App
          </h1>
          <p className="text-xs text-gray-500">Messages</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openSettings}
          className="flex max-w-[11rem] items-center gap-2 rounded-full px-2 py-1.5 text-gray-700 hover:bg-gray-100"
          title="Profile and settings"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(user?.name) || "U"
            )}
          </span>
          <span className="hidden truncate text-sm font-medium sm:block">
            {user?.name}
          </span>
        </button>

        <button
          type="button"
          onClick={openSettings}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
          title="Settings"
          aria-label="Settings"
        >
          <FiSettings />
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
          title="Logout"
          aria-label="Logout"
        >
          <FiLogOut />
        </button>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 text-left shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-950">
                Profile settings
              </h2>

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

            <div className="mb-5 flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-xl font-semibold text-gray-700"
                title="Change photo"
                aria-label="Change photo"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(name) || "U"
                )}

                <span className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center bg-black/55 text-white">
                  <FiCamera size={14} />
                </span>
              </button>

              <div className="min-w-0 flex-1">
                <label
                  htmlFor="profile-name"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Display name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <p className="mt-1 truncate text-xs text-gray-500">
                  {user?.email}
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatar}
              className="hidden"
            />

            {error && (
              <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiSave />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
