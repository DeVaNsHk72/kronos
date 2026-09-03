import { useEffect, useState } from "react";

/** ⌘K / ⌃K toggles a boolean. One place owning the shortcut means two
 *  handlers can never fight over `preventDefault`. */
export default function useCmdK() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  return [open, setOpen] as const;
}
