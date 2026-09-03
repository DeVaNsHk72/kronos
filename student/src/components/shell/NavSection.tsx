import NavItem from "./NavItem";
import type { NavGroup } from "./nav";

/** A labelled group of nav rows. Extra spacing above every group except the
 *  first, so the whole rail reads as one column with sections rather than a
 *  stack of separated blocks. */
export default function NavSection({
  group,
  first = false,
  onNavigate,
}: {
  group: NavGroup;
  first?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className={first ? undefined : "mt-5"}>
      <div className="px-4 pb-1 text-[0.6875rem] font-medium text-ink-2">{group.heading}</div>
      {group.entries.map((entry) => (
        <NavItem key={entry.to} entry={entry} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
