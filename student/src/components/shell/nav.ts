/**
 * The routes that appear in the sidebar, one edit away from the labels users
 * see. Kept as data so a page rename, an added route, or a re-order is a diff
 * in this file only.
 */
import {
  ChatCircleText,
  MagnifyingGlass,
  ListChecks,
  BookOpen,
  ChartBar,
  Gauge,
  FilePlus,
  Archive,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";

export type NavEntry = {
  to: string;
  label: string;
  Icon: ComponentType<{ size?: number; weight?: "regular" | "fill" | "bold"; className?: string }>;
  end?: boolean;
};

export type NavGroup = { heading: string; entries: NavEntry[] };

export const STUDENT: NavEntry[] = [
  { to: "/ask",          label: "Ask",      Icon: ChatCircleText,  end: true },
  { to: "/ask/search",   label: "Search",   Icon: MagnifyingGlass },
  { to: "/ask/practice", label: "Practice", Icon: ListChecks },
  { to: "/ask/notes",    label: "Notes",    Icon: BookOpen },
  { to: "/stats",        label: "Stats",    Icon: ChartBar },
];

export const FACULTY: NavEntry[] = [
  { to: "/faculty",          label: "Dashboard",     Icon: Gauge,    end: true },
  { to: "/faculty/generate", label: "Set a paper",   Icon: FilePlus },
  { to: "/faculty/bank",     label: "Question bank", Icon: Archive },
];

export const DEFAULT_GROUPS: NavGroup[] = [
  { heading: "Studying", entries: STUDENT },
  { heading: "Teaching", entries: FACULTY },
];
