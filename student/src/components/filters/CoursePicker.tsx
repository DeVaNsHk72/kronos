import { useEffect, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
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
import { getCourses, type Course } from "@/api";
import { cn } from "@/lib/utils";

export interface CoursePickerProps {
  code?: string;
  name?: string;
  onPick: (course: Course | null) => void;
}

export function CoursePicker({ code, name, onPick }: CoursePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Course[]>([]);

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

  const active = !!code;

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
          <span className={cn(active && "text-ink-2")}>Course</span>
          {active && (
            <span className="max-w-[12rem] truncate font-mono text-xs font-medium text-ink">
              {code}
            </span>
          )}
          <CaretDown size={12} weight="regular" className="text-ink-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search code or name…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {active && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onPick(null);
                    setOpen(false);
                  }}
                  className="text-mark"
                >
                  Clear course{name ? ` — ${name}` : ""}
                </CommandItem>
              </CommandGroup>
            )}
            {query.trim().length < 2 ? (
              <CommandEmpty>Type at least two characters.</CommandEmpty>
            ) : options.length === 0 ? (
              <CommandEmpty>No matching course.</CommandEmpty>
            ) : (
              <CommandGroup>
                {options.map((c) => (
                  <CommandItem
                    key={`${c.course_code}-${c.course_name}`}
                    value={`${c.course_code} ${c.course_name}`}
                    onSelect={() => {
                      onPick(c);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="flex-col items-start gap-0.5"
                  >
                    <div className="flex w-full items-baseline gap-2">
                      <span className="font-mono text-xs text-ink">
                        {c.course_code}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-ink-2">
                        {c.question_count}
                      </span>
                    </div>
                    <div className="truncate text-sm text-ink-2">
                      {c.course_name}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
