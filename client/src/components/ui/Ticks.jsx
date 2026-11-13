import { IoCheckmark, IoCheckmarkDone, IoTimeOutline } from "react-icons/io5";

// Delivery state of one of my messages: clock (sending), one tick
// (sent), two ticks (delivered), two highlighted ticks (read).
function Ticks({ status, onBubble = false }) {
  if (status === "pending") {
    return <IoTimeOutline className="text-[13px] opacity-70" title="Sending" />;
  }
  if (status === "sent") {
    return <IoCheckmark className="text-[15px] opacity-70" title="Sent" />;
  }

  const read = status === "read";
  return (
    <IoCheckmarkDone
      title={read ? "Read" : "Delivered"}
      className={`text-[15px] ${
        read ? (onBubble ? "text-cyan-300" : "text-brand") : "opacity-70"
      }`}
    />
  );
}

export default Ticks;
