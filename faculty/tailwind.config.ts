import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)", "paper-2": "var(--paper-2)",
        line: "var(--line)", "line-2": "var(--line-2)",
        ink: "var(--ink)", "ink-2": "var(--ink-2)",
        mark: "var(--mark)",
        ok: "var(--ok)", warn: "var(--warn)",
      },
      fontFamily: {
        editorial: ["Fraunces", "ui-serif", "Georgia", "serif"],
        serif: ["Newsreader", "ui-serif", "Georgia", "serif"],
        sans: ["General Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Departure Mono", "ui-monospace", "monospace"],
      },
    },
  },
} satisfies Config;
