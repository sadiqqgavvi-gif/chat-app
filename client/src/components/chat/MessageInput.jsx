import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  FiCornerUpLeft,
  FiEdit2,
  FiFile,
  FiImage,
  FiMic,
  FiPaperclip,
  FiSend,
  FiSmile,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import EmojiPicker from "../ui/EmojiPicker";
import IconButton from "../ui/IconButton";
import Menu from "../ui/Menu";
import { useAuth, useChat, useToast } from "../../context/contexts";
import socket from "../../lib/socket";
import {
  formatBytes,
  formatDuration,
  messagePreview,
  otherUserOf,
  senderId,
} from "../../lib/format";
import { MAX_FILE_BYTES, pickRecorderMimeType, prepareAttachment } from "../../lib/media";

const MAX_FILES = 10;
const TYPING_IDLE_MS = 2500;
// Unsent text per chat, kept while the app is open.
const drafts = new Map();

const isTouch = () => window.matchMedia("(pointer: coarse)").matches;

function ContextBar({ icon: Icon, title, text, onCancel }) {
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl border-l-4 border-brand bg-soft py-2 pl-3 pr-1">
      <Icon className="shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-brand">{title}</p>
        <p className="truncate text-sm text-muted">{text}</p>
      </div>
      <IconButton label="Cancel" onClick={onCancel} className="h-8 w-8">
        <FiX />
      </IconButton>
    </div>
  );
}

