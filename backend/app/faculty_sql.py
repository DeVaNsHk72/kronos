"""Every SQL statement the faculty console runs.

Two rules hold throughout:
  * `sitting = 'Main'` for anything representing a normal paper. Only half the
    corpus is Main; pooling re-exam sittings roughly doubles apparent repetition
    and distorts unit emphasis.
  * NULL marks are excluded, never coalesced to zero. 19% of questions state no
    marks; treating those as zero drags every average down while the row count
    still looks complete.
"""
from .databricks import CATALOG as C

SUBJECTS = f"""
SELECT s.subject_key, s.subject_name, s.subject_code, s.semester, s.branch,
       COUNT(q.question_id) AS questions
FROM {C}.dim_subject s
LEFT JOIN {C}.fact_question q ON q.subject_key = s.subject_key
GROUP BY s.subject_key, s.subject_name, s.subject_code, s.semester, s.branch
ORDER BY questions DESC"""

OVERVIEW = f"""
SELECT COUNT(*) AS total_questions,
       COUNT(DISTINCT exam_year) AS years_covered,
       COUNT(DISTINCT source_file) AS papers,
       SUM(CASE WHEN marks IS NOT NULL THEN 1 ELSE 0 END) AS with_marks,
       SUM(CASE WHEN topic_id IS NULL THEN 1 ELSE 0 END) AS unmapped,
       SUM(CASE WHEN course_outcome IS NOT NULL THEN 1 ELSE 0 END) AS with_co,
       MIN(exam_year) AS first_year, MAX(exam_year) AS last_year
FROM {C}.fact_question WHERE subject_key = :subject_key"""

MARKS_BY_UNIT = f"""
SELECT unit_no, SUM(marks) AS marks, COUNT(*) AS questions
FROM {C}.fact_question
WHERE subject_key = :subject_key AND sitting = 'Main'
  AND marks IS NOT NULL AND unit_no IS NOT NULL
GROUP BY unit_no ORDER BY unit_no"""

UNIT_DRIFT = f"""
SELECT exam_year, unit_no, SUM(marks) AS marks
FROM {C}.fact_question
WHERE subject_key = :subject_key AND sitting = 'Main'
  AND marks IS NOT NULL AND unit_no IS NOT NULL
GROUP BY exam_year, unit_no ORDER BY exam_year, unit_no"""

BLOOM = f"""
SELECT bloom_level, COUNT(*) AS questions, SUM(marks) AS marks
FROM {C}.fact_question
WHERE subject_key = :subject_key AND bloom_level IS NOT NULL
GROUP BY bloom_level ORDER BY questions DESC"""
COVERAGE_GAP = f"""
-- Note coverage is aggregated to one row per topic BEFORE the join. Joining
-- fact_note_coverage directly fans each question row out by its number of note
-- rows, which multiplied every mark total on this screen: "Storage as a
-- Service" read 1,190 marks from 175 questions when the truth is far lower and
-- it is not even in the top three.
WITH notes AS (
  SELECT topic_id, SUM(depth_score) AS notes_pages
  FROM {C}.fact_note_coverage GROUP BY topic_id
)
SELECT t.topic_name, t.unit_no, SUM(q.marks) AS marks_examined,
       COUNT(DISTINCT q.exam_year) AS years_appeared, COUNT(*) AS questions,
       COALESCE(MAX(n.notes_pages), 0) AS notes_pages
FROM {C}.fact_question q
JOIN {C}.dim_topic t ON t.topic_id = q.topic_id
LEFT JOIN notes n ON n.topic_id = t.topic_id
WHERE q.subject_key = :subject_key AND q.marks IS NOT NULL
GROUP BY t.topic_name, t.unit_no
ORDER BY marks_examined DESC"""

REPETITION = f"""
SELECT repeat_cluster_id, COUNT(*) AS times_asked,
       MIN(exam_year) AS first_asked, MAX(exam_year) AS last_asked,
       ANY_VALUE(question_text) AS example, ANY_VALUE(unit_no) AS unit_no
FROM {C}.fact_question
WHERE subject_key = :subject_key AND repeat_cluster_id IS NOT NULL
GROUP BY repeat_cluster_id HAVING COUNT(*) >= 3
ORDER BY times_asked DESC LIMIT 40"""

FRESHNESS = f"""
SELECT unit_no, MAX(exam_year) AS last_asked, COUNT(*) AS questions,
       SUM(marks) AS marks, COUNT(DISTINCT exam_year) AS years
FROM {C}.fact_question
WHERE subject_key = :subject_key AND sitting = 'Main' AND unit_no IS NOT NULL
GROUP BY unit_no ORDER BY unit_no"""

BLUEPRINT = f"""
SELECT unit_no, questions_asked, questions_to_answer, marks_per_question,
       unit_max_marks, basis
FROM {C}.dim_exam_pattern
WHERE subject_key = :subject_key AND exam_type = :exam_type ORDER BY unit_no"""

