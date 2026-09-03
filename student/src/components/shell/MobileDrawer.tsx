import { X } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import Sidebar from "./Sidebar";
import type { Dims } from "./TitleBlock";
import type { NavGroup } from "./nav";

const spring = { type: "spring" as const, bounce: 0, duration: 0.3 };

export default function MobileDrawer({
  open,
  onClose,
  groups,
  dims,
  onOpenCmdK,
}: {
  open: boolean;
  onClose: () => void;
  groups: NavGroup[];
  dims: Dims;
  onOpenCmdK: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.button
            aria-label="Close navigation"
            onClick={onClose}
            className="absolute inset-0 bg-[#04101c]/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className="absolute inset-y-0 left-0 w-[262px] rounded-r-[var(--r-lg)] bg-paper shadow-lg"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={spring}
          >
            <button
              onClick={onClose}
              aria-label="Close navigation"
              className="absolute right-2 top-2.5 z-10 grid h-8 w-8 place-items-center text-ink-2"
            >
              <X size={16} />
            </button>
            <Sidebar
              groups={groups}
              dims={dims}
              onOpenCmdK={onOpenCmdK}
              onNavigate={onClose}
              variant="drawer"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
