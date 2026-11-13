import { useEffect, useRef, useState } from "react";
import { FiCamera, FiLogOut, FiMonitor, FiMoon, FiSun } from "react-icons/fi";
import PanelHeader, { UserRow } from "./PanelHeader";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";
import EditableField from "../ui/EditableField";
import { Button } from "../ui/Modal";
import { useAuth, useChat, useTheme, useToast } from "../../context/contexts";
import { errorMessage } from "../../lib/api";
import { fileToAvatar } from "../../lib/media";
import {
  desktopPermission,
  getNotifySettings,
  requestDesktopPermission,
  setNotifySetting,
} from "../../lib/notify";
import { changePassword } from "../../services/authService";
import { fetchBlockedUsers, updateProfile } from "../../services/userService";

function Section({ title, children }) {
  return (
    <section className="border-b border-line px-5 py-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-[15px] text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-brand peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40" />
    </label>
  );
}

const THEMES = [
  { id: "light", label: "Light", icon: FiSun },
  { id: "dark", label: "Dark", icon: FiMoon },
  { id: "system", label: "System", icon: FiMonitor },
];

function PasswordForm() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await changePassword(current, next);
      toast("Password changed");
      setOpen(false);
      setCurrent("");
      setNext("");
    } catch (err) {
      setError(errorMessage(err, "Could not change your password."));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Change password
      </Button>
    );
  }

  const inputClass =
    "mb-2 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-brand";

  return (
    <form onSubmit={submit}>
      <input
        type="password"
        autoComplete="current-password"
        placeholder="Current password"
        value={current}
        onChange={(event) => setCurrent(event.target.value)}
        className={inputClass}
        required
        autoFocus
      />
      <input
        type="password"
        autoComplete="new-password"
        placeholder="New password (at least 6 characters)"
        value={next}
        onChange={(event) => setNext(event.target.value)}
        className={inputClass}
        required
      />
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving && <Spinner className="h-4 w-4" />}
          Save
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SettingsPanel({ onBack }) {
  const { user, updateUser, logout } = useAuth();
  const { setBlocked } = useChat();
  const { theme, setTheme } = useTheme();
  const { toast, toastError } = useToast();
  const fileRef = useRef(null);

  const [notify, setNotify] = useState(getNotifySettings);
  const [permission, setPermission] = useState(desktopPermission);
  const [blocked, setBlockedList] = useState([]);
  const blockedCount = user.blockedUsers?.length || 0;

  useEffect(() => {
    if (blockedCount === 0) return;
    fetchBlockedUsers()
      .then((response) => setBlockedList(response.data))
      .catch(() => {});
  }, [blockedCount]);

  const save = async (changes) => {
    try {
      const response = await updateProfile(changes);
      updateUser(response.data);
      return true;
    } catch (err) {
      toastError(errorMessage(err, "Could not update your profile."));
      return false;
    }
  };

  const pickAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (await save({ avatar: await fileToAvatar(file) }))
        toast("Profile photo updated");
    } catch (err) {
      toastError(err.message);
    }
  };

  const setNotifyOption = (key, value) => {
    setNotifySetting(key, value);
    setNotify(getNotifySettings());
  };

  const toggleDesktop = async (enabled) => {
    if (enabled && permission === "default") {
      setPermission(await requestDesktopPermission());
    }
    setNotifyOption("desktop", enabled);
  };

  return (
    <>
      <PanelHeader title="Settings" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center border-b border-line px-5 py-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative rounded-full"
            aria-label="Change profile photo"
          >
            <Avatar src={user.avatar} name={user.name} id={user.id} size="xl" />
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <FiCamera className="text-xl" />
              Change photo
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={pickAvatar}
          />
          {user.avatar && (
            <button
              type="button"
              onClick={() => save({ avatar: "" })}
              className="mt-2 text-xs text-muted hover:text-danger"
            >
              Remove photo
            </button>
          )}
          <p className="mt-3 text-sm text-muted">{user.email}</p>
        </div>

        <Section title="Profile">
          <EditableField
            label="Name"
            value={user.name}
            maxLength={50}
            onSave={(name) => (name ? save({ name }) : false)}
          />
          <EditableField
            label="About"
            value={user.about || ""}
            maxLength={140}
            placeholder="Tell people something about you"
            onSave={(about) => save({ about })}
          />
        </Section>

        <Section title="Theme">
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                aria-pressed={theme === id}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm transition-colors ${
                  theme === id
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-line text-muted hover:bg-hover"
                }`}
              >
                <Icon className="text-lg" />
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Notifications">
          <Toggle
            label="Message sounds"
            hint="Play a sound for new messages"
            checked={notify.sound}
            onChange={(value) => setNotifyOption("sound", value)}
          />
          <Toggle
            label="Desktop notifications"
            hint={
              permission === "denied"
                ? "Blocked in your browser settings for this site"
                : permission === "unsupported"
                  ? "Not supported in this browser"
                  : "Show a notification when the app is in the background"
            }
            checked={notify.desktop && permission === "granted"}
            onChange={toggleDesktop}
          />
        </Section>

        <Section title="Blocked contacts">
          {blockedCount === 0 ? (
            <p className="text-sm text-muted">
              You haven't blocked anyone. Blocked contacts can't message or call you.
            </p>
          ) : (
            <div className="-mx-5">
              {blocked
                .filter((item) => user.blockedUsers.includes(item._id))
                .map((item) => (
                  <UserRow
                    key={item._id}
                    user={item}
                    subtitle={item.email}
                    onClick={() => setBlocked(item._id, false)}
                    right={
                      <span className="text-sm font-medium text-brand">Unblock</span>
                    }
                  />
                ))}
            </div>
          )}
        </Section>

        <Section title="Account">
          <PasswordForm />
          <div className="mt-3">
            <Button variant="outline" className="text-danger" onClick={logout}>
              <FiLogOut /> Log out
            </Button>
          </div>
        </Section>
      </div>
    </>
  );
}

export default SettingsPanel;
