# Kronos — complete project explanation

A college's exam archive, turned into governed tables that a text-to-SQL agent
can answer from. Built for the Databricks Campus Hackathon.

**The one idea the whole project rests on:**

> Genie is a text-to-SQL agent over Unity Catalog tables. It does not read PDFs
> and it does not query vector stores.
> **Embeddings are not the product. Rows are.**

Everything upstream — 10,623 scraped exam PDFs, OCR on two different engines,
question parsing, topic clustering, 384-dimension embeddings — exists to *build
the tables*. Once they exist, the agent is Genie querying them.

---

## Contents

1. [The problem](#1-the-problem)
2. [What it does](#2-what-it-does)
3. [The gold table structure](#3-the-gold-table-structure)
4. [Features in full](#4-features-in-full)
5. [The pipeline that built the tables](#5-the-pipeline-that-built-the-tables)
6. [Skills and technologies](#6-skills-and-technologies)
7. [Repository layout](#7-repository-layout)
8. [What is real and what is not](#8-what-is-real-and-what-is-not)
9. [Running it](#9-running-it)

---

## 1. The problem

Two people need the same archive and cannot use it.

**A student, three days from an exam**, has access to nine years of past papers
and no way to know which topics matter. Sorting 56 PDFs by hand is not revision.

**A lecturer setting the next paper** works from memory. They have no visibility
into what has already been asked to death, no view of which topics are examined
heavily but taught thinly, and no evidence trail when the exam committee asks why
a question was chosen.

Both questions are answerable from the same data. Neither is answerable from PDFs.

---

## 2. What it does

**Student side** — ask in plain words, get a ranked answer with citations.

> *"I have the Cloud Computing exam in three days, where do I start?"*

Genie writes SQL, runs it, returns a ranked topic list with the evidence: marks
carried over nine years, how many papers contained it, which unit it sits in, and
how many pages of notes cover it. **The SQL is visible.** Every row traces to a
source PDF.

**Faculty side** — set the next paper, and see what the exam has been doing.

A generated paper is **assembled from real past questions by constraint
satisfaction**, never invented. Every line carries a `question_id`, its source
PDF and the year it was last asked. That is what makes it defensible to an exam
committee.

---

## 3. The gold table structure

Seven tables in Unity Catalog. **Seven, not seventeen** — text-to-SQL accuracy is
driven mostly by how narrow and well-described the surface is.

```
                      dim_subject (30)
                       subject_key ◄──────────────┐
                            ▲                     │
              ┌─────────────┴──────────┐          │
        dim_topic (757)      dim_exam_pattern (168)
         topic_id ◄──┐        (subject_key, exam_type, unit_no)
              ▲      │
              │      └──────── fact_question (15,888) ───────────┘
              │                topic_id, subject_key
   fact_note_coverage (921)
        topic_id
        note_id ──── = sha256 ───► bronze_page   [NOT in the Genie space]

   fact_attempt (0)     → topic_id, question_id     empty by design
   fact_engagement (0)  → topic_id                  empty by design
```

### The star, and what each point is for

| Table | Rows | Its job |
|---|---|---|
| **`fact_question`** | 15,888 | **The core.** One row per question ever asked. Everything else exists to make this rankable. |
| `dim_topic` | 757 | The vocabulary. Without it you have 15,888 unrelated sentences; with it, ~25 revisable topics per subject. |
| `dim_subject` | 30 | Identity across time. A subject has run under many codes; this is what makes nine years one history. |
| `dim_exam_pattern` | 168 | The *shape* of a paper. Distinguishes "often asked" from "guaranteed to be worth 33 marks". |
| `fact_note_coverage` | 921 | Turns "study addressing modes" into "read these pages". |
| `fact_attempt` | **0** | What *you* got wrong. Empty — no quiz has run. |
| `fact_engagement` | **0** | What students look at as an exam nears. Empty — no telemetry. |

### Three design decisions that matter

**1. Natural keys, not surrogate integers.** `subject_key` is `cloud_computing`,
`topic_id` is `cloud_computing|virtualization_techniques`. Every join is readable
in a raw query result, which matters when the agent's SQL is shown to a user who
has to judge whether it answered the right question.

**2. Subjects are identified by NAME, never by code.** Course codes change every
scheme — DBMS has run under seven. Keying on code would fragment nine years of
history into seven unrelated courses. `dim_subject.course_codes` keeps them all
as a JSON array; `subject_code` exists but the schema comment says *never join on
this*.

**3. `topic_id` is keyed on name, not unit.** The same topic sits in different
units across schemes — "Storage as a Service" appears under units 1 through 5. A
unit-keyed id fragmented 63 real topics into 127 unstable ones.

### Why `bronze_page` is deliberately outside

`bronze_page` holds 2,691 pages of raw note markdown. It is **not** registered in
the Genie space. Genie is text-to-SQL; a wide table of prose cannot answer a
question, and every extra table dilutes the schema that makes the rest work. It
is a content store, queried directly when the app needs to *show* material rather
than rank it.

### Why two tables are empty

`fact_attempt` and `fact_engagement` carry the full schema and zero rows. They
are the tables that make an answer *personal* — with them empty, the system ranks
what the examiner favours but not what any individual student is weak at.

They are empty because no quiz has ever run and no telemetry is collected.
Filling them with plausible rows would fake precisely the capability they
represent, in a system whose entire value proposition is that every number traces
to a real document.

---

## 4. Features in full

### Student

| Feature | What it does |
|---|---|
| **Search** | Every question, filtered by branch, year, exam type, unit, marks |
| **Semantic search** | 384-dim embeddings over question text — finds by meaning, not keyword |
| **Ask** | Genie text-to-SQL, with the query shown |
| **Stats** | What to study: marks by topic, repetition, unit emphasis |
| **Bulk download** | Papers as PDF, zipped by filter |
| **Voice** | Whisper STT in, ElevenLabs TTS out |
| **Telegram bot** | Same archive over chat, with per-user conversation history |

### Faculty

| Feature | What it does |
|---|---|
| **Dashboard** | Marks by unit, unit emphasis over nine years, honest coverage tiles |
| **Paper generator** | Constraint satisfaction over real questions → a printable paper |
| **Coverage gaps** | Scatter of examined-vs-taught; the bottom-right quadrant is the problem zone |
| **CO/PO attainment** | Accreditation view, with a 10% floor flag |
| **Question bank** | Filtered search, every row showing source PDF and year |
| **"Has this been asked?"** | Paste a draft question, get IDF-ranked matches from nine years |
| **Gaps and staleness** | Which units have not been examined recently; topics never examined |
| **Ask** | Same Genie agent, same show-the-SQL |

### The paper generator in detail

The headline feature, and the one with the strictest rule:

> **SQL selects, the model only phrases.**

**Structure** comes from a declared format where one exists. The CIE shape is
printed on the papers themselves — *PART A: Total 5 Marks (No Choice)*, *PART B:
Total 15 Marks*, *PART C: internal choice*, *Maximum Marks 40* — so it is
declared, not inferred. Where no declared format exists, structure is averaged
from real papers and **the UI says so**.

**Selection**, per slot, in order:
1. Exclude anything in a repeat cluster asked within the last *N* years
2. Prefer a question carrying a CO not yet placed
3. Prefer the requested Bloom level
4. Prefer older questions — they read as fresher to students
5. Never reuse a `repeat_cluster_id` within one paper

**When a constraint cannot be met it is printed on the paper.** A banner reading
*"CO3 could not be placed"* or *"no 3-mark question exists in this unit; used 4"*
is more useful than a paper that looks complete and quietly isn't.

The single place a model is permitted: an optional, **off-by-default** rephrase
of one question for freshness, content unchanged, marked visibly as edited with
the original one click away.

### The similarity checker, and why it took three attempts

*Has this question been asked before?* — the question a lecturer actually has
while drafting.

Two obvious scorings were tried first, and **both were wrong in ways that looked
completely fine**:

| Scoring | A verbatim repeat scored | Why it fails |
|---|---|---|
| Jaccard overlap | **18%** | diluted by every unshared word — a duplicate reads as "not similar" |
| Containment | **100%** — for an *unrelated* question | a short probe trivially fits inside a long one |
| **IDF-weighted** | 100% exact · 92% rephrased · 70% variant | rare words carry the signal |

The working version weights each shared word by how rare it is *in that subject*:
"virtualization" counts, "explain" barely does. No stopword list has to be
guessed in advance.

---

## 5. The pipeline that built the tables

```
scrape ──► OCR ──► parse ──► cluster ──► embed ──► gold tables ──► Genie
10,623    2 engines  208,746   757        384-dim    7 tables      text-to-SQL
 PDFs               questions  topics     vectors    15,888 rows
```

### Stage 1 — Scrape

10,623 unique exam PDFs from the college library, keyed by sha256. 619 duplicates
collapsed (the same paper filed under several branches). 220 turned out to be
saved "404 Not Found" HTML pages stored with a `.pdf` name.

### Stage 2 — OCR, on two engines

**Exam papers** (earlier run, CUDA A5000): a hybrid split by math content.
Born-digital papers without heavy math went through PyMuPDF on CPU; math-heavy
and scanned papers went through Marker/Surya on GPU. This cut GPU work from
27,550 pages to ~10,100.

**Lecture notes** (this run, Apple M4 Pro / MPS): **11,224 of 12,698 pages, 10.2
GPU-hours, zero stalls.** Notable findings:

- On MPS the recognition model does not run on MPS at all — Surya routes it to
  **llama.cpp with Metal** (vLLM is CUDA-only), so "maximise GPU" meant two
  separate knobs: torch batch sizes (Apple defaults are 8 vs CUDA's 36) and
  llama.cpp decode slots.
- Measured **8–9 seconds per OCR page**; cost tracks *pages needing OCR*, not
  total pages — 61% of pages had a usable text layer and were free.
- A supervisor restarts on crash **and** on stall, and sets a file aside after
  repeated identical failures. Protecting against a *hang* but not against a file
  that fails *reliably* let one bad file block a queue for 20 minutes before that
  was fixed.

### Stage 3 — Parse

Rules-first with an LLM fallback, producing 208,746 questions with unit, question
number, subpart, marks, CO and PO.

### Stage 4 — Topic clustering and embeddings

`bge-small-en-v1.5` → 384-dim vectors → clustering → LLM-labelled topic names.
The same vectors drive **repeat detection**: cosine ≥ 0.92, union-find, giving
2,364 clusters. The largest is **one question asked 46 times across 7 years**.

### Stage 5 — Gold tables

A subject enters the schema only if it has **both** notes and ≥100 parsed
questions. Notes without papers give topics with no evidence to rank; papers
without notes give a ranking with nowhere to send the reader.

---

## 6. Skills and technologies

### To build this

| Area | What is genuinely required |
|---|---|
| **Data engineering** | Dimensional modelling — star schema, grain, natural vs surrogate keys, slowly-changing identity. The hardest part was not the pipeline; it was deciding that a subject is identified by name. |
| **Databricks / Unity Catalog** | Catalogs, schemas, Volumes, Delta tables, SQL Statement Execution API, Genie spaces. Knowing that CTAS **drops column comments** — which Genie reads — matters more than it sounds. |
| **SQL (advanced)** | Window functions, `LATERAL VIEW explode`, `array_intersect`/`array_union`, CTEs. The similarity checker is IDF weighting computed entirely in SQL. |
| **OCR / document AI** | Marker, Surya, layout models, why 96 DPI changes everything, why a text layer is not always better than OCR. |
| **GPU / MPS** | Batch sizing, unified memory, why more workers is wrong on Apple Silicon, llama.cpp Metal offload. |
| **Constraint satisfaction** | The paper generator is a scheduling problem with backtracking and explicit relaxation reporting. |
| **Prompt engineering** | Only where a model is actually used — and mostly in the negative: forbidding paraphrase, forcing citations, biasing toward *not* filtering. |
| **Full-stack** | React 19, React Router, Tailwind v4, FastAPI, async polling against an eventually-consistent API. |
| **Design systems** | Shared tokens across two build systems; three-state theming; print stylesheets. |

### The stack

| Layer | Technology |
|---|---|
| Agent | **Databricks AI/BI Genie** (text-to-SQL) |
| Warehouse | Unity Catalog, Delta, Serverless SQL |
| Backend | FastAPI, SQLite + `embeddings.npy` for the student archive |
| Frontend | Vite, React 19, React Router, Tailwind v4, shadcn/ui |
| OCR | Marker / Surya (MPS + llama.cpp Metal), PyMuPDF, `gpt-4.1-mini` vision |
| Embeddings | `bge-small-en-v1.5`, 384-dim |
| Voice | Whisper STT, ElevenLabs TTS |
| Design | Fraunces · Newsreader · General Sans · Departure Mono |

### The judgement that is harder than the tech

Most of the difficulty was **not** technical. It was repeatedly deciding what a
number is allowed to claim:

- 19% of questions state no marks → exclude, never coalesce to zero
- Only 50% of the corpus is `Main` sittings → filter, or repetition doubles
- 54% of Bloom levels are `unclassified` → say so rather than charting 46% as if
  it were the whole
- `page_start`/`page_end` are min and max of *scattered* hits, not a range
- Two tables are empty and must stay empty

---

## 7. Repository layout

```
kronos/
├── student/        Vite + React 19 — ONE app, both audiences
│   └── src/routes/faculty/   the faculty console, same router and design system
├── backend/        FastAPI — student archive + Databricks proxy
│   └── app/
│       ├── databricks.py     SQL Statement Execution client (holds the token)
│       ├── faculty_sql.py    every faculty query, in one place
│       ├── genie.py          the agent client
│       └── routers/          search · chat · papers · voice · telegram · faculty
├── design/         shared tokens — neither app owns the palette
├── scripts/        corpus pipeline: OCR, extraction, embeddings, clustering
├── SCHEMA.md       complete database reference — every column, every trap
├── AGENTS.md       the agent, and what grounds it
└── PROJECT.md      this file
```

---

## 8. What is real and what is not

Stated plainly, because a system built on provenance should be honest about its
own.

### Real

- 15,888 questions from 696 papers over 9 years, every one traceable to a PDF
- 30 subjects, each with both paper history and extracted notes
- 2,364 repeat clusters from real embedding similarity
- Zero referential orphans on every join
- Genie answering over the live tables, SQL visible

### Not real, and why

| | |
|---|---|
| **`fact_attempt` / `fact_engagement`** | Empty. No quiz, no telemetry. Personalisation is schema-ready but unproven. |
| **`dim_exam_pattern.basis = 'observed'`** | Averaged from real papers, *not* a published blueprint. Unit totals sum to 155 or 201, not 100, so generated SEE papers must be scaled. The CIE format is declared and produces clean papers. |
| **`source_page` is 100% NULL** | The parsed corpus carries paper hashes, not page numbers. Citation is document-level. |
| **CO/PO are 76%/78% NULL** | The attainment view covers a minority of the archive and says so. |
| **8 of 47 columns carry no information** | Present because the schema specifies them. Genie reads every column comment, so they are real noise. |
| **Note extraction is partly unverified** | 853 coverage rows from Marker, 68 from `gpt-4.1-mini` at ~96 DPI. On the one file both engines processed the model won — but one file is not a verification. |

---

## 9. Running it

```bash
# backend
pip install -r requirements.txt
cp .env.example .env          # Databricks host/token/warehouse/genie space
uvicorn backend.app.main:app --reload

# frontend
cd student && pnpm install && pnpm dev
```

`DATABRICKS_CATALOG` **must** name the catalog the Genie space is configured
against. When they diverge, the Ask panel answers about a different dataset than
every other screen, with nothing on screen to reveal it. This has already
happened once in development.

### Rebuilding the tables

```bash
python ocr_mps/build_all_subjects.py    # → parquet for all qualifying subjects
```

Then upload to `/Volumes/…/raw/` and `CREATE OR REPLACE TABLE … AS SELECT * FROM
parquet.\`…\``. **Re-apply column comments afterwards** — CTAS drops them, and
Genie reads them.
