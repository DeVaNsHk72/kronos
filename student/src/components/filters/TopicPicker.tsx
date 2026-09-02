import { useEffect, useState } from "react";
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
import { getTopics, type TopicGroup } from "@/api";
import { cn } from "@/lib/utils";

/** Only meaningful once a course is picked. Renders nothing before that. */
export interface TopicPickerProps {
  courseCode?: string;
  value?: string;
  onPick: (topic: string | undefined) => void;
}

export function TopicPicker({ courseCode, value, onPick }: TopicPickerProps) {
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<TopicGroup[]>([]);

  useEffect(() => {
    if (!courseCode) return setTopics([]);
    getTopics(courseCode)
      .then(setTopics)
      .catch(() => setTopics([]));
  }, [courseCode]);

  if (!courseCode || topics.length === 0) return null;

  const active = !!value;

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
          <span className={cn(active && "text-ink-2")}>Topic</span>
          {active && (
            <span className="max-w-[10rem] truncate font-medium text-ink">
              {value}
            </span>
          )}
          <CaretDown size={12} weight="regular" className="text-ink-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search topic…" />
          <CommandList>
            <CommandEmpty>No topics.</CommandEmpty>
            <CommandGroup>
              {topics.map((t) => {
                const on = value === t.topic;
                return (
                  <CommandItem
                    key={t.topic}
                    value={t.topic}
                    onSelect={() => {
                      onPick(on ? undefined : t.topic);
                      setOpen(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Check
                      size={14}
                      weight="regular"
                      className={cn("shrink-0 text-mark", !on && "invisible")}
                    />
                    <span className="min-w-0 flex-1 truncate">{t.topic}</span>
                    <span className="font-mono text-[10px] tabular-nums text-ink-2">
                      {t.count.toLocaleString()}
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
