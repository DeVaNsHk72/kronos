import { NextRequest, NextResponse } from "next/server";
import { query, T } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Question bank. Filters are composed server-side from a fixed set of clauses
 * and always bound as parameters, so no user input reaches the statement text.
 */
export async function POST(req: NextRequest) {
  const b = await req.json();
  const where: string[] = ["subject_key = :subject_key"];
  const params: Record<string, string | number | null> = {
    subject_key: String(b.subject_key ?? ""),
  };

  const eq = (col: string, key: string, val: unknown, num = false) => {
    if (val === undefined || val === null || val === "" || val === "all") return;
    where.push(`${col} = :${key}`);
    params[key] = num ? Number(val) : String(val);
  };
  eq("unit_no", "unit_no", b.unit, true);
  eq("marks", "marks", b.marks, true);
  eq("course_outcome", "course_outcome", b.co, true);
  eq("bloom_level", "target_bloom", b.bloom);
  eq("exam_year", "cutoff_year", b.year, true);
  eq("sitting", "exam_type", b.sitting);

  if (b.q) {
    where.push("LOWER(question_text) LIKE :qtext");
    params.qtext = `%${String(b.q).toLowerCase()}%`;
  }

  const limit = Math.min(Number(b.limit) || 100, 500);
  const offset = Math.max(Number(b.offset) || 0, 0);
  const clause = where.join("\n  AND ");
  const sql = `
SELECT question_id, question_text, marks, unit_no, course_outcome, program_outcome,
       bloom_level, exam_year, exam_session, sitting, repeat_cluster_id,
       source_file, source_page, topic_id
FROM ${T}fact_question
WHERE ${clause}
ORDER BY exam_year DESC, unit_no, question_id
LIMIT ${limit} OFFSET ${offset}`;
  const countSql = `SELECT COUNT(*) AS n FROM ${T}fact_question WHERE ${clause}`;

  try {
    const [rows, count] = await Promise.all([query(sql, params), query(countSql, params)]);
    return NextResponse.json({ ...rows, total: Number(count.rows[0]?.n ?? 0), limit, offset });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
