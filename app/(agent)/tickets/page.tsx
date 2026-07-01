import { Suspense } from "react";
import Link from "next/link";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { tickets } from "@/db/schema/tickets";
import { user } from "@/db/schema/auth";
import { COLOR_BADGE, formatTicketDate } from "@/lib/tickets";
import {
  getTicketStatuses,
  getTicketCategories,
  type TicketStatus,
  type TicketCategory,
} from "@/lib/ticket-config";
import { requireAgent } from "@/lib/authz";
import { TicketFilters } from "./_components/ticket-filters";
import { TicketIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "All Tickets" };

const PAGE_SIZE = 25;

/** First letters of the first two words, e.g. "Sahaj Tavethiya" → "ST". */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase();
}

type SearchParams = {
  q?: string;
  status?: string;
  category?: string;
  awaiting?: string;
  mine?: string;
  page?: string;
};

interface Props {
  searchParams: Promise<SearchParams>;
}

export default async function TicketsPage({ searchParams }: Props) {
  const params = await searchParams;

  const [session, statuses, categories] = await Promise.all([
    requireAgent(),
    getTicketStatuses(),
    getTicketCategories(),
  ]);

  return (
    <div className="p-6 space-y-5">
      <TicketFilters statuses={statuses} categories={categories} />

      {/* Re-suspends on every search/filter change (key = params), so the table
          skeleton shows while the new results load. */}
      <Suspense key={JSON.stringify(params)} fallback={<TicketsTableSkeleton />}>
        <TicketsResults
          params={params}
          agentId={session.id}
          statuses={statuses}
          categories={categories}
        />
      </Suspense>
    </div>
  );
}

async function TicketsResults({
  params,
  agentId,
  statuses,
  categories,
}: {
  params: SearchParams;
  agentId: string;
  statuses: TicketStatus[];
  categories: TicketCategory[];
}) {
  const statusMap = Object.fromEntries(statuses.map((s) => [s.slug, s]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c]));

  const page = Math.max(1, parseInt(params.page ?? "1") || 1);
  const search = params.q?.trim() ?? "";
  const statusFilter =
    params.status && params.status !== "all" ? params.status : null;
  const categoryFilter =
    params.category && params.category !== "all" ? params.category : null;
  const awaitingFilter = params.awaiting === "1";
  const mineFilter = params.mine === "1";

  // Build where conditions
  const conditions = [];
  if (search) {
    const numSearch = parseInt(search.replace("#", ""));
    const textConditions = [
      ilike(tickets.subject, `%${search}%`),
      ilike(tickets.customerName, `%${search}%`),
      ilike(tickets.customerEmail, `%${search}%`),
    ];
    if (!isNaN(numSearch)) textConditions.push(eq(tickets.ticketNumber, numSearch) as never);
    conditions.push(or(...textConditions));
  }
  if (statusFilter) conditions.push(eq(tickets.status, statusFilter));
  if (categoryFilter) conditions.push(eq(tickets.category, categoryFilter));
  if (awaitingFilter) conditions.push(eq(tickets.awaitingReply, true));
  if (mineFilter) conditions.push(eq(tickets.assignedAgentId, agentId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(tickets)
    .where(whereClause);

  const rows = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      status: tickets.status,
      category: tickets.category,
      customerName: tickets.customerName,
      assignedAgentId: tickets.assignedAgentId,
      assignedAgentName: user.name,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .leftJoin(user, eq(tickets.assignedAgentId, user.id))
    .where(whereClause)
    .orderBy(desc(tickets.updatedAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildPageUrl(p: number) {
    const qp = new URLSearchParams();
    if (search) qp.set("q", search);
    if (statusFilter) qp.set("status", statusFilter);
    if (categoryFilter) qp.set("category", categoryFilter);
    if (awaitingFilter) qp.set("awaiting", "1");
    if (mineFilter) qp.set("mine", "1");
    if (p > 1) qp.set("page", String(p));
    const qs = qp.toString();
    return `/tickets${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {total} ticket{total !== 1 ? "s" : ""}
        {search || statusFilter || categoryFilter ? " matching your filters" : ""}
      </p>

      {rows.length === 0 ? (
        <div className="bg-card rounded-xl border border-border shadow-soft flex flex-col items-center justify-center py-20 text-center">
          <TicketIcon className="size-10 text-muted-foreground mb-3" />
          <p className="text-base font-medium text-foreground">No tickets found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || statusFilter || categoryFilter
              ? "Try adjusting your filters."
              : "Customers can submit tickets at your support portal."}
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-accent/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-16">
                      #
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Subject
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-32 hidden sm:table-cell">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-36 hidden md:table-cell">
                      Category
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-40 hidden lg:table-cell">
                      Customer
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-24 hidden lg:table-cell">
                      Assigned
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-28 hidden xl:table-cell">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-accent/40 transition-colors group"
                    >
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        #{row.ticketNumber}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/tickets/${row.id}`}
                          className="font-medium text-foreground hover:underline line-clamp-1"
                        >
                          {row.subject}
                        </Link>
                        {/* Mobile: show status inline */}
                        <div className="flex gap-1.5 mt-1 sm:hidden">
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${COLOR_BADGE[statusMap[row.status]?.color ?? "slate"] ?? ""}`}
                          >
                            {statusMap[row.status]?.label ?? row.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium ${COLOR_BADGE[statusMap[row.status]?.color ?? "slate"] ?? ""}`}
                        >
                          {statusMap[row.status]?.label ?? row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium ${COLOR_BADGE[categoryMap[row.category]?.color ?? "slate"] ?? ""}`}
                        >
                          {categoryMap[row.category]?.label ?? row.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span
                          className="block max-w-36 truncate text-muted-foreground text-xs"
                          title={row.customerName}
                        >
                          {row.customerName}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {row.assignedAgentName ? (
                          <div
                            className="size-7 rounded-full bg-primary/10 border border-border flex items-center justify-center text-2xs font-semibold text-foreground"
                            title={row.assignedAgentName}
                          >
                            {getInitials(row.assignedAgentName)}
                          </div>
                        ) : (
                          <span
                            className="size-7 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground"
                            title="Unassigned"
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell whitespace-nowrap">
                        {formatTicketDate(row.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground text-xs">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="border-border text-foreground hover:bg-accent"
                  >
                    <Link href={buildPageUrl(page - 1)}>Previous</Link>
                  </Button>
                )}
                {page < totalPages && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="border-border text-foreground hover:bg-accent"
                  >
                    <Link href={buildPageUrl(page + 1)}>Next</Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TicketsTableSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-28" />
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-accent/50 px-4 py-3">
          <Skeleton className="h-3 w-24" />
        </div>
        {/* Rows */}
        <div className="divide-y divide-border/60">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-3 w-10 shrink-0" />
              <Skeleton className="h-4 flex-1 max-w-xs" />
              <Skeleton className="h-5 w-16 rounded-md shrink-0 hidden sm:block" />
              <Skeleton className="h-5 w-20 rounded-md shrink-0 hidden md:block" />
              <Skeleton className="size-7 rounded-full shrink-0 hidden lg:block" />
              <Skeleton className="h-3 w-16 shrink-0 hidden xl:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
