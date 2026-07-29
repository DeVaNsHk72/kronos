import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChartBar as ChartColumn,
  DownloadSimple as DownloadIcon,
  House,
  MagnifyingGlass as Search,
  Sparkle as Sparkles,
  TextT as TypeIcon,
  Image as ImageIcon,
  X,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import {
  search,
  getFacets,
  type FilterState,
  type SearchResponse,
  type Facets,
} from "@/api";
import QuestionCard from "@/components/QuestionCard";
import { CoursePicker } from "@/components/filters/CoursePicker";
import { FacetPicker } from "@/components/filters/FacetPicker";
import { TopicPicker } from "@/components/filters/TopicPicker";
import { SemesterPicker } from "@/components/filters/SemesterPicker";
import { YearRangePicker } from "@/components/filters/YearRangePicker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

const EMPTY: FilterState = { q: "", mode: "keyword" };
const PAGE_SIZE = 25;

const HERO_LINKS = [
  { to: "/ask", label: "Ask", icon: Sparkles },
  { to: "/stats", label: "Stats", icon: ChartColumn },
  { to: "/download", label: "Download", icon: DownloadIcon },
];

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Compact digit range around the current page for the paginator. */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

export default function Home() {
  const searchRef = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState<FilterState>(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQ = useDebounced(filter.q, 350);
  const effective = useMemo(
    () => ({ ...filter, q: debouncedQ }),
    [filter, debouncedQ],
  );

  const reqId = useRef(0);

  useEffect(() => {
    setPage(1);
  }, [
    effective.branch,
    effective.program,
    effective.exam_type,
    effective.semester,
    effective.year_min,
    effective.year_max,
    effective.course_code,
    effective.topic,
    effective.q,
    effective.mode,
  ]);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    Promise.all([search(effective, page, PAGE_SIZE), getFacets(effective)])
      .then(([res, fac]) => {
        if (id !== reqId.current) return;
        setData(res);
        setFacets(fac);
      })
      .catch((e) => {
        if (id !== reqId.current) return;
        setError(e?.message ?? "Something went wrong");
      })
      .finally(() => id === reqId.current && setLoading(false));
  }, [effective, page]);

  const patch = (p: Partial<FilterState>) => setFilter((f) => ({ ...f, ...p }));
  const semantic = filter.mode === "semantic";

  const years = Object.keys(facets?.year ?? {})
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <>
      {/* HERO — editorial right-aligned layout */}
      <section className="relative isolate min-h-screen overflow-hidden sm:min-h-[100svh]">
        <img
          src="/herosection.jpg"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover [filter:saturate(0.88)_brightness(0.75)]"
        />
        {/* directional gradient: heavier on the right where text sits */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#05070d]/20 via-[#05070d]/45 to-[#05070d]/80" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#05070d]/25 via-transparent to-[#05070d]/60" />

        <div className="relative flex min-h-screen flex-col justify-end px-5 pb-16 sm:min-h-[100svh] sm:px-10 lg:px-16">
          <div className="ml-auto w-full max-w-xl text-right">
            <p className="serif italic text-[14px] leading-relaxed text-white/60 sm:text-[16px]">
              Tired of going through hundreds of papers
              <br className="hidden sm:block" /> just to find what you want?
            </p>
            <h1 className="mt-4 serif-display text-[clamp(3rem,12vw,8rem)] leading-[0.9] text-white [text-shadow:0_4px_60px_rgba(5,7,13,0.6)]">
              Not any
              <br />
              more.
            </h1>
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/50 sm:text-[12px]">
              Ten years of BMSCE papers, question by question
            </p>

            <nav className="mt-10 flex flex-wrap items-center justify-end gap-3">
              <Button
                size="lg"
                onClick={() =>
                  searchRef.current?.scrollIntoView({ behavior: "smooth" })
                }
                className="h-11 gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-[#05070d] hover:bg-white/95"
              >
                <Search size={16} weight="regular" />
                Search the archive
              </Button>
              {HERO_LINKS.map(({ to, label, icon: Icon }) => (
                <Button
                  key={to}
                  asChild
                  size="sm"
                  variant="secondary"
                  className="h-11 gap-2 rounded-full border border-white/15 bg-white/10 px-5 text-[13px] font-medium text-white/90 backdrop-blur-md hover:border-white/25 hover:bg-white/18"
                >
                  <Link to={to}>
                    <Icon size={16} weight="regular" />
                    {label}
                  </Link>
                </Button>
              ))}
            </nav>
          </div>
        </div>
      </section>

      {/* SEARCH */}
      <section ref={searchRef} className="grid-paper">
        <div className="mx-auto max-w-2xl px-4 py-8 text-center sm:px-6 sm:py-10">
          <p className="serif italic text-[15px] text-ink-2">Search the archive.</p>

          <div className="relative mt-3">
            <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-ink-2">
              {semantic ? (
                <Sparkles size={17} />
              ) : (
                <Search size={17} weight="regular" />
              )}
            </span>
            <Input
              value={filter.q}
              onChange={(e) => patch({ q: e.target.value })}
              placeholder={
                semantic
                  ? "describe a concept — finding area under a curve"
                  : "laplace transform, breakpoint chlorination…"
              }
              className="h-12 rounded-full border-ink/15 bg-paper-2 pl-12 pr-12 text-[15px] shadow-none focus-visible:border-ink/30 focus-visible:ring-ink/10"
            />
            {filter.q && (
              <button
                onClick={() => patch({ q: "" })}
                aria-label="Clear search"
                className="absolute inset-y-0 right-4 grid place-items-center text-ink-2 hover:text-ink"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <Tabs
            value={filter.mode}
            onValueChange={(v) => patch({ mode: v as FilterState["mode"] })}
            className="mt-3 inline-flex"
          >
            <TabsList>
              <TabsTrigger value="keyword" className="gap-1.5">
                <TypeIcon size={13} weight="regular" /> Keyword
              </TabsTrigger>
              <TabsTrigger value="semantic" className="gap-1.5">
                <Sparkles size={13} weight="regular" /> Meaning
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {semantic && (
            <p className="mt-2 serif italic text-[12px] text-ink-2">
              ranks by concept, not exact words
            </p>
          )}
        </div>
      </section>

      {/* FILTER BAR (sticky) */}
      <div className="sticky top-[68px] z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <CoursePicker
            code={filter.course_code}
            name={filter.course_name}
            onPick={(c) =>
              patch({
                course_code: c?.course_code,
                course_name: c?.course_name,
                topic: undefined,
              })
            }
          />
          <TopicPicker
            courseCode={filter.course_code}
            value={filter.topic}
            onPick={(t) => patch({ topic: t })}
          />
          <FacetPicker
            label="Branch"
            value={filter.branch}
            options={Object.entries(facets?.branch ?? {})}
            displayValue={filter.branch?.replace(/_/g, " ")}
            onPick={(v) => patch({ branch: v as string | undefined })}
          />
          <SemesterPicker
            value={filter.semester}
            counts={facets?.semester as Record<string, number>}
            onPick={(v) => patch({ semester: v })}
          />
          <YearRangePicker
            years={years}
            yearMin={filter.year_min}
            yearMax={filter.year_max}
            onChange={patch}
          />
          <FacetPicker
            label="Exam"
            value={filter.exam_type}
            options={Object.entries(facets?.exam_type ?? {})}
            onPick={(v) => patch({ exam_type: v as string | undefined })}
          />
          <FacetPicker
            label="Programme"
            value={filter.program}
            options={Object.entries(facets?.program ?? {})}
            onPick={(v) => patch({ program: v as string | undefined })}
          />
          <Button
            variant={filter.has_images ? "default" : "outline"}
            size="sm"
            onClick={() =>
              patch({ has_images: filter.has_images ? undefined : true })
            }
            className="h-9 gap-1.5 rounded-md font-normal"
          >
            <ImageIcon size={14} weight="regular" />
            With figures
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        {/* Active-filter chips (was ActiveFilters.tsx) */}
        <ActiveFilterChips filter={filter} onChange={patch} />

        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <p className="font-mono text-xs tabular-nums text-ink-2">
            {loading && !data
              ? "searching…"
              : data
                ? `${data.total.toLocaleString()} question${
                    data.total === 1 ? "" : "s"
                  }`
                : ""}
          </p>
        </div>

        {error && (
          <div className="py-16 text-center text-sm text-mark">
            Couldn't reach the archive. {error}
          </div>
        )}

        {!error && data && data.results.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-sm text-ink-2">
              No questions match. Try fewer filters
              {!semantic && <> or switch to Meaning</>}.
            </p>
          </div>
        )}

        {!error && data && data.results.length > 0 && (
          <>
            <div
              className={cn(
                "mt-3 flex flex-col gap-2.5 transition-opacity",
                loading && "opacity-60",
              )}
            >
              {data.results.map((q) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  query={effective.mode === "keyword" ? effective.q : ""}
                />
              ))}
            </div>

            {data.total_pages > 1 && (
              <Pagination className="mt-6">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (data.page > 1) setPage(data.page - 1);
                      }}
                      aria-disabled={data.page <= 1}
                      className={cn(
                        data.page <= 1 && "pointer-events-none opacity-40",
                      )}
                    />
                  </PaginationItem>
                  {pageWindow(data.page, data.total_pages).map((p, i) => (
                    <PaginationItem key={`${p}-${i}`}>
                      {p === "…" ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href="#"
                          isActive={p === data.page}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p);
                          }}
                        >
                          {p}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (data.page < data.total_pages) setPage(data.page + 1);
                      }}
                      aria-disabled={data.page >= data.total_pages}
                      className={cn(
                        data.page >= data.total_pages &&
                          "pointer-events-none opacity-40",
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}

        {!data && !error && (
          <div className="py-20 text-center text-sm text-ink-2">Loading…</div>
        )}
      </main>
    </>
  );
}

/** Inline chips for every applied filter (was ActiveFilters.tsx). Click any
 *  chip's X to unset just that dimension; "Clear all" resets everything
 *  except the search query + mode. */
function ActiveFilterChips({
  filter,
  onChange,
}: {
  filter: FilterState;
  onChange: (p: Partial<FilterState>) => void;
}) {
  const chips: { label: string; unset: Partial<FilterState> }[] = [];
  if (filter.course_code)
    chips.push({
      label: filter.course_name ?? filter.course_code,
      unset: { course_code: undefined, course_name: undefined, topic: undefined },
    });
  if (filter.topic) chips.push({ label: filter.topic, unset: { topic: undefined } });
  if (filter.branch)
    chips.push({
      label: filter.branch.replace(/_/g, " "),
      unset: { branch: undefined },
    });
  if (filter.semester)
    chips.push({ label: `Sem ${filter.semester}`, unset: { semester: undefined } });
  if (filter.year_min || filter.year_max)
    chips.push({
      label: `${filter.year_min ?? "…"}–${filter.year_max ?? "…"}`,
      unset: { year_min: undefined, year_max: undefined },
    });
  if (filter.exam_type)
    chips.push({ label: filter.exam_type, unset: { exam_type: undefined } });
  if (filter.program)
    chips.push({ label: filter.program, unset: { program: undefined } });
  if (filter.has_images)
    chips.push({ label: "With figures", unset: { has_images: undefined } });

  if (chips.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <Badge
          key={c.label}
          variant="secondary"
          className="gap-1.5 rounded-full pl-2.5 pr-1 font-normal"
        >
          <span className="truncate">{c.label}</span>
          <button
            onClick={() => onChange(c.unset)}
            aria-label={`Remove ${c.label}`}
            className="grid h-4 w-4 place-items-center rounded-full text-ink-2 hover:bg-line hover:text-mark"
          >
            <X size={11} weight="bold" />
          </button>
        </Badge>
      ))}
      <button
        onClick={() =>
          onChange({
            course_code: undefined,
            course_name: undefined,
            topic: undefined,
            branch: undefined,
            program: undefined,
            exam_type: undefined,
            semester: undefined,
            year_min: undefined,
            year_max: undefined,
            has_images: undefined,
          })
        }
        className="ml-1 text-xs text-mark hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
