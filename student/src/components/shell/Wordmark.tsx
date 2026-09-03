import { NavLink } from "react-router-dom";

/** The KRONOS wordmark and its square marker. One place to change the brand
 *  identity, used by the sidebar header, the mobile top bar, the Gate, and
 *  the Landing sheet. */
export default function Wordmark({
  to = "/welcome",
  size = 13,
  showMarker = true,
  markerAlignsRight = true,
  className = "",
}: {
  to?: string;
  size?: number;
  showMarker?: boolean;
  markerAlignsRight?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <NavLink to={to} className="wordmark text-ink" style={{ fontSize: `${size}px` }}>
        Kronos
      </NavLink>
      {showMarker && (
        <span
          aria-hidden
          className={`h-[0.4375rem] w-[0.4375rem] bg-ink-2 ${markerAlignsRight ? "ml-auto" : ""}`}
        />
      )}
    </div>
  );
}
