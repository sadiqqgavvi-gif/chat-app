import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiChevronLeft, FiChevronRight, FiDownload, FiX } from "react-icons/fi";
import { formatDay, formatTime } from "../../lib/format";

// Full-screen viewer for the photos and videos of a chat.
function Lightbox({ items, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const item = items[Math.min(index, items.length - 1)];

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(items.length - 1, current + 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items.length, onClose]);

  if (!item) return null;

  const navButton =
    "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20 disabled:opacity-0";

  return createPortal(
    <div className="fixed inset-0 z-[70] flex animate-fade-in flex-col bg-black/95 text-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.sender}</p>
          <p className="text-xs text-white/60">
            {formatDay(item.createdAt)} at {formatTime(item.createdAt)}
          </p>
        </div>
        {item.downloadUrl && (
          <a
            href={item.downloadUrl}
            download={item.name}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-white/10"
            aria-label="Download"
            title="Download"
          >
            <FiDownload />
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-white/10"
          aria-label="Close"
        >
          <FiX />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {item.video ? (
          <video
            key={item.url}
            src={item.url}
            controls
            autoPlay
            className="max-h-full max-w-full rounded"
          />
        ) : (
          <img
            key={item.url}
            src={item.url}
            alt={item.name}
            className="max-h-full max-w-full rounded object-contain"
          />
        )}

        <button
          type="button"
          className={`${navButton} left-3`}
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
          aria-label="Previous"
        >
          <FiChevronLeft />
        </button>
        <button
          type="button"
          className={`${navButton} right-3`}
          disabled={index >= items.length - 1}
          onClick={() => setIndex(index + 1)}
          aria-label="Next"
        >
          <FiChevronRight />
        </button>
      </div>

      {item.caption && (
        <p className="mx-auto max-w-2xl px-4 pb-5 text-center text-sm">{item.caption}</p>
      )}
    </div>,
    document.body,
  );
}

export default Lightbox;
