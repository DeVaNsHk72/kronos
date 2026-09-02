---
name: Kronos
description: A cyanotype blueprint of nine years of exam papers — ruled cells, one drafting white, one correction red.
colors:
  paper: "#0e2740"
  paper-2: "#102c46"
  line: "#2c4a68"
  line-2: "#16354f"
  ink: "#e9f2fb"
  ink-2: "#a3bcd4"
  mark: "#ff6b4a"
  ok: "#7fd6a0"
  warn: "#f0b429"
  surface-dim: "#0a1e33"
  surface-bright: "#1a3a58"
  surface-container-lowest: "#071726"
  surface-container-low: "#0c2338"
  surface-container-high: "#16354f"
  surface-container-highest: "#1d4062"
  outline: "#55708d"
  primary: "#eaf4ff"
  on-primary: "#0b2137"
  primary-container: "#1d4062"
  on-primary-container: "#cfe4f8"
  secondary: "#a9c0d6"
  secondary-container: "#16395b"
  error-container: "#6b2415"
  on-error-container: "#ffdad2"
  seq-1: "#3a72a8"
  seq-2: "#5f95c6"
  seq-3: "#8ab3d9"
  seq-4: "#b2cfea"
  seq-5: "#dcebf9"
  seq-min: "#24557f"
  seq-empty: "#16354f"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, Helvetica Neue, sans-serif"
    fontSize: "clamp(2.2rem, 6.4vw, 5.2rem)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.028em"
    fontVariation: "'wdth' 96"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, Helvetica Neue, sans-serif"
    fontSize: "34px"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 96"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, Helvetica Neue, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, Helvetica Neue, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, Helvetica Neue, sans-serif"
    fontSize: "10.5px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.14em"
    fontVariation: "'wdth' 80"
  wordmark:
    fontFamily: "Archivo, ui-sans-serif, system-ui, Helvetica Neue, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.22em"
    fontVariation: "'wdth' 88"
    fontFeature: "'ss01'"
  mono:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "-0.04em"
    fontFeature: "'tnum'"
  note:
    fontFamily: "Archivo, ui-sans-serif, system-ui, Helvetica Neue, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
rounded:
  none: "0px"
  xs: "2px"
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "20px"
  full: "999px"
spacing:
  cell-y: "8px"
  cell-x: "16px"
  control-x: "14px"
  panel: "20px"
  gutter: "24px"
  section: "36px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "6px"
    padding: "0 14px"
    height: "36px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "6px"
    padding: "0 14px"
    height: "36px"
  field:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "36px"
  field-focus:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "20px"
  badge:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.xs}"
    padding: "4px 6px"
    typography: "{typography.mono}"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.xs}"
    padding: "5px 9px"
  pill:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "5px 6px 5px 10px"
  tile:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.none}"
    padding: "11px 14px"
  tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
---

# Design System: Kronos

## Overview

**Creative North Star: "The Blueprint"**

Kronos is a cyanotype. A question paper's blueprint — the unit × marks × CO matrix that a
student and a lecturer already argue over — is a Prussian-blue field with the drawing in
white line, and the only other ink on it is the red an examiner corrects with. The app is
the working sheet; anything that goes to paper is the blueline print of it. That is not a
light/dark toggle dressed as a metaphor: in this process the working surface and the
printed artifact genuinely differ, so the two schemes are two materials, not two moods.

Underneath, the system is Material Design 3 taken as tokens rather than as a component
library: a full tonal ramp per key colour seeded on Prussian blue (`#16395b`), MD3's
surface-container hierarchy, state layers at MD3's own opacities, and MD3's shape scale —
all as CSS custom properties over Tailwind v4, so no value is written twice and no second
component library was added. MD3's `primary` role is deliberately re-cast: on a drenched
blue field the *drafting white* is what reads as the product's own colour, so
`--md-primary` is `#eaf4ff` and a lighter blue would have vanished into the ground.

