import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChartBar, MagnifyingGlass, Repeat } from "@phosphor-icons/react";
import NumberFlow from "@number-flow/react";
import {
  BarChart,
  BarSeries,
  Bar,
  Heatmap,
  HeatmapSeries,
  HeatmapCell,
  LinearXAxis,
  LinearXAxisTickSeries,
  LinearXAxisTickLabel,
  LinearYAxis,
  LinearYAxisTickSeries,
  LinearYAxisTickLabel,
  ChartTooltip,
} from "reaviz";
import {
  getCourseStats,
  getCourses,
  type Course,
  type CourseStats,
  type TopicStat,
} from "../api";
import Popover from "../components/Popover";

const RECENT_KEY = "kronos:recent-courses";
const RECENT_MAX = 6;

function loadRecent(): Course[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as Course[]) : [];
  } catch {
    return [];
  }
}
function saveRecent(c: Course) {
  try {
    const cur = loadRecent().filter((x) => x.course_code !== c.course_code);
    const next = [c, ...cur].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

function yearAxis(s: CourseStats) {
  return Object.keys(s.by_year)
    .map(Number)
    .sort((a, b) => a - b);
}

/* ── Inline year strip (compact, for the topic list) ─────────────────── */

function YearStrip({ t, years }: { t: TopicStat; years: number[] }) {
  const max = Math.max(...years.map((y) => t.by_year[String(y)] ?? 0), 1);
  return (
    <div className="flex gap-[3px]">
      {years.map((y) => {
        const n = t.by_year[String(y)] ?? 0;
        return (
          <span
            key={y}
            title={`${y}: ${n}`}
            className="h-4 w-2.5 rounded-[2px] border border-line/70"
            style={
              n
                ? {
                    background: `color-mix(in srgb, var(--color-blueprint) ${
                      30 + (n / max) * 70
                    }%, transparent)`,
                    borderColor: "transparent",
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

/* ── Panel wrapper ────────────────────────────────────────────────────── */

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4">
      <h2 className="title-section">{title}</h2>
      {hint && <p className="mb-3 mt-1 serif-note leading-snug">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function isStale(lastAsked: number | null, latestYear: number) {
  return lastAsked != null && latestYear - lastAsked >= 2;
}

/* ── reaviz theme tokens ──────────────────────────────────────────────── */

/* reaviz needs literal colours, so they are read off the live tokens once per
   theme rather than frozen into this file. The previous constants here were the
   single biggest reason the charts drifted away from the rest of the app. */
function readVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const INK = readVar("--k-ink", "#e9f2fb");
const INK2 = readVar("--k-ink-2", "#a3bcd4");
const BLUEPRINT = readVar("--k-mark", "#ff6b4a");

/* Magnitude is one hue stepped by lightness, validated for CVD separation and
   for contrast against this surface. The accent red stays out of it: on this
   sheet red means a mark, a citation, or a constraint that failed, and a
   heatmap wearing it would spend that meaning on every warm cell. */
const SEQ = [
  readVar("--k-seq-1", "#3a72a8"),
  readVar("--k-seq-2", "#5f95c6"),
  readVar("--k-seq-3", "#8ab3d9"),
  readVar("--k-seq-4", "#b2cfea"),
  readVar("--k-seq-5", "#dcebf9"),
];
const SEQ_EMPTY = readVar("--k-seq-empty", "#16354f");

const TICK_STYLE = { fill: INK2, fontSize: 10.5, fontFamily: "Martian Mono, ui-monospace, monospace" } as Record<string, unknown>;
const tickLabel = <LinearXAxisTickLabel {...TICK_STYLE} />;
const yTickLabel = <LinearYAxisTickLabel {...TICK_STYLE} />;

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function Stats() {
  const [params] = useSearchParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [yearMin, setYearMin] = useState<number | undefined>();
  const [yearMax, setYearMax] = useState<number | undefined>();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Course[]>([]);
  const [data, setData] = useState<CourseStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<Course[]>(loadRecent);
  const [view, setView] = useState<"list" | "heat">("list");

  useEffect(() => {
    const code = params.get("course");
    if (!code) return;
    getCourses(code)
      .then((cs) => cs.find((c) => c.course_code === code))
      .then((c) => c && pick(c));
    const lo = params.get("year_min");
    const hi = params.get("year_max");
    if (lo) setYearMin(Number(lo));
    if (hi) setYearMax(Number(hi));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return setOptions([]);
    const t = setTimeout(
      () =>
        getCourses(query.trim())
          .then(setOptions)
          .catch(() => setOptions([])),
      250,
    );
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!course) return setData(null);
    setLoading(true);
    getCourseStats(course.course_code, yearMin, yearMax)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [course, yearMin, yearMax]);

  function pick(c: Course) {
    setCourse(c);
    setYearMin(undefined);
    setYearMax(undefined);
    saveRecent(c);
    setRecent(loadRecent());
  }

  const years = data ? yearAxis(data) : [];
  const latestYear = years[years.length - 1] ?? 0;
  const topicMax = data?.topics[0]?.count ?? 1;

  /* reaviz data shapes — memoised so charts don't re-animate on unrelated
     state changes (view toggle, popover open, etc.) */
  const yearBarData = useMemo(
    () =>
      years.map((y) => ({ key: String(y), data: data?.by_year[String(y)] ?? 0 })),
    [data, years],
  );

  const marksBarData = useMemo(
    () =>
      data
        ? Object.entries(data.marks).map(([k, v]) => ({
            key: `${k} mk`,
            data: v,
          }))
        : [],
    [data],
  );

  const heatData = useMemo(() => {
    if (!data) return [];
    return data.topics.map((t) => ({
      key: t.topic,
      data: years.map((y) => ({
        key: String(y),
        data: t.by_year[String(y)] ?? 0,
      })),
    }));
  }, [data, years]);

  return (
    <>
      <section className="grid-paper border-b border-line">
        <div className="page py-8">
          <h1 className="title-page">What to study</h1>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Popover
              label="Course"
              value={course?.course_code}
              active={!!course}
              width="w-80"
            >
              {(close) => (
                <div>
                  <div className="flex items-center gap-1.5 border-b border-line px-2 pb-2 pt-1">
                    <MagnifyingGlass
                      size={14}
                      className="text-ink-2"
                      weight="regular"
                    />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search code or name…"
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                  <ul className="mt-1 max-h-72 overflow-auto thin-scroll">
                    {options.map((c) => (
                      <li key={`${c.course_code}-${c.course_name}`}>
                        <button
                          onClick={() => {
                            pick(c);
                            setQuery("");
                            close();
                          }}
                          className="block w-full rounded-sm px-2 py-1.5 text-left transition-transform hover:bg-paper active:scale-[0.98]"
                        >
                          <span className="font-mono text-xs">
                            {c.course_code}
                          </span>
                          <span className="ml-2 font-mono text-[10px] text-ink-2">
                            {c.question_count}
                          </span>
                          <div className="truncate text-sm text-ink-2">
                            {c.course_name}
                          </div>
                        </button>
                      </li>
                    ))}
                    {query.trim().length < 2 && (
                      <li className="px-2 py-2 text-sm text-ink-2">
                        Type at least two characters.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </Popover>

            {course && years.length > 1 && (
              <div className="flex items-center gap-1.5 text-sm">
                {(
                  [
                    ["from", yearMin, setYearMin],
                    ["to", yearMax, setYearMax],
                  ] as const
                ).map(([lbl, val, set]) => (
                  <label key={lbl} className="flex items-center gap-1.5">
                    <span className="label-cap">{lbl}</span>
                    <select
                      value={val ?? ""}
                      onChange={(e) =>
                        set(
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      className="field"
                    >
                      <option value="">Any</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}

            {course && (
              <span className="text-sm text-ink-2">{course.course_name}</span>
            )}
          </div>
        </div>
      </section>

      <main className="page py-6">
        {!course && (
          <div className="mx-auto max-w-2xl py-12">
            <div className="flex flex-col items-center text-center">
              <div className="icon-badge">
                <ChartBar size={20} weight="regular" />
              </div>
              <h2 className="title-page mt-5">Pick a course</h2>
            </div>

            {recent.length > 0 && (
              <div className="mt-10">
                <p className="mb-3 text-center label-cap">Recently viewed</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {recent.map((c) => (
                    <button
                      key={c.course_code}
                      onClick={() => pick(c)}
                      className="flex items-baseline gap-2 rounded-sm border border-line bg-paper-2 px-3.5 py-2.5 text-left transition-[transform,border-color] duration-150 hover:border-ink/25 active:scale-[0.98]"
                    >
                      <span className="shrink-0 font-mono text-[11px] text-ink">
                        {c.course_code}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">
                        {c.course_name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-ink-2">
                        {c.question_count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {course && loading && !data && (
          <div className="py-20 text-center text-sm text-ink-2">Counting…</div>
        )}

        {course && data && data.total === 0 && (
          <div className="py-20 text-center text-sm text-ink-2">
            No questions for that course in this year range.
          </div>
        )}

        {course && data && data.total > 0 && (
          <div
            className={`transition-[opacity,filter] duration-200 ease-out ${
              loading ? "opacity-60 blur-[2px]" : "opacity-100 blur-0"
            }`}
          >
            <header className="mb-5 flex flex-wrap items-end gap-x-8 gap-y-3 border-b border-line pb-5">
              <div>
                <NumberFlow
                  value={data.total}
                  className="mono block text-[48px] font-medium leading-none text-ink sm:text-[56px]"
                />
                <p className="mt-2 label-cap">
                  questions · {years[0]}–{years[years.length - 1]}
                </p>
              </div>
              <div className="flex gap-x-8 pb-2 text-[14px] text-ink-2">
                <span>
                  <NumberFlow
                    value={data.topics.length}
                    className="font-medium text-ink"
                  />{" "}
                  topics
                </span>
                {data.repeats.length > 0 && (
                  <span>
                    <NumberFlow
                      value={data.repeats.length}
                      className="font-medium text-mark"
                    />{" "}
                    repeated verbatim
                  </span>
                )}
              </div>
            </header>

            {/* Topic analysis — switchable between list and reaviz heat map */}
            <Panel
              title="Topics by how often they are asked"
              hint={
                view === "heat"
                  ? "Each cell is one topic in one year."
                  : "Darker squares mean more questions that year."
              }
            >
              <div className="mb-3 flex gap-1">
                {(["list", "heat"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                      view === v
                        ? "bg-ink text-paper"
                        : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    {v === "list" ? "List" : "Heat map"}
                  </button>
                ))}
              </div>

              {view === "heat" && heatData.length > 0 ? (
                <div
                  className="overflow-x-auto thin-scroll"
                  style={{ minHeight: Math.max(200, heatData.length * 36 + 60) }}
                >
                  <Heatmap
                    height={Math.max(200, heatData.length * 36 + 60)}
                    width={Math.max(500, years.length * 70 + 200)}
                    data={heatData}
                    series={
                      <HeatmapSeries
                        colorScheme={SEQ}
                        emptyColor={SEQ_EMPTY}
                        cell={
                          <HeatmapCell
                            tooltip={
                              <ChartTooltip
                                content={(d: unknown) => {
                                  const val =
                                    (d as { data?: { value?: number } })?.data
                                      ?.value ?? 0;
                                  return (
                                    <div
                                      style={{
                                        fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif",
                                        fontSize: 12,
                                        padding: "4px 8px",
                                      }}
                                    >
                                      <strong>{val}</strong> questions
                                    </div>
                                  );
                                }}
                              />
                            }
                          />
                        }
                      />
                    }
                    yAxis={
                      <LinearYAxis
                        type="category"
                        tickSeries={
                          <LinearYAxisTickSeries
                            label={
                              <LinearYAxisTickLabel
                                {...({ style: { fill: INK, fontSize: 12, fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif" } } as Record<string, unknown>)}
                              />
                            }
                          />
                        }
                      />
                    }
                    xAxis={
                      <LinearXAxis
                        type="category"
                        tickSeries={
                          <LinearXAxisTickSeries label={tickLabel} />
                        }
                      />
                    }
                  />
                </div>
              ) : view === "list" ? (
                <div className="flex flex-col gap-1.5">
                  {data.topics.map((t) => {
                    const stale = isStale(t.last_asked, latestYear);
                    return (
                      <div
                        key={t.topic}
                        title={
                          t.last_asked
                            ? `Last asked in ${t.last_asked}`
                            : undefined
                        }
                        className={`flex items-center gap-3 rounded-sm px-1 py-1 transition-colors hover:bg-paper ${
                          stale ? "opacity-55" : ""
                        }`}
                      >
                        <span className="w-52 shrink-0 truncate serif text-[15px] sm:w-64">
                          {t.topic}
                        </span>
                        <div className="hidden h-3.5 flex-1 rounded-[2px] bg-line/40 sm:block">
                          <div
                            className="draw h-full rounded-[2px] bg-blueprint/60"
                            style={{
                              width: `${(t.count / topicMax) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums">
                          <NumberFlow value={t.count} />
                        </span>
                        <YearStrip t={t} years={years} />
                        <span className="hidden w-20 shrink-0 text-right serif-label text-[12px] text-ink-2 sm:block">
                          {t.last_asked
                            ? stale
                              ? `last, ${t.last_asked}`
                              : t.last_asked
                            : ""}
                        </span>
                        <span className="margin-rule mark w-14 shrink-0 pl-3 text-right text-[11px]">
                          {t.avg_marks != null ? `${t.avg_marks} mk` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </Panel>

            {/* reaviz bar charts */}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Panel
                title="Questions per year"
              >
                {yearBarData.length > 0 && (
                  <BarChart
                    width={550}
                    height={220}
                    data={yearBarData}
                    xAxis={
                      <LinearXAxis
                        type="category"
                        tickSeries={
                          <LinearXAxisTickSeries label={tickLabel} />
                        }
                      />
                    }
                    yAxis={
                      <LinearYAxis
                        type="value"
                        tickSeries={
                          <LinearYAxisTickSeries label={yTickLabel} />
                        }
                      />
                    }
                    series={
                      <BarSeries
                        colorScheme={[BLUEPRINT]}
                        animated
                        padding={0.3}
                        bar={
                          <Bar
                            tooltip={
                              <ChartTooltip
                                content={(d: unknown) => {
                                  const val =
                                    (d as { y?: number })?.y ?? 0;
                                  return (
                                    <div
                                      style={{
                                        fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif",
                                        fontSize: 12,
                                        padding: "4px 8px",
                                      }}
                                    >
                                      <strong>{val}</strong> questions
                                    </div>
                                  );
                                }}
                              />
                            }
                          />
                        }
                        tooltip={null}
                      />
                    }
                  />
                )}
              </Panel>

              <Panel
                title="Marks distribution"
              >
                {marksBarData.length > 0 ? (
                  <BarChart
                    width={550}
                    height={220}
                    data={marksBarData}
                    xAxis={
                      <LinearXAxis
                        type="category"
                        tickSeries={
                          <LinearXAxisTickSeries label={tickLabel} />
                        }
                      />
                    }
                    yAxis={
                      <LinearYAxis
                        type="value"
                        tickSeries={
                          <LinearYAxisTickSeries label={yTickLabel} />
                        }
                      />
                    }
                    series={
                      <BarSeries
                        colorScheme={[INK2]}
                        animated
                        padding={0.3}
                        bar={
                          <Bar
                            tooltip={
                              <ChartTooltip
                                content={(d: unknown) => {
                                  const val =
                                    (d as { y?: number })?.y ?? 0;
                                  return (
                                    <div
                                      style={{
                                        fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif",
                                        fontSize: 12,
                                        padding: "4px 8px",
                                      }}
                                    >
                                      <strong>{val}</strong> questions
                                    </div>
                                  );
                                }}
                              />
                            }
                          />
                        }
                        tooltip={null}
                      />
                    }
                  />
                ) : (
                  <p className="text-sm text-ink-2">No marks recorded.</p>
                )}
              </Panel>
            </div>

            {data.repeats.length > 0 && (
              <div className="mt-4">
                <Panel
                  title="Asked more than once, word for word"
                >
                  <ul className="flex flex-col gap-2">
                    {data.repeats.map((r) => (
                      <li
                        key={r.text.slice(0, 60) + r.years.join()}
                        className="flex gap-3 border-l border-line pl-3"
                      >
                        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-semibold text-mark">
                          <Repeat size={12} weight="regular" />×{r.n}
                        </span>
                        <div className="min-w-0">
                          <p className="serif text-[16px] leading-relaxed text-ink">
                            {r.text}
                          </p>
                          <p className="mt-1 serif-label text-[13px] text-ink-2">
                            {r.years.join(" · ")}
                            {r.marks != null && ` — ${r.marks} marks`}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
