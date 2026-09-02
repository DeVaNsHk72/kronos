import axios from "axios";

/** All faculty calls go through the backend: a static SPA cannot hold the
 *  Databricks token, so the browser names a query and never sends SQL. */
const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || "" });

export interface QueryResult {
  rows: Record<string, any>[];
  columns: string[];
  sql: string;
  ms: number;
  total?: number;
  /** "genie" when the agent wrote the SQL, "sql-fallback" when it could not. */
  engine?: "genie" | "sql-fallback";
  fallback_reason?: string;
}

/** Analytical screens go through Genie: it writes the SQL, we show it.
 *  Falls back to the equivalent hand-written statement if Genie is unavailable,
 *  and the response says which path answered — a screen degrades to
 *  working-but-not-agentic rather than to blank. */
export const runQuery = (name: string, params: Record<string, unknown> = {}) => {
  const subject_key = params.subject_key as string | undefined;
  if (subject_key && GENIE_BACKED.has(name)) {
    return http
      .post<QueryResult>("/api/faculty/genie-query", { name, subject_key })
      .then((r) => r.data);
  }
  return http.post<QueryResult>("/api/faculty/query", { name, params }).then((r) => r.data);
};

/** Questions Genie answers well: aggregate analytics over one subject.
 *  Deliberately excluded — `subjects` (drives the picker, must be instant),
 *  `availability` and `markSlots` (feed the generator's own constraints, where
 *  a differently-phrased answer would silently change a paper). */
const GENIE_BACKED = new Set([
  "overview", "marksByUnit", "unitDrift", "freshness",
]);

export const askGenie = (question: string, conversation_id?: string) =>
  http.post("/api/faculty/ask", { question, conversation_id }).then((r) => r.data);

export const facultyStatus = () =>
  http.get("/api/faculty/status").then((r) => r.data);

export const searchBank = (body: Record<string, unknown>) =>
  http.post<QueryResult>("/api/faculty/bank", body).then((r) => r.data);

export const generatePaper = (body: Record<string, unknown>) =>
  http.post("/api/faculty/generate", body).then((r) => r.data);

export interface Subject {
  subject_key: string; subject_name: string; subject_code: string;
  semester: number; branch: string; questions: number;
}
