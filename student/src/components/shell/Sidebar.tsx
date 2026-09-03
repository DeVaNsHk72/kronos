import Wordmark from "./Wordmark";
import NavSection from "./NavSection";
import TitleBlock, { type Dims } from "./TitleBlock";
import CommandKButton from "./CommandKButton";
import type { NavGroup } from "./nav";

/** The desktop rail. A ruled column pinned to the left edge of the sheet.
 *  Every part inside it is a component the caller can swap. */
export default function Sidebar({
  groups,
  dims,
  onOpenCmdK,
  onNavigate,
  variant = "desktop",
}: {
  groups: NavGroup[];
  dims: Dims;
  onOpenCmdK: () => void;
  onNavigate?: () => void;
  /** "desktop" = fixed rail, "drawer" = flush inside the mobile drawer. */
  variant?: "desktop" | "drawer";
}) {
  const shell =
    variant === "desktop"
      ? "fixed inset-y-0 left-0 z-40 hidden w-[14.25rem] flex-col border-r border-line bg-paper/92 shadow-[2px_0_12px_rgba(0,0,0,0.04)] backdrop-blur-sm lg:flex"
      : "flex flex-col h-full";

  return (
    <aside className={shell}>
      <div className="border-b border-line px-3 py-3">
        <Wordmark />
      </div>

      <nav className="flex-1 overflow-y-auto thin-scroll py-3">
        {groups.map((g, i) => (
          <NavSection key={g.heading} group={g} first={i === 0} onNavigate={onNavigate} />
        ))}
      </nav>

      <CommandKButton onOpen={onOpenCmdK} />
      <TitleBlock dims={dims} />
    </aside>
  );
}
