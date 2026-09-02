import { useState } from "react";
import { Check, CaretDown } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, fmt } from "@/lib/utils";

/** Popover + Command combobox for enum facets. Feeds it `[value, count]` pairs
 *  (from `/api/facets`) and the currently-selected value. Selecting the same
 *  value again clears it — no separate clear button. */
export interface FacetPickerProps {
  label: string;
  value?: string | number | null;
  options: [string, number][];
  numeric?: boolean;
  onPick: (v: string | number | undefined) => void;
  displayValue?: string;
  width?: string;
}

export function FacetPicker({
  label,
  value,
  options,
  numeric,
  onPick,
  displayValue,
  width = "w-72",
}: FacetPickerProps) {
  const [open, setOpen] = useState(false);
  const active = value != null && value !== "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-1.5 rounded-sm bg-paper-2 font-normal",
            active && "border-ink/30",
          )}
        >
          <span className={cn(active && "text-ink-2")}>{label}</span>
          {active && (
            <span className="max-w-[10rem] truncate font-medium text-ink">
              {displayValue ?? String(value)}
            </span>
          )}
          <CaretDown size={12} weight="regular" className="text-ink-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", width)} align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>Nothing here.</CommandEmpty>
            <CommandGroup>
              {options.map(([raw, count]) => {
                const v = numeric ? Number(raw) : raw;
                const on = value === v;
                return (
                  <CommandItem
                    key={raw}
                    value={raw}
                    onSelect={() => {
                      onPick(on ? undefined : v);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Check
                      size={14}
                      weight="regular"
                      className={cn("shrink-0 text-mark", !on && "invisible")}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {raw.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-ink-2">
                      {fmt(count)}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
