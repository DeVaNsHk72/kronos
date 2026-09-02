# Kronos

A college's own exam archive, turned into something two different people can use.

**Students** ask what to study and get a ranked answer with citations.
**Faculty** set the next paper from questions that were actually asked, and see
what the exam has been over- and under-examining.

```
kronos/
├── student/    Vite + React 19 — the student-facing archive (search, ask, stats, bulk export)
├── faculty/    Next.js 15 — the faculty console (paper generator, coverage, CO/PO, Genie)
├── backend/    FastAPI — serves the student app from SQLite + embeddings
├── design/     Shared design tokens. Both apps import these; neither owns a palette.
└── scripts/    Corpus pipeline: OCR, extraction, embeddings, topic clustering
```

## The two apps, and why they are separate

They answer different questions and are deployed independently, but they are one
product visually: `design/tokens.css` and `design/typography.css` hold the palette
and type, and each app maps them into its own build system's theme layer. Changing
the accent in one file changes both. Previously the palette was duplicated per app
and had begun to drift.

| | student | faculty |
|---|---|---|
| Stack | Vite + React Router + Tailwind v4 | Next.js App Router + Tailwind v3 |
| Data | FastAPI → SQLite + embeddings | Databricks SQL (Unity Catalog) |
| Deploy | Cloudflare Pages | any Node host |

Start with **[PROJECT.md](PROJECT.md)** for the full explanation — problem, gold
table design, every feature, the pipeline, and the skills involved.

See **[SCHEMA.md](SCHEMA.md)** for the complete database reference — every
column, every coverage gap, and the eight traps that produce plausible wrong
answers. See **[AGENTS.md](AGENTS.md)** for how each AI component is grounded — the part
that decides whether an answer can be trusted.

## Faculty console

Reads the gold star schema in Unity Catalog. Its governing rule: **SQL selects,
the model only phrases.** A generated paper is assembled by constraint
satisfaction over real past questions — every line traces to a `question_id`,
its source PDF and the year it was last asked. No language model invents a
question. Where a constraint cannot be met it is stated on the paper rather than
quietly dropped.

Screens: dashboard · paper generator · coverage gaps · CO/PO attainment ·
question bank · "has this been asked?" · syllabus gaps · Genie ask panel.

```bash
cd faculty && cp .env.example .env.local   # fill in Databricks host/token/warehouse
npm install && npm run dev                 # http://localhost:3100
```

`DATABRICKS_CATALOG` must match the catalog the Genie space is configured
against — otherwise the ask panel answers from a different dataset than every
other screen, which is very hard to notice.

## Student app

```bash
cd student && npm install && npm run dev
```

---

## What Pyqheaven does

Four pages, four jobs:

### `/home` — Every exam question, searchable

- Full-text keyword search + BGE semantic search (toggleable).
- Filters: course, branch, semester, year range, exam type, programme, "with figures".
- Question cards show text, marks, topic, unit, course, and a link to the original PDF.
- Figures are extracted and rendered inline (with a zoom-in lightbox).

### `/ask` — Grounded chatbot ("Ask the archive")

- Every answer is retrieved from real questions; every claim carries a `[n]` citation that jumps to the source card.
- The model never _composes_ new questions — it only _summarises what the archive says_.
- Shows an "Understood" panel (parsed course/branch/year/etc.) so a wrong filter is legible instead of silent.
- Follow-up chips: "Only Main exams", "Last 2 years only", "Open statistics", "Download these papers" — all deep-link to the other three routes.

### `/stats` — What to study

- Pick a course, see: topic-frequency bars, year-strips (which topics have gone quiet), marks distribution, and — the killer feature — **verbatim repeats** (same question text appearing across multiple years).
- Recently-viewed courses persist in localStorage.

### `/download` — Bulk PDF export

- Multi-course + year-range picker.
- Checkbox-per-row for selective zip, filter by exam type, sort by newest / largest.
- Zips are `ZIP_STORED` (PDFs are already compressed — no gain from DEFLATE, huge speed win).

## Architecture at a glance

