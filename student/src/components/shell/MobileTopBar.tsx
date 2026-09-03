import { List as ListIcon } from "@phosphor-icons/react";
import Wordmark from "./Wordmark";
import CommandKButton from "./CommandKButton";

/** The folded-away margin on mobile: a hairline bar with a menu handle,
 *  the wordmark, and the command palette trigger. */
export default function MobileTopBar({
  onOpenDrawer,
  onOpenCmdK,
}: {
  onOpenDrawer: () => void;
  onOpenCmdK: () => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-13 items-center gap-3 border-b border-line bg-paper/95 px-4 py-2.5 backdrop-blur lg:hidden">
      <button
        onClick={onOpenDrawer}
        aria-label="Open navigation"
        className="grid h-8 w-8 place-items-center text-ink"
      >
        <ListIcon size={18} />
      </button>
      <Wordmark size={12} showMarker={false} />
      <CommandKButton onOpen={onOpenCmdK} compact />
    </header>
  );
}
