import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turn a transport failure into something a student can act on. The library's
 *  own string ("AxiosError: Request failed with status code 502") names no
 *  problem and no recovery, and it is the one piece of copy on this screen
 *  nobody wrote. */
export function archiveError(e: unknown): string {
  const status =
    typeof e === "object" && e !== null
      ? (e as { response?: { status?: number } }).response?.status
      : undefined;
  if (status === 504) return "Kronos took too long on that one. Try a narrower question.";
  if (status === 502 || status === 503)
    return "Kronos can't reach its tables right now. Nothing was lost — try again in a moment.";
  if (status === 429) return "Too many questions at once. Wait a few seconds and ask again.";
  if (status && status >= 500) return "Kronos hit an error working that out. Try again.";
  if (status === 404) return "Kronos has nothing on that subject yet.";
  return "Can't reach Kronos. Check your connection and try again.";
}

/** One number format for the whole app. Indian grouping, because the readers
 *  are at an Indian college and 2,08,746 is how they write it — but the point
 *  is that it is the SAME grouping everywhere. The rail printing 2,08,746
 *  while the screen beside it printed 208,746 was the same figure wearing two
 *  faces, which on a sheet whose argument is traceability reads as two
 *  different numbers. */
export function fmt(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (v == null || !Number.isFinite(v)) return "\u2014";
  return v.toLocaleString("en-IN");
}
