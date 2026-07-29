import axios from "axios";

// Calls go through Vite's /api proxy to the FastAPI backend.
const http = axios.create({ baseURL: "" });

export interface QImage {
  filename: string;
  url: string;
}

export interface Question {
  id: number;
  sha: string;
  unit: number | null;
  qno: number | null;
  subpart: string | null;
  question_md: string;
  marks: number | null;
  co: number | null;
  po: number | null;
  course_code: string;
  course_name: string;
  program: string;
  semester: number | null;
  year: number | null;
  exam_type: string;
  branch: string;
  topic: string | null;
  subtopic: string | null;
  images: QImage[];
  download_url: string;
  score?: number;
}

export interface SearchResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: Question[];
}

export type Facets = Record<string, Record<string, number>> & { total: number };

export interface FilterState {
  q: string;
  mode: "keyword" | "semantic";
  branch?: string;
  program?: string;
  exam_type?: string;
  semester?: number;
  year_min?: number;
  year_max?: number;
  course_code?: string;
  course_name?: string; // display only, for the selected-course chip
  topic?: string;
  has_images?: boolean;
}

function params(f: FilterState, page: number, page_size: number) {
  const p: Record<string, string | number> = { page, page_size };
  if (f.branch) p.branch = f.branch;
  if (f.program) p.program = f.program;
  if (f.exam_type) p.exam_type = f.exam_type;
  if (f.semester) p.semester = f.semester;
  if (f.year_min) p.year_min = f.year_min;
  if (f.year_max) p.year_max = f.year_max;
  if (f.course_code) p.course_code = f.course_code;
  if (f.topic) p.topic = f.topic;
  if (f.has_images) p.has_images = "true";
  return p;
}

export interface Course {
  course_code: string;
  course_name: string;
  question_count: number;
}

export async function getCourses(q: string) {
  const { data } = await http.get<Course[]>("/api/courses", {
    params: { q, limit: 20 },
  });
  return data;
}

export interface TopicGroup {
  topic: string;
  count: number;
  subtopics: { subtopic: string; count: number }[];
}

export async function getTopics(course_code: string) {
  const { data } = await http.get<TopicGroup[]>("/api/topics", {
    params: { course_code },
  });
  return data;
}

export async function search(f: FilterState, page: number, page_size = 25) {
  const p = params(f, page, page_size);
  if (f.mode === "semantic") {
    const { data } = await http.get<SearchResponse>("/api/search/semantic", {
      params: { ...p, q: f.q },
    });
    return data;
  }
  const { data } = await http.get<SearchResponse>("/api/search", {
    params: { ...p, ...(f.q ? { q: f.q } : {}) },
  });
  return data;
}

export async function getFacets(f: FilterState) {
  const { data } = await http.get<Facets>("/api/facets", {
    params: params(f, 1, 1),
  });
  return data;
}

export interface ChatCitation {
  n: number;
  question_id: number;
  course_code: string;
  year: number | null;
  qno: number | null;
  download_url: string;
}

export interface ChatIntent {
  kind?: string;
  query?: string;
  course_code?: string | null;
  course_name?: string | null;
  branch?: string | null;
  exam_type?: string | null;
  semester?: number | null;
  unit?: number | null;
  year_min?: number | null;
  year_max?: number | null;
  has_images?: boolean | null;
  [k: string]: unknown;
}

export interface ChatResponse {
  intent: ChatIntent;
  answer: string | null;
  citations: ChatCitation[];
  results: Question[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function askChat(message: string, history?: ChatTurn[]) {
  const { data } = await http.post<ChatResponse>("/api/chat", {
    message,
    history: history?.slice(-4),
  });
  return data;
}

export interface TopicStat {
  topic: string;
  count: number;
  by_year: Record<string, number>;
  avg_marks: number | null;
  last_asked: number | null;
}

export interface RepeatStat {
  n: number;
  years: number[];
  marks: number | null;
  text: string;
}

export interface CourseStats {
  total: number;
  by_year: Record<string, number>;
  topics: TopicStat[];
  marks: Record<string, number>;
  repeats: RepeatStat[];
}

export async function getCourseStats(
  course_code: string,
  year_min?: number,
  year_max?: number,
) {
  const { data } = await http.get<CourseStats>("/api/stats/course", {
    params: { course_code, year_min, year_max },
  });
  return data;
}

export interface Paper {
  sha: string;
  course_code: string;
  course_name: string;
  year: number | null;
  exam_type: string;
  semester: number | null;
  branch: string;
  program: string;
  num_pages: number | null;
  filename: string;
  size_bytes: number;
  available: boolean;
  download_url: string;
}

export interface PapersResponse {
  count: number;
  total_bytes: number;
  max_files: number;
  max_bytes: number;
  papers: Paper[];
}

/** Repeated `course_code` params — axios's default array format would send
 *  `course_code[]=` which FastAPI does not bind to a list. */
function paperQuery(
  codes: string[],
  yearMin?: number,
  yearMax?: number,
  shas?: string[],
) {
  const p = new URLSearchParams();
  codes.forEach((c) => p.append("course_code", c));
  if (yearMin) p.set("year_min", String(yearMin));
  if (yearMax) p.set("year_max", String(yearMax));
  shas?.forEach((s) => p.append("sha", s));
  return p.toString();
}

export async function getPapers(
  codes: string[],
  yearMin?: number,
  yearMax?: number,
) {
  const { data } = await http.get<PapersResponse>(
    `/api/papers?${paperQuery(codes, yearMin, yearMax)}`,
  );
  return data;
}

/** Plain URL — the browser downloads it, no JS needed. Pass `shas` to zip
 *  only a specific subset of the papers the codes/years would match. */
export const papersZipUrl = (
  codes: string[],
  yearMin?: number,
  yearMax?: number,
  shas?: string[],
) => `/api/papers/zip?${paperQuery(codes, yearMin, yearMax, shas)}`;

export interface Stats {
  questions: number;
  papers: number;
  courses: number;
  branches: number;
  topics: number;
  year_range: [number, number];
}

export async function getStats() {
  const { data } = await http.get<Stats>("/api/stats");
  return data;
}
