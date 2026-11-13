import { useState } from "react";
import { ConfirmDialog } from "../ui/Modal";
import { useChat } from "../../context/contexts";
import { chatTitle, otherUserOf } from "../../lib/format";

// Confirmation dialogs for the destructive chat actions, shared by the
// chat list, the chat header menu and the info panel.
// Returns [ask(kind, chat), dialogElement]; kind is "clear" | "remove" | "block".
export function useChatConfirm() {
  const { me, clearMessages, removeChat, setBlocked } = useChat();
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  let dialog = null;
  if (pending) {
    const { kind, chat } = pending;
    const other = chat.isGroupChat ? null : otherUserOf(chat, me);

    const config = {
      clear: {
        title: "Clear this chat?",
        message:
          "All messages in this chat will be removed for you. Other people keep their copy.",
        confirmLabel: "Clear chat",
        run: () => clearMessages(chat._id),
      },
      remove: chat.isGroupChat
        ? {
            title: "Exit group?",
            message: `You will leave "${chat.chatName}" and stop receiving its messages.`,
            confirmLabel: "Exit group",
            run: () => removeChat(chat),
          }
        : {
            title: "Delete chat?",
            message: `Your chat with ${chatTitle(chat, me)} and its messages will be removed for you. They keep their copy.`,
            confirmLabel: "Delete chat",
            run: () => removeChat(chat),
          },
      block: {
        title: `Block ${other?.name}?`,
        message: "Blocked contacts can't send you messages or call you.",
        confirmLabel: "Block",
        run: () => setBlocked(other._id, true),
      },
    }[kind];

    const confirm = async () => {
      setBusy(true);
      await config.run();
      setBusy(false);
      setPending(null);
    };

    dialog = (
      <ConfirmDialog
        title={config.title}
        message={config.message}
        confirmLabel={config.confirmLabel}
        danger
        busy={busy}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    );
  }

  return [(kind, chat) => setPending({ kind, chat }), dialog];
}
