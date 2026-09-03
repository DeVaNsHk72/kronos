/**
 * Every shell part is exported from here so consumers can either import the
 * whole `<AppShell />` or pull one piece (a `<Sidebar />` in a Storybook
 * demo, a `<TitleBlock />` on the landing footer, a `<TabStrip />` on any
 * page) without knowing the folder layout.
 */
export { default as AppShell } from "./AppShell";
export { default as Sidebar } from "./Sidebar";
export { default as MobileTopBar } from "./MobileTopBar";
export { default as MobileDrawer } from "./MobileDrawer";
export { default as Wordmark } from "./Wordmark";
export { default as NavItem } from "./NavItem";
export { default as NavSection } from "./NavSection";
export { default as TitleBlock } from "./TitleBlock";
export { default as CommandKButton } from "./CommandKButton";
export { default as TabStrip } from "./TabStrip";
export { default as useCmdK } from "./useCmdK";
export { STUDENT, FACULTY, DEFAULT_GROUPS } from "./nav";
export type { NavEntry, NavGroup } from "./nav";
export type { Dims } from "./TitleBlock";
export type { Tab } from "./TabStrip";
