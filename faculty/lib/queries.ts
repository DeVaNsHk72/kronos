/**
 * Every SQL statement the console runs, in one place.
 *
 * Two rules hold throughout:
 *   - `sitting = 'Main'` for anything that represents a normal paper. Re-exam
 *     sittings are real data but they are not "what is normally asked", and
 *     pooling them inflates repetition and distorts unit emphasis.
 *   - NULL marks are excluded, never coalesced to zero. 8% of questions have no
 *     stated marks; treating those as zero-mark questions would understate
 *     every total while looking complete.
 */
import { T } from "./db";

export const SUBJECTS = `
SELECT s.subject_key, s.subject_name, s.subject_code, s.semester, s.branch,
       COUNT(q.question_id) AS questions
FROM ${T}dim_subject s
LEFT JOIN ${T}fact_question q ON q.subject_key = s.subject_key
GROUP BY s.subject_key, s.subject_name, s.subject_code, s.semester, s.branch
ORDER BY s.subject_name`;

/** Dashboard tiles. Coverage percentages are reported, not hidden. */
export const OVERVIEW = `
SELECT
  COUNT(*)                                              AS total_questions,
  COUNT(DISTINCT exam_year)                             AS years_covered,
  COUNT(DISTINCT source_file)                           AS papers,
  SUM(CASE WHEN marks IS NOT NULL THEN 1 ELSE 0 END)    AS with_marks,
  SUM(CASE WHEN topic_id IS NULL THEN 1 ELSE 0 END)     AS unmapped,
  SUM(CASE WHEN course_outcome IS NOT NULL THEN 1 ELSE 0 END) AS with_co,
  SUM(CASE WHEN unit_no IS NULL THEN 1 ELSE 0 END)      AS no_unit,
  MIN(exam_year) AS first_year, MAX(exam_year) AS last_year
FROM ${T}fact_question
WHERE subject_key = :subject_key`;

export const MARKS_BY_UNIT = `
SELECT unit_no, SUM(marks) AS marks, COUNT(*) AS questions
FROM ${T}fact_question
WHERE subject_key = :subject_key AND sitting = 'Main'
  AND marks IS NOT NULL AND unit_no IS NOT NULL
GROUP BY unit_no ORDER BY unit_no`;

/** Unit emphasis drift — reveals a unit quietly being dropped. */
export const UNIT_DRIFT = `
SELECT exam_year, unit_no, SUM(marks) AS marks
FROM ${T}fact_question
WHERE subject_key = :subject_key AND exam_type = 'SEE'
  AND sitting = 'Main' AND marks IS NOT NULL AND unit_no IS NOT NULL
GROUP BY exam_year, unit_no ORDER BY exam_year, unit_no`;

export const BLOOM = `
SELECT bloom_level, COUNT(*) AS questions, SUM(marks) AS marks
FROM ${T}fact_question
WHERE subject_key = :subject_key AND bloom_level IS NOT NULL
GROUP BY bloom_level`;

/** Examined heavily, taught thinly. The bottom-right of the scatter. */
export const COVERAGE_GAP = `
SELECT t.topic_name, t.unit_no,
       SUM(q.marks)                    AS marks_examined,
       COUNT(DISTINCT q.exam_year)     AS years_appeared,
       COUNT(*)                        AS questions,
       COALESCE(SUM(n.depth_score), 0) AS notes_pages
FROM ${T}fact_question q
JOIN ${T}dim_topic t ON t.topic_id = q.topic_id
LEFT JOIN ${T}fact_note_coverage n ON n.topic_id = t.topic_id
WHERE q.subject_key = :subject_key AND q.marks IS NOT NULL
GROUP BY t.topic_name, t.unit_no
ORDER BY marks_examined DESC`;

export const CO_ATTAINMENT = `
SELECT course_outcome,
       COUNT(*)   AS questions,
       SUM(marks) AS total_marks,
       ROUND(100.0 * SUM(marks) / SUM(SUM(marks)) OVER (), 1) AS pct_of_paper
FROM ${T}fact_question
WHERE subject_key = :subject_key AND exam_type = 'SEE'
  AND sitting = 'Main' AND course_outcome IS NOT NULL AND marks IS NOT NULL
GROUP BY course_outcome ORDER BY course_outcome`;