function FilePreview({ file, onRemove }) {
  const image = file.mimeType.startsWith("image/");
  const video = file.mimeType.startsWith("video/");

  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-soft">
      {image ? (
        <img
          src={file.previewUrl}
          alt={file.name}
          className="h-full w-full object-cover"
        />
      ) : video ? (
        <video src={file.previewUrl} muted className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 p-1.5 text-center text-muted">
          <FiFile className="text-lg" />
          <span className="w-full truncate text-[10px]">{file.name}</span>
          <span className="text-[10px]">{formatBytes(file.size)}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
        aria-label={`Remove ${file.name}`}
      >
        <FiX />
      </button>
    </div>
  );
}

const MessageInput = forwardRef(function MessageInput({ chat }, ref) {
  const { user } = useAuth();
  const { toastError } = useToast();
  const {
    me,
    sendMessage,
    saveEdit,
    replyTo,
    setReplyTo,
    editing,
    setEditing,
    setBlocked,
  } = useChat();
  const chatId = chat._id;

  const [text, setText] = useState(() => drafts.get(chatId) || "");
  const [files, setFiles] = useState([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachMenu, setAttachMenu] = useState(null);
  const [recording, setRecording] = useState(null); // { seconds }

  const textareaRef = useRef(null);
  const mediaInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  const typingRef = useRef({ active: false, timer: null, lastSent: 0 });

  const other = chat.isGroupChat ? null : otherUserOf(chat, me);
  const blockedByMe = other && user.blockedUsers?.includes(other._id);

  /* ------------------------------- typing --------------------------------- */

  const stopTyping = () => {
    const state = typingRef.current;
    clearTimeout(state.timer);
    if (state.active) {
      state.active = false;
      socket.emit("typing", { chatId, typing: false });
    }
  };

  const noteTyping = () => {
    const state = typingRef.current;
    const now = Date.now();
    // Re-announce every few seconds so the indicator survives long messages.
    if (!state.active || now - state.lastSent > 3000) {
      state.active = true;
      state.lastSent = now;
      socket.emit("typing", { chatId, typing: true });
    }
    clearTimeout(state.timer);
    state.timer = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  useEffect(() => {
    const state = typingRef.current;
    return () => {
      clearTimeout(state.timer);
      if (state.active) socket.emit("typing", { chatId, typing: false });
      recorderRef.current?.cancel();
    };
  }, [chatId]);

  /* -------------------------------- text ---------------------------------- */

  const changeText = (value) => {
    setText(value);
    if (!editing) drafts.set(chatId, value);
    if (value.trim()) noteTyping();
    else stopTyping();
  };

  // Grow the textarea with its content, up to a limit.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [text, recording]);

  // Entering edit mode loads the message into the box; leaving it
  // restores whatever draft was there before.
  const [editingId, setEditingId] = useState(null);
  if ((editing?._id || null) !== editingId) {
    setEditingId(editing?._id || null);
    setText(editing ? editing.content : drafts.get(chatId) || "");
    if (editing) setFiles([]);
  }

  useEffect(() => {
    if (!isTouch() || replyTo || editing) textareaRef.current?.focus();
  }, [chatId, replyTo, editing]);

  const insertEmoji = (emoji) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? text.length;
    const end = textarea?.selectionEnd ?? text.length;
    changeText(text.slice(0, start) + emoji + text.slice(end));

    requestAnimationFrame(() => {
      if (!textarea) return;
      const caret = start + emoji.length;
      textarea.setSelectionRange(caret, caret);
      if (!isTouch()) textarea.focus();
    });
  };

  /* -------------------------------- files --------------------------------- */

  const addFiles = async (picked) => {
    const list = Array.from(picked || []);
    if (list.length === 0 || editing) return;

    const tooBig = list.find((file) => file.size > MAX_FILE_BYTES);
    if (tooBig) {
      toastError(`"${tooBig.name}" is larger than 25 MB.`);
      return;
    }
    if (files.length + list.length > MAX_FILES) {
      toastError(`You can send up to ${MAX_FILES} files at once.`);
      return;
    }

    const prepared = await Promise.all(list.map(prepareAttachment));
    setFiles((current) => [...current, ...prepared]);
    textareaRef.current?.focus();
  };

  useImperativeHandle(ref, () => ({ addFiles }));

  const onPick = (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  };

  const onPaste = (event) => {
    const pasted = Array.from(event.clipboardData?.files || []);
    if (pasted.length > 0) {
      event.preventDefault();
      addFiles(pasted);
    }
  };

  /* ------------------------------- sending -------------------------------- */

  const send = async () => {
    const content = text.trim();

    if (editing) {
      if (!content && !editing.attachments?.length) return;
      if (content === editing.content || (await saveEdit(editing, content))) {
        setEditing(null);
      }
      return;
    }

    if (!content && files.length === 0) return;

    if (files.length === 0) {
      sendMessage(chatId, { content, reply: replyTo });
    } else {
      // Each file is its own message; the text becomes the first caption.
      files.forEach((file, index) => {
        sendMessage(chatId, {
          content: index === 0 ? content : "",
          files: [file],
          reply: index === 0 ? replyTo : null,
        });
      });
    }

    stopTyping();
    setText("");
    setFiles([]);
    setReplyTo(null);
    setEmojiOpen(false);
    drafts.delete(chatId);
    if (!isTouch()) textareaRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      !isTouch()
    ) {
      event.preventDefault();
      send();
    }
    if (event.key === "Escape") {
      if (emojiOpen) setEmojiOpen(false);
      else if (editing) setEditing(null);
      else if (replyTo) setReplyTo(null);
    }
  };

  /* ------------------------------ voice notes ----------------------------- */

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toastError("Voice messages aren't supported in this browser.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toastError("Allow microphone access to record a voice message.");
      return;
    }

    const mimeType = pickRecorderMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    const startedAt = Date.now();
    let cancelled = false;
    const reply = replyTo;

    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setRecording({ seconds });
      if (seconds >= 600) recorder.stop();
    }, 250);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      setRecording(null);

      const duration = (Date.now() - startedAt) / 1000;
      if (cancelled || duration < 0.6 || chunks.length === 0) return;

      const type = (recorder.mimeType || mimeType || "audio/webm").split(";")[0];
      const blob = new Blob(chunks, { type });
      sendMessage(chatId, {
        files: [
          {
            blob,
            name: `voice-message.${type.includes("mp4") ? "m4a" : type.split("/")[1]}`,
            mimeType: type,
            size: blob.size,
            duration,
            previewUrl: URL.createObjectURL(blob),
          },
        ],
        voice: true,
        reply,
      });
      setReplyTo(null);
    };

    recorderRef.current = {
      finish: () => recorder.state !== "inactive" && recorder.stop(),
      cancel: () => {
        cancelled = true;
        if (recorder.state !== "inactive") recorder.stop();
      },
    };
    recorder.start();
    setRecording({ seconds: 0 });
  };

  /* -------------------------------- render -------------------------------- */

  if (blockedByMe || chat.blockedByOther) {
    return (
      <div className="border-t border-line bg-panel px-4 py-3.5 text-center text-sm text-muted">
        {blockedByMe ? (
          <>
            You blocked {other.name}.{" "}
            <button
              type="button"
              className="font-semibold text-brand hover:underline"
              onClick={() => setBlocked(other._id, false)}
            >
              Unblock
            </button>{" "}
            to send a message.
          </>
        ) : (
          "You can't send messages to this contact."
        )}
      </div>
    );
  }

  const canSend = editing
    ? text.trim().length > 0 || editing.attachments?.length > 0
    : text.trim().length > 0 || files.length > 0;

  return (
    <div className="relative border-t border-line bg-panel px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3">
      {emojiOpen && (
        <div className="absolute bottom-full left-2 right-2 z-20 mb-2 animate-pop sm:right-auto sm:w-96">
          <EmojiPicker onSelect={insertEmoji} />
        </div>
      )}

      {editing && (
        <ContextBar
          icon={FiEdit2}
          title="Edit message"
          text={messagePreview(editing, me)}
          onCancel={() => setEditing(null)}
        />
      )}
      {replyTo && !editing && (
        <ContextBar
          icon={FiCornerUpLeft}
          title={`Replying to ${senderId(replyTo) === me ? "yourself" : replyTo.sender?.name || "message"}`}
          text={messagePreview(replyTo, me)}
          onCancel={() => setReplyTo(null)}
        />
      )}

      {files.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {files.map((file, index) => (
            <FilePreview
              key={file.previewUrl}
              file={file}
              onRemove={() =>
                setFiles((current) => current.filter((_, position) => position !== index))
              }
            />
          ))}
        </div>
      )}

      {recording ? (
        <div className="flex items-center gap-2">
          <IconButton
            label="Discard recording"
            className="text-danger"
            onClick={() => recorderRef.current?.cancel()}
          >
            <FiTrash2 />
          </IconButton>
          <div className="flex flex-1 items-center gap-3 rounded-full bg-soft px-4 py-2.5 text-sm text-ink">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
            <span className="tabular-nums">{formatDuration(recording.seconds)}</span>
            <span className="truncate text-muted">Recording voice message…</span>
          </div>
          <button
            type="button"
            onClick={() => recorderRef.current?.finish()}
            aria-label="Send voice message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-lg text-white hover:bg-brand-strong"
          >
            <FiSend />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1">
          <IconButton
            label="Emoji"
            active={emojiOpen}
            onClick={() => setEmojiOpen((open) => !open)}
            className="mb-0.5"
          >
            <FiSmile />
          </IconButton>
          {!editing && (
            <IconButton
              label="Attach"
              className="mb-0.5"
              onClick={(event) =>
                setAttachMenu(event.currentTarget.getBoundingClientRect())
              }
            >
              <FiPaperclip />
            </IconButton>
          )}

          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(event) => changeText(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={files.length > 0 ? "Add a caption" : "Type a message"}
            aria-label="Message"
            maxLength={5000}
            dir="auto"
            className="mx-1 max-h-36 min-h-11 min-w-0 flex-1 resize-none rounded-3xl bg-soft px-4 py-2.5 text-[15px] leading-6 text-ink outline-none placeholder:text-faint focus:ring-2 focus:ring-brand/25"
          />

          {canSend || editing ? (
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              aria-label={editing ? "Save edit" : "Send"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-lg text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
            >
              <FiSend className="-translate-x-px translate-y-px" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              aria-label="Record voice message"
              title="Record voice message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-lg text-white transition-colors hover:bg-brand-strong"
            >
              <FiMic />
            </button>
          )}
        </div>
      )}

      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={onPick}
      />
      <input ref={fileInputRef} type="file" multiple hidden onChange={onPick} />

      {attachMenu && (
        <Menu
          anchorRect={attachMenu}
          align="left"
          onClose={() => setAttachMenu(null)}
          items={[
            {
              label: "Photos & videos",
              icon: FiImage,
              onClick: () => mediaInputRef.current?.click(),
            },
            {
              label: "Document",
              icon: FiFile,
              onClick: () => fileInputRef.current?.click(),
            },
          ]}
        />
      )}
    </div>
  );
});

export default MessageInput;
