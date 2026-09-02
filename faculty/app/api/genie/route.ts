import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HOST = (process.env.DATABRICKS_HOST || "").replace(/\/$/, "");
const TOKEN = process.env.DATABRICKS_TOKEN || "";
const SPACE = process.env.DATABRICKS_GENIE_SPACE_ID || "";

/**
 * Genie conversation. Follow-ups stay in one conversation so context carries;
 * the generated SQL is returned alongside the prose so the UI can show it.
 */
export async function POST(req: NextRequest) {
  if (!HOST || !TOKEN || !SPACE) {
    return NextResponse.json(
      { error: "Genie is not configured — DATABRICKS_GENIE_SPACE_ID is unset." },
      { status: 503 });
  }
  const { content, conversation_id } = await req.json();
  const h = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
  const base = `${HOST}/api/2.0/genie/spaces/${SPACE}`;

  try {
    const start = conversation_id
      ? await fetch(`${base}/conversations/${conversation_id}/messages`,
          { method: "POST", headers: h, body: JSON.stringify({ content }), cache: "no-store" })
      : await fetch(`${base}/start-conversation`,
          { method: "POST", headers: h, body: JSON.stringify({ content }), cache: "no-store" });
    if (!start.ok) throw new Error(`${start.status} ${await start.text()}`);
    const s = await start.json();
    const convId = s.conversation_id ?? s.conversation?.id ?? conversation_id;
    const msgId = s.message_id ?? s.id ?? s.message?.id;

    // Genie is asynchronous; poll the message until it settles.
    let msg: any = s.message ?? s;
    // Poll while the message is in any non-terminal state. Genie's first reply
    // is SUBMITTED; omitting it returned the echoed question as the "answer".
    const PENDING_STATES = [
      "SUBMITTED", "IN_PROGRESS", "PENDING", "FILTERING_CONTEXT",
      "ASKING_AI", "EXECUTING_QUERY", "FETCHING_METADATA", "QUERY_RESULT_EXPIRED", "PENDING_WAREHOUSE",
    ];
    for (let i = 0; i < 60 && PENDING_STATES.includes(msg.status); i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const p = await fetch(`${base}/conversations/${convId}/messages/${msgId}`,
        { headers: h, cache: "no-store" });
      msg = await p.json();
    }

    const texts: string[] = [];
    let sql: string | null = null;
    let rows: unknown[] = [];
    let columns: string[] = [];
    for (const a of msg.attachments ?? []) {
      if (a.text?.content) texts.push(a.text.content);
      if (a.query?.query) {
        sql = a.query.query;
        if (a.query.description) texts.push(a.query.description);
        // fetch the result set for this attachment
        const res = await fetch(
          `${base}/conversations/${convId}/messages/${msgId}/attachments/${a.attachment_id}/query-result`,
          { headers: h, cache: "no-store" });
        if (res.ok) {
          const rj = await res.json();
          columns = rj.statement_response?.manifest?.schema?.columns?.map((c: any) => c.name) ?? [];
          rows = (rj.statement_response?.result?.data_array ?? []).map((arr: string[]) =>
            Object.fromEntries(arr.map((v, i) => [columns[i], v])));
        }
      }
    }
    return NextResponse.json({
      conversation_id: convId,
      status: msg.status,
      answer: texts.join("\n\n") || msg.content || "(no answer returned)",
      sql, rows, columns,
      error: msg.error?.message ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
