import { useRef, useState } from "react";
import {
  FiImage,
  FiMic,
  FiPaperclip,
  FiSend,
  FiSmile,
  FiStopCircle,
  FiX,
} from "react-icons/fi";
import { sendMessage } from "../../services/messageService";
import { useAuth } from "../../context/useAuth";
import { useChat } from "../../context/useChat";
import socket from "../../socket";

const EMOJIS = [
  "\u{1F600}",
  "\u{1F602}",
  "\u{1F60D}",
  "\u{1F60E}",
  "\u{1F973}",
  "\u{1F44D}",
  "\u{1F64F}",
  "\u{1F525}",
  "\u2764\uFE0F",
  "\u2705",
  "\u{1F389}",
  "\u{1F91D}",
  "\u{1F605}",
  "\u{1F62D}",
  "\u{1F621}",
  "\u{1F4AF}",
];

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        url: reader.result,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      });
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getReplyLabel(message) {
  if (!message) return "";

  if (message.content) return message.content;
  if (message.attachments?.[0]?.mimeType?.startsWith("image/")) {
    return "Photo";
  }
  if (message.attachments?.[0]?.mimeType?.startsWith("audio/")) {
    return "Voice note";
  }

  return message.attachments?.[0]?.name || "Attachment";
}

function MessageInput() {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const { token } = useAuth();

  const {
    selectedChat,
    setMessages,
    replyMessage,
    setReplyMessage,
  } = useChat();

  const handleTyping = (event) => {
    setMessage(event.target.value);

    if (!selectedChat) return;

    socket.emit("typing", selectedChat._id);

    clearTimeout(window.typingTimeout);

    window.typingTimeout = setTimeout(() => {
      socket.emit("stop typing", selectedChat._id);
    }, 1200);
  };

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    const oversizedFile = files.find(
      (file) => file.size > MAX_ATTACHMENT_BYTES
    );

    if (oversizedFile) {
      setError("Attachments must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    try {
      setError("");
      const convertedFiles = await Promise.all(
        files.map(fileToAttachment)
      );

      setAttachments((prev) => [...prev, ...convertedFiles]);
    } catch {
      setError("Could not attach that file.");
    } finally {
      event.target.value = "";
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const recorder = new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });

          if (blob.size > MAX_ATTACHMENT_BYTES) {
            setError("Voice notes must be 5 MB or smaller.");
            return;
          }

          const file = new File([blob], `voice-${Date.now()}.webm`, {
            type: "audio/webm",
          });

          const voiceAttachment = await fileToAttachment(file);
          setAttachments((prev) => [...prev, voiceAttachment]);
        } catch {
          setError("Could not attach that voice note.");
        } finally {
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setError("Microphone permission was denied.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  const handleSend = async () => {
    const trimmedMessage = message.trim();

    if (!selectedChat) return;
    if (!trimmedMessage && attachments.length === 0) return;

    socket.emit("stop typing", selectedChat._id);

    try {
      setError("");

      const response = await sendMessage(
        trimmedMessage,
        selectedChat._id,
        token,
        {
          attachments,
          replyTo: replyMessage?._id,
        }
      );

      setMessages((prev) =>
        prev.some((item) => item._id === response.data._id)
          ? prev
          : [...prev, response.data]
      );
      setMessage("");
      setAttachments([]);
      setReplyMessage(null);
      setShowEmojiPicker(false);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not send message."
      );
    }
  };

  if (!selectedChat) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 bg-white px-3 py-3 sm:px-4">
      {error && (
        <div className="mb-2 rounded-md bg-red-50 px-3 py-2 text-left text-sm text-red-700">
          {error}
        </div>
      )}

      {replyMessage && (
        <div className="mb-2 flex items-center justify-between rounded-md border-l-4 border-blue-500 bg-blue-50 px-3 py-2 text-left">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-blue-700">
              Replying to {replyMessage.sender?.name || "message"}
            </div>
            <div className="truncate text-sm text-gray-700">
              {getReplyLabel(replyMessage)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setReplyMessage(null)}
            className="ml-3 rounded-full p-1 text-gray-500 hover:bg-white"
            title="Cancel reply"
            aria-label="Cancel reply"
          >
            <FiX />
          </button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {attachments.map((attachment, index) => (
            <div
              key={`${attachment.name}-${index}`}
              className="relative flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-gray-50 text-xs text-gray-600"
            >
              {attachment.mimeType.startsWith("image/") ? (
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="h-full w-full object-cover"
                />
              ) : attachment.mimeType.startsWith("audio/") ? (
                <span className="px-2 text-center">Voice note</span>
              ) : (
                <span className="px-2 text-center">
                  {attachment.name}
                </span>
              )}

              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                title="Remove attachment"
                aria-label="Remove attachment"
              >
                <FiX size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showEmojiPicker && (
        <div className="mb-2 grid w-fit grid-cols-8 gap-1 rounded-md border bg-white p-2 shadow-lg">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setMessage((prev) => `${prev}${emoji}`)}
              className="h-8 w-8 rounded hover:bg-gray-100"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
          title="Emoji"
          aria-label="Emoji"
        >
          <FiSmile />
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
          title="Attach file"
          aria-label="Attach file"
        >
          <FiPaperclip />
        </button>

        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
          title="Attach image"
          aria-label="Attach image"
        >
          <FiImage />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFiles}
          className="hidden"
        />

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="hidden"
        />

        <input
          type="text"
          placeholder="Type a message..."
          className="min-w-0 flex-1 rounded-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
          value={message}
          onChange={handleTyping}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSend();
            }
          }}
        />

        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isRecording
              ? "bg-red-100 text-red-600"
              : "text-gray-600 hover:bg-gray-100"
          }`}
          title={isRecording ? "Stop recording" : "Record voice note"}
          aria-label={
            isRecording ? "Stop recording" : "Record voice note"
          }
        >
          {isRecording ? <FiStopCircle /> : <FiMic />}
        </button>

        <button
          type="button"
          onClick={handleSend}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
          title="Send"
          aria-label="Send"
        >
          <FiSend />
        </button>
      </div>
    </div>
  );
}

export default MessageInput;