The arrangement is ruled, never floating. Every bordered box is a drawn cell with a
hairline rule and a barely-raised ground; nothing casts a shadow at rest, because on a
drawing depth is a lie. The body itself carries the grid — 8px minor and 64px major rules,
fixed-attachment — so panels align to the sheet rather than stacking on top of it. The
system explicitly refuses the category arrangement it was measured against: no gray thread
rail, no centred bubble column, no evidence demoted to cards beneath an answer. Navigation
lives in the margin of the drawing with a title block stamped in its corner, and the
figures in that block are real.

**Key Characteristics:**

- Prussian-blue field owns the viewport; the drawing is white line on it.
- One correction red (`--k-mark`), spent only on a mark, a citation, or a failed constraint.
- One typeface — Archivo — from 10.5px to 96px, its width axis carrying register.
- Martian Mono only where the text is literally machine output.
- Ruled cells with hairline borders; a 4px radius, and mostly none at all.
- Every quantity sits in a fixed tabular slot and prints an em-dash rather than collapsing.
- Print inverts the token layer to white stock and blue line — never per-element overrides.

## Colors

A single hue, drenched: one Prussian-blue tonal ramp carrying ground, rule and drawing,
with neutrals tinted toward it so nothing on the sheet reads as a foreign material, and
exactly one warm accent standing against all of it.

### Primary

- **Drafting White** (`#eaf4ff`): MD3's primary role, re-cast as the drawn line. It is the
  fill of the one filled button, the active tab's rule, the focus outline, and the station
  tick on the nav rail. On this field, white is the product's colour.
- **Sheet Ink** (`#e9f2fb`): the on-surface text colour — headings, body, table values,
  any number that is not a mark.
- **Ink Half-Tone** (`#a3bcd4`): on-surface-variant. Field labels, captions, placeholders,
  inactive tabs, axis ticks, the second line of any pair.

### Secondary

- **Faded Blueprint** (`#a9c0d6`) with **Deep Field container** (`#16395b`): the MD3
  secondary pair, available for a container that must sit apart from the surface ladder
  without reaching for the accent.

### Tertiary

Omitted. The system has one accent, and adding a third key colour would give the sheet a
voice it does not need.

### Neutral

- **Cyanotype Field** (`#0e2740`): the ground. MD3 surface; the viewport is this colour
  edge to edge.
- **Raised Field** (`#102c46`): surface-container. Every card, panel and table header —
  a rise you feel rather than see.
- **Drafting Rule** (`#2c4a68`): outline-variant. Every hairline in the app: cell borders,
  table rules, tile grids, the margin rule, the background grid's major line.
- **Ruled Fill** (`#16354f`): surface-container-high, used as a fill for icon wells, row
  hovers, and the empty-cell chart colour.
- **Outline** (`#55708d`): the heavier stroke, used on the outlined button so it reads as
  a control rather than a cell.

The full MD3 surface ladder is exposed (`--md-surface-dim` `#0a1e33` through
`--md-surface-container-highest` `#1d4062`) for anything that needs a real ladder rather
than the two-ground shorthand.

### Accent

- **Correction Red** (`#ff6b4a`, `#b3341f` on white stock): MD3's error role, carrying
  error, citation and failed-constraint as one semantic family — *this needs your attention
  and it traces somewhere.* It is the caret, the selection tint, the highlighter stripe,
  the corner ticks of a framed cell, the `.mark` figure hanging in the margin, the
  `.draft-dim` dimension number, and the hottest cells of the hero matrix. Nothing else.

### Status

- **Verified Green** (`#7fd6a0`) and **Caution Amber** (`#f0b429`): semantic only, kept
  separate from the accent and absent from every chart ramp.

### Chart ramp

- **Sequential ramp** (`--k-seq-1` `#3a72a8` → `--k-seq-5` `#dcebf9`): one hue stepped by
  lightness, validated for CVD separation and for contrast against the field. Units, years
  and marks are ordinal, not identities.
