# The Kronos agent

**Kronos has one agent: Databricks AI/BI Genie.**

It is a text-to-SQL agent over Unity Catalog tables. A student or lecturer asks
in plain words, Genie writes SQL, runs it against governed tables, and returns
rows — with the query visible.

Everything else in Kronos is either deterministic SQL or a transport. That is the
architecture, not a limitation:

> Genie does not read PDFs and it does not query vector stores.
> **Embeddings are not the product. Rows are.**

The corpus work — OCR, question extraction, topic clustering, embeddings — exists
to *build the tables*. Once the tables exist, the agent is Genie querying them.

---

## What Genie sees

Seven gold tables in Unity Catalog. Genie's accuracy is driven almost entirely by
how narrow and well-described this surface is, which is why it is seven tables
and not seventeen.

| Table | Rows | What it answers |
|---|---|---|
| `fact_question` | 1,107 | every question ever asked — marks, unit, CO, PO, Bloom, year, source |
| `dim_topic` | 63 | what each question is *about* |
| `dim_subject` | 1 | one subject across every code it has run under |
| `dim_exam_pattern` | 6 | the shape of a paper, per unit |
| `fact_note_coverage` | 91 | where the study material for a topic is |
| `fact_attempt` | 0 | quiz answers — **empty, no data exists yet** |
| `fact_engagement` | 0 | topic views near an exam — **empty** |

`bronze_page` (2,691 pages of note text) is deliberately **kept out of the Genie
space**. Genie is text-to-SQL; a wide table of raw markdown cannot answer a
question and dilutes the schema that makes the rest work.

**Every `COMMENT` matters.** Genie reads column comments, so they are written in
the vocabulary a student uses, not the vocabulary the schema uses. Eight of the
47 columns currently carry no information (see `SCHEMA` notes) — pruning them is
the cheapest available accuracy win.

---

## Where the agent is exposed

| Surface | Path |
|---|---|
| Faculty console — Ask | `faculty/app/api/genie/route.ts` |
| Student backend | `backend/app/genie.py` → `POST /api/chat` |
| Telegram | `backend/app/routers/telegram.py` |

All three hit the same Genie space over the same tables, so an answer does not
change depending on where it was asked.

### Show the SQL

Every surface exposes a **show the SQL** toggle on every answer.

This is not a debug affordance. The characteristic text-to-SQL failure is not a
crash — it is confidently answering a *subtly different question* than the one
asked. Filtering to the wrong exam type, pooling re-exam sittings into "what is
normally asked", silently dropping rows where marks are NULL. The prose reads
fine in every one of those cases. **The SQL is the only place it shows.**

### Polling states

Genie is asynchronous. A client must wait through every non-terminal state:

```
SUBMITTED · IN_PROGRESS · PENDING · FILTERING_CONTEXT
ASKING_AI · EXECUTING_QUERY · FETCHING_METADATA · PENDING_WAREHOUSE
```

Omitting one is a real bug and was one here: an early client waited on only some,
returned as soon as it saw `SUBMITTED`, and **echoed the user's own question back
as the answer.** It looked like a working reply — no error, no empty state.

### The catalog must match

`DATABRICKS_CATALOG` in the faculty console has to name the same catalog the
Genie space is configured against. When they diverge, the Ask panel answers about
a different dataset than every other screen — an application quietly disagreeing
with itself, with nothing on screen to reveal it. This has already happened once:
Genie pointed at `hackathon_project.default` while the console read
`workspace.kronos`.

---

## What the agent is deliberately not asked to do

Two features could have been LLM calls and are not. Both are SQL.

### Paper generation — `faculty/app/api/generate/route.ts`

> **SQL selects, the model only phrases.**

A generated paper is assembled by constraint satisfaction over real past
questions. Every line traces to a `question_id`, its source PDF and the year it
was last asked. No model invents a question, because a paper has to be defended
line by line to an exam committee.

Constraints: blueprint structure · exclude anything asked in the last *N* years ·
CO coverage · Bloom mix · no repeated cluster · exact marks total.

**When a constraint cannot be met it is printed on the paper, not dropped.** A
banner saying *"CO3 could not be placed"* is more useful than a paper that looks
complete and quietly isn't.

The one place a model is permitted: an optional, **off-by-default** rephrase of a
single question for freshness, content unchanged, marked visibly as edited with
the original one click away.

### Similarity check — `faculty/app/api/similar/route.ts`

*Has this question been asked before?* — IDF-weighted term overlap computed in
SQL. Rare words carry the signal, so no stopword list has to be guessed.

Two simpler scorings were tried and both were wrong in ways that looked fine:

| Scoring | A verbatim repeat scored | Why it fails |
|---|---|---|
| Jaccard | **18%** | diluted by unshared words — a duplicate reads as "not similar" |
| Containment | **100%** for an unrelated question | a short probe trivially fits inside a long one |
| **IDF-weighted** | 100% exact · 92% rephrased · 70% variant | correct ranking and drop-off |

On a backend without Databricks array functions it returns an explicit *"this
needs Databricks"* error rather than an empty result — "no similar questions
found" that really means "the feature did not run" would let someone re-set a
question asked five times.

---

## Voice

`backend/app/routers/voice.py` — Whisper for speech-to-text, ElevenLabs for
text-to-speech.

**Neither reasons about content.** Voice is a transport into the same Genie
pipeline, so it inherits whatever grounding that pipeline has rather than opening
a path around it.

---

## Legacy: the GPT chat path

`backend/app/chat.py` predates the Genie integration. It is a retrieval-grounded
chat over the local SQLite question bank using `gpt-4o-mini` — parse the message
into filters, run the existing search, compose a reply citing only retrieved rows.

**It is not part of the agent story and should not be presented as one.** It
answers from a local database rather than governed Unity Catalog tables, which is
precisely the architecture the Genie requirement exists to rule out.

It still runs because the student app depends on it. To remove the GPT dependency
entirely, `POST /api/chat` routes to `genie.ask()` instead of the parse/compose
pipeline — `backend/app/genie.py` already implements the call, and the Telegram
router already uses it.

---

## Why this shape

The corpus pipeline is elaborate — 12,698 pages OCR'd, questions parsed, topics
clustered, embeddings built. None of that is the agent. It is how the tables got
made.

The agent is Genie writing SQL over those tables, and the two places where a
wrong-but-plausible answer would be expensive — printing an exam paper, telling a
lecturer a question is fresh — are handled by deterministic SQL instead, with the
query visible either way.
