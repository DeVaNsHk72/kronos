import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SemesterPickerProps {
  value?: number;
  counts?: Record<string, number>;
  onPick: (n: number | undefined) => void;
}

const SEMS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function SemesterPicker({ value, counts = {}, onPick }: SemesterPickerProps) {
  const [open, setOpen] = useState(false);
  const active = value != null;

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
          <span className={cn(active && "text-ink-2")}>Semester</span>
          {active && <span className="font-medium text-ink">{value}</span>}
          <CaretDown size={12} weight="regular" className="text-ink-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="grid grid-cols-4 gap-1.5">
          {SEMS.map((s) => {
            const on = value === s;
            const n = counts[String(s)] ?? 0;
            return (
              <button
                key={s}
                disabled={!n}
                onClick={() => {
                  onPick(on ? undefined : s);
                  setOpen(false);
                }}
                title={`${n.toLocaleString()} questions`}
                className={cn(
                  "rounded-md border py-2 text-sm transition-colors disabled:opacity-30",
                  on
                    ? "border-mark bg-mark text-paper"
                    : "border-line text-ink-2 hover:border-ink-2/50 hover:text-ink",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
