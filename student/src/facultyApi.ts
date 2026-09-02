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
}

export const runQuery = (name: string, params: Record<string, unknown> = {}) =>
  http.post<QueryResult>("/api/faculty/query", { name, params }).then((r) => r.data);

export const facultyStatus = () =>
  http.get("/api/faculty/status").then((r) => r.data);

export const searchBank = (body: Record<string, unknown>) =>
  http.post<QueryResult>("/api/faculty/bank", body).then((r) => r.data);

export const checkSimilar = (subject_key: string, probe: string) =>
  http.post<QueryResult>("/api/faculty/similar", { subject_key, probe }).then((r) => r.data);

export const generatePaper = (body: Record<string, unknown>) =>
  http.post("/api/faculty/generate", body).then((r) => r.data);

export interface Subject {
  subject_key: string; subject_name: string; subject_code: string;
  semester: number; branch: string; questions: number;
}