export const PO_ATTAINMENT = `
SELECT program_outcome,
       COUNT(*)   AS questions,
       SUM(marks) AS total_marks
FROM ${T}fact_question
WHERE subject_key = :subject_key AND exam_type = 'SEE'
  AND sitting = 'Main' AND program_outcome IS NOT NULL AND marks IS NOT NULL
GROUP BY program_outcome ORDER BY program_outcome`;

export const REPETITION = `
SELECT repeat_cluster_id, COUNT(*) AS times_asked,
       MIN(exam_year) AS first_asked, MAX(exam_year) AS last_asked,
       ANY_VALUE(question_text) AS example,
       ANY_VALUE(unit_no) AS unit_no
FROM ${T}fact_question
WHERE subject_key = :subject_key AND repeat_cluster_id IS NOT NULL
GROUP BY repeat_cluster_id
HAVING COUNT(*) >= 3
ORDER BY times_asked DESC`;

export const BLUEPRINT = `
SELECT unit_no, questions_asked, questions_to_answer,
       marks_per_question, unit_max_marks, basis
FROM ${T}dim_exam_pattern
WHERE subject_key = :subject_key AND exam_type = :exam_type
ORDER BY unit_no`;

/** Observed fallback when no blueprint row exists — the UI must say so. */
export const OBSERVED_SHAPE = `
SELECT unit_no,
       CAST(ROUND(AVG(qs)) AS INT)  AS questions_asked,
       CAST(ROUND(AVG(mk)) AS INT)  AS unit_max_marks
FROM (
  SELECT source_file, unit_no, COUNT(*) AS qs, SUM(marks) AS mk
  FROM ${T}fact_question
  WHERE subject_key = :subject_key AND sitting = 'Main'
    AND marks IS NOT NULL AND unit_no IS NOT NULL
  GROUP BY source_file, unit_no
) t
GROUP BY unit_no ORDER BY unit_no`;

/** Candidate pool for one blueprint slot. Selection is SQL; the model never picks. */
export const CANDIDATES = `
WITH recent_clusters AS (
  SELECT DISTINCT repeat_cluster_id
  FROM ${T}fact_question
  WHERE subject_key = :subject_key
    AND exam_year >= :cutoff_year
    AND repeat_cluster_id IS NOT NULL
)
SELECT q.question_id, q.question_text, q.marks, q.unit_no,
       q.course_outcome, q.program_outcome, q.bloom_level,
       q.exam_year, q.exam_session, q.source_file, q.source_page,
       q.repeat_cluster_id, q.topic_id
FROM ${T}fact_question q
WHERE q.subject_key = :subject_key
  AND q.unit_no     = :unit_no
  AND q.marks       = :marks
  AND q.exam_type   = 'SEE'
  AND q.sitting     = 'Main'
  AND q.marks IS NOT NULL
  AND (q.repeat_cluster_id IS NULL
       OR q.repeat_cluster_id NOT IN (SELECT repeat_cluster_id FROM recent_clusters))
ORDER BY
  CASE WHEN q.bloom_level = :target_bloom THEN 0 ELSE 1 END,
  q.exam_year ASC
LIMIT 40`;

/** Marks actually available per unit — the generator needs real slot sizes. */
export const MARK_SLOTS = `
SELECT unit_no, marks, COUNT(*) AS n
FROM ${T}fact_question
WHERE subject_key = :subject_key AND sitting = 'Main'
  AND exam_type = 'SEE' AND marks IS NOT NULL AND unit_no IS NOT NULL
GROUP BY unit_no, marks ORDER BY unit_no, marks`;

export const DISTINCT_COS = `
SELECT DISTINCT course_outcome FROM ${T}fact_question
WHERE subject_key = :subject_key AND course_outcome IS NOT NULL
ORDER BY course_outcome`;

/**
 * "Has this been asked before?" — the question a lecturer actually has when
 * drafting. Jaccard overlap on distinctive words, computed in SQL so it runs
 * on whichever backend is active. Stopwords are stripped because otherwise
 * every question matches every other on "explain", "the", "with".
 */