- **Below-step** (`#24557f`) and **Empty** (`#16354f`): a value that is present but too
  small to step, and a value that is absent. Two different facts, two different colours.

### Named Rules

**The Evidence Red Rule.** Red means a mark, a citation, or a failed constraint. It is
never decoration, never a link colour, never a brand flourish, and never a chart series.
In a system whose whole value is traceability, the colour that signals evidence cannot also
signal nothing.

**The Ordinal Ramp Rule.** Ordered series take the sequential ramp, stepped by magnitude.
Categorical hue cycling is banned — a palette that wraps around tells the reader unit 6 is
unit 1 again. Series past the ramp's length fold into one labelled band; they are never
dropped and never given an invented hue.

**The Reserved Meaning Rule.** `--k-ok`, `--k-warn` and the accent are status, not palette.
A series wearing a status colour steals a meaning the app needs elsewhere.

**The One Material Rule.** Neutrals are tinted toward the seed, not gray. Anything truly
gray on this sheet reads as a foreign object pasted onto the drawing.

## Typography

**Display Font:** Archivo (variable weight 100–900, width 62–125), with `ui-sans-serif,
system-ui, "Helvetica Neue", sans-serif`
**Body Font:** Archivo — the same face, at every size
**Label/Mono Font:** Martian Mono, with `ui-monospace, "SFMono-Regular", monospace`

**Character:** One workhorse grotesk carries the whole system from a 10.5px title-block
stamp to a 96px display line, and where a second typeface would normally be reached for,
the *width axis* does the work instead — a title block is condensed because a title block
is condensed on a real drawing, not because it needed a different voice. Martian Mono is
not a "technical feel"; it marks a change of author. It appears where the text was written
by a machine — the SQL, a `question_id`, a source path — and on every figure, because
tabular numerals are what make a column of marks a column rather than a shimmer.

### Hierarchy

- **Display** (500, `clamp(2.2rem, 6.4vw, 5.2rem)`, 1.02, `-0.028em`, width 96): the
  landing headline, on the field itself. Line breaks are authored, not left to the measure.
- **Headline** (500, 30px → 34px at 640px, 1.04, `-0.03em`, width 96): `.title-page` — one
  per screen, and every screen picks this one.
- **Title** (500, 20px, 1.15, `-0.02em`): `.title-section` — the heading on a panel.
  There is no third heading size.
- **Body** (400, 13–15.5px, 1.55): `.serif` — question text, topic names, prose. Reading
  columns are held at 52–54ch.
- **Label** (500, 10.5px, `0.14em`, uppercase, width 80): `.label-cap` / `.draft-caps` —
  every field label, tile caption and table header. This is the title-block register.
- **Wordmark** (600, `0.22em`, uppercase, width 88, `ss01`): drafting caps out of a title
  block. Kronos, and nothing else.
- **Mono** (400, 10–15px, `-0.04em`, tabular): `.mono` / `.badge` / `.mark` — every
  numeric value, id, badge and code block.
- **Dimension** (`.draft-dim`, mono, 11px, accent): the number written along a measured
  line. Always tabular, always the accent, because a measured number on this sheet is
  evidence.
- **Revision note** (`.draft-note`, italic, 12.5px, ink-2): hand-added to a finished
  drawing — the one place the system permits an italic.

### Named Rules

**The One Face Rule.** Archivo alone, 10.5px to 96px. Size and width carry register; a
second display face is a costume. Martian Mono is admitted only where the text is literally
machine output.

**The Width-Not-Weight Rule.** When a register needs to change — a stamp, a title block, a
display line — move the width axis (80 / 88 / 96) before reaching for weight. Weight is too
blunt for a drawing.

**The Two Headings Rule.** Every screen has one `.title-page` and as many `.title-section`s
as it has panels. A third heading size is a drift, not a need.

**The Tabular Figure Rule.** Every number is `font-variant-numeric: tabular-nums`, so a
figure never changes position between two answers.

