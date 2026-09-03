# Kronos — humanization plan

Six phases, ordered by dependency and by cheapest-highest-impact first.
Each phase is shippable on its own; nothing later depends on all of an earlier
phase being done, only its foundation.

The through-line: **the engineering-drawing concept is a strong idea when
it's rare.** Right now every screen carries eight decorative motifs; we're
going to leave two.

---

## Phase 1 — Delete the AI tells

Cheapest, highest impact. Every one of these is a subtraction. Do this first
so the later phases operate on a quieter canvas.

- [x] Delete `SheetFrame` (corner tick chrome) from `Gate.tsx` and `Landing.tsx`; remove the component
- [x] Remove hand-authored `<br/>` breaks in `Landing.tsx` display headline — trust `max-w-[Nch]`
- [x] Remove "Rev. 2026 · Sheet 1 of 1 · B.M.S. College of Engineering" from Landing header
- [x] Remove the paragraph under "What do you need to know?" on the Ask screen
- [x] Remove the "Its brain: 2,08,746 questions from this college's own papers" footer strip
- [x] Reduce the KRONOS + square marker instances — keep the marker in the sidebar header only, drop it from Gate/Landing/mobile bar
- [x] Delete `.no-print` classes (nothing here gets printed)

**Exit criteria:** every screen has one fewer decorative motif. The two motifs
we keep on purpose: the sidebar title block, and the mono-numeric stat tiles.

---

## Phase 2 — Type system consolidation

Fixes the "everything is shouting" problem. Collapses five type voices into
three, moves off pixel-hardcoded sizes.

- [x] Audit `index.css` for every `.draft-caps`, `.draft-note`, `.label-cap`, `.wordmark`, `.title-*` utility — reduce to three tiers: `display`, `body`, `caption`
- [x] Delete the caps-tracking treatment from everything except the title block cells
- [x] Sidebar section headings ("Studying", "Teaching"): sentence case, weight 500, no tracking bump
- [x] Convert all `text-[Npx]` and `w-[Npx]` in the shell to `rem` (respects browser zoom)
- [x] Adopt Apple's tracking rule: negative on display (`-0.02em`), zero on body, small positive only on the title-block caption
- [x] One accent color introduced in `tokens.css` — muted blue, used only for: active tab, active nav tick, primary button

**Exit criteria:** a screenshot with the sidebar cropped out is legible
without any letter-spaced caps. One color note besides ink/paper.

---

## Phase 3 — Corners and surface grammar

The all-0-radius aesthetic is the biggest single "AI-generated" tell.

- [x] Add radius tokens to `tokens.css`: `--r-sm: 6px`, `--r-md: 10px`, `--r-lg: 14px`
- [x] Round buttons, inputs, tiles, cards, panels, drawer, composer using those tokens
- [x] Keep the title-block cells at 0 radius — it's the one place the drawing motif earns it
- [x] Kill the outer `border-line` on groups that could be spacing instead — the drafting-rail sections, the stats tile row, the "Studying"/"Teaching" groupings, the tabstrip container
- [x] Rule = "these are separate categories." Spacing = "these are one group." Apply consistently.

**Exit criteria:** count the visible rectangles per screen. Cut in half.

---

## Phase 4 — Motion

Nothing animates. Even the click-to-navigate is a hard swap. Add motion where
it earns its place (per `find-animation-opportunities` skill).

Use Motion (Framer Motion). Default spring: `bounce: 0, duration: 0.3`.

- [x] `active:scale-[0.98]` + 100ms transform transition on every interactive `.btn`
- [x] Sliding underline on `<TabStrip>` — animate the underline element between tabs, not the border of the active `<a>`
- [x] Sidebar station-mark tick springs in on active change (`h: 0 → 16px`)
- [x] Mobile drawer slides in from left with a spring, backdrop cross-fades
- [x] CommandK dialog scales+fades from center (transform-origin: center, respect `prefers-reduced-motion`) — already handled by radix/shadcn Dialog
- [x] `prefers-reduced-motion` guard wrapping the motion module: MotionConfig reducedMotion="user" + existing CSS guard

**Exit criteria:** every navigation, open/close, and press has a matching
motion. No hard swaps remain.

---

## Phase 5 — Materials, depth, composer

The whole app is one flat plane. The floating composer is *opaque* despite
literally floating over content.

- [x] Composer: `backdrop-blur-xl` + semi-transparent bg + soft top shadow. Drop the linear-gradient hack.
- [x] Composer resting state shrinks to `~w-[520px]` centered pill; expands to full width on focus (spring)
- [x] Composer hides on scroll-down / reveals on scroll-up (Safari tab-bar pattern) — skipped, composer should always be reachable
- [x] Sidebar keeps its `backdrop-blur-sm` but gains a subtle right-edge shadow so it reads as *above* the sheet, not the same plane
- [x] `prefers-reduced-transparency: reduce` overrides for both — solid ground, no blur
- [x] Icons: replace the `regular → fill` weight swap on active with `regular` + color change. The weight jump is too heavy.

**Exit criteria:** the composer visibly floats. The sidebar reads as chrome,
not a bordered column.

---

## Phase 6 — Copy pass

Every string is a full explanatory sentence. Apple: show, don't explain.

- [x] Ask page — "Ask in plain words…" paragraph already removed in Phase 1
- [x] Landing subheadline — trimmed to one sentence
- [x] Loading states: replaced "SPAN NOT ANSWERED — THE ARCHIVE IS NOT REACHABLE" with a quiet dash
- [x] Error strings: `archiveError()` already handles this well; loading path now shows `—` instead of lying
- [x] Nav labels: "Patterns" → "Stats" (names what the page shows); "Papers" kept (it downloads papers)

**Exit criteria:** no paragraph on any working surface exceeds one sentence.

---

## Order and dependencies

```
Phase 1  (delete)      ─┐
Phase 2  (type)         ├─→ Phase 3 (radius/surfaces) ─→ Phase 4 (motion) ─→ Phase 5 (materials)
Phase 6  (copy)        ─┘
```

Phases 1, 2, 6 are independent — pick any order. Phase 3 wants 1 done first
so we're rounding the surfaces that survive, not all of them. Phase 4 wants
3 done first so the motion targets the final shapes. Phase 5 wants 4 done so
the composer's shrink/expand can spring into place.

## Rules for every phase

- Read the file, then delete before adding. Every phase's PR should be net
  negative lines.
- Keep the shell components — the point of the refactor is that these edits
  land in one file each, not a diff across pages.
- Verify each phase in the browser before moving on. A stat that stops
  loading is worth more than any of this.
