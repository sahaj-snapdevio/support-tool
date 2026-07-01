import { notFound } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tickets } from "@/db/schema";
import { getTicketStatuses, getTicketCategories } from "@/lib/ticket-config";
import { COLOR_BADGE, formatTicketDateTime } from "@/lib/tickets";
import { verifyEmailToken } from "@/lib/customer-access";
import { PRODUCT_NAME } from "@/config/platform";
import { CaretRightIcon, TicketIcon } from "@phosphor-icons/react/dist/ssr";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function MyTicketsListPage({ params }: Props) {
  const { token } = await params;

  const email = verifyEmailToken(token);
  if (!email) notFound();

  const [rows, statuses, categories] = await Promise.all([
    db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        subject: tickets.subject,
        status: tickets.status,
        category: tickets.category,
        customerToken: tickets.customerToken,
        createdAt: tickets.createdAt,
      })
      .from(tickets)
      .where(eq(tickets.customerEmail, email))
      .orderBy(desc(tickets.createdAt)),
    getTicketStatuses(),
    getTicketCategories(),
  ]);

  const statusMap = Object.fromEntries(statuses.map((s) => [s.slug, s]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c]));

  const openTickets = rows.filter(
    (t) => !(statusMap[t.status]?.isClosedState ?? false)
  );
  const closedTickets = rows.filter(
    (t) => statusMap[t.status]?.isClosedState ?? false
  );

  return (
    <div className="min-h-screen bg-public">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-sand sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="size-7 rounded-md bg-bark flex items-center justify-center">
              <TicketIcon className="size-4 text-cream" weight="fill" />
            </div>
            <span className="font-semibold text-bark text-sm">{PRODUCT_NAME}</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/submit" className="text-stone hover:text-bark transition-colors">
              Submit a Ticket
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-bark">Your tickets</h1>
          <p className="text-xs text-stone mt-1">
            {rows.length} ticket{rows.length !== 1 ? "s" : ""} for {email}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-sand shadow-soft flex flex-col items-center justify-center py-20 text-center">
            <TicketIcon className="size-10 text-sand mb-3" />
            <p className="text-base font-medium text-bark">No tickets found</p>
            <p className="text-sm text-stone mt-1">
              We couldn&apos;t find any tickets for this email.
            </p>
            <Link
              href="/submit"
              className="mt-4 inline-flex items-center rounded-md bg-bark px-4 py-2 text-sm font-medium text-cream hover:bg-bark/90 transition-colors"
            >
              Submit a ticket
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {openTickets.length > 0 && (
              <TicketGroup
                title="Open"
                tickets={openTickets}
                statusMap={statusMap}
                categoryMap={categoryMap}
              />
            )}
            {closedTickets.length > 0 && (
              <TicketGroup
                title="Closed"
                tickets={closedTickets}
                statusMap={statusMap}
                categoryMap={categoryMap}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

interface TicketRow {
  id: string;
  ticketNumber: number;
  subject: string;
  status: string;
  category: string;
  customerToken: string;
  createdAt: Date;
}

function TicketGroup({
  title,
  tickets: rows,
  statusMap,
  categoryMap,
}: {
  title: string;
  tickets: TicketRow[];
  statusMap: Record<string, { label: string; color: string } | undefined>;
  categoryMap: Record<string, { label: string } | undefined>;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-2xs font-medium text-stone uppercase tracking-wider px-1">
        {title}
      </h2>
      <div className="bg-white rounded-xl border border-sand shadow-soft overflow-hidden divide-y divide-sand">
        {rows.map((t) => (
          <Link
            key={t.id}
            href={`/ticket/${t.id}?token=${t.customerToken}`}
            className="flex items-center gap-4 px-5 py-4 hover:bg-cream/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-stone">#{t.ticketNumber}</span>
                <span className="text-stone text-xs">·</span>
                <span className="text-xs text-stone truncate">
                  {categoryMap[t.category]?.label ?? t.category}
                </span>
              </div>
              <p className="text-sm font-medium text-bark truncate">{t.subject}</p>
              <p className="text-xs text-stone mt-0.5">{formatTicketDateTime(t.createdAt)}</p>
            </div>
            <span
              className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium shrink-0 ${
                COLOR_BADGE[statusMap[t.status]?.color ?? "slate"] ?? ""
              }`}
            >
              {statusMap[t.status]?.label ?? t.status}
            </span>
            <CaretRightIcon className="size-4 text-stone shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
