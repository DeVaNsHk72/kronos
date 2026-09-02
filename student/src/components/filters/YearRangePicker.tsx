import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface YearRangePickerProps {
  years: number[];
  yearMin?: number;
  yearMax?: number;
  onChange: (patch: { year_min?: number; year_max?: number }) => void;
}

/** Two chained selects inside one popover — kept in one component because
 *  From/To are conceptually a single field. */
export function YearRangePicker({
  years,
  yearMin,
  yearMax,
  onChange,
}: YearRangePickerProps) {
  const [open, setOpen] = useState(false);
  const active = yearMin != null || yearMax != null;
  const label = active
    ? `${yearMin ?? "…"}–${yearMax ?? "…"}`
    : "Year";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-1.5 rounded-md bg-paper-2 font-normal",
            active && "border-ink/30",
          )}
        >
          <span className={cn(active && "text-ink-2")}>Year</span>
          {active && <span className="font-medium text-ink">{label}</span>}
          <CaretDown size={12} weight="regular" className="text-ink-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex items-center gap-2">
          {[
            ["from", yearMin, (n?: number) => onChange({ year_min: n })] as const,
            ["to", yearMax, (n?: number) => onChange({ year_max: n })] as const,
          ].map(([lbl, val, set]) => (
            <label key={lbl} className="flex-1">
              <span className="mb-1.5 block label-cap">{lbl}</span>
              <select
                value={val ?? ""}
                onChange={(e) =>
                  set(e.target.value ? Number(e.target.value) : undefined)
                }
                className="field w-full"
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
        {active && (
          <button
            onClick={() =>
              onChange({ year_min: undefined, year_max: undefined })
            }
            className="mt-2 text-xs text-mark hover:underline"
          >
            Clear years
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
