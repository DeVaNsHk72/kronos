import { useLocation } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./Sidebar";
import MobileTopBar from "./MobileTopBar";
import MobileDrawer from "./MobileDrawer";
import CommandK from "../CommandK";
import useCmdK from "./useCmdK";
import { DEFAULT_GROUPS, type NavGroup } from "./nav";
import type { Dims } from "./TitleBlock";

/** The full app chrome — desktop rail, mobile top bar, mobile drawer, and
 *  the ⌘K palette — composed from parts. Pass different `groups` to change
 *  the nav; pass different `dims` to change the title-block numbers. */
export default function AppShell({
  dims,
  groups = DEFAULT_GROUPS,
}: {
  dims: Dims;
  groups?: NavGroup[];
}) {
  const [cmdkOpen, setCmdkOpen] = useCmdK();
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();

  // Close the drawer on route change during render — an effect would let it
  // paint once in the wrong state on back/forward.
  const [drawerAt, setDrawerAt] = useState(loc.pathname);
  if (drawerAt !== loc.pathname) {
    setDrawerAt(loc.pathname);
    if (drawer) setDrawer(false);
  }

  return (
    <>
      <Sidebar groups={groups} dims={dims} onOpenCmdK={() => setCmdkOpen(true)} />
      <MobileTopBar
        onOpenDrawer={() => setDrawer(true)}
        onOpenCmdK={() => setCmdkOpen(true)}
      />
      <MobileDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        groups={groups}
        dims={dims}
        onOpenCmdK={() => setCmdkOpen(true)}
      />
      <CommandK open={cmdkOpen} onOpenChange={setCmdkOpen} />
    </>
  );
}
