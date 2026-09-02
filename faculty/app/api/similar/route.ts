import { NextRequest, NextResponse } from "next/server";
import { query, usingDatabricks } from "@/lib/db";
import * as Q from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Similarity uses Databricks array functions (array_intersect / array_union),
 * which SQLite has no equivalent for. Rather than silently returning nothing on
 * the local backend, say so — a "no similar questions" answer that really means
 * "this feature did not run" is exactly the kind of quiet wrong answer that
 * would let a lecturer re-set a question that has been asked five times.
 */
export async function POST(req: NextRequest) {
  if (!usingDatabricks) {
    return NextResponse.json(
      { error: "Similarity search needs the Databricks backend — the local mirror has no array functions." },
      { status: 503 });
  }
  const { subject_key, probe } = await req.json();
  if (!probe || String(probe).trim().length < 8) {
    return NextResponse.json({ error: "Type a bit more of the question first." }, { status: 400 });
  }
  try {
    const r = await query(Q.SIMILAR, { subject_key, probe: String(probe) });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