```
                                              ┌──────────────────────────────┐
                                              │  browser (React 19 + Vite)   │
                                              │                              │
                                              │  /home  /ask  /stats  /down  │
                                              └──────────────┬───────────────┘
                                                             │
                                              axios ──── /api/* ──── vite proxy
                                                             │
                        ┌────────────────────────────────────▼────────────────────────────┐
                        │  FastAPI (uvicorn, single process)                              │
                        │                                                                 │
                        │   routers/                                                      │
                        │     ├── search      /api/search       (keyword + filters)       │
                        │     │               /api/search/semantic (BGE cosine)           │
                        │     ├── meta        /api/facets, /api/filters, /api/courses,    │
                        │     │               /api/topics, /api/stats, /api/stats/course  │
                        │     ├── questions   /api/question/{id}                          │
                        │     ├── files       /api/download/{sha}, /api/figures/{sha}/*   │
                        │     ├── chat        /api/chat            (grounded RAG)         │
                        │     └── papers      /api/papers, /api/papers/zip                │
                        │                                                                 │
                        │   shared modules                                                │
                        │     ├── db.py       read-only SQLite (mmap_size = 0)            │
                        │     ├── semantic.py numpy cosine over embeddings.npy            │
                        │     ├── chat.py     parse-intent → retrieve → compose           │
                        │     ├── filters.py  shared WHERE-clause builder                 │
                        │     ├── shape.py    row → dict + images join                    │
                        │     └── llm.py      lazy OpenAI client (gpt-4o-mini)            │
                        └────┬───────────────────────────────┬───────────────────┬────────┘
                             │                               │                   │
                    ┌────────▼─────────┐         ┌──────────▼──────────┐   ┌─────▼─────┐
                    │ questions_v2.db  │         │ embeddings.npy      │   │ figures/  │
                    │  ATTACH p AS     │         │  188,701 × 384 f16  │   │ <sha>/... │
                    │ papers_v2.db     │         │ + emb_keys.json     │   │           │
                    │  166 MB          │         │  139 MB             │   │           │
                    └──────────────────┘         └─────────────────────┘   └───────────┘
                             ▲                                              ▲
                             │                                              │
                    ┌────────┴──────────────────────────────────────────────┴────────────┐
                    │  scripts/ (offline pipeline, not on the request path)              │
                    │                                                                    │
                    │   PDFs → OCR (marker/olmocr, GPU) → extracted text                 │
                    │        ↓                                                           │
                    │   parse questions (rules + LLM fallback) → questions_v2.db         │
                    │        ↓                                                           │
                    │   embed_questions.py (bge-small)  →  embeddings.npy                │
                    │        ↓                                                           │
                    │   cluster_questions.py + label_topics.py (gpt-4o-mini)             │
                    │        ↓                                                           │
                    │   apply_topics.py  →  questions.topic + subtopic populated         │
                    └────────────────────────────────────────────────────────────────────┘
```

## Production deployment

Everything runs on free tiers. No servers to babysit, no card required beyond what each platform mandates.

```
pyqheaven.in ──▶ Cloudflare Worker (static SPA, frontend/dist)
                        │
                        │  fetch /api/*
                        ▼
              Google Cloud Run (FastAPI, 2 GiB, scale-to-zero)
                        │
          ┌─────────────┼──────────────────┬───────────────────┐
          ▼             ▼                  ▼                    ▼
  questions_v2.db  embeddings.npy   figures/ (bundled     PDFs — GitHub
  papers_v2.db     (baked into      into the Docker       Releases, sharded
  (baked into      the image)       image)                pdfs-0 … pdfs-f
  the image)                                               (GitHub caps
                                                             1000 assets/
                                                             release; sha's
                                                             first hex
                                                             nibble picks
                                                             the shard)
          │
          ▼
  Groq (Llama / gpt-oss-120b) for /api/chat — OpenAI-
  compatible endpoint, swapped in via LLM_BASE_URL so
  chat costs $0 instead of burning an OpenAI budget
```

