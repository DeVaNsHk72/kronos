# Kronos agents

Six AI components run in Kronos. They differ in one thing that matters more than
their models or prompts: **what stops them inventing an answer.**

Everything here is built on a college's exam archive, and a fabricated past
question is worse than no answer at all — a student revises from it, or a
lecturer prints it on a paper. Each agent below is described by its grounding
first, because that is the part that can fail silently.

| Agent | Where | Model | What grounds it |
|---|---|---|---|
| [Grounded chat](#1-grounded-chat) | student | `gpt-4o-mini` | retrieved rows + mandatory citations |
| [Genie](#2-genie-text-to-sql) | both | Databricks Genie | Unity Catalog tables; SQL is shown |
| [Paper generator](#3-paper-generator) | faculty | **none** | constraint satisfaction over real questions |
| [Similarity check](#4-similarity-check) | faculty | **none** | IDF-weighted term overlap in SQL |
| [Telegram bot](#5-telegram-bot) | messaging | Databricks serving endpoint | same tables as Genie |
| [Voice](#6-voice) | student | `whisper-1`, `eleven_multilingual_v2` | transcription only, no reasoning |

Two of the six use no model at all. That is deliberate, not an omission.

---

## 1. Grounded chat

`backend/app/chat.py` · `POST /api/chat` · `gpt-4o-mini`

Answers "what has been asked about X" from the question bank. **Three steps, and
only the first and last involve a model.**

```
message ──parse──> filters + semantic query ──search──> rows ──compose──> reply
         (model)      (no model, existing            (model, restricted
                       search machinery)              to those rows)
```

**Parse** turns free text into structured filters. Its governing instruction is a
bias toward *not* filtering:

> A field is null unless the user actually said it. Every filter you set removes
> questions. Setting one the user did not ask for hides the results they wanted
> and they cannot tell that happened. When in doubt, null.

That asymmetry is the point: an over-eager filter produces a confident, wrong,
*small* answer, and the student has no way to see what was silently excluded.
The canonical filter vocabulary (branches, exam types, programmes, year range) is
read from the corpus and injected into the prompt, so the model picks from values
that exist rather than inventing plausible-looking branch names.

**Search** is the existing filter and semantic machinery, unchanged. No model.

**Compose** writes the reply from the top 12 retrieved rows and nothing else:

> You answer using ONLY the numbered past exam questions given to you. They are
> the complete evidence; you have no other knowledge of this course.
>
> Citations are mandatory. Every sentence that states something about the
> questions must carry at least one bracketed marker like `[3]` or `[2][7]`. A
> sentence with no marker is not allowed, because the student cannot check it.

Plus: never invent a question, year, mark value or topic; do not *answer* the
exam questions, describe what has been asked; if the rows don't support an
answer, say so.

**Failure modes.** Retrieval returning nothing means the reply says nothing —
that path is explicit (`no_match_reply`), not left to the model. A citation
marker with no matching row is treated as a grounding failure and shown plainly
rather than rendered as a link that goes nowhere. Rate limited to 10 requests
per minute per IP.

---

## 2. Genie (text-to-SQL)

`backend/app/genie.py`, `faculty/app/api/genie/route.ts` · Databricks Genie

Natural language becomes SQL against Unity Catalog tables, runs, and returns rows
with the query that produced them.

**This is the only agent whose reasoning is fully inspectable.** Both surfaces
expose a *show the SQL* toggle on every answer, which matters because the usual
text-to-SQL failure isn't a crash — it's answering a subtly different question
than the one asked. The SQL is the only way to see that.

Genie is asynchronous. The faculty client polls through every non-terminal state:

```
SUBMITTED · IN_PROGRESS · PENDING · FILTERING_CONTEXT
ASKING_AI · EXECUTING_QUERY · FETCHING_METADATA · PENDING_WAREHOUSE
```

Omitting states here is a real bug and was one: an early version waited on only
some of them, returned as soon as it saw `SUBMITTED`, and **echoed the user's own
question back as the answer.** It looked like a working reply.

**The catalog must match.** `DATABRICKS_CATALOG` in the faculty console has to
point at the same catalog the Genie space is configured against. When they
diverge, the ask panel answers about a different dataset than every other screen
— an app quietly disagreeing with itself, with nothing on screen to reveal it.

Degrades gracefully: with credentials absent, `available()` returns false and the
feature is hidden rather than erroring.

---

## 3. Paper generator

`faculty/app/api/generate/route.ts` · **no model**

Assembles a question paper. The governing rule:

> **SQL selects, the model only phrases.**

Every question on a generated paper is a row from `fact_question`, carrying its
`question_id`, source PDF and the year it was last asked. Selection is constraint
satisfaction, not generation:

1. **Structure** comes from a declared format where one exists (the CIE shape —
   Part A 1×5, Part B 3×5, Part C 3×10 answer 2 — is printed on the papers
   themselves), otherwise from the observed shape of past papers, **and the UI
   says which**.
2. **Exclusion** — anything in a repeat cluster asked within the last *N* years
   is out of the pool.
3. **CO coverage** — when required, each slot prefers a question carrying a CO
   not yet placed.
4. **Bloom mix** — slots target the requested distribution as far as the pool allows.
5. **No duplicate `repeat_cluster_id`** within one paper.
6. **Marks must total** the declared format exactly.

**When a constraint cannot be met it is printed on the paper, not dropped.** A
banner reading *"CO3 could not be placed"* or *"no 3-mark question exists in this
unit; used 4"* is more useful than a paper that looks complete and quietly isn't.
This is the whole reason the feature is defensible to an exam committee.

The single place a model is allowed: an **optional, off-by-default rephrase** of
one question for freshness, keeping the content identical, marked visibly as
edited with the original one click away.

**Known limit.** Where no declared blueprint exists, structure is averaged from
real papers, whose unit totals sum to 155 or 201 rather than 100 — so the paper
is scaled and reports the scaling. Declared formats (CIE) produce clean papers
with zero warnings; observed ones do not. The fix is parsing real blueprints out
of the syllabus PDFs.

---

## 4. Similarity check

`faculty/app/api/similar/route.ts` · **no model**

Answers the question a lecturer actually has while drafting: *has this been asked
before?* Ranked matches from nine years of papers, with the year and marks.

Scoring is **IDF-weighted term overlap computed in SQL**. Rare words carry the
signal — "virtualization" counts, "explain" barely does — so no stopword list has
to be guessed in advance.

Two simpler scorings were tried and both were wrong in ways that looked fine:

| Scoring | A verbatim repeat scored | Why it fails |
|---|---|---|
| Jaccard overlap | **18%** | diluted by every unshared word; a duplicate reads as "not similar" |
| Containment | **100%** — for an unrelated question | a short probe trivially fits inside a long one |
| **IDF-weighted** | 100% exact · 92% rephrased · 70% variant | rare terms dominate; correct drop-off |

Requires the Databricks backend (`array_intersect` / `array_union` have no SQLite
equivalent). On the local mirror it **returns an explicit "this needs Databricks"
error** rather than an empty result — "no similar questions found" that really
means "the feature didn't run" would let someone re-set a question asked five
times.

---

## 5. Telegram bot

`backend/app/telegram.py` · `POST /api/telegram/webhook`

The archive over Telegram, hitting a Databricks serving endpoint. Per-user
conversation history so context carries across messages.

**Sessions are in-memory** — correct for a single process, and the thing to
change first when this runs on more than one.

---

## 6. Voice

`backend/app/routers/voice.py` · `POST /api/voice/stt`, `POST /api/voice/tts`

- **STT** — `whisper-1`, browser audio → text, feeding the same chat pipeline
- **TTS** — ElevenLabs `eleven_multilingual_v2`, replies read aloud

**Neither reasons about content.** Voice is a transport for the grounded chat
agent, so it inherits that agent's citation guarantees rather than introducing a
path around them. Multilingual TTS matters for a college where the same lecture
happens in more than one language.

---

## The pattern worth keeping

The two agents doing the highest-stakes work — **assembling a real exam paper**
and **telling a lecturer whether a question is a repeat** — use no language model
at all. Both are SQL.

That is not conservatism. A generated paper has to be defended line by line to an
exam committee, and a similarity score has to be trustworthy enough to act on.
Neither tolerates a plausible answer, and both have a deterministic method
available. The model is used where it genuinely helps — turning messy human
phrasing into structured filters, and reading rows back as prose — and kept out
of the places where being confidently wrong is expensive.
