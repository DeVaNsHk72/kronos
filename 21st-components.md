# Kronos — 21st.dev Component Plan

Components from [21st.dev](https://21st.dev) that can replace or upgrade what Kronos has today. Recommended pick marked ★.

---

## 1. Sidebar & Navigation

| Component | Author | What it does | Why for Kronos |
|---|---|---|---|
| ★ [Animated Sidebar](https://21st.dev/@unlumen/components/sidebar-001) | unlumen | Spring hover highlight, animated active indicator bar, collapsible groups, drag-to-resize | Replaces our `Sidebar` + `NavItem` + `NavSection` — gives us Phase 4 motion for free |
| [Sidebar Light](https://21st.dev/@inference-sh/components/sidebar-light) | inference-sh | Lightweight sidebar with nested items, icons, active route highlighting | Simpler alternative if we don't want animation |
| [Sidebar Nav Group](https://21st.dev/@felipemenezes098/components/collapsible-05) | felipemenezes098 | Collapsible sidebar with grouped sections, rotating chevron | Good if we add collapsible "Studying"/"Teaching" groups |

```bash
npx shadcn@latest add "https://21st.dev/r/unlumen/sidebar-001"
```

---

## 2. Number Ticker / Stats

| Component | Author | What it does | Why for Kronos |
|---|---|---|---|
| ★ [Number Ticker](https://21st.dev/@dillionverma/components/number-ticker) | dillionverma (Magic UI) | Animated count up/down to target | For the title block stats (Questions, Papers, Subjects) — numbers animate in instead of popping |
| [Count Up](https://21st.dev/@unlumen/components/count-up) | unlumen | Springs to target on viewport entry, per-digit slide/fade/blur | More dramatic, good for Landing page |
| [Count Animation](https://21st.dev/@bundui/components/count-animation) | bundui | Smooth number animation with Framer Motion | Lightweight alternative |

```bash
npx shadcn@latest add "https://21st.dev/r/dillionverma/number-ticker"
```

---

## 3. Select / Dropdown

| Component | Author | What it does | Why for Kronos |
|---|---|---|---|
| ★ [Combobox](https://21st.dev/@shugar/components/combobox) | shugar | Filters large lists, selectable options | Replaces `SubjectPicker` native select with searchable combobox |

```bash
npx shadcn@latest add "https://21st.dev/r/shugar/combobox"
```

---

## 4. Data Table

| Component | Author | What it does | Why for Kronos |
|---|---|---|---|
| ★ [Sortable Table](https://21st.dev/@ddoemonn/components/sortable-table) | ddoemonn | Rows animate into place on sort, follow toggle | For faculty question bank, stats tables |
| [Table](https://21st.dev/@originui/components/table) | originui | Enhanced shadcn/ui table | Simpler, stays close to our existing `.table-wrap` |

```bash
npx shadcn@latest add "https://21st.dev/r/ddoemonn/sortable-table"
```

---

## Priority Order

| Priority | Component | Replaces | Phase |
|---|---|---|---|
| 1 | Animated Sidebar | `Sidebar` + `NavItem` + `NavSection` | 4 (Motion) |
| 2 | Number Ticker | Static stat numbers | 4 (Motion) |
| 3 | Combobox | `SubjectPicker` | standalone |
| 4 | Sortable Table | `.table-wrap` | standalone |

---

## Install All (one shot)

```bash
npx shadcn@latest add \
  "https://21st.dev/r/unlumen/sidebar-001" \
  "https://21st.dev/r/dillionverma/number-ticker" \
  "https://21st.dev/r/shugar/combobox" \
  "https://21st.dev/r/ddoemonn/sortable-table"
```

> **Note:** Each install adds the component source to your repo (not a dependency). You own the code and can modify it to match Kronos's tokens/theme.
