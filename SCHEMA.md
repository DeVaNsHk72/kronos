# Kronos database

The complete reference for `hackathon_project.default` — the seven gold tables
Databricks Genie queries, plus the content store beside them.

Every number here is **measured from the built tables**, not declared. Where a
column carries no information that is stated, because a column that is always
NULL is worse than an absent one: it looks like data.

- **15,888 questions · 30 subjects · 696 papers · 2016–2024**
- **757 topics · 168 exam patterns · 921 note-coverage rows**
- **Zero referential orphans** on every join

---

## Contents

1. [How the tables connect](#1-how-the-tables-connect)
2. [Where the data comes from](#2-where-the-data-comes-from)
3. [Table reference](#3-table-reference) — every column
4. [Coverage per subject](#4-coverage-per-subject)
5. [Distributions](#5-distributions)
6. [Traps](#6-traps) — how this data will mislead you
7. [Dead columns](#7-dead-columns)
8. [Rebuilding and loading](#8-rebuilding-and-loading)

---

## 1. How the tables connect

Every join is a **string equality on a natural key**. There are no surrogate
integers anywhere — `subject_key` and `topic_id` are slugs derived from names,
which makes every join readable in a query result.

```
                      dim_subject (30)
                       subject_key ◄──────────────┐
                            ▲                     │
              ┌─────────────┴──────────┐          │
              │                        │          │
        dim_topic (757)      dim_exam_pattern (168)
         topic_id ◄──┐        (subject_key, exam_type, unit_no)
              ▲      │
              │      │        fact_question (15,888) ──────────┘
              │      └──────── topic_id, subject_key
              │
   fact_note_coverage (921)
        topic_id
        note_id ──── = sha256 ───► bronze_page   [NOT in the Genie space]

   fact_attempt (0)     → topic_id, question_id     empty by design
   fact_engagement (0)  → topic_id                  empty by design
```

**`bronze_page` is deliberately outside the Genie space.** Genie is text-to-SQL;
a wide table of raw page markdown cannot answer a question and dilutes the
schema that makes the rest work. It is a content store, queried directly.

---

## 2. Where the data comes from

Two independent pipelines feed this schema, and **they do not share a corpus**:

| Feeds | From | Pipeline |
|---|---|---|
| `fact_question`, `dim_topic`, `dim_subject`, `dim_exam_pattern` | `RIPPED_PAPERS` — 10,623 scraped exam PDFs | OCR → question parsing → topic clustering → `questions_v2.db` |
| `fact_note_coverage`, `bronze_page` | `ExNote` — student lecture notes | Marker/Surya on MPS + gpt-4.1-mini → markdown |
| `repeat_cluster_id` | `embeddings.npy` — 384-dim vectors | cosine ≥ 0.92, union-find |

**Consequence worth internalising:** a question's `source_file` points into the
exam-paper archive; `bronze_page` contains lecture notes. They are different
documents. Bronze does **not** provide provenance for questions — that comes
from `source_file` and `source_sha`.

A subject appears here only if it has **both** notes and ≥100 parsed questions.
Notes without papers give topics with no evidence to rank; papers without notes
give a ranking with nowhere to send the reader. Linear Algebra & Optimization
was excluded at 54 questions.

---

## 3. Table reference

### `fact_question` — 15,888 rows, 20 columns

One row per question ever asked. **The core fact table**; everything else exists
to make it answerable.

| # | Column | Type | Null | Distinct | Notes |
|---|---|---|---|---|---|
| 1 | `question_id` | STRING | 0% | 15,888 | **PK.** `subject_key_sha12_qno+subpart_i` |
| 2 | `subject_key` | STRING | 0% | 30 | **FK → dim_subject** |
| 3 | `topic_id` | STRING | 0% | 757 | **FK → dim_topic.** Zero unmapped |
| 4 | `unit_no` | DOUBLE | 16.2% | 7 | Syllabus unit. **Units 6–7 are artifacts** (see traps) |
| 5 | `exam_year` | BIGINT | 0% | 9 | 2016–2024 |
| 6 | `exam_type` | STRING | 0% | **1** | Always `SEE`. **No discriminating power** |
| 7 | `exam_session` | STRING | 0% | 5 | Main / Supplementary / Makeup / Reappear / Grade Improvement |
| 8 | `sitting` | STRING | 0% | 5 | Alias of `exam_session`. **Filter `= 'Main'` for a normal paper** |
| 9 | `marks` | DOUBLE | **19.0%** | 60 | NULL where the paper never stated them |
| 10 | `bloom_level` | STRING | 0% | 6 | From the leading verb. **54% `unclassified`** |
| 11 | `course_outcome` | DOUBLE | **76.1%** | 6 | CO number. Sparse |
| 12 | `program_outcome` | DOUBLE | **78.0%** | 9 | PO number. Sparse |
| 13 | `question_no` | DOUBLE | 4.3% | 52 | Number on the paper |
| 14 | `subpart` | STRING | 5.3% | 12 | a / b / c within the question |
| 15 | `repeat_cluster_id` | STRING | **52.1%** | 2,364 | Cosine ≥ 0.92. **NULL is correct** — no near-duplicate |
| 16 | `question_text` | STRING | 0% | 14,392 | Verbatim. 2,459 rows share text with another |
| 17 | `source_file` | STRING | 0% | 696 | Path to the source PDF, for citation |
| 18 | `source_page` | — | **100%** | 0 | **Dead.** Citation is document-level only |
| 19 | `source_sha` | STRING | 0% | 696 | sha256 of the source paper |
| 20 | `map_confidence` | DOUBLE | 0% | 2 | 1.0 high / 0.5 low, from the parser |

### `dim_topic` — 757 rows, 7 columns

The vocabulary every recommendation is phrased in.

| Column | Type | Null | Distinct | Notes |
|---|---|---|---|---|
| `topic_id` | STRING | 0% | 757 | **PK.** `subject_key\|slug` |
| `subject_key` | STRING | 0% | 30 | **FK → dim_subject** |
| `unit_no` | DOUBLE | 5.5% | 7 | A hint. Varies by scheme — see traps |
| `topic_name` | STRING | 0% | **741** | **16 names repeat across subjects** |
| `contact_hours` | — | **100%** | 0 | Dead — syllabus PDFs unparsed |
| `course_outcome` | — | **100%** | 0 | Dead — syllabus PDFs unparsed |
| `in_current_scheme` | — | **100%** | 0 | Dead. **NULL = unknown, never FALSE** |

`topic_id` is keyed on **name, not unit**, because the same topic sits in
different units across schemes. A unit-keyed id fragmented real topics into
unstable duplicates.

### `dim_subject` — 30 rows, 8 columns

One row per subject, identified by **name**, never by code.

| Column | Type | Null | Distinct | Notes |
|---|---|---|---|---|
| `subject_key` | STRING | 0% | 30 | **PK.** Slug of the subject name |
| `subject_name` | STRING | 0% | 30 | As students say it |
| `subject_code` | STRING | 0% | 30 | Most recent code. **Never join on this** |
| `course_codes` | STRING | 0% | 30 | JSON array of every historical code |
| `branch` | STRING | 0% | 6 | Owning branch |
| `semester` | BIGINT | 0% | 6 | 1–6 |
| `scheme` | STRING | 0% | 1 | Always `2023` |
| `credits` | — | **100%** | 0 | Dead — absent from every source |

Codes change every scheme, which is exactly why the key is the name. DBMS alone
has run under several codes; `course_codes` keeps them all.

### `dim_exam_pattern` — 168 rows, 8 columns

The shape of a paper, per unit. Grain: `(subject_key, exam_type, unit_no)`.

| Column | Type | Null | Distinct | Notes |
|---|---|---|---|---|
| `subject_key` | STRING | 0% | 30 | **FK → dim_subject** |
| `exam_type` | STRING | 0% | **1** | Always `SEE` |
| `unit_no` | BIGINT | 0% | 7 | Units 6–7 are artifacts |
| `questions_asked` | BIGINT | 0% | 11 | Mean questions set from this unit |
| `questions_to_answer` | — | **100%** | 0 | Dead — internal choice unrecoverable |
| `marks_per_question` | DOUBLE | 1.2% | 8 | Modal value |
| `unit_max_marks` | BIGINT | 0% | 43 | Mean total from this unit |
| `basis` | STRING | 0% | 1 | Always `observed` |

**`basis = 'observed'` matters.** These are averages measured from real papers,
**not a published departmental blueprint**. Unit totals do not sum to 100 — for
Cloud Computing they sum to 155, for DBMS 201 — so any generator using them must
scale and say so.

### `fact_note_coverage` — 921 rows, 7 columns

Turns "study this topic" into "read these pages".

| Column | Type | Null | Distinct | Notes |
|---|---|---|---|---|
| `note_id` | STRING | 0% | 130 | sha256. **FK → bronze_page.sha256** |
| `topic_id` | STRING | 0% | 452 | **FK → dim_topic.** 452 of 757 topics (60%) |
| `depth_score` | DOUBLE | 0% | 37 | Pages containing **all** the topic's distinctive words |
| `page_start` | BIGINT | 0% | 118 | Min of scattered hits — **not a range start** |
| `page_end` | BIGINT | 0% | 172 | Max of scattered hits |
| `source_file` | STRING | 0% | 34 | Note PDF filename |
| `engine` | STRING | 0% | 2 | `marker_out` (853) or `openai_out` (68) |

**`depth_score` method.** Word specificity is measured against each subject's own
note corpus: anything appearing on more than 25% of that subject's pages is
dropped as a stopword. Without it, generic subject words matched nearly every
page — "Data Paradigms in Cloud" once claimed 112 of 159 pages.

### `fact_attempt` and `fact_engagement` — 0 rows

**Empty by design.** No student quiz data or telemetry exists anywhere in the
corpus. Full schema is present so a quiz can write into it.

They are the tables that make an answer *personal*. With them empty, the schema
ranks what the examiner favours but not what any individual student is weak at —
"where should anyone start", not "where should *you* start". Filling them with
plausible rows would fake precisely the capability they represent.

| `fact_attempt` | `fact_engagement` |
|---|---|
| `attempt_id`, `student_id`, `topic_id` → dim_topic, `question_id` → fact_question, `is_correct`, `answered_at` | `topic_id` → dim_topic, `view_count`, `days_to_exam`, `captured_on` |

### `bronze_page` — content store, outside Genie

One row per extracted page. Natural key `(sha256, page_no)`. Holds the actual
study material — `fact_note_coverage` says a topic spans 18 pages; this says what
those pages contain. Near-dead columns: `exam_year` 100% NULL (filenames carry no
year), `exam_type` 98% NULL.

---

## 4. Coverage per subject

Subjects are uneven, and a query that pools them inherits the unevenness.

| Subject | Sem | Questions | Yrs | Papers | Topics | Noted | Marks | CO |
|---|---|---|---|---|---|---|---|---|
| Machine Learning | 6 | 1,596 | 9 | 79 | 75 | 50 | 86% | 21% |
| Scientific Foundations for Health | 1 | 1,571 | 4 | 11 | 26 | 14 | **29%** | 3% |
| Computer Network | 5 | 1,262 | 9 | 56 | 54 | 30 | 81% | 19% |
| Cloud Computing | 6 | 1,107 | 9 | 56 | 63 | 43 | 89% | 31% |
| Internet of Things | 5 | 1,015 | 9 | 52 | 59 | 47 | 90% | 20% |
| Artificial Intelligence | 5 | 944 | 9 | 48 | 37 | **4** | 75% | 24% |
| Operating System | 4 | 817 | 9 | 33 | 35 | 28 | 97% | 32% |
| Engineering Chemistry | 1 | 797 | 9 | 32 | 45 | 16 | 96% | **0%** |
| DBMS | 3 | 781 | 9 | 39 | 45 | 29 | 91% | 25% |
| Software Engineering | 5 | 705 | 9 | 33 | 37 | 30 | 85% | **0%** |
| Theoretical Foundations of Computations | 3 | 525 | 9 | 26 | 21 | 20 | 76% | 11% |
| Cryptography | 5 | 420 | 5 | 16 | 21 | 13 | 90% | 50% |
| Applied Physics | 1 | 381 | 7 | 18 | 13 | 6 | 76% | 11% |
| Engineering Mathematics II | 2 | 379 | 7 | 17 | 15 | 5 | **51%** | 0% |
| Renewable Energy Sources | 5 | 341 | 5 | 16 | 19 | 10 | 100% | 34% |
| Data Structure | 3 | 324 | 5 | 15 | 16 | 11 | 98% | 58% |
| Analysis and Design of Algorithms | 4 | 268 | 4 | 11 | 13 | 9 | 91% | 64% |
| Introduction to Electrical Engineering | 1 | 259 | 3 | 10 | 15 | 8 | 97% | 75% |
| Principles of Programming in C | 2 | 255 | 3 | 11 | 16 | 8 | 95% | 47% |
| Object Oriented Programming | 3 | 254 | 2 | 10 | 16 | 11 | 98% | 91% |
| Introduction to Python Programming | 1 | 250 | 3 | 10 | 11 | 6 | 88% | 48% |
| Computer Aided Engineering Design | 1 | 244 | 2 | 28 | 15 | 9 | 87% | 4% |
| Computer Organization and Architecture | 3 | 198 | 3 | 8 | 12 | 5 | 99% | 78% |
| Introduction to Civil Engineering | 1 | 188 | 3 | 10 | 13 | 7 | 95% | 39% |
| Introduction to Sustainable Engineering | 2 | 183 | 3 | 9 | 10 | 9 | 99% | 0% |
| Logic Design | 3 | 181 | 4 | 8 | 12 | **0** | 92% | 30% |
| Introduction to Electronics Engineering | 1 | 181 | 3 | 8 | 12 | 7 | 85% | 35% |
| Green Buildings | 1 | 175 | 3 | 10 | 13 | 11 | 95% | 35% |
| Waste Management | 2 | 164 | 3 | 10 | 10 | 3 | 100% | 49% |
| Engineering Mathematics I | 1 | 123 | 2 | 6 | 8 | 3 | **17%** | 0% |
| **TOTAL** | | **15,888** | **9** | **696** | **757** | **452** | **81%** | **24%** |

Outliers to know before quoting a number:

- **Engineering Mathematics I** — only **17%** of questions state marks. Any
  marks-weighted ranking silently drops five sixths of it.
- **Scientific Foundations for Health** — 1,571 questions from just 11 papers,
  and only 29% carry marks. High question count, thin evidence.
- **Logic Design** — 181 questions, **zero note coverage**.
- **Artificial Intelligence** — 944 questions but only 4 of 37 topics noted.
- **Engineering Chemistry, Software Engineering, Sustainable Engineering,
  Engineering Maths I/II** — **0% CO**, so they cannot appear in attainment views.

---

## 5. Distributions

**Bloom level** — derived from the leading verb:

| | count | |
|---|---|---|
| unclassified | 8,512 | **54%** — verb not in the map, or question starts mid-sentence |
| understand | 3,318 | explain, describe, discuss |
| apply | 1,511 | compute, solve, implement |
| remember | 944 | state, list, define |
| analyse | 910 | derive, prove, differentiate |
| evaluate | 693 | design, compare, justify |

The 54% unclassified is the honest number. Any Bloom-mix feature is working from
46% of the data.

**Sitting** — 7,898 Main · 5,900 Supplementary · 1,384 Makeup · 557 Reappear ·
149 Grade Improvement. **Only 50% are Main.** Pooling re-exam sittings into "what
is normally asked" roughly doubles apparent repetition.

**Units** — 1: 2,954 · 2: 2,606 · 3: 2,778 · 4: 2,657 · 5: 2,231 · **6: 43 ·
7: 44**.

**Repetition** — 2,364 clusters covering 7,616 questions. Largest: **one question
asked 46 times across 7 years.**

---

## 6. Traps

Each produces a plausible-looking answer that is wrong.

### 6.1 Half the corpus is re-exam sittings

Only 7,898 of 15,888 rows are `Main`. Supplementary and Makeup papers reuse
questions heavily, so **any query about "what is normally asked" must filter
`sitting = 'Main'`** or it will overstate repetition and distort unit emphasis.

### 6.2 NULLs are not zeros

19% of questions have no stated marks, 76% no CO, 78% no PO. **Exclude them,
never coalesce to zero** — a zero-mark question drags every average down while
the row count still looks complete. Every reported total should say what it
excluded.

### 6.3 `page_start`/`page_end` are not a range

They are the **min and max of scattered hits**. A row reading `depth_score = 6,
page_start = 2, page_end = 161` means **six pages somewhere between 2 and 161**,
not 160 pages of coverage. Rendering "pages 2–161" would be a straightforward
lie. Summing `depth_score` across topics also double-counts, because one page
covers several topics.

### 6.4 Topic names repeat across subjects

**16 topic names appear under more than one subject.** `topic_id` is unique
because it is prefixed by subject, but **grouping by `topic_name` instead of
`topic_id` silently merges two subjects' data.**

### 6.5 2,459 rows share question text

20 texts span more than one subject — courses genuinely covering the same ground.
The rest are the same question re-set across sittings. `SUM(marks)` counts all
of them.

### 6.6 Units 6 and 7 exist

87 rows sit in units 6–7, parser artifacts from papers with non-standard
numbering. **A UI showing "units 1–5" silently drops them.**

### 6.7 `exam_type` and `map_confidence` cannot filter

Both are single-valued across all 15,888 rows (`SEE`, and effectively `1.0`).
Filtering on them looks meaningful and does nothing.

### 6.8 The exam pattern is observed, not published

`basis = 'observed'` on all 168 rows. Unit totals sum to 155 or 201 rather than
100, so a generated paper must be scaled — and must say so.

### 6.9 Note extraction quality is mixed and partly unverified

853 coverage rows came from Marker/Surya, 68 from `gpt-4.1-mini` at ~96 effective
DPI. On the one file both engines processed, the model captured truth tables that
the layout model dropped entirely — but that is a single file, not a
verification. Exam questions are unaffected; this touches only note coverage and
`bronze_page`.

---

## 7. Dead columns

**Eight columns carry no information.** They exist because the runbook's schema
specifies them.

| Column | Table | Why |
|---|---|---|
| `source_page` | fact_question | parsed corpus carries no page numbers |
| `map_confidence` | fact_question | uniformly 1.0 |
| `exam_type` | fact_question, dim_exam_pattern | always `SEE` |
| `contact_hours` | dim_topic | syllabus PDFs unparsed |
| `course_outcome` | dim_topic | syllabus PDFs unparsed |
| `in_current_scheme` | dim_topic | **NULL = unknown, never FALSE** |
| `credits` | dim_subject | absent from every source |
| `questions_to_answer` | dim_exam_pattern | internal choice unrecoverable |

**Genie reads every column comment**, so eight dead columns are real noise in the
surface that drives its accuracy. Pruning them is the cheapest available
improvement.

`in_current_scheme` deserves emphasis: the runbook treats FALSE as "never
recommend this topic". The available evidence was far too thin to declare topics
dead, so it is NULL. **Never read NULL as FALSE here.**

---

## 8. Rebuilding and loading

```bash
python ocr_mps/build_all_subjects.py      # → ocr_mps/work/databricks_all/*.parquet
```

Idempotent. A subject is included if it has notes **and** ≥100 parsed questions.

**Load:** upload the parquet to `/Volumes/workspace/kronos/raw/`, then per table:

```sql
CREATE OR REPLACE TABLE hackathon_project.default.<table>
AS SELECT * FROM parquet.`/Volumes/workspace/kronos/raw/all_<table>.parquet`;
```

`CREATE TABLE AS SELECT` **drops column comments**. Genie reads those, so
re-apply them after loading — see `databricks_setup.sql`.

**Backups in the catalog:** `*_backup_cc_only` (the single-subject build),
`*_backup_pre_enrich` (before `unit_no`/CO/PO/`sitting` were added).

**The catalog must match Genie's.** `DATABRICKS_CATALOG` in the faculty console
has to name the catalog the Genie space is configured against. When they diverge,
the ask panel answers about a different dataset than every other screen, with
nothing on screen to reveal it. This has already happened once.

### The demo query

```sql
WITH hist AS (
  SELECT topic_id, SUM(marks) tm, COUNT(DISTINCT source_file) np,
         COUNT(DISTINCT exam_year) ny
  FROM hackathon_project.default.fact_question
  WHERE subject_key = 'cloud_computing'
    AND sitting = 'Main'          -- normal papers only
    AND marks IS NOT NULL         -- never coalesce to zero
    AND topic_id IS NOT NULL
  GROUP BY topic_id)
SELECT t.unit_no, t.topic_name, h.tm AS marks, h.np AS papers, h.ny AS years,
       ROUND(100.0*h.tm/(SELECT SUM(tm) FROM hist), 1) AS mark_share,
       COALESCE(SUM(nc.depth_score), 0) AS note_pages
FROM hist h
JOIN hackathon_project.default.dim_topic t USING (topic_id)
LEFT JOIN hackathon_project.default.fact_note_coverage nc USING (topic_id)
GROUP BY t.topic_id, t.unit_no, t.topic_name
ORDER BY h.tm DESC;
```

The three clauses that keep it honest are the `WHERE` filters: Main sittings
only, NULL marks excluded, unmapped topics excluded.
