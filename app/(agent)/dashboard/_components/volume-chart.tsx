"use client";

import { useState, useEffect, useCallback } from "react";

type Day = { date: string; count: number };

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function VolumeChart({ initialData }: { initialData: Day[] }) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const [data, setData] = useState<Day[]>(initialData);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(
    async (days: 7 | 30) => {
      if (days === 7) {
        setData(initialData);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/stats/volume?days=${days}`);
        const json = (await res.json()) as { days: Day[] };
        setData(json.days ?? []);
      } finally {
        setLoading(false);
      }
    },
    [initialData]
  );

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-card rounded-xl border border-border shadow-soft p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Ticket Volume</h2>
          <p className="text-xs text-muted-foreground mt-0.5">New tickets per day</p>
        </div>
        <div className="flex gap-1">
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === d
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/20"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className={`transition-opacity ${loading ? "opacity-40" : ""}`}>
        <div className="flex items-end gap-1 h-32">
          {data.map((d) => {
            const heightPct = Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0);
            return (
              <div
                key={d.date}
                className="group relative flex-1 flex flex-col items-center justify-end h-full"
              >
                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-10">
                  <div className="bg-primary text-primary-foreground text-xs rounded px-2 py-1 whitespace-nowrap">
                    {d.count} ticket{d.count !== 1 ? "s" : ""}
                  </div>
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-bark" />
                </div>
                <div
                  style={{ height: `${heightPct}%` }}
                  className="w-full bg-stone/40 hover:bg-stone rounded-t-sm transition-colors min-h-[2px]"
                />
              </div>
            );
          })}
        </div>

        {period === 7 && (
          <div className="flex gap-1 mt-1.5">
            {data.map((d) => {
              const day = new Date(d.date + "T00:00:00");
              return (
                <div key={d.date} className="flex-1 text-center text-[10px] text-muted-foreground">
                  {DAY_ABBR[day.getDay()]}
                </div>
              );
            })}
          </div>
        )}

        {period === 30 && (
          <div className="flex gap-1 mt-1.5">
            {data.map((d, i) => {
              const day = new Date(d.date + "T00:00:00");
              const show = i === 0 || i === data.length - 1 || (i + 1) % 6 === 0;
              return (
                <div key={d.date} className="flex-1 text-center text-[10px] text-muted-foreground overflow-hidden">
                  {show ? day.getDate() : ""}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
