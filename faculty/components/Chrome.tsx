"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/util";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/generate", label: "Paper Generator" },
  { href: "/coverage", label: "Coverage" },
  { href: "/similar", label: "Has this been asked?" },
  { href: "/topics", label: "Gaps" },
  { href: "/attainment", label: "CO / PO" },
  { href: "/bank", label: "Question Bank" },
  { href: "/ask", label: "Ask" },
];

export function Chrome({ children, backend }: { children: React.ReactNode; backend: string }) {
  const path = usePathname();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-paper-2 sticky top-0 z-20 no-print">
        <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center gap-8">
          <Link href="/" className="wordmark text-[15px] text-ink shrink-0">
            Kronos <span className="text-mark">Faculty</span>
          </Link>
          <nav className="flex gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                className={cn(
                  "px-3 py-1.5 text-[13px] rounded-md whitespace-nowrap transition-colors",
                  path === n.href
                    ? "bg-line-2 text-ink font-medium"
                    : "text-ink-2 hover:text-ink hover:bg-line-2/60")}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <ThemeToggle />
            <span className="mono text-[10px] uppercase tracking-widest text-ink-2">
              {backend === "databricks" ? "● databricks" : "○ local mirror"}
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-[1400px] w-full px-6 py-8">{children}</main>
    </div>
  );
}