MARK_SLOTS = f"""
SELECT unit_no, marks, COUNT(*) AS n
FROM {C}.fact_question
WHERE subject_key = :subject_key AND sitting = 'Main'
  AND marks IS NOT NULL AND unit_no IS NOT NULL
GROUP BY unit_no, marks ORDER BY unit_no, marks"""
CANDIDATES = f"""
WITH recent_clusters AS (
  SELECT DISTINCT repeat_cluster_id FROM {C}.fact_question
  WHERE subject_key = :subject_key AND exam_year >= :cutoff_year
    AND repeat_cluster_id IS NOT NULL
)
SELECT q.question_id, q.question_text, q.marks, q.unit_no, q.course_outcome,
       q.program_outcome, q.bloom_level, q.exam_year, q.exam_session,
       q.source_file, q.source_page, q.repeat_cluster_id, q.topic_id
FROM {C}.fact_question q
WHERE q.subject_key = :subject_key AND q.unit_no = :unit_no
  AND q.marks = :marks AND q.sitting = 'Main' AND q.marks IS NOT NULL
  AND (q.repeat_cluster_id IS NULL
       OR q.repeat_cluster_id NOT IN (SELECT repeat_cluster_id FROM recent_clusters))
ORDER BY CASE WHEN q.bloom_level = :target_bloom THEN 0 ELSE 1 END, q.exam_year ASC
LIMIT 40"""

# Rare words carry the signal. Plain overlap scored a verbatim repeat at 0.18;
# containment scored an unrelated question at 100% because a short probe fits
# inside a long one. Weighting by how rare each word is in this subject fixes
# both, and needs no stopword list guessed in advance.
SIMILAR = f"""
WITH toks AS (
  SELECT question_id, explode(array_distinct(array_remove(
    split(regexp_replace(lower(question_text), '[^a-z0-9 ]', ' '), ' +'), ''))) AS w
  FROM {C}.fact_question WHERE subject_key = :subject_key
),
n AS (SELECT COUNT(DISTINCT question_id) AS total FROM toks),
df AS (SELECT w, COUNT(DISTINCT question_id) AS df FROM toks GROUP BY w),
idf AS (SELECT df.w, LOG(10, n.total / df.df) AS weight FROM df CROSS JOIN n),
probe AS (
  SELECT explode(array_distinct(array_remove(
    split(regexp_replace(lower(:probe), '[^a-z0-9 ]', ' '), ' +'), ''))) AS w
),
probe_w AS (
  SELECT p.w, COALESCE(i.weight, 1.0) AS weight
  FROM probe p LEFT JOIN idf i ON i.w = p.w WHERE LENGTH(p.w) > 2
),
probe_total AS (SELECT SUM(weight) AS tw FROM probe_w),
scored AS (
  SELECT t.question_id, SUM(pw.weight) AS matched, COUNT(*) AS shared_words,
         collect_set(t.w) AS shared_terms
  FROM toks t JOIN probe_w pw ON pw.w = t.w GROUP BY t.question_id
)
SELECT f.question_id, f.question_text, f.marks, f.unit_no, f.exam_year,
       f.exam_session, f.course_outcome, f.source_file, f.repeat_cluster_id,
       ROUND(s.matched / GREATEST(pt.tw, 0.0001), 3) AS similarity,
       s.shared_words,
       array_join(slice(sort_array(s.shared_terms), 1, 6), ', ') AS shared_terms
FROM scored s
JOIN {C}.fact_question f ON f.question_id = s.question_id
CROSS JOIN probe_total pt
WHERE f.subject_key = :subject_key AND s.shared_words >= 2
ORDER BY similarity DESC LIMIT 15"""




# What a paper could actually be built from: unused questions per unit and mark
# value, after removing everything asked recently. Answers "is this blueprint
# even satisfiable" before a lecturer discovers it slot by slot.
AVAILABILITY = f"""
WITH recent AS (
  SELECT DISTINCT repeat_cluster_id FROM {C}.fact_question
  WHERE subject_key = :subject_key AND exam_year >= :cutoff_year
    AND repeat_cluster_id IS NOT NULL
)
SELECT q.unit_no, q.marks,
       COUNT(*) AS total,
       SUM(CASE WHEN q.repeat_cluster_id IS NULL
                  OR q.repeat_cluster_id NOT IN (SELECT repeat_cluster_id FROM recent)
                THEN 1 ELSE 0 END) AS available,
       COUNT(DISTINCT q.course_outcome) AS distinct_cos
FROM {C}.fact_question q
WHERE q.subject_key = :subject_key AND q.sitting = 'Main'
  AND q.marks IS NOT NULL AND q.unit_no IS NOT NULL
GROUP BY q.unit_no, q.marks
ORDER BY q.unit_no, q.marks"""
# Questions a practice set can be built from. Short-answer questions make poor
# MCQ stems, so the floor on marks keeps only ones with enough substance to
# carry distractors.
PRACTICE_POOL = f"""
SELECT q.question_id, q.question_text, q.marks, q.unit_no, q.bloom_level,
       q.exam_year, q.source_file, q.topic_id, t.topic_name
FROM {C}.fact_question q
LEFT JOIN {C}.dim_topic t ON t.topic_id = q.topic_id
WHERE q.subject_key = :subject_key
  AND q.marks IS NOT NULL AND q.marks >= 4
  AND LENGTH(q.question_text) BETWEEN 40 AND 400
ORDER BY q.exam_year DESC
LIMIT 400"""


REGISTRY = {
    "subjects": SUBJECTS, "overview": OVERVIEW, "marksByUnit": MARKS_BY_UNIT,
    "unitDrift": UNIT_DRIFT, "bloom": BLOOM, "coverageGap": COVERAGE_GAP,
    "repetition": REPETITION, "freshness": FRESHNESS, "blueprint": BLUEPRINT,
    "markSlots": MARK_SLOTS,
    "availability": AVAILABILITY, "practicePool": PRACTICE_POOL,
}
ALLOWED_PARAMS = {"subject_key", "exam_type", "unit_no", "marks",
                  "target_bloom", "cutoff_year", "probe", "topic_id"}