- **Frontend** — `frontend/dist` deployed as a Cloudflare Worker with static assets (`wrangler.jsonc`, `not_found_handling: "single-page-application"` so client-side routes survive a hard refresh). Build command: `npm install && npm run build`; deploy command: `npx wrangler deploy`.
- **Backend** — a single Docker image (`Dockerfile`) built with `gcloud builds submit` and deployed to Cloud Run. The two SQLite DBs, `embeddings.npy`, `emb_keys.json`, and `figures/` are all `COPY`'d into the image at build time — no volume mounts, no GCS bucket. Image lives in Artifact Registry (`us-central1-docker.pkg.dev/…/paperbank/paperbank-api`).
- **PDFs** — the ~8 GB corpus is too large for the Cloud Run image (and too many files for a single Hugging Face dataset directory, which caps at 10,000/folder, or a single GitHub Release, which caps at 1,000 assets). Sharded across **16 GitHub Releases** (`pdfs-0` … `pdfs-f`) keyed by the first hex character of each paper's SHA. `PDF_BASE_URL` + that shard math live in `backend/app/config.py` and every URL-building spot (`shape.py`, `routers/papers.py`, `routers/files.py`).
- **Bulk zip in production** — `/api/papers/zip` streams each selected PDF from GitHub Releases via `requests.get()` and writes it straight into the in-memory zip (no local disk to read from, unlike dev). Still capped at 300 files / 750 MB.
- **Chat LLM** — defaults to OpenAI, but production points `LLM_BASE_URL` at Groq's OpenAI-compatible endpoint (`https://api.groq.com/openai/v1`) with `CHAT_MODEL=openai/gpt-oss-120b`. Same `llm.py` code path, just a different `base_url` + key.
- **Rate limiting** — `/api/chat` is capped at 10 requests/minute per IP (`backend/app/ratelimit.py`, in-memory sliding window). Client IP is read from `X-Forwarded-For` because Cloud Run's own proxy IP is what `request.client.host` would otherwise report.
- **CORS** — locked to `https://pyqheaven.in` via the `CORS_ORIGINS` env var (comma-separated list, defaults to `*` for local dev).
- **Analytics** — Google Analytics (`gtag.js`) + Umami, both loaded as static `<script>` tags in `frontend/index.html`. Not env-driven — the IDs are public and don't change per environment.
- **SEO** — Open Graph + Twitter Card meta, JSON-LD `WebSite` schema with a `SearchAction`, `robots.txt`, `sitemap.xml`, all in `frontend/index.html` / `frontend/public/`.

Redeploying after a code change:

```bash
# frontend — Cloudflare auto-builds on push to main

# backend
gcloud builds submit . --tag us-central1-docker.pkg.dev/bmsce-503918/paperbank/paperbank-api
gcloud run services update paperbank-api --region us-central1 \
  --image us-central1-docker.pkg.dev/bmsce-503918/paperbank/paperbank-api
```

## The data pipeline

**Nothing on this page runs at request time.** It's the offline path that produced the two SQLite files and one embedding matrix the backend serves from.

### 1. Scraping (Node.js, historical)

The original scrape lived at `bmsce-paper-ripper` (not in this repo) and pulled 10,606 PDFs from BMSCE's paper archive. That work is done — Paperbank starts from the PDFs.

### 2. OCR (`scripts/run_all.sh`, `run_ocr_all.{sh,ps1}`, `OCR_RUNBOOK.md`)

