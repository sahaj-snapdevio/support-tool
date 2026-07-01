"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellIcon, TicketIcon } from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type NotifTab = "all" | "unread" | "read";
const TABS: NotifTab[] = ["all", "unread", "read"];

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  ticketId: string | null;
  ticketNumber: number | null;
  isRead: boolean;
  createdAt: string;
}

const POLL_INTERVAL_MS = 30_000;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotifTab>("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: Notification[]; unreadCount: number };
      setItems(data.items);
      setUnread(data.unreadCount);
    } catch {
      // ignore transient errors
    }
  }, []);

  // Initial load + lightweight polling for the unread badge.
  useEffect(() => {
    load();
    const t = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Refresh when the panel is opened.
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    await fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
  }

  async function openNotification(n: Notification) {
    setOpen(false);
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {});
    }
    if (n.ticketId) router.push(`/tickets/${n.ticketId}`);
  }

  const filtered =
    tab === "unread"
      ? items.filter((n) => !n.isRead)
      : tab === "read"
        ? items.filter((n) => n.isRead)
        : items;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <BellIcon className="size-5" weight={unread > 0 ? "fill" : "regular"} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-2xs font-semibold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border p-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                tab === t
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {t}
              {t === "unread" && unread > 0 ? ` (${unread})` : ""}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <BellIcon className="size-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {tab === "unread"
                ? "No unread notifications."
                : tab === "read"
                  ? "No read notifications."
                  : "No notifications yet."}
            </p>
          </div>
        ) : (
          <ul className="max-h-96 overflow-y-auto divide-y divide-border/60">
            {filtered.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-accent/50 transition-colors ${
                    n.isRead ? "" : "bg-accent/30"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <TicketIcon className="size-3.5 text-foreground" weight="fill" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-snug">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-2xs text-muted-foreground/70 mt-1">{relativeTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <span className="mt-1 size-2 rounded-full bg-red-500 shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
