import { Command as CommandIcon } from "@phosphor-icons/react";

/** The rail's "⌘K Jump to…" button. Icon-only variant for the mobile bar. */
export default function CommandKButton({
  onOpen,
  compact = false,
}: {
  onOpen: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        onClick={onOpen}
        aria-label="Open command palette"
        className="ml-auto grid h-8 w-8 place-items-center text-ink-2"
      >
        <CommandIcon size={15} weight="bold" />
      </button>
    );
  }
  return (
    <button
      onClick={onOpen}
      className="mx-3 mb-3 flex items-center gap-2 rounded-[var(--r-sm)] bg-surface-hover px-2.5 py-1.5 text-[0.6875rem] text-ink-2 transition-[color,background-color] duration-150 hover:bg-surface-active hover:text-ink"
    >
      <CommandIcon size={12} weight="bold" />
      <span className="font-mono text-[0.625rem] text-ink-2/60">⌘K</span>
      <span className="ml-auto">Jump to…</span>
    </button>
  );
}
