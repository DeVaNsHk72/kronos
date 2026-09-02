"use client";
import { useState } from "react";
import { Banner, Skeleton } from "@/components/Bits";

type Turn = { q: string; a?: any; err?: string };

const SUGGESTIONS = [
  "Which topics in DBMS carry the most marks over the last five years?",
  "Which questions have been repeated most often in Data Structure?",
  "How are marks distributed across units in Object Oriented Programming?",
];

export default function Ask() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [conv, setConv] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSql, setShowSql] = useState<Record<number, boolean>>({});

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setInput(""); setBusy(true);
    const i = turns.length;
    setTurns((t) => [...t, { q: text }]);
    try {
      const r = await fetch("/api/genie", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, conversation_id: conv }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      if (j.conversation_id) setConv(j.conversation_id);
      setTurns((t) => t.map((x, k) => (k === i ? { ...x, a: j } : x)));
    } catch (e) {
      setTurns((t) => t.map((x, k) => (k === i ? { ...x, err: String(e) } : x)));
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="serif-display text-4xl text-ink">Ask the archive</h1>
        <p className="text-[13px] text-ink-2 mt-2">
          Answers come from Genie writing SQL against the same tables the rest of
          this console uses. The SQL is always one click away — if the question was
          understood differently than you meant, the query will show it.
        </p>
      </div>

      {turns.length === 0 && (
        <div className="flex flex-col gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)}
              className="text-left border rounded-lg bg-paper-2 px-4 py-2.5 text-[13.5px]
                         serif hover:border-ink-2 transition-colors">{s}</button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {turns.map((t, i) => (
          <div key={i} className="flex flex-col gap-2">
            <p className="serif text-[15px] text-ink border-l-2 border-mark pl-3">{t.q}</p>
            {t.err ? <Banner>{t.err}</Banner>
              : !t.a ? <Skeleton className="h-24" />
              : (
                <div className="border rounded-lg bg-paper-2 p-4">
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{t.a.answer}</p>
                  {t.a.rows?.length > 0 && (
                    <div className="mt-3 overflow-x-auto border rounded">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wider text-ink-2">
                            {t.a.columns.map((c: string) => <th key={c} className="px-3 py-1.5">{c}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {t.a.rows.slice(0, 20).map((r: any, k: number) => (
                            <tr key={k} className="border-t">
                              {t.a.columns.map((c: string) => (
                                <td key={c} className="px-3 py-1.5 mono">{String(r[c] ?? "—")}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {t.a.sql && (
                    <div className="mt-3">
                      <button onClick={() => setShowSql({ ...showSql, [i]: !showSql[i] })}
                        className="mono text-[10px] uppercase tracking-widest text-ink-2 hover:text-mark">
                        {showSql[i] ? "hide sql" : "show the sql"}
                      </button>
                      {showSql[i] && (
                        <pre className="mt-2 p-3 rounded border bg-paper text-[11px] mono
                                        text-ink-2 overflow-x-auto whitespace-pre">{t.a.sql}</pre>
                      )}
                    </div>
                  )}
                </div>
              )}
          </div>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 sticky bottom-4">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={conv ? "Ask a follow-up…" : "Ask anything about the archive…"}
          className="flex-1 border rounded-md bg-paper-2 px-3 py-2.5 text-[14px]" />
        <button type="submit" disabled={busy || !input.trim()}
          className="bg-mark text-paper rounded-md px-5 text-[14px] disabled:opacity-40">
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
