# Kronos

**Your college has a memory now.**

Every past paper, every set of notes, every syllabus — read, parsed, and held in
one place as governed tables. Kronos is the agent that thinks over that memory
and shows its working.

```
15,888 questions · 30 subjects · 9 years · 237 documents · 11,224 pages read
```

Not a search box. The papers and notes are the memory; a Databricks Multi-Agent
Supervisor calling Genie is what reasons over it. Ask in plain words and the SQL
it wrote is one click away — an agent that cannot show its working cannot be
trusted with an exam.

---

## Contents

1. [The problem](#the-problem)
2. [The two doors](#the-two-doors)
3. [Studying](#studying)
4. [Intelligence](#intelligence-teaching)
5. [How the agent works](#how-the-agent-works)
6. [The data underneath](#the-data-underneath)
7. [Architecture](#architecture)
8. [Running it](#running-it)
9. [What is real and what is not](#what-is-real-and-what-is-not)
10. [Further reading](#further-reading)

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

---

## Studying

One hub at `/ask`, four ways into the same corpus.

### Ask

The agent, in plain words. *"What repeats in operating systems deadlock
questions?"* returns a real answer with the questions behind it, the years they
were set, and the paper each came from.

Powered by the Multi-Agent Supervisor, which calls Genie as a tool. The reply
carries the tool calls as well as the prose.

### Search

Every question in the archive, filtered by branch, year, exam type, unit and
marks — plus **semantic search** over 384-dimension embeddings, which finds by
meaning rather than keyword.

### Practice

**MCQ sets built from real past questions.** Scope to a whole subject or a single
unit, choose 5–20 questions, answer, then check.

The stem is always a question that was actually set, carrying its year, marks and
source paper. The distractors are **other real topics from the same subject** —
so a wrong option is something a student could genuinely confuse it with, not an
invented plausible-sounding string. Nothing here writes course content.

### Notes & papers

The documents themselves — 31 subjects of lecture notes and past papers, opened
or downloaded as PDFs.

A document is listed **only if it was actually read into the archive**, so what
you open is what the agent answers from. Grouped by subject, filterable to notes
or papers.

Also available: `/stats` (what to study) and `/download` (bulk PDF export).

---

## Intelligence (teaching)

Six screens behind a menu at `/faculty`.

### Overview

What this subject has actually been examining — marks by unit, and unit emphasis
across nine years as a stacked area. A unit thinning out year on year is usually
being quietly dropped, and that shows here before anyone notices in a meeting.

Coverage tiles are honest: the marks-coverage tile reports what fraction of
questions state their marks, because 19% do not.

### Generate a paper

The headline feature, and the one with the strictest rule:

> **SQL selects, the model only phrases.**

A paper is assembled by constraint satisfaction over real past questions. Every
line traces to a `question_id`, its source PDF, and the year it was last asked —
which is what makes it defensible to an exam committee. **No language model
invents a question.**

Two declared formats, both taken from papers the college actually sets:

| | Structure | Marks |
|---|---|---|
| **SEE** | 5 units × 20 marks, 10 marks per question, internal choice | 100 |
| **CIE** | Part A 1×5 · Part B 3×5 · Part C 2 of 3 ×10 | 40 |

Controls, and what each really does:

- **Exclude asked in last N years** — real. Drops every question in a repeat
  cluster set since the cutoff.
- **Difficulty preference** — a preference *order*, not a ratio. Slots prefer the
  highest-weighted level first; a level at zero is never preferred.

Print gives the paper alone — chrome, controls and provenance panels are working
aids, not part of the document.

### Practice sets

The same MCQ builder as the student side, for setting revision.

### Coverage

**Where teaching and examining diverge.** A scatter of note depth against marks
examined, with the problem quadrant labelled rather than left to inference:
heavily examined, thinly taught.

Beneath it, **asked to death** — near-identical questions set three or more
times, with the span of years. Faculty use this to *avoid* them.

### Question bank

Every question, filtered by unit, marks, Bloom level, year and sitting, with full
text search. Every row expands to its source file, sitting, topic and repeat
cluster. Exports to CSV.

### Asked before?

Paste a question you are drafting, get ranked matches from nine years.

Scoring is **IDF-weighted term overlap computed in SQL** — rare words carry the
signal, so "virtualization" counts and "explain" barely does. A verbatim repeat
scores 100%, a rephrasing 92%, a loose variant 70%.

---

## How the agent works

```
question ─► Multi-Agent Supervisor ─► Genie (tool) ─► Unity Catalog ─► rows
                    │                    │
              reasoning, tool          the SQL
              calls returned          returned
```

**One agent, one entry point.** The supervisor reasons about the question and
calls Genie as a tool, so a reply carries the tool calls, the SQL and the rows —
not just prose.

Every analytical screen routes through it: overview, marks by unit, unit drift,
coverage, repetition, freshness. Each panel offers **"show the sql Genie wrote"**
with the timing and which engine answered.

**Fallback chain:** supervisor → Genie → the equivalent hand-written statement.
A screen degrades to working-but-not-agentic rather than to blank, and says which
path answered.

### Where the agent is deliberately not used

| | Why |
|---|---|
| **Paper assembly** | Genie answers questions; it does not select under constraints. A paper defended line by line cannot have its selection rephrased between runs. |
| **Similarity scoring** | Must be reproducible to be actionable. |
| **Subject picker** | Drives every other screen; a 20-second call to fill a dropdown is wrong. |

The characteristic text-to-SQL failure is not a crash — it is confidently
answering a *subtly different* question. Filtering to the wrong exam type,
pooling re-exam sittings into "what is normally asked", dropping NULL marks.
The prose reads fine in every case. **The SQL is the only place it shows**, which
is why it is always one click away.

---

## The data underneath

Seven gold tables in Unity Catalog. Seven, not seventeen — text-to-SQL accuracy
is driven mostly by how narrow the surface is.

| Table | Rows | Its job |
|---|---|---|
| `fact_question` | 15,888 | One row per question ever asked. The core. |
| `dim_topic` | 757 | The vocabulary. Without it, 15,888 unrelated sentences. |
| `dim_subject` | 30 | Identity across time — a subject has run under many codes. |
| `dim_exam_pattern` | 168 | The shape of a paper, per unit. |
| `fact_note_coverage` | 921 | Which pages of notes cover which topic. |
| `fact_attempt` | 0 | Empty by design — no quiz data exists. |
| `fact_engagement` | 0 | Empty by design — no telemetry exists. |

`bronze_page` (2,691 pages of note text) sits **outside** the Genie space
deliberately: a wide table of raw markdown cannot answer a question and dilutes
the schema that makes the rest work.

Three design decisions worth knowing:

1. **Natural keys, not surrogate integers.** `subject_key` is `cloud_computing`;
   every join is readable in a raw query result, which matters when the agent's
   SQL is shown to someone judging whether it answered the right question.
2. **Subjects are identified by name, never by code.** Codes change every scheme —
   DBMS has run under seven. Keying on code would fragment nine years into seven
   unrelated courses.
3. **`topic_id` is keyed on name, not unit.** The same topic sits in different
   units across schemes; a unit-keyed id fragmented 63 real topics into 127.

Full column-level reference, including every trap, in **[SCHEMA.md](SCHEMA.md)**.

---

## Architecture

```
kronos/
├── student/          Vite + React 19 — ONE app, both audiences
│   └── src/routes/
│       ├── Landing.tsx        two doors
│       ├── Ask.tsx  Home.tsx  Notes.tsx      student hub
│       └── faculty/           Intelligence — 6 screens
├── backend/          FastAPI
│   └── app/
│       ├── mas_client.py      Multi-Agent Supervisor (the agent)
│       ├── genie_client.py    Genie, structured
│       ├── databricks.py      SQL Statement Execution (holds the token)
│       ├── faculty_sql.py     every statement, in one place
│       └── routers/           faculty · notes · chat · search · papers · voice · telegram
├── design/           shared tokens — neither side owns the palette
├── scripts/          corpus pipeline: OCR, extraction, embeddings, clustering
└── backend/data/     notes index (which documents exist and where)
```

**The Databricks token lives in the backend, never the bundle.** A static SPA has
no secrets, so the browser names a query (`POST /api/faculty/query`) and the
server holds the credentials and the SQL.

### API

| Endpoint | |
|---|---|
| `POST /api/faculty/ask` | the agent |
| `POST /api/faculty/genie-query` | a named analytical question, answered by Genie |
| `POST /api/faculty/query` | a named statement, run directly |
| `POST /api/faculty/generate` | assemble a paper |
| `POST /api/faculty/practice` | build an MCQ set |
| `POST /api/faculty/similar` | has this been asked? |
| `POST /api/faculty/bank` | filtered question search |
| `GET /api/notes` · `/subjects` · `/file/{sha}` | documents, and the PDFs themselves |
| `POST /api/chat` | student chat, same agent |

### Design

Cream paper, one bookish red, an editorial serif for content and a retro mono for
anything numeric. Red means *a mark, a citation, or something that failed* —
never decoration. Tokens live once in `design/` and both build systems map them.

Motion is gated on frequency and purpose: the ⌘K palette has none (a keyboard
action fired hundreds of times a day is a disqualifier), charts do not animate
(data being read before an exam is set should not move for style), and the paper
reveal exists because a 60-second wait ending in a teleport is jarring.

---

## Running it

```bash
# backend
pip install -r requirements.txt
cp .env.example .env          # Databricks host, token, warehouse, Genie space, agent endpoint
uvicorn backend.app.main:app --reload

# frontend
cd student && pnpm install && pnpm dev
```

Two environment variables are easy to get wrong and fail quietly:

- **`DATABRICKS_CATALOG`** must name the catalog the Genie space queries. When
  they diverge, the ask panel answers about a different dataset than every other
  screen, with nothing on screen to reveal it.
- **`GENIE_SPACE_ID` and `DATABRICKS_GENIE_SPACE_ID`** must both be set. Two
  clients read different names; setting one leaves the other silently
  unavailable, which surfaces as a null answer rather than an error.
- **`EXNOTE_ROOT`** points at the PDFs, which live outside the repo.

### Rebuilding the tables

```bash
python ocr_mps/build_all_subjects.py     # → parquet for every qualifying subject
```

A subject is included only if it has **both** notes and ≥100 parsed questions.
Notes without papers give topics with no evidence to rank; papers without notes
give a ranking with nowhere to send the reader.

After loading, **re-apply column comments** — `CREATE TABLE AS SELECT` drops
them, and Genie reads them.

---

## What is real and what is not

A system built on provenance should be honest about its own.

**Real** — 15,888 questions from 696 papers over nine years, every one traceable
to a PDF. 2,364 repeat clusters from actual embedding similarity. Zero
referential orphans on any join. The agent answering live, SQL visible.

**Not:**

| | |
|---|---|
| `fact_attempt` / `fact_engagement` | Empty. No quiz, no telemetry. Personalisation is schema-ready, unproven. |
| `dim_exam_pattern.basis = 'observed'` | Averaged from real papers, not a published blueprint. The two declared formats (SEE, CIE) are taken from real papers and do not need it. |
| `source_page` | 100% NULL. Citation is document-level, not page-level. |
| Bloom levels | 54% `unclassified` — the verb was not in the map. Any difficulty preference works from the other 46%. |
| Sittings | Only half the corpus is `Main`. Every query that means "what is normally asked" filters on it; pooling re-exams roughly doubles apparent repetition. |
| Note extraction | 853 coverage rows from Marker/Surya, 68 from `gpt-4.1-mini` at ~96 DPI. On the one file both processed, the model won — but one file is not a verification. |

---

## Further reading

| | |
|---|---|
| **[PROJECT.md](PROJECT.md)** | Full explanation — problem, gold schema design, the pipeline, the skills involved |
| **[SCHEMA.md](SCHEMA.md)** | Every column, every coverage gap, and the traps that produce plausible wrong answers |
| **[AGENTS.md](AGENTS.md)** | The agent, and what grounds it |
