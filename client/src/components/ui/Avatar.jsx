import { FiUsers } from "react-icons/fi";
import { colorFor, getInitials } from "../../lib/format";

const SIZES = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-28 w-28 text-3xl",
  "2xl": "h-36 w-36 text-4xl",
};

function Avatar({
  src,
  name,
  id,
  group = false,
  size = "md",
  online = false,
  className = "",
}) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <span
        className={`flex items-center justify-center overflow-hidden rounded-full font-semibold text-white ${SIZES[size]}`}
        style={src ? undefined : { backgroundColor: colorFor(id || name) }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : group ? (
          <FiUsers className="h-[45%] w-[45%]" />
        ) : (
          getInitials(name)
        )}
      </span>
      {online && (
        <span
          className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-panel bg-online"
          title="Online"
        />
      )}
    </span>
  );
}

export default Avatar;
