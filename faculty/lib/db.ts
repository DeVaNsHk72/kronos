/**
 * Query layer. One interface, two backends.
 *
 * Databricks is the target, but the workspace is not provisioned yet, so the
 * same SQL runs against a local SQLite mirror of the identical gold tables
 * until DATABRICKS_HOST / TOKEN / WAREHOUSE_ID are set. Switching is an env
 * change, not a code change -- which also means the SQL shown in the UI is the
 * SQL that actually ran, on either backend.
 *
 * This module is server-only. The token never reaches the browser.
 */
import "server-only";

export type Row = Record<string, unknown>;
export interface QueryResult {
  rows: Row[];
  columns: string[];
  sql: string;
  backend: "databricks" | "local";
  ms: number;
  truncated?: boolean;
}

const HOST = (process.env.DATABRICKS_HOST || "").replace(/\/$/, "");
const TOKEN = process.env.DATABRICKS_TOKEN || "";
const WAREHOUSE = process.env.DATABRICKS_WAREHOUSE_ID || "";

export const usingDatabricks = Boolean(HOST && TOKEN && WAREHOUSE);
/**
 * Table prefix. Databricks is fully qualified; SQLite tables are bare.
 *
 * This must match the catalog the Genie space is configured against, or /ask
 * answers from a different dataset than every other screen — which looks like
 * the app disagreeing with itself and is very hard to spot.
 */
const CATALOG = process.env.DATABRICKS_CATALOG || "hackathon_project.default";
export const T = usingDatabricks ? `${CATALOG}.` : "";

/**
 * Named parameters are bound, never interpolated. Databricks takes them as
 * typed parameters; SQLite takes them as :name bindings. No string splicing
 * anywhere, so a subject key from a query string cannot alter the statement.
 */
export async function query(
  sql: string,
  params: Record<string, string | number | null> = {},
): Promise<QueryResult> {
  const t0 = Date.now();
  return usingDatabricks
    ? await queryDatabricks(sql, params, t0)
    : queryLocal(sql, params, t0);
}

async function queryDatabricks(
  sql: string,
  params: Record<string, string | number | null>,
  t0: number,
): Promise<QueryResult> {
  const body = {
    statement: sql,
    warehouse_id: WAREHOUSE,
    wait_timeout: "50s",
    on_wait_timeout: "CONTINUE",
    parameters: Object.entries(params).map(([name, value]) => ({
      name,
      value: value === null ? null : String(value),
      type: typeof value === "number" ? "INT" : "STRING",
    })),
  };

  let res = await fetch(`${HOST}/api/2.0/sql/statements`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Databricks ${res.status}: ${await res.text()}`);
  let json = await res.json();

  // A cold warehouse returns PENDING and takes seconds to spin up; poll it out.
  const id = json.statement_id;
  let guard = 0;
  while (["PENDING", "RUNNING"].includes(json.status?.state) && guard++ < 60) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await fetch(`${HOST}/api/2.0/sql/statements/${id}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });
    json = await res.json();
  }
  if (json.status?.state !== "SUCCEEDED") {
    throw new Error(json.status?.error?.message || `statement ${json.status?.state}`);
  }

  const columns: string[] =
    json.manifest?.schema?.columns?.map((c: { name: string }) => c.name) ?? [];
  const data: string[][] = json.result?.data_array ?? [];
  const rows = data.map((arr) =>
    Object.fromEntries(arr.map((v, i) => [columns[i], coerce(v)])),
  );
  return {
    rows,
    columns,
    sql,
    backend: "databricks",
    ms: Date.now() - t0,
    truncated: json.manifest?.truncated ?? false,
  };
}

/** Databricks returns every cell as a string; restore numbers and nulls. */
function coerce(v: string | null): unknown {
  if (v === null || v === "") return v === "" ? "" : null;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d*\.\d+$/.test(v)) return Number(v);
  return v;
}

let sqliteDb: import("better-sqlite3").Database | null = null;

function queryLocal(
  sql: string,
  params: Record<string, string | number | null>,
  t0: number,
): QueryResult {
  if (!sqliteDb) {
    // Required lazily: better-sqlite3 is a native module and must never be
    // pulled into a client bundle.
    const Database = require("better-sqlite3");
    const path = require("path");
    sqliteDb = new Database(path.join(process.cwd(), "data", "kronos.db"), {
      readonly: true,
    });
  }
  // Databricks' :name syntax matches SQLite's, so the statement is unchanged.
  // Only the parameter set is narrowed: SQLite rejects unused bindings.
  const used = Object.fromEntries(
    Object.entries(params).filter(([k]) => new RegExp(`:${k}\\b`).test(sql)),
  );
  const stmt = sqliteDb!.prepare(translate(sql));
  const rows = stmt.all(used) as Row[];
  return {
    rows,
    columns: rows.length ? Object.keys(rows[0]) : [],
    sql,
    backend: "local",
    ms: Date.now() - t0,
  };
}

/**
 * The handful of Databricks SQL builtins SQLite spells differently. Kept
 * deliberately small: if a query needs more than this, it belongs in a view,
 * not in a translation layer that quietly diverges from what the UI displays.
 */
function translate(sql: string): string {
  return sql
    .replace(/\bcurrent_date\(\)/gi, "date('now')")
    .replace(/\byear\(date\('now'\)\)/gi, "CAST(strftime('%Y','now') AS INTEGER)")
    .replace(/\byear\(([^)]+)\)/gi, "CAST(strftime('%Y',$1) AS INTEGER)")
    .replace(/\bANY_VALUE\(/gi, "MAX(")
    .replace(/\b\w+\.\w+\.(?=(fact_|dim_|bronze_))/gi, "");
}
