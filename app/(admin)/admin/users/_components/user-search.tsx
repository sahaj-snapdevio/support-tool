"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function UserSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      params.delete("page");
      router.push(`/admin/users?${params.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    // Skip when already in sync with the URL — otherwise each router.push()
    // produces a new searchParams (and new push callback), re-firing this
    // effect in an infinite navigation loop.
    const current = searchParams.get("q") ?? "";
    if (q === current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push(q), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, searchParams, push]);

  return (
    <div className="relative w-72">
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <Input
        autoComplete="off"
        className={cn("h-10 pl-9", q && "pr-9")}
        name="user-search"
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or email…"
        value={q}
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
