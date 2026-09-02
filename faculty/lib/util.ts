import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...i: ClassValue[]) => twMerge(clsx(i));

export async function runQuery(name: string, params: Record<string, unknown> = {}) {
  const r = await fetch("/api/query", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, params }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
  return r.json();
}

/** Marks are 8% NULL. Anything that totals them must say what it excluded. */
export function coveragePhrase(withValue: number, total: number, noun = "questions") {
  const pct = total ? Math.round((100 * withValue) / total) : 0;
  if (pct === 100) return `all ${total.toLocaleString()} ${noun}`;
  return `${withValue.toLocaleString()} of ${total.toLocaleString()} ${noun} (${pct}%)`;
}