## Layout

The sheet is ruled before anything is drawn on it. `body` carries the grid itself — two
repeating rules in each axis, a 64px major line at 46% of the rule colour and an 8px minor
at 18%, `background-attachment: fixed` — so scrolling moves content across a stationary
sheet. Every panel aligns to this, which is why the app reads as one drawing rather than a
stack of boxes. `.grid-paper` is the one escape: an unruled patch for content that needs to
sit clear of the grid without becoming a card.

`.page` is the single container: `max-width: 1400px`, centred, `padding-inline: 24px`.
Every header, nav strip, control row and content block sits on that one gutter, so nothing
is inset differently from the thing above it. Reading and conversation columns narrow
further inside it — 860–880px for the thread and composer, 640–680px for the landing's
reading column.

Navigation is the margin of the drawing: a fixed 228px left column at `lg` and up, one rule
down its edge, `bg-paper/92` with a light backdrop blur, and the title block stamped at its
foot. Below `lg` the same margin folds into a 52px top bar and a 262px drawer; a route
change closes the drawer during render, so back/forward navigation closes it too. The
composer occupies the bottom margin at full content width, offset by the rail's 228px.

Density is tight and even: cells at 8px/16px, controls at 36px height with 14px inline
padding, panels at 20px, sections separated by 32–36px. Tiles and dimension blocks are
grids that own their outer top and left rules while each cell draws only its own bottom and
right — five figures read as one measured strip, the way a title block does, not as five
cards in a row.

### Named Rules

**The One Gutter Rule.** Everything on a screen sits on `.page`. A panel that insets itself
differently from the one above it breaks the drawing.

**The Fixed Slot Rule.** Every quantity lives in a fixed tabular slot and prints an
em-dash (—) when the archive has not answered. Columns do not move when an answer arrives,
and a missing figure is stated rather than hidden by collapsing its row.

## Elevation & Depth

Flat by conviction. Depth is tonal: the MD3 surface-container ladder
(`#071726` → `#1d4062`) does the work, and nothing casts a shadow at rest. `.card` is a
hairline rule over a barely-raised ground — a drawn cell, not a floating card. The three
MD3 elevation tokens exist for the rare overlay that must genuinely sit above the sheet
(popovers, the mobile drawer scrim) and each carries a real offset with a soft blur; a
zero-offset halo is decoration, not depth.

Interaction depth is a *state layer*, never a second background colour: a tint of the
content colour over the container at MD3's own opacities — hover 0.08, focus 0.10,
pressed 0.10, dragged 0.16, disabled 0.38. That is what keeps every interactive surface in
the app behaving identically.

### Shadow Vocabulary

- **Level 1** (`0 1px 2px rgba(2,10,20,.30), 0 1px 3px 1px rgba(2,10,20,.15)`): a resting
  overlay — a popover panel.
- **Level 2** (`0 1px 2px rgba(2,10,20,.30), 0 2px 6px 2px rgba(2,10,20,.15)`): a raised
  overlay, e.g. a menu opened over content.
- **Level 3** (`0 4px 8px 3px rgba(2,10,20,.15), 0 1px 3px rgba(2,10,20,.30)`): a modal or
  drawer that owns the screen.

Each is re-authored for the white stock scheme at roughly half the opacity, because a
shadow on paper is a different physical fact.

### Named Rules

**The No-Float Rule.** Nothing in this world floats. Surfaces are ruled onto the sheet;
elevation is reserved for an overlay that is genuinely above it.

**The State-Layer Rule.** Hover and press are a tint of the content colour at MD3's
opacities, applied through a `::before` at `z-index: -1` on an isolated stacking context —
never a swapped background colour.

## Shapes

The blueprint is ruled, not rounded. The default radius is 4px (`--k-radius`), and most
things use less: badges, chips, icon wells and the focus outline take the 2px extra-small
step, tiles and dimension cells take none at all. The MD3 shape scale is present in full
(0 / 2 / 4 / 8 / 12 / 20 / 999px) but the upper steps are effectively unused — a 20px
corner on a drafting sheet reads as a different material. `999px` appears only on the
scrollbar thumb.

