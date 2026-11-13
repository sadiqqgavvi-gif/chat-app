import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A floating menu. Position it either at a point ({x, y}, for context
// menus) or next to an element (anchorRect, for dropdowns). It keeps
// itself inside the viewport and closes on outside click, scrolling or Esc.
function Menu({ items, onClose, point, anchorRect, align = "right" }) {
  const ref = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    const { offsetWidth: width, offsetHeight: height } = ref.current;
    const margin = 8;
    let left;
    let top;

    if (point) {
      left = point.x;
      top = point.y;
    } else {
      left = align === "right" ? anchorRect.right - width : anchorRect.left;
      top = anchorRect.bottom + 4;
      if (top + height > window.innerHeight - margin) {
        top = anchorRect.top - height - 4;
      }
    }

    setPosition({
      left: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(top, window.innerHeight - height - margin)),
    });
  }, [point, anchorRect, align]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) onClose();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    // Close when the user scrolls the page behind the menu. Listening for
    // the gesture (not "scroll") keeps the menu open when content merely
    // shifts, e.g. a new message arriving in the list.
    const onGesture = (event) => {
      if (!ref.current?.contains(event.target)) onClose();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onGesture, { capture: true, passive: true });
    window.addEventListener("touchmove", onGesture, { capture: true, passive: true });
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onGesture, true);
      window.removeEventListener("touchmove", onGesture, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-[60] min-w-48 animate-pop overflow-hidden rounded-xl border border-line bg-panel py-1.5 text-sm text-ink shadow-xl"
      style={position || { left: 0, top: 0, visibility: "hidden" }}
    >
      {items.filter(Boolean).map((item) =>
        item.divider ? (
          <div key={item.key} className="my-1.5 border-t border-line" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onClick();
            }}
            className={`flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover disabled:opacity-50 ${
              item.danger ? "text-danger" : ""
            }`}
          >
            {item.icon && <item.icon className="shrink-0 text-base opacity-80" />}
            <span className="truncate">{item.label}</span>
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

export default Menu;
