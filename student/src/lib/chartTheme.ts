import { useEffect, useState } from "react";

/**
 * Charts read the same tokens as everything else.
 *
 * reaviz and recharts want literal colour strings, which is how chart palettes
 * end up as a hardcoded array at the top of a file and then quietly stop
 * matching the rest of the app. Reading the computed custom properties keeps
 * one source of truth, and means the charts follow the sheet into its light
 * variant and into print without a second palette existing anywhere.
 */

const TOKENS = [
  "--k-ink",
  "--k-ink-2",
  "--k-line",
  "--k-line-2",
  "--k-paper",
  "--k-paper-2",
  "--k-mark",
  "--k-seq-1",
  "--k-seq-2",
  "--k-seq-3",
  "--k-seq-4",
  "--k-seq-5",
  "--k-seq-min",
  "--k-seq-empty",
] as const;

export type ChartTokens = Record<(typeof TOKENS)[number], string>;

function read(): ChartTokens {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as ChartTokens;
  for (const t of TOKENS) out[t] = cs.getPropertyValue(t).trim();
  return out;
}

/**
 * Live token values, re-read when the colour scheme changes so a chart never
 * keeps the palette of the theme it was mounted under.
 */
export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(() =>
    typeof window === "undefined" ? ({} as ChartTokens) : read(),
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setTokens(read());
    mq.addEventListener("change", sync);
    // The theme can also be pinned on the root element.
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", sync);
      mo.disconnect();
    };
  }, []);

  return tokens;
}

/** The sequential ramp, lowest magnitude first. */
export function sequential(t: ChartTokens): string[] {
  return [t["--k-seq-1"], t["--k-seq-2"], t["--k-seq-3"], t["--k-seq-4"], t["--k-seq-5"]];
}

/**
 * A colour for step `i` of `n` ordered bands, taken from the ramp rather than
 * cycled: an ordinal series has an order, and a palette that wraps around
 * tells the reader that unit 6 is unit 1 again.
 *
 * Series past the ramp's length are the caller's problem to fold into an
 * "Other" band — this returns the top step rather than inventing a hue.
 */
export function step(t: ChartTokens, i: number, n: number): string {
  const ramp = sequential(t);
  if (n <= 1) return ramp[ramp.length - 1];
  const idx = Math.round((i / (n - 1)) * (ramp.length - 1));
  return ramp[Math.min(ramp.length - 1, Math.max(0, idx))];
}

/** Axis tick styling, shared so no two charts label themselves differently. */
export function tickStyle(t: ChartTokens) {
  return {
    fill: t["--k-ink-2"],
    fontSize: 10.5,
    fontFamily: "Martian Mono, ui-monospace, monospace",
  };
}