Borders do the structural work. Every surface is defined by a 1px hairline in
`--k-line`, and Tailwind v4's base layer sets `border-color` globally to that token so no
element ever falls back to `currentColor` and draws an ink-weight rule that looks like an
error.

Two recurring silhouettes:

- **Corner ticks** (`.cell-framed`): 9px L-shaped marks in the accent at the top-left and
  bottom-right of a cell, borrowed from a drawing frame. Applied only to the cell that is
  the subject of the screen — the answer, the generated paper — so the eye knows which cell
  was drawn on purpose. They are suppressed in print.
- **The margin rule** (`.margin-rule`): `inset 1px 0 0` — the vertical rule down a printed
  question paper. Content sits left of it, the measured number sits right of it.

### Named Rules

**The Ruled-Not-Rounded Rule.** 4px is the ceiling for content surfaces and 2px is the
common case. A pill shape is reserved for the scrollbar thumb.

**The Hairline Rule.** Structure is one 1px line in the rule colour. Two-tone borders,
inner glows and double rules belong to a different material.

## Components

### Buttons

Two buttons, and there is no third.

- **Shape:** softly squared (6px), 36px tall, 14px inline padding, 13px medium label.
- **Primary (filled):** drafting white fill (`{colors.primary}`) on deep-blue text
  (`{colors.on-primary}`) with a matching border — the main action reads as the one thing
  actually drawn on the blueprint.
- **Outlined:** transparent ground, 1px `{colors.outline}` border, ink label.
- **Hover / Press:** an MD3 state layer at 0.08 / 0.10, transitioned over 140ms
  (`--k-dur-press`) on `--k-ease-out`. No colour swap, no lift, no shadow.
- **Disabled:** 0.38 opacity (`--md-state-disabled`) and `cursor: not-allowed`.
- **Icon-only:** the same classes squared to 32–36px with padding zeroed.

### Chips

- **Style:** 11px label, 5px/9px padding, 2px radius, hairline `line` border on the field
  ground, ink-2 text. `.chip-topic` promotes it — ink text, a 20%-ink border blend, raised
  ground — for a chip that names a real entity.
- **State:** hover raises the border toward ink-2 and the text to ink. Chips are used as
  follow-up refinements under an answer ("Main exams only", "from the last 2 years only").

### Badges and pills

- **Badge:** mono at 10px, tabular, 2px radius, hairline border on the field ground. Every
  metadata badge in the app — year, exam type, marks, ids. `.badge-code` raises it to ink.
- **Pill:** 12px, 4px radius, raised ground, an inline-flex row with a 5px gap — used where
  a badge needs to carry a small control or icon alongside its label.

### Cards / Containers

- **Corner style:** 4px (`--radius`).
- **Background:** `{colors.paper-2}` — the raised field.
- **Border:** 1px `{colors.line}`, and the border is what defines the surface.
- **Shadow strategy:** none. See Elevation & Depth.
- **Internal padding:** 20px (`.card p-5`); the `Panel` wrapper is the one place a bordered
  box is constructed, so radius, ground and padding cannot drift screen by screen.

### Inputs / Fields

- **Style:** 36px tall, 10px inline padding, 13px text, 4px radius, 1px `line` border on
  the `surface-container-low` ground. `textarea.field` releases the fixed height.
- **Caret:** the accent — the one place red appears before anything has been asked, because
  the caret is where the user's own mark will land.
- **Hover:** border rises to ink-2.
- **Focus:** the rule *thickens* rather than colouring — border to ink plus an
  `inset 0 0 0 1px` ink ring. A red ring on every focused input would read as an error, and
  red here means something specific.
- **Placeholder:** `--k-ink-2` at full opacity — placeholder text carries the same 4.5:1
  floor as any other body copy.
