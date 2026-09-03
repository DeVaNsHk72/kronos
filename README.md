# Kronos

**Your college has a memory now.**

Every past paper, every set of notes, every syllabus — read, parsed, and held in
one place as governed tables. Kronos is the agent that thinks over that memory
and shows its working.

```
208,746 questions · 3,296 courses · 10,606 papers · 30,464 topics · 2016–2025
```

Not a search box. The papers and notes are the memory; Databricks Genie is the
text-to-SQL agent that reasons over it. Ask in plain words — on the web, or on
Telegram — and the SQL it wrote is one click away. An agent that cannot show its
working cannot be trusted with an exam.

---

## Contents

1.  [The problem](#the-problem)
2.  [The two doors](#the-two-doors)
3.  [Studying](#studying)
4.  [Intelligence (teaching)](#intelligence-teaching)
5.  [Telegram bot](#telegram-bot)
6.  [How the agent works](#how-the-agent-works)
7.  [The data underneath](#the-data-underneath)
8.  [Architecture](#architecture)
9.  [Tech stack](#tech-stack)
10. [Running it](#running-it)
11. [Environment variables](#environment-variables)
12. [Project structure](#project-structure)
13. [Design system](#design-system)
14. [What is real and what is not](#what-is-real-and-what-is-not)
15. [Further reading](#further-reading)

---

## The problem

Two people need the same archive and neither can use it.

**A student, three days from an exam** has nine years of past papers and no way
to know which topics matter. Sorting 56 PDFs by hand is not revision.

**A lecturer setting the next paper** works from memory — no view of what has
already been asked to death, no sense of which topics are examined heavily but
taught thinly, and no evidence trail when the exam committee asks why a question
was chosen.

Both questions are answerable from the same rows. Neither is answerable from PDFs.

---

## The two doors

The homepage asks who you are and nothing else. A student and a lecturer want
opposite things from identical data, so the question is asked before anything is
shown rather than guessed at.

| Door | Goes to |
|---|---|
| **I'm studying** | `/ask` — the study hub |
| **I teach here** | `/faculty` — Intelligence |

The choice is stored in `localStorage` and can be changed at any time.

---

## Studying

One hub at `/ask`, five tabs in a floating animated navbar: **Ask · Search · Practice · Notes · Stats**.

### Ask

The agent, in plain words. *"What repeats in operating systems deadlock
questions?"* returns a structured answer with the questions behind it, the years
they were set, and the paper each came from.

Powered by Databricks Genie. The reply carries the generated SQL, the answer
text (rendered with bold and bullets), and tabular results displayed as
`QuestionCard` components — the same cards used throughout the app. Garbage rows
(OCR artifacts, table sample data shorter than 30 characters) are filtered out
before rendering.

### Search

Every question in the archive, filtered by course, branch, semester, year, exam
type, and programme — plus **semantic search** over 384-dimension embeddings,
which finds by meaning rather than keyword. Toggle between keyword and meaning
modes.

### Practice

**MCQ sets built from real past questions.** Scope to a whole subject or a single
unit, choose 5–20 questions, answer, then check.

The stem is always a question that was actually set, carrying its year, marks and
source paper. The distractors are **other real topics from the same subject** —
so a wrong option is something a student could genuinely confuse it with, not an
invented string.

### Notes

The documents themselves — lecture notes and past papers, opened or downloaded as
PDFs. A document is listed **only if it was actually read into the archive**, so
what you open is what the agent answers from.

### Stats

Subject-level analytics: marks distribution by unit, topic frequency, year-over-year
trends. Stats are animated with `NumberTicker` components on load.

---

## Intelligence (teaching)

Three tabs in the faculty floating navbar: **Dashboard · Set a paper · Question bank**.

### Dashboard

What this subject has actually been examining — marks by unit, unit emphasis
across nine years as a stacked area, coverage tiles. A unit thinning out year on
year is usually being quietly dropped, and that shows here before anyone notices
in a meeting.

### Set a paper (Generate)

The headline feature, with the strictest rule:

> **SQL selects, the model only phrases.**

A paper is assembled by constraint satisfaction over real past questions. Every
line traces to a `question_id`, its source PDF, and the year it was last asked —
which is what makes it defensible to an exam committee. **No language model
invents a question.**

Two declared formats:

| | Structure | Marks |
|---|---|---|
| **SEE** | 5 units × 20 marks, 10 marks per question, internal choice | 100 |
| **CIE** | Part A 1×5 · Part B 3×5 · Part C 2 of 3 ×10 | 40 |

Controls: exclude questions asked in the last N years, difficulty preference
(Bloom level ordering).

### Question bank

Every question, filtered by unit, marks, Bloom level, year and sitting, with full
text search. Every row expands to its source file, sitting, topic and repeat
cluster. Table rows enter with staggered spring animations.

---

## Telegram bot

**[@KronosStudybot](https://t.me/KronosStudybot)** — the same Genie agent,
available on Telegram.

Students message the bot in plain text and get structured answers: a text summary
plus a numbered list of matching questions with marks, year, and topic. The bot
maintains per-user conversation context via Genie's `conversation_id`, so
follow-up questions work.

### Commands

| Command | What it does |
|---|---|
| `/start`, `/help` | Welcome message and command list |
| `/plan` | Study priority list based on exam importance |
| `/quiz` | Practice question from the most important topic |
| `/topics` | All topics grouped by unit with exam frequency |
| `/reset` | Clear conversation context |

Or just send any question in plain text.

### Running the bot

The bot uses long-polling (no webhook/public URL needed):

```bash
cd backend && ../.venv/bin/python telegram_poll.py
```

For production with a public URL, register the webhook:

```
GET /telegram/set-webhook?url=https://your-domain.com
```

---

## How the agent works

```
question ─► Genie (text-to-SQL) ─► Unity Catalog ─► rows
                   │
              the SQL is
              always visible
```

Genie writes SQL, runs it against governed tables, and returns rows — with the
query visible. Every analytical screen offers **"Show SQL"** with the timing and
which engine answered.

**Fallback chain:** Genie → hand-written SQL statement. A screen degrades to
working-but-not-agentic rather than to blank, and says which path answered.

### Where the agent is deliberately not used

| | Why |
|---|---|
| **Paper assembly** | Must be reproducible; SQL selects, constraint satisfaction assembles. |
| **Similarity scoring** | Must be reproducible to be actionable. IDF-weighted term overlap in SQL. |
| **Subject picker** | Drives every other screen; a 20-second agent call to fill a dropdown is wrong. |

---

## The data underneath

### Databricks (Unity Catalog — remote)

Seven gold tables. Seven, not seventeen — text-to-SQL accuracy is driven mostly
by how narrow the surface is.

| Table | Rows | Its job |
|---|---|---|
| `fact_question` | 15,888 | One row per question ever asked. The core. |
| `dim_topic` | 757 | The vocabulary. Without it, 15,888 unrelated sentences. |
| `dim_subject` | 30 | Identity across time — a subject has run under many codes. |
| `dim_exam_pattern` | 168 | The shape of a paper, per unit. |
| `fact_note_coverage` | 921 | Which pages of notes cover which topic. |
| `fact_attempt` | 0 | Empty by design — no quiz data exists. |
| `fact_engagement` | 0 | Empty by design — no telemetry exists. |

### SQLite (local — `DERIVED_DATA/`)

The full 208k-question corpus across all branches and colleges, used for search,
stats, chat, and the student-facing features. Two databases:

| File | Size | Content |
|---|---|---|
| `questions_v2.db` | 166 MB | All questions, topics, embeddings keys |
| `papers_v2.db` | 8 MB | Paper metadata, course mappings |

Plus `embeddings.npy` (384-dim vectors) and `emb_keys.json` for semantic search.

### Design decisions

1. **Natural keys, not surrogate integers.** `subject_key` is `cloud_computing`;
   every join is readable in a raw query result.
2. **Subjects are identified by name, never by code.** Codes change every scheme —
   DBMS has run under seven.
3. **`topic_id` is keyed on name, not unit.** The same topic sits in different
   units across schemes.

Full column-level reference in **[SCHEMA.md](SCHEMA.md)**.

---

## Architecture

```
kronos/
├── student/              React 19 SPA — one app, both audiences
│   └── src/
│       ├── routes/
│       │   ├── Ask.tsx           Genie-powered Q&A
│       │   ├── Home.tsx          Search
│       │   ├── Notes.tsx         Document browser
│       │   ├── Stats.tsx         Subject analytics
│       │   ├── Download.tsx      Bulk PDF export
│       │   ├── Gate.tsx          Role picker (student/teacher)
│       │   ├── Landing.tsx       Welcome page
│       │   └── faculty/
│       │       ├── Dashboard.tsx
│       │       ├── Generate.tsx  Paper assembly
│       │       ├── Bank.tsx      Question bank
│       │       └── Practice.tsx  MCQ builder
│       ├── components/
│       │   ├── shell/            App chrome: sidebar, nav, title block
│       │   │   ├── AppShell.tsx  Composes sidebar + mobile bar + drawer + ⌘K
│       │   │   ├── Sidebar.tsx   Desktop rail (14.25rem, fixed left)
│       │   │   ├── NavItem.tsx   Spring-animated active bar
│       │   │   ├── TabStrip.tsx  Spring-animated tab pill (layoutId)
│       │   │   ├── TitleBlock.tsx  Animated number stats
│       │   │   └── nav.ts       Route definitions (Studying + Teaching)
│       │   ├── ui/
│       │   │   ├── floating-nav.tsx   Scroll-collapsing floating pill navbar
│       │   │   ├── number-ticker.tsx  Animated counting numbers
│       │   │   └── combobox.tsx       Searchable dropdown
│       │   ├── QuestionCard.tsx  The universal question display card
│       │   ├── ChatAnswer.tsx    Text answer with citations + TTS
│       │   ├── PromptBox.tsx     Chat input
│       │   ├── CommandK.tsx      ⌘K command palette
│       │   └── GlobalComposer.tsx  Floating input on every screen
│       ├── api.ts               Student API client (local backend)
│       └── facultyApi.ts        Faculty API client (Databricks via backend)
│
├── backend/              FastAPI (Python)
│   └── app/
│       ├── main.py              App assembly, /api/stats, /api/health
│       ├── genie_client.py      Genie conversation client (structured rows + SQL)
│       ├── genie.py             Genie prose client (chat path)
│       ├── databricks.py        SQL Statement Execution (holds the token)
│       ├── mas_client.py        Multi-Agent Supervisor client
│       ├── chat.py              Grounded chat (OpenAI + semantic search)
│       ├── semantic.py          Embedding model loader + vector search
│       ├── db.py                SQLite connection (read-only, shared)
│       ├── config.py            Paths, env vars
│       ├── faculty_sql.py       Every hand-written SQL statement
│       ├── telegram.py          Telegram bot logic (Genie-backed)
│       ├── llm.py               OpenAI / Groq abstraction
│       ├── filters.py           Query filter composition
│       ├── ratelimit.py         Rate limiting
│       └── routers/
│           ├── faculty.py       /api/faculty/* — agent, generate, bank, practice
│           ├── chat.py          /api/chat — student grounded chat
│           ├── search.py        /api/search — keyword + semantic search
│           ├── meta.py          /api/facets, /api/stats/course
│           ├── questions.py     /api/questions
│           ├── papers.py        /api/papers
│           ├── notes.py         /api/notes
│           ├── files.py         /api/file/{sha} — serve PDFs
│           ├── telegram.py      /telegram/webhook, /telegram/set-webhook
│           └── voice.py         /api/tts — ElevenLabs text-to-speech
│   └── telegram_poll.py         Long-polling runner for the Telegram bot
│
├── DERIVED_DATA/         Local copy of SQLite databases + embeddings
│   ├── questions_v2.db
│   ├── papers_v2.db
│   ├── embeddings.npy
│   └── emb_keys.json
│
├── .env                  All credentials and paths
├── requirements.txt      Python dependencies
├── Dockerfile            Container build
├── PROJECT.md            Full project explanation
├── SCHEMA.md             Complete table/column reference
├── AGENTS.md             Agent architecture
└── DESIGN.md             Design tokens (Cyanotype theme)
```

### API endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/stats` | GET | Global counts (questions, papers, courses, topics, year range) |
| `/api/health` | GET | Server health + semantic model status |
| `/api/search` | POST | Keyword + semantic question search |
| `/api/chat` | POST | Student grounded chat (OpenAI + citations) |
| `/api/facets` | GET | Filter options (courses, branches, years, etc.) |
| `/api/questions` | POST | Paginated question listing |
| `/api/papers` | GET | Paper listing |
| `/api/notes` | GET | Notes listing |
| `/api/file/{sha}` | GET | Serve a PDF |
| `/api/tts` | POST | Text-to-speech via ElevenLabs |
| `/api/faculty/ask` | POST | Ask Genie (text → SQL → rows) |
| `/api/faculty/genie-query` | POST | Named analytical question via Genie |
| `/api/faculty/query` | POST | Named hand-written SQL query |
| `/api/faculty/generate` | POST | Assemble an exam paper |
| `/api/faculty/practice` | POST | Build an MCQ practice set |
| `/api/faculty/similar` | POST | "Has this been asked before?" |
| `/api/faculty/bank` | POST | Filtered question bank search |
| `/api/faculty/units` | GET | Units and topics for a subject |
| `/api/faculty/status` | GET | Service health (Databricks, Genie, agent) |
| `/telegram/webhook` | POST | Telegram bot webhook |
| `/telegram/set-webhook` | GET | Register webhook URL with Telegram |

---

## Tech stack

### Frontend

| | |
|---|---|
| **Framework** | React 19 + TypeScript |
| **Build** | Vite |
| **Styling** | Tailwind CSS v4 |
| **Routing** | React Router v7 |
| **Animation** | Motion (Framer Motion) — spring physics, `layoutId` shared layout |
| **Charts** | Recharts, Reaviz |
| **Icons** | Phosphor Icons |
| **Package manager** | pnpm (monorepo workspace) |

### Backend

| | |
|---|---|
| **Framework** | FastAPI + Uvicorn |
| **Database** | SQLite (local, read-only) + Databricks Unity Catalog (remote) |
| **AI/Agent** | Databricks Genie (text-to-SQL) |
| **Embeddings** | Sentence Transformers (384-dim, loaded at startup) |
| **Chat** | OpenAI GPT for grounded answers with citations |
| **TTS** | ElevenLabs API |
| **Bot** | Telegram Bot API (long-polling or webhook) |

### External services

| Service | What it does |
|---|---|
| **Databricks** | Unity Catalog (gold tables), Genie (text-to-SQL agent), SQL Warehouse |
| **OpenAI** | Grounded chat answers with citations |
| **Groq** | Alternative LLM provider |
| **ElevenLabs** | Text-to-speech for reading answers aloud |
| **Telegram** | Bot platform for mobile access |

---

## Running it

### Prerequisites

- Python 3.11+ with a virtual environment
- Node.js 18+ and pnpm
- A Databricks workspace with Unity Catalog tables loaded
- The SQLite databases in `DERIVED_DATA/` (or on an external drive)

### Setup

```bash
# Clone and configure
git clone <repo-url> kronos && cd kronos
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

# Python backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd student && pnpm install && cd ..
```

### Start the servers

```bash
# Terminal 1: Backend (port 8000)
.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend (port 5173)
cd student && pnpm dev

# Terminal 3 (optional): Telegram bot
cd backend && ../.venv/bin/python telegram_poll.py
```

The frontend proxies `/api` requests to `localhost:8000` via Vite config.

Open [http://localhost:5173](http://localhost:5173).

> **First startup takes ~30 seconds** while the embedding model (sentence-transformers)
> loads in a background thread. Keyword search and Genie work immediately; semantic
> search becomes available once loading completes (check `/api/health`).

---

## Environment variables

All in `.env` at the repo root.

| Variable | Required | Purpose |
|---|---|---|
| `DERIVED_DATA_DIR` | Yes | Path to `questions_v2.db`, `papers_v2.db`, embeddings |
| `PAPERS_ROOT` | Yes | Path to the ripped PDF files |
| `DATABRICKS_HOST` | Yes | Databricks workspace URL |
| `DATABRICKS_TOKEN` | Yes | Databricks personal access token (starts with `dapi`) |
| `GENIE_SPACE_ID` | Yes | Genie space ID in the Databricks workspace |
| `DATABRICKS_WAREHOUSE_ID` | Yes | SQL Warehouse ID for direct queries |
| `DATABRICKS_CATALOG` | No | Catalog name (default: `hackathon_project.default`) |
| `OPEN_AI_API_KEY` | For chat | OpenAI API key for grounded chat answers |
| `GROQ_API_KEY` | No | Alternative LLM via Groq |
| `ELEVENLABS_API_KEY` | For TTS | Text-to-speech |
| `TELEGRAM_BOT_TOKEN` | For bot | Telegram bot token from @BotFather |

### Common gotchas

- **`DATABRICKS_TOKEN`** must start with `dapi` — missing the `d` prefix gives a 401.
- **`DATABRICKS_WAREHOUSE_ID`** must match the current workspace — a warehouse ID
  from another workspace gives a 404.
- **`DERIVED_DATA_DIR`** on an external drive causes 10+ second query times and
  potential `database disk image is malformed` errors if the drive sleeps. Copy
  the files locally for reliability.
- **`GENIE_SPACE_ID`** and `DATABRICKS_GENIE_SPACE_ID` — the codebase reads both
  (`genie_client.py` checks both env vars). Set at least `GENIE_SPACE_ID`.

---

## Design system

**Cyanotype** — the visual language of an architect's blueprint. Dark blue paper,
one drafting white for content, one correction red for marks and errors.

### Colours

| Token | Hex | Use |
|---|---|---|
| `paper` | `#0e2740` | Background |
| `ink` | `#e9f2fb` | Primary text |
| `ink-2` | `#a3bcd4` | Secondary text |
| `mark` | `#ff6b4a` | Marks, citations, errors — never decoration |
| `line` | `#2c4a68` | Borders and rules |
| `blueprint` | — | Accent blue for interactive elements |
| `ok` | `#7fd6a0` | Success |
| `warn` | `#f0b429` | Warning |

### Motion

All animation uses `motion/react` (Framer Motion) with spring physics:

- **Floating navbar**: collapses to a circle on scroll-down, expands on scroll-up
  (spring stiffness 300, damping 20). Nav items stagger in/out.
- **Tab strip**: shared `layoutId` pill slides between tabs (spring, no bounce,
  300ms).
- **Sidebar active bar**: `layoutId` animated indicator (spring stiffness 500,
  damping 35).
- **Number ticker**: animated counting on load using `useMotionValue`.
- **Table rows**: staggered spring entry (delay capped at 300ms).
- **Combobox**: spring-animated dropdown popover.

Motion is gated on purpose: ⌘K has none (keyboard action, high frequency),
charts do not animate (data being read before an exam should not move for style).

### Typography

- `Archivo` for display headings
- System font stack for body
- `Departure Mono` for numeric/code content

---

## What is real and what is not

A system built on provenance should be honest about its own.

**Real** — 208,746 questions from 10,606 papers, every one traceable to a PDF.
Repeat clusters from actual embedding similarity. Zero referential orphans on any
join. The agent answering live, SQL visible. Telegram bot responding to student
queries.

**Not:**

| | |
|---|---|
| `fact_attempt` / `fact_engagement` | Empty. No quiz data, no telemetry. Personalisation is schema-ready, unproven. |
| `source_page` | 100% NULL. Citation is document-level, not page-level. |
| Bloom levels | 54% `unclassified` — the verb was not in the map. |
| Sittings | Only half the corpus is `Main`. Queries meaning "what is normally asked" filter on it. |
| Some Genie answers | Genie's text-to-SQL can confidently answer a subtly different question. The SQL is always visible for exactly this reason. |

---

## Further reading

| | |
|---|---|
| **[PROJECT.md](PROJECT.md)** | Full explanation — problem, gold schema design, the pipeline |
| **[SCHEMA.md](SCHEMA.md)** | Every column, every coverage gap, and the traps that produce plausible wrong answers |
| **[AGENTS.md](AGENTS.md)** | The agent architecture and where it is deliberately not used |
| **[DESIGN.md](DESIGN.md)** | Design tokens — the Cyanotype theme |

---

## License

Built for the Databricks Campus Hackathon at B.M.S. College of Engineering.