export const SIMILAR = `
-- Rare words carry the signal. Plain overlap scored a verbatim repeat at 0.18;
-- containment then scored an unrelated question at 100% because a short probe
-- trivially fits inside a long one. Both are fixed by weighting each shared
-- word by how rare it is in this subject: "virtualization" counts, "system"
-- barely does, and no stopword list has to be guessed at in advance.
WITH toks AS (
  SELECT question_id,
         explode(array_distinct(
           array_remove(split(regexp_replace(lower(question_text), '[^a-z0-9 ]', ' '), ' +'), '')
         )) AS w
  FROM ${T}fact_question WHERE subject_key = :subject_key
),
n AS (SELECT COUNT(DISTINCT question_id) AS total FROM toks),
df AS (
  SELECT w, COUNT(DISTINCT question_id) AS df FROM toks GROUP BY w
),
idf AS (
  SELECT df.w, LOG(10, n.total / df.df) AS weight FROM df CROSS JOIN n
),
probe AS (
  SELECT explode(array_distinct(
    array_remove(split(regexp_replace(lower(:probe), '[^a-z0-9 ]', ' '), ' +'), '')
  )) AS w
),
probe_w AS (
  SELECT p.w, COALESCE(i.weight, 1.0) AS weight
  FROM probe p LEFT JOIN idf i ON i.w = p.w
  WHERE LENGTH(p.w) > 2
),
probe_total AS (SELECT SUM(weight) AS tw FROM probe_w),
scored AS (
  SELECT t.question_id,
         SUM(pw.weight) AS matched,
         COUNT(*)       AS shared_words,
         collect_set(t.w) AS shared_terms
  FROM toks t
  JOIN probe_w pw ON pw.w = t.w
  GROUP BY t.question_id
)
SELECT f.question_id, f.question_text, f.marks, f.unit_no, f.exam_year,
       f.exam_session, f.course_outcome, f.source_file, f.repeat_cluster_id,
       ROUND(s.matched / GREATEST(pt.tw, 0.0001), 3) AS similarity,
       s.shared_words,
       array_join(slice(sort_array(s.shared_terms), 1, 6), ', ') AS shared_terms
FROM scored s
JOIN ${T}fact_question f ON f.question_id = s.question_id
CROSS JOIN probe_total pt
WHERE f.subject_key = :subject_key AND s.shared_words >= 2
ORDER BY similarity DESC
LIMIT 15`;

/** Every question for one topic — the drill-down behind any number. */
export const TOPIC_DETAIL = `
SELECT f.question_id, f.question_text, f.marks, f.unit_no, f.exam_year,
       f.exam_session, f.course_outcome, f.bloom_level, f.source_file,
       f.repeat_cluster_id
FROM ${T}fact_question f
WHERE f.subject_key = :subject_key AND f.topic_id = :topic_id
ORDER BY f.exam_year DESC, f.marks DESC`;

/** Topics in the syllabus that the exam has never touched. */
export const NEVER_ASKED = `
SELECT t.topic_id, t.topic_name, t.unit_no,
       COALESCE(SUM(n.depth_score), 0) AS notes_pages
FROM ${T}dim_topic t
LEFT JOIN ${T}fact_note_coverage n ON n.topic_id = t.topic_id
WHERE t.subject_key = :subject_key
  AND t.topic_id NOT IN (
    SELECT DISTINCT topic_id FROM ${T}fact_question
    WHERE subject_key = :subject_key AND topic_id IS NOT NULL)
GROUP BY t.topic_id, t.topic_name, t.unit_no
ORDER BY notes_pages DESC`;

/** Freshness: when each unit was last examined, and how heavily. */
export const FRESHNESS = `
SELECT unit_no,
       MAX(exam_year)  AS last_asked,
       COUNT(*)        AS questions,
       SUM(marks)      AS marks,
       COUNT(DISTINCT exam_year) AS years
FROM ${T}fact_question
WHERE subject_key = :subject_key AND sitting = 'Main' AND unit_no IS NOT NULL
GROUP BY unit_no ORDER BY unit_no`;

/** Bloom × unit, for spotting a unit that only ever gets recall questions. */
export const BLOOM_BY_UNIT = `
SELECT unit_no, bloom_level, COUNT(*) AS questions, SUM(marks) AS marks
FROM ${T}fact_question
WHERE subject_key = :subject_key AND sitting = 'Main'
  AND unit_no IS NOT NULL AND bloom_level IS NOT NULL
GROUP BY unit_no, bloom_level ORDER BY unit_no`;
