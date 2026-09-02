import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowsDownUp,
  DownloadSimple as DownloadIcon,

  MagnifyingGlass as Search,
  X,
} from "@phosphor-icons/react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Checkbox } from "../components/ui/checkbox";
import {
  getCourses,
  getPapers,
  getStats,
  papersZipUrl,
  type Course,
  type Paper,
  type PapersResponse,
} from "../api";
import Popover from "../components/Popover";

function niceSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(bytes < 1024 * 1024 * 10 ? 1 : 0)} MB`;
}

const columns: ColumnDef<Paper>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label={`Select ${row.original.course_code} ${row.original.year}`}
      />
    ),
    enableSorting: false,
    size: 40,
  },
  {
    accessorKey: "course_code",
    header: "Code",
    cell: ({ row }) => (
      <span className="badge badge-code">{row.original.course_code}</span>
    ),
    size: 120,
  },
  {
    accessorKey: "course_name",
    header: "Course",
    cell: ({ row }) => (
      <span className="truncate text-sm" title={row.original.course_name}>
        {row.original.course_name}
      </span>
    ),
  },
  {
    accessorKey: "year",
    header: ({ column }) => (
      <button
        className="inline-flex items-center gap-1"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Year
        {column.getIsSorted() === "asc" ? (
          <ArrowUp size={12} />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown size={12} />
        ) : (
          <ArrowsDownUp size={12} className="text-ink-2" />
        )}
      </button>
    ),
    cell: ({ row }) => (
      <span className="badge">{row.original.year ?? "—"}</span>
    ),
    size: 80,
  },
  {
    accessorKey: "exam_type",
    header: "Exam",
    cell: ({ row }) => (
      <span className="badge">{row.original.exam_type}</span>
    ),
    size: 100,
  },
  {
    accessorKey: "num_pages",
    header: "Pages",
    cell: ({ row }) => (
      <span className="font-mono text-[11px] tabular-nums text-ink-2">
        {row.original.num_pages ? `${row.original.num_pages}p` : ""}
      </span>
    ),
    size: 60,
  },
  {
    accessorKey: "size_bytes",
    header: ({ column }) => (
      <button
        className="inline-flex items-center gap-1"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Size
        {column.getIsSorted() === "asc" ? (
          <ArrowUp size={12} />
        ) : column.getIsSorted() === "desc" ? (
          <ArrowDown size={12} />
        ) : (
          <ArrowsDownUp size={12} className="text-ink-2" />
        )}
      </button>
    ),
    cell: ({ row }) => (
      <span className="margin-rule mark text-[11px]">
        {niceSize(row.original.size_bytes)}
      </span>
    ),
    size: 80,
  },
  {
    id: "download",
    header: "",
    cell: ({ row }) => (
      <a
        href={row.original.download_url}
        className="text-blueprint transition-transform hover:underline active:scale-[0.9]"
        title="Download this paper"
      >
        <DownloadIcon size={14} />
      </a>
    ),
    size: 40,
  },
];

export default function Download() {
  const [params] = useSearchParams();
  const [picked, setPicked] = useState<Course[]>([]);
  const [yearMin, setYearMin] = useState<number | undefined>();
  const [yearMax, setYearMax] = useState<number | undefined>();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Course[]>([]);
  const [data, setData] = useState<PapersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [years, setYears] = useState<number[]>([]);
  const [examFilter, setExamFilter] = useState<Set<string>>(new Set());

  const [sorting, setSorting] = useState<SortingState>([
    { id: "year", desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const codes = useMemo(() => picked.map((c) => c.course_code), [picked]);

  useEffect(() => {
    getStats()
      .then((s) => {
        const [lo, hi] = s.year_range;
        setYears(Array.from({ length: hi - lo + 1 }, (_, i) => hi - i));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const codesParam = params.get("codes");
    if (!codesParam) return;
    const wanted = codesParam.split(",");
    Promise.all(wanted.map((code) => getCourses(code)))
      .then((lists) =>
        lists.flatMap((cs, i) =>
          cs.filter((c) => c.course_code === wanted[i]),
        ),
      )
      .then((cs) => cs.length && setPicked(cs))
      .catch(() => {});
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
    if (codes.length === 0) {
      setData(null);
      setRowSelection({});
      return;
    }
    setLoading(true);
    getPapers(codes, yearMin, yearMax)
      .then((res) => {
        setData(res);
        setRowSelection({});
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [codes, yearMin, yearMax]);

  const add = (c: Course) =>
    setPicked((p) =>
      p.some((x) => x.course_code === c.course_code) ? p : [...p, c],
    );

  const paperCountsByCourse = useMemo(() => {
    const m = new Map<string, number>();
    data?.papers.forEach((p) =>
      m.set(p.course_code, (m.get(p.course_code) ?? 0) + 1),
    );
    return m;
  }, [data]);

  const examTypes = useMemo(() => {
    if (!data) return [] as string[];
    const set = new Set<string>();
    data.papers.forEach((p) => p.exam_type && set.add(p.exam_type));
    const ORDER = ["Main", "Supplementary", "Makeup", "Reappear"];
    return [...set].sort((a, b) => {
      const ia = ORDER.indexOf(a);
      const ib = ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [data]);

  const visible = useMemo(() => {
    if (!data) return [] as Paper[];
    return examFilter.size
      ? data.papers.filter((p) => examFilter.has(p.exam_type))
      : data.papers;
  }, [data, examFilter]);

  const visibleTotalBytes = useMemo(
    () => visible.reduce((s, p) => s + p.size_bytes, 0),
    [visible],
  );

  const overLimit =
    !!data &&
    (visible.length > data.max_files || visibleTotalBytes > data.max_bytes);

  const table = useReactTable({
    data: visible,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.sha,
    enableRowSelection: true,
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedBytes = selectedRows.reduce(
    (s, r) => s + r.original.size_bytes,
    0,
  );
  const selectedShas = selectedRows.map((r) => r.original.sha);

  function toggleExam(t: string) {
    setExamFilter((s) => {
      const n = new Set(s);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  }

  return (
    <>
      <section className="grid-paper border-b border-line">
        <div className="page py-8">
          <h1 className="title-page">Download</h1>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Popover label="Add course" value={null} active={false} width="w-80">
              {(close) => (
                <div>
                  <div className="flex items-center gap-1.5 border-b border-line px-2 pb-2 pt-1">
                    <Search size={14} className="text-ink-2" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search code or name…"
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                  <ul className="mt-1 max-h-72 overflow-auto thin-scroll">
                    {options.map((c) => {
                      const on = codes.includes(c.course_code);
                      return (
                        <li key={`${c.course_code}-${c.course_name}`}>
                          <button
                            onClick={() => {
                              add(c);
                              setQuery("");
                              close();
                            }}
                            disabled={on}
                            className="block w-full rounded-sm px-2 py-1.5 text-left transition-transform hover:bg-paper active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
                          >
                            <span className="font-mono text-xs">
                              {c.course_code}
                            </span>
                            {on && (
                              <span className="ml-2 text-[10px] text-mark">
                                added
                              </span>
                            )}
                            <div className="truncate text-sm text-ink-2">
                              {c.course_name}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                    {query.trim().length < 2 && (
                      <li className="px-2 py-2 text-sm text-ink-2">
                        Type at least two characters.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </Popover>

            {[
              ["from", yearMin, setYearMin] as const,
              ["to", yearMax, setYearMax] as const,
            ].map(([lbl, val, set]) => (
              <label key={lbl} className="flex items-center gap-1.5 text-sm">
                <span className="serif-note">{lbl}</span>
                <select
                  value={val ?? ""}
                  onChange={(e) =>
                    set(e.target.value ? Number(e.target.value) : undefined)
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

          {picked.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {picked.map((c) => {
                const n = paperCountsByCourse.get(c.course_code);
                return (
                  <span key={c.course_code} className="pill">
                    <span className="font-mono text-[11px]">
                      {c.course_code}
                    </span>
                    <span className="max-w-40 truncate text-ink-2">
                      {c.course_name}
                    </span>
                    {n != null && (
                      <span className="font-mono text-[10px] text-ink-2">
                        {n} paper{n === 1 ? "" : "s"}
                      </span>
                    )}
                    <button
                      onClick={() =>
                        setPicked((p) =>
                          p.filter((x) => x.course_code !== c.course_code),
                        )
                      }
                      aria-label={`Remove ${c.course_code}`}
                      className="grid h-4 w-4 place-items-center rounded-sm text-ink-2 transition-colors hover:bg-line hover:text-mark"
                    >
                      <X size={11} weight="bold" />
                    </button>
                  </span>
                );
              })}
              <button
                onClick={() => setPicked([])}
                className="ml-1 text-xs text-mark hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </section>

      <main className="page py-6">
        {picked.length === 0 && (
          <div className="mx-auto max-w-2xl py-12 text-center">
            <div className="mx-auto icon-badge">
              <DownloadIcon size={20} weight="regular" />
            </div>
            <h2 className="title-page mt-5">Pick your courses</h2>
          </div>
        )}

        {picked.length > 0 && loading && !data && (
          <div className="py-20 text-center text-sm text-ink-2">Looking…</div>
        )}

        {data && data.count === 0 && (
          <div className="py-20 text-center text-sm text-ink-2">
            No papers for that selection. Try widening the years.
          </div>
        )}

        {data && data.count > 0 && (
          <div
            className={`transition-[opacity,filter] duration-200 ease-out ${
              loading ? "opacity-60 blur-[2px]" : "opacity-100 blur-0"
            }`}
          >
            {/* toolbar */}
            <div className="mb-3 flex flex-wrap items-center gap-3 border-b border-line pb-3">
              <p className="font-mono text-xs tabular-nums text-ink-2">
                <b className="text-ink">{visible.length}</b> paper
                {visible.length === 1 ? "" : "s"} ·{" "}
                {niceSize(visibleTotalBytes)}
                {examFilter.size > 0 && (
                  <span className="ml-1">(filtered from {data.count})</span>
                )}
              </p>

              {examTypes.length > 1 && (
                <div className="flex flex-wrap items-center gap-1">
                  {examTypes.map((t) => {
                    const on = examFilter.has(t);
                    return (
                      <button
                        key={t}
                        onClick={() => toggleExam(t)}
                        aria-pressed={on}
                        className={`rounded-sm border px-2.5 py-0.5 text-[11px] font-medium transition-[colors,transform] active:scale-[0.96] ${
                          on
                            ? "border-mark bg-mark text-paper"
                            : "border-line bg-paper-2 text-ink-2 hover:border-ink-2/50 hover:text-ink"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                {selectedRows.length > 0 ? (
                  <a
                    href={papersZipUrl(codes, yearMin, yearMax, selectedShas)}
                    className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-2 text-xs font-medium text-paper transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
                  >
                    <DownloadIcon size={14} />
                    Download selected ({selectedRows.length},{" "}
                    {niceSize(selectedBytes)})
                  </a>
                ) : overLimit ? (
                  <p className="text-xs text-mark">
                    Too large — limit is {data.max_files} papers /{" "}
                    {niceSize(data.max_bytes)}. Narrow years or select a subset.
                  </p>
                ) : (
                  <a
                    href={papersZipUrl(codes, yearMin, yearMax)}
                    className="inline-flex items-center gap-1.5 rounded-sm bg-mark px-3 py-2 text-xs font-medium text-paper transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
                  >
                    <DownloadIcon size={14} />
                    Download all ({niceSize(visibleTotalBytes)})
                  </a>
                )}
              </div>
            </div>

            {/* TanStack table */}
            <div className="rounded-sm border border-line">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow
                      key={hg.id}
                      className="border-line bg-paper-2 hover:bg-paper-2"
                    >
                      {hg.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          style={{ width: header.getSize() }}
                          className="text-[11px] font-medium text-ink-2"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className="border-line transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-sm text-ink-2"
                      >
                        No papers match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* sticky bottom bar when rows are selected */}
            {selectedRows.length > 0 && (
              <div className="sticky bottom-4 z-10 mt-4 flex items-center justify-between rounded-sm border border-line bg-paper-2/95 px-4 py-3 shadow-md backdrop-blur-sm">
                <p className="text-sm text-ink-2">
                  <b className="text-ink">{selectedRows.length}</b> selected ·{" "}
                  {niceSize(selectedBytes)}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRowSelection({})}
                    className="text-xs text-ink-2 hover:text-ink"
                  >
                    Clear
                  </button>
                  <a
                    href={papersZipUrl(codes, yearMin, yearMax, selectedShas)}
                    className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
                  >
                    <DownloadIcon size={14} />
                    Download {selectedRows.length} paper
                    {selectedRows.length === 1 ? "" : "s"}
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
