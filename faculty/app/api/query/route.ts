import { NextRequest, NextResponse } from "next/server";
import { query, usingDatabricks } from "@/lib/db";
import * as Q from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * The browser names a query; it never sends SQL. Anything else would let a
 * crafted request run arbitrary statements against the warehouse with the
 * server's own credentials.
 */
const REGISTRY: Record<string, string> = {
  subjects: Q.SUBJECTS,
  overview: Q.OVERVIEW,
  marksByUnit: Q.MARKS_BY_UNIT,
  unitDrift: Q.UNIT_DRIFT,
  bloom: Q.BLOOM,
  coverageGap: Q.COVERAGE_GAP,
  coAttainment: Q.CO_ATTAINMENT,
  poAttainment: Q.PO_ATTAINMENT,
  repetition: Q.REPETITION,
  blueprint: Q.BLUEPRINT,
  observedShape: Q.OBSERVED_SHAPE,
  markSlots: Q.MARK_SLOTS,
  distinctCos: Q.DISTINCT_COS,
  topicDetail: Q.TOPIC_DETAIL,
  neverAsked: Q.NEVER_ASKED,
  freshness: Q.FRESHNESS,
  bloomByUnit: Q.BLOOM_BY_UNIT,
};

const ALLOWED_PARAMS = new Set([
  "subject_key", "exam_type", "unit_no", "marks", "target_bloom", "cutoff_year",
  "topic_id", "probe",
]);

export async function POST(req: NextRequest) {
  try {
    const { name, params = {} } = await req.json();
    const sql = REGISTRY[name];
    if (!sql) {
      return NextResponse.json({ error: `unknown query "${name}"` }, { status: 400 });
    }
    const clean: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(params)) {
      if (ALLOWED_PARAMS.has(k)) clean[k] = v as string | number | null;
    }
    const result = await query(sql, clean);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: message, backend: usingDatabricks ? "databricks" : "local" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    backend: usingDatabricks ? "databricks" : "local",
    queries: Object.keys(REGISTRY),
  });
}