- **Select:** native chrome is suppressed (`appearance-none`) and a 13px caret glyph is
  drawn into the field, because a platform arrow is the one control belonging to no design
  system. It carries three distinct states — in flight ("Loading…"), empty ("No subjects in
  scope"), and `failed` ("Not answered") — because a picker that says "Loading…" forever
  after a failure is telling the user to keep waiting for nothing.

### Navigation

- **Tabs:** 13px, 11px/14px padding, ink-2 at rest, ink on hover. The active tab is drawn
  in — a full-weight ink bottom rule plus a 10×3px tick beneath its left edge. The tick is
  ink, not the accent: which position you are at is navigation, and the accent is spent
  only on evidence. The hairline belongs to the full-width wrapper, not the strip, so it
  runs edge to edge.
- **Rail links:** 13px rows with a 15px icon; the active position is marked with a 2px ink
  tick at the left edge and the icon switches to `fill` weight — on a drawing, the active
  position on a rule is ticked, not highlighted.
- **Focus-visible:** a 2px ink outline at 2px offset with a 2px radius, applied globally to
  links, buttons, inputs, selects, textareas and anything with `tabindex`.

### Tiles

A ruled block, not a row of cards. `TileRow` owns the outer top and left rules and each
`Tile` draws only its own bottom and right, so five figures read as one measured strip.
Each tile is a `.label-cap` over a 24px mono tabular figure; `tone="warn"` switches the
figure to the accent, which is the only tone a tile has.

### Signature: the Drafting Rail and Title Block

The chrome is not a bar above the content — it is the frame the content is drawn inside.
A ruled margin down the left edge carries the two verbs the product has ("Studying",
"Teaching"), and the corner of the sheet carries a title block: a 2×2 grid of the archive's
real dimensions (Subjects, Years, Questions, Papers) over a source line. Every number in it
is measured and every unanswered slot prints an em-dash. This deliberately replaces the
category's thread rail — a list of past conversation titles says what you asked; this says
what the archive *is*, which is what a student needs before they know what to ask.

### Signature: the Global Composer

The agent is reachable from every screen, drawn as the sheet's bottom margin: a ruled strip
the width of the content column on a paper-to-transparent gradient, with an accent caret
and a filled 32px submit. `/` focuses it from anywhere. It is not a floating pill, because
nothing in this world floats.

### Signature: the Cyanotype Exposure (landing hero)

A WebGL field — instanced bars on a real line-segment grid, one bar per (year, unit) cell,
height set by marks carried — with a light bar sweeping across it once and leaving the
matrix behind, the way a cyanotype is exposed. It sweeps once and holds; a looping hero is
a screensaver. Bars run pale drafting blue and lerp toward the correction red at the
heaviest cells, so the topics carrying the most marks are literally the ones marked in red.
**A cell with no value is not drawn at all** — rendering a flat plate would put a mark on
the sheet for a row that does not exist. With no data the sheet stays unexposed, which is
the honest state. It fails silently to the CSS grid underneath if WebGL is unavailable,
pauses off-screen via IntersectionObserver, and holds a static tilted frame under
`prefers-reduced-motion`.

### Charts

Charts read the live custom properties rather than carrying a palette of their own
(`useChartTokens`), re-reading on a colour-scheme change and on a `data-theme` mutation, so
a chart never keeps the palette of the theme it mounted under and follows the sheet into
the print without a second palette existing anywhere. `sequential()` returns the five-step
ramp lowest-first; `step(i, n)` maps an ordered band onto it and returns the top step
rather than inventing a hue past the end; `tickStyle()` is shared so no two charts label
themselves differently (ink-2, 10.5px, Martian Mono).

### Motion

Four durations and three curves, and that is the whole vocabulary: press 140ms, pop 180ms,
panel 220ms, draw 620ms, on `--k-ease-out` `cubic-bezier(.23,1,.32,1)` for entering and
exiting, `--k-ease-in-out` for moving on screen, and MD3's emphasized-decelerate
`--k-ease-emph` for the one authored moment per surface.

- **`.draw`** scales a bar in from its left edge (450ms) — used only where a value has a
  length worth reading.
- **`.disclosure`** animates `grid-template-rows: 0fr → 1fr` so a source panel or a "show
  the SQL" block opens without knowing its height.
- **`.k-rise` / `.k-stagger`** lift sections in at 40ms intervals when a generated paper
  arrives after a 20–60s wait, so the eye is led down the page rather than hit with all of
  it at once.
- **`.popover-panel`** scales from its trigger's top-left in 150ms, via a `data-mounted`
  class flip rather than `@starting-style`, which does not fire reliably on React mounts.
- **Reduced motion** means fewer and gentler, not none: `k-rise` keeps its fade and loses
  its movement, the disclosure keeps opacity and drops the row transition, `.draw` is off.

### The Print

`@media print` switches the *token layer* — paper to white, line to `#9db8d0`, ink to
`#0c2338`, mark to `#b3341f` — rather than overriding colours element by element, then
hides `header`, `nav`, `aside` and `.no-print`, drops the body grid, suppresses corner
ticks, sets the paper sheet to 11pt with `break-inside: avoid` per section, and sets A4 at
18mm/16mm margins. The same inversion is what the light scheme is: the blueline print,
offered when a viewer asks for light and forced when anything goes to paper.

## Do's and Don'ts

### Do:

- **Do** spend red only on a mark, a citation, or a failed constraint. If it is not one of
  those three, it is ink.
- **Do** give every quantity a fixed tabular slot and print `—` when there is no value, so
  columns hold their position whether or not the archive answered.
- **Do** use the sequential ramp (`--k-seq-1..5`) for ordered series, and fold anything past
  it into one labelled band.
- **Do** distinguish *present but below the step* (`--k-seq-min`) from *absent*
  (`--k-seq-empty`). They are different facts.
- **Do** build every bordered box from `.card` / `Panel`, every label from `.label-cap`,
  every control from `.field` / `.btn` / `.btn-primary`.
- **Do** express hover and press as MD3 state layers at 0.08 / 0.10 over the container.
- **Do** move the width axis (80 / 88 / 96) to change register before reaching for weight.
- **Do** name the problem and the recovery in the product's own language when something
  fails — "The archive is not answering right now. Nothing was lost — try again in a
  moment." (`archiveError`, `src/lib/utils.ts`).
- **Do** theme the browser's own surfaces — focus ring, caret, selection, scrollbars,
  `::placeholder`, `color-scheme` — because on a drenched field an unthemed focus ring is
  the most visible foreign object on the page.
- **Do** let printing invert through the token layer, so a new component is print-correct
  the day it ships.

### Don't:

- **Don't** use the accent as a link colour, a brand flourish, a chart series, or a hover
  tint. Red that means "nothing" destroys red that means "evidence".
- **Don't** cycle hues for a categorical series, and don't reuse `--k-ok` or `--k-warn` as
  series colours.
- **Don't** render a figure the system does not have. No placeholder counts, no filled bar
  for an empty cell, no plausible-looking number to keep an animation interesting.
- **Don't** float anything. No resting shadows on cards, panels, tiles or rails; depth is
  the surface ladder.
- **Don't** colour a focus ring with the accent — thicken the rule to ink instead.
- **Don't** introduce a second typeface. Martian Mono is admitted only where the text is
  literally machine output.
- **Don't** add a third heading size, a third button, or a fourth radius.
- **Don't** ship a native `<select>` arrow, an unthemed scrollbar, or a browser-default
  focus outline.
- **Don't** write print rules per element. Switch the tokens.
- **Don't** let a raw library or HTTP error string reach the screen.
- **Don't** exceed 300ms for a UI transition; a 180ms disclosure reads as more responsive
  than a 400ms one.
