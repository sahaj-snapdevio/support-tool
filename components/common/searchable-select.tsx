"use client";

import {
  CaretUpDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string;
}

interface Props {
  /**
   * Tighter trigger chrome (smaller padding/gap/caret) for dense contexts
   * like table cells, where the default caret + padding can crowd out the
   * selected value in a fixed-width column.
   */
  compact?: boolean;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  triggerClassName?: string;
  value: string;
}

/**
 * A searchable single-select (Popover + filterable list). Opens cleanly below
 * the trigger — unlike a native Radix Select, it never re-centers/scrolls to the
 * selected option. Keyboard: type to filter, ↑/↓ to move, Enter to pick, Esc to close.
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  searchPlaceholder = "Search…",
  triggerClassName,
  disabled = false,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter((o) => o.label.toLowerCase().includes(q))
      : options;
  }, [options, query]);

  const pick = (v: string) => {
    onValueChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setQuery("");
        }
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          className={cn(
            "flex h-10 items-center justify-between rounded-md border border-border bg-transparent text-sm text-foreground transition-colors hover:border-stone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
            compact ? "gap-1 px-2" : "gap-2 px-3",
            triggerClassName
          )}
          disabled={disabled}
          role="combobox"
          title={selected?.label}
          type="button"
        >
          <span
            className={cn("truncate", !selected && "text-muted-foreground")}
          >
            {selected?.label ?? placeholder}
          </span>
          <CaretUpDownIcon
            className={cn(
              "shrink-0 text-muted-foreground",
              compact ? "size-3" : "size-4"
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-48 p-0"
      >
        <div className="flex items-center gap-2 border-b border-border px-2.5">
          <MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" />
          {/* biome-ignore lint/a11y/noAutofocus: focus the search when the popover opens */}
          <input
            autoFocus
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const opt = filtered[active];
                if (opt) {
                  pick(opt.value);
                }
              }
            }}
            placeholder={searchPlaceholder}
            value={query}
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No results
            </p>
          ) : (
            filtered.map((o, i) => (
              <button
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors",
                  i === active ? "bg-accent" : "hover:bg-accent/60"
                )}
                key={o.value}
                onClick={() => pick(o.value)}
                onMouseEnter={() => setActive(i)}
                type="button"
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && (
                  <CheckIcon className="size-4 shrink-0 text-foreground" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
