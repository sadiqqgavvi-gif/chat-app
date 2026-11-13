import { useState } from "react";
import { FiClock } from "react-icons/fi";
import { EMOJI_CATEGORIES, getRecentEmojis, rememberEmoji } from "../../lib/emoji";

function EmojiPicker({ onSelect, className = "" }) {
  const [recent, setRecent] = useState(getRecentEmojis);
  const [category, setCategory] = useState(recent.length > 0 ? "recent" : "smileys");

  const emojis =
    category === "recent"
      ? recent
      : EMOJI_CATEGORIES.find((item) => item.id === category).emojis;

  const pick = (emoji) => {
    rememberEmoji(emoji);
    onSelect(emoji);
    if (category !== "recent") setRecent(getRecentEmojis());
  };

  const tab = (id, label, content) => (
    <button
      key={id}
      type="button"
      title={label}
      aria-label={label}
      onClick={() => setCategory(id)}
      className={`flex h-9 flex-1 items-center justify-center rounded-lg text-lg hover:bg-hover ${
        category === id ? "bg-hover" : "opacity-60"
      }`}
    >
      {content}
    </button>
  );

  return (
    <div
      className={`flex h-80 w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-xl ${className}`}
    >
      <div className="flex gap-0.5 border-b border-line p-1.5">
        {recent.length > 0 &&
          tab("recent", "Recently used", <FiClock className="text-base" />)}
        {EMOJI_CATEGORIES.map((item) => tab(item.id, item.label, item.icon))}
      </div>
      <div className="grid flex-1 grid-cols-8 content-start gap-0.5 overflow-y-auto p-2">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => pick(emoji)}
            className="flex aspect-square items-center justify-center rounded-lg text-2xl hover:bg-hover"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export default EmojiPicker;