Ran on a WSL2 + GPU box using `marker` (and later `olmocr` for pages marker couldn't handle). Output: per-paper markdown + extracted images under `DERIVED_DATA/extracted_text_v2/`. **~6–8 hours for the full corpus.** Only re-run if new PDFs arrive.

### 3. Question extraction (rules + LLM fallback)

- **Rules parser** — a hand-written parser recognises the common BMSCE question-paper layouts (`Q1. …`, `1.a) …`, `Q6(a) [7]`, etc.). ~85% coverage.
- **LLM fallback** — the remaining 15% (weird layouts, ancient scans, single-column tables) go through `gpt-4o-mini` with a strict schema prompt.
- Output: `questions_v2.db` — one row per question, denormalised (course/branch/year/etc. all on the row).

Both parsers set `parser` and `confidence` columns so downstream steps can weight them.

### 4. Embeddings (`scripts/embed_questions.py`)

- **Model:** `BAAI/bge-small-en-v1.5` via sentence-transformers.
- Passes `passage: <question text>` for the corpus and `query: <user query>` at search time (the model was trained with those prefixes).
- Output: `embeddings.npy` (float16, L2-normalised, 188,701 × 384, ~139 MB) + `emb_keys.json` mapping row index → `text_hash`.
- **~2 hours** on CPU, <30 minutes on a modest GPU. Rerun only when questions change.

### 5. Topic clustering (`scripts/cluster_questions.py`)

Groups semantically-similar questions per course into ~10–30 clusters (HDBSCAN over the embeddings). Purely an intermediate step — output feeds the labeller.

### 6. Topic labelling (`scripts/label_topics.py`)

- Sends each cluster to `gpt-4o-mini` with a strict prompt: _"Give one topic (2–4 words) + one subtopic (3–6 words). JSON only. No prose."_
- Total cost for the full corpus: **$0.51** at time of writing.
- Handles both index-keyed and name-keyed LLM responses (the model sometimes ignores the "return keys as `0`, `1`, …" instruction).

### 7. Apply topics (`scripts/apply_topics.py`)

Denormalises the labels back onto every question row (30,464 distinct `topic` values, 10,025 fully-labelled courses, zero unlabelled rows).

### 8. Keyword fallback (`scripts/keyword_label.py`)

For courses the LLM couldn't cluster meaningfully (too few questions, too diverse), assigns topics via a small keyword taxonomy. Fills in ~2% of rows.

**Rebuilding is idempotent** — every script writes to a new SQLite file, atomically swaps it in, then the backend reads the new file on next request (`mmap_size = 0` guards against the running server segfaulting on a mid-read rewrite).

## Backend

Python 3.11 + FastAPI + uvicorn. Single process, no queue, no worker fleet. Everything under `backend/app/`:

### Layout

```
backend/app/
├── main.py           FastAPI app assembly; CORS; background semantic warmup on startup
├── config.py         Env loader (.env), paths, model IDs, page sizes, CORS origins
├── db.py             SQLite RO connection with papers_v2 attached; per-request context manager
├── shape.py          Row → dict; joins in question_images; the canonical SELECT column list
├── filters.py        Shared WHERE-clause builder; folds `Common`/`Elective` branches and
│                     `Kannada`/`Mathematics` programmes into every branch/programme filter
├── semantic.py       Loads embeddings.npy once; numpy cosine matmul; `search_rows()` shared
│                     between /api/search/semantic and /api/chat so both paths rank identically
├── chat.py           Grounded RAG: parse_intent() → retrieve → compose_answer()
├── llm.py            Lazy OpenAI-SDK client — works against OpenAI or any OpenAI-compatible
│                     endpoint (prod points it at Groq via LLM_BASE_URL). Degrades to a passive
│                     "no key configured" response if no key is set.
├── ratelimit.py      In-memory per-IP sliding-window limiter (used on /api/chat)
└── routers/
    ├── search.py     /api/search (keyword + filters), /api/search/semantic (BGE)
    ├── meta.py       /api/filters, /api/facets, /api/courses, /api/topics, /api/stats, /api/stats/course
    ├── questions.py  /api/question/{id}
    ├── files.py      /api/download/{sha} (PDF), /api/figures/{sha}/{filename}
    ├── chat.py       /api/chat (POST; grounded, cited, deep-linkable; rate-limited 10/min/IP)
    └── papers.py     /api/papers (list with sizes), /api/papers/zip (bulk zip)
```

### Key architectural choices

- **Two DBs attached, not one.** `questions_v2.db` is the row-store; `papers_v2.db` is the paper-level metadata (SHA, `paper_courses` join table, `original_paths`). Kept separate because they rebuild on different cadences.
- **Read-only + per-request connections.** `sqlite3.connect(..., uri=True, "?mode=ro")` + `PRAGMA query_only = ON`. Scales fine for our load; simplifies deploys.
- **`PRAGMA mmap_size = 0`.** The rebuild scripts rewrite the DB files while the server is running. With mmap, a page invalidated mid-read causes SIGSEGV. Reading through the pager costs almost nothing at our query shapes and fails cleanly.
- **Semantic search is a `numpy` matrix multiply.** No FAISS, no pgvector, no HNSW. 188k × 384 float16 fits in ~139 MB RAM; a matmul + top-800 argpartition runs in ~40ms on CPU. When you outgrow this it'll be obvious.
- **Chat = intent parse → retrieve → compose.** All three are model calls (`gpt-4o-mini`) but retrieval uses the same `semantic.search_rows` the UI does. If a user searches "laplace" and asks "laplace" they get the same rows in the same order.
- **`Filters` folds shared subjects.** BMSCE `Common` branch + `Kannada`/`Mathematics` programmes contain subjects taught to _every_ branch. `Filters.where()` transparently adds them to any branch/programme filter, so picking `CSE` also returns the shared subjects.

## Frontend

React 19 + Vite 8 + Tailwind v4 + React Router 7. Single-page app; ~4K lines of code (`src/` sans generated).

### Layout

```
frontend/src/
├── main.tsx                  React root
├── App.tsx                   Router shell (5 routes → 4 pages + catch-all redirect)
├── api.ts                    axios client + all TS response types
├── index.css                 @theme tokens + custom utility classes (~329 lines)
│
├── routes/
│   ├── Home.tsx              Landing hero + search page + filters + results
│   ├── Ask.tsx               Chat thread + input bar + follow-up chips
│   ├── Stats.tsx             Course picker + topic bars + verbatim repeats
│   └── Download.tsx          Multi-course picker + paper list + selective zip
│
└── components/
    ├── Masthead.tsx          Floating pill nav (fixed top)
    ├── QuestionCard.tsx      The question row; used everywhere questions appear
    ├── FilterBar.tsx         The full filter row for /home
    ├── ActiveFilters.tsx     Applied-filter chips (removable)
    ├── Pagination.tsx        Numeric page controls
    ├── Popover.tsx           Origin-anchored dropdown (with mount animation)
    ├── ChatAnswer.tsx        Grounded assistant answer + [n] citation buttons
    ├── ChatIntentPanel.tsx   "Understood" — parsed intent breakdown
    └── ChatOverview.tsx      Stat overview + topics-covered + also-asked-in
```

## Running locally

### Prereqs

- Python 3.11+
- Node 18+
- The three data files present at `DERIVED_DATA/` (either shipped alongside the code or built via `scripts/`)
- OpenAI API key **only** if you want `/ask` chat to work — search/stats/download work without it

### One-time setup

```bash
# Backend deps
python -m venv .venv
.venv\Scripts\activate         # or `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt

# Frontend deps
cd frontend
npm install
cd ..

# Environment (see next section)
cp .env.example .env
# edit .env
```

### Run

Two terminals:

```bash
# terminal 1 — backend on :8000
python -m uvicorn backend.app.main:app --port 8000

# terminal 2 — frontend dev server on :5173 (proxies /api → :8000)
cd frontend
npm run dev
```

Open `http://localhost:5173`. First `/api/search/semantic` or `/api/chat` request triggers the model load (~10s CPU, once per process).

### Build for production

```bash
cd frontend
npm run build              # outputs to frontend/dist/
```

Serve `frontend/dist/` behind any static host (nginx, Caddy, Cloudflare Pages). Point `/api/*` to the FastAPI process.

## Environment variables

Set in `.env` at repo root. Loaded by `backend/app/config.py` before any other config resolution.

| Var                                            | Required                              | Default                | Purpose                                                                                                                                     |
| ----------------------------------------------- | -------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `PAPERS_ROOT`                                  | local dev, for `/api/download/{sha}`   | repo root               | Path to the tree of source PDFs. Ignored when `PDF_BASE_URL` is set (production).                                                          |
| `DERIVED_DATA_DIR`                             | no                                     | `<repo>/DERIVED_DATA`   | Where `questions_v2.db`, `papers_v2.db`, `embeddings.npy`, `emb_keys.json`, `figures/` live.                                               |
| `PDF_BASE_URL`                                 | production only                        | — (serves from disk)    | Base URL for sharded PDF hosting, e.g. `https://github.com/<user>/<repo>/releases/download`. Switches downloads/zips to fetch remotely.    |
| `API_BASE_URL`                                 | production only                        | — (relative URLs)       | This API's own public URL. Prefixed onto `/api/figures/...` links so the frontend hits the backend directly.                              |
| `OPEN_AI_API_KEY` / `OPENAIR` / `LLM_API_KEY`  | for `/ask`                             | —                        | Chat model key. `LLM_API_KEY` wins if set (paired with `LLM_BASE_URL` for Groq); otherwise falls back to the OpenAI vars.                   |
| `LLM_BASE_URL`                                 | no                                     | OpenAI's default         | OpenAI-compatible base URL. Production sets `https://api.groq.com/openai/v1`.                                                              |
| `CHAT_MODEL`                                   | no                                     | `gpt-4o-mini`            | Chat completion model ID. Production uses `openai/gpt-oss-120b` (Groq).                                                                     |
| `CORS_ORIGINS`                                 | no                                     | `*`                      | Comma-separated allowed origins. Production sets `https://pyqheaven.in`.                                                                    |

The `.env` file is `.gitignore`d. `.env.example` documents the shape.

## Directory map

```
paperbank/
│
├── README.md                  ← this file
├── requirements.txt           Python dependencies (top-level, single source)
├── .env.example               Environment template
├── .gitignore
│
├── Dockerfile                 Cloud Run image: deps, backend code, DERIVED_DATA baked in
├── .dockerignore, .gcloudignore
│
├── backend/                   FastAPI application
│   └── app/
│       ├── main.py
│       ├── config.py, db.py, shape.py, filters.py, semantic.py, chat.py, llm.py, ratelimit.py
│       └── routers/
│           └── search.py, meta.py, questions.py, files.py, chat.py, papers.py
│
├── frontend/                  React + Vite SPA, deployed as a Cloudflare Worker
│   ├── package.json, tsconfig.json, vite.config.ts
│   ├── wrangler.jsonc         Cloudflare Worker config — static assets, SPA fallback routing
│   ├── index.html             Google Fonts, favicon, SEO meta (OG/Twitter/JSON-LD), analytics
│   ├── public/
│   │   ├── herosection.jpg    Landing hero background / OG share image
│   │   ├── ending.jpg         (available for section backgrounds)
│   │   ├── favicon.svg
│   │   ├── robots.txt, sitemap.xml
│   │   └── BMS_College_of_Engineering.svg
│   └── src/
│       ├── main.tsx, App.tsx, index.css, api.ts
│       ├── routes/            Home / Ask / Stats / Download
│       └── components/        See "Frontend layout" above
│
├── scripts/                   Offline data pipeline (not on the request path)
│   ├── OCR_RUNBOOK.md         How to re-OCR the corpus
│   ├── run_all.sh             End-to-end OCR pipeline entrypoint (WSL2 + GPU)
│   ├── run_ocr_all.{sh,ps1}
│   ├── embed_questions.py     Build embeddings.npy + emb_keys.json
│   ├── cluster_questions.py   HDBSCAN over embeddings, per course
│   ├── label_topics.py        gpt-4o-mini → topic + subtopic per cluster
│   ├── apply_topics.py        Denormalise labels onto question rows
│   └── keyword_label.py       Keyword-based fallback for unclusterable courses
│
├── plans/                     Executed refactor plans (design + animation)
│   ├── README.md
│   ├── 001-popover-panel-entry.md              DONE
│   └── 002-editorial-refresh-rollout.md        DONE
│
└── DERIVED_DATA/              Data artifacts (large — usually gitignored)
    ├── questions_v2.db        ~166 MB — one row per question, denormalised
    ├── papers_v2.db           ~8 MB   — paper-level metadata + join tables
    ├── embeddings.npy         ~139 MB — float16 [N × 384], L2-normalised
    ├── emb_keys.json          Row index → text_hash mapping
    └── figures/               Extracted figure PNGs, keyed by <sha>/<filename>
```

## API reference

All endpoints return JSON unless noted. Prefix: `/api`.

### Search

| Method | Path               | Purpose                                                                    |
| ------ | ------------------ | -------------------------------------------------------------------------- |
| GET    | `/search`          | Keyword + filters. `?q=` + any `FilterState` field. Paginated.             |
| GET    | `/search/semantic` | Cosine over BGE embeddings, then filters applied. Same shape as `/search`. |

### Metadata (drives the UI)

| Method | Path                                                   | Purpose                                                                                 |
| ------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| GET    | `/filters`                                             | Static option lists per dimension (branches, programmes, exam types, years, semesters). |
| GET    | `/facets`                                              | Value → count per dimension **given current filters** — for showing option counts.      |
| GET    | `/courses?q=<query>`                                   | Course autocomplete (code or name substring).                                           |
| GET    | `/topics?course_code=<code>`                           | Topics + subtopics for a course.                                                        |
| GET    | `/stats`                                               | Corpus totals: questions, papers, courses, branches, topics, year range.                |
| GET    | `/stats/course?course_code=<code>&year_min=&year_max=` | Per-course breakdown: topics, by-year counts, marks distribution, verbatim repeats.     |

### Questions

| Method | Path             | Purpose                                                                      |
| ------ | ---------------- | ---------------------------------------------------------------------------- |
| GET    | `/question/{id}` | Full question detail + source paper + sibling questions from the same paper. |

### Files

| Method | Path                        | Purpose                                                                      |
| ------ | --------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/download/{sha}`           | Original PDF (FileResponse).                                                 |
| GET    | `/figures/{sha}/{filename}` | Extracted figure PNG. Path is safely constrained under `FIGURES_DIR/<sha>/`. |

### Chat

| Method | Path    | Purpose                                                                                                                                                                       |
| ------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/chat` | Body: `{message, history?}`. Returns `{intent, answer, citations, results}`. Grounded — every claim in `answer` uses `[n]` markers that map to `citations[]` and `results[]`. |

### Papers (bulk)

| Method | Path          | Purpose                                                                                                         |
| ------ | ------------- | --------------------------------------------------------------------------------------------------------------- |
| GET    | `/papers`     | Multi-course + year range → paper list with sizes + total.                                                      |
| GET    | `/papers/zip` | Same params + optional `sha[]` for selective download. Returns `application/zip`. Capped at 300 files / 750 MB. |

## Deliberately simple

Things that could be more sophisticated but aren't, on purpose:

- **No vector DB.** In-process numpy matmul. Rebuild `embeddings.npy` when you change questions; the backend picks it up on next process start.
- **No cache layer.** SQLite is fast enough for our load; adding Redis would be a bet on a bottleneck that doesn't exist.
- **No client state manager.** React state + effects + URL params. Grew large without ever needing Zustand.
- **No auth.** Public read-only archive. `/api/chat` is rate-limited (10/min/IP) instead of gated behind login — enough to stop one visitor burning the shared quota without adding accounts to a paper archive.
- **No test harness.** Every downstream artefact is a `.db` or `.npy` file you can verify by inspection; behaviour is verified end-to-end in the browser during development. Not defending this, just noting it.
- **No queue / worker fleet.** OCR is offline (WSL2 + GPU, hours), everything else is per-request and returns in under a second.
- **No feature flags.** Ship changes; roll back with git if wrong.

## Credits

- Original scraper + PDF corpus: [`shaansubbaiah/bmsce-paper-ripper`](https://github.com/shaansubbaiah/bmsce-paper-ripper).
- OCR: [marker](https://github.com/VikParuchuri/marker) + [olmocr](https://github.com/allenai/olmocr) as a fallback.
- Embeddings: [BGE-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5).
- LLM: OpenAI `gpt-4o-mini` for the offline pipeline (parsing, labelling); production chat runs on Groq (`openai/gpt-oss-120b`) through the same OpenAI-compatible client.
- Hosting: [Cloudflare Workers](https://developers.cloudflare.com/workers/) (frontend), [Google Cloud Run](https://cloud.google.com/run) (backend), [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github) (PDF storage, sharded).
- UI: React 19, Tailwind v4, Phosphor Icons, NumberFlow, Source Serif 4 + Instrument Serif via Google Fonts.
