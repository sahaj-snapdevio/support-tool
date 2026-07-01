import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { tickets, ticketComments, ticketAttachments, ticketActivity } from "@/db/schema";
import { storage } from "@/lib/storage";
import { ReplyForm } from "./reply-form";
import { TicketActions } from "./ticket-actions";
import { ChatCircleIcon, ClockIcon, TicketIcon } from "@phosphor-icons/react/dist/ssr";
import { getTicketStatuses, getTicketCategories } from "@/lib/ticket-config";
import { COLOR_BADGE } from "@/lib/tickets";
import { signEmailToken } from "@/lib/customer-access";
import { RichTextContent } from "@/components/common/rich-text-content";
import { TicketAttachments } from "@/components/common/ticket-attachments";
import { PRODUCT_NAME } from "@/config/platform";

interface Props {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ token?: string }>;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TicketDetailPage({ params, searchParams }: Props) {
  const { ticketId } = await params;
  const { token } = await searchParams;

  if (!token) notFound();

  // Validate ticket + token together
  const [ticket] = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.customerToken, token)))
    .limit(1);

  if (!ticket) notFound();

  const [statuses, categories] = await Promise.all([
    getTicketStatuses(),
    getTicketCategories(),
  ]);

  const statusMap = Object.fromEntries(statuses.map((s) => [s.slug, s]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c]));

  // The customer's other tickets (same email) so they can jump between them.
  // Holding a valid token for this ticket already proves access to this email's
  // tickets in our customer-access model, so exposing siblings here is safe.
  const siblingTickets = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      status: tickets.status,
      customerToken: tickets.customerToken,
    })
    .from(tickets)
    .where(eq(tickets.customerEmail, ticket.customerEmail))
    .orderBy(desc(tickets.createdAt));

  const openTickets = siblingTickets.filter(
    (t) => !(statusMap[t.status]?.isClosedState ?? false)
  );
  const hasOtherOpen = openTickets.some((t) => t.id !== ticket.id);

  // Fetch public comments (exclude internal notes)
  const comments = await db
    .select()
    .from(ticketComments)
    .where(
      and(
        eq(ticketComments.ticketId, ticketId),
        eq(ticketComments.isInternal, false)
      )
    )
    .orderBy(asc(ticketComments.createdAt));

  // Fetch all attachments for this ticket
  const attachments = await db
    .select()
    .from(ticketAttachments)
    .where(eq(ticketAttachments.ticketId, ticketId));

  // Ticket-level attachments (not linked to a comment)
  const ticketLevelAttachments = attachments.filter((a) => !a.commentId);

  // Map commentId → attachments
  const attachmentsByComment = new Map<string, typeof attachments>();
  for (const a of attachments) {
    if (a.commentId) {
      if (!attachmentsByComment.has(a.commentId)) {
        attachmentsByComment.set(a.commentId, []);
      }
      attachmentsByComment.get(a.commentId)!.push(a);
    }
  }

  // Simplified activity (status changes only — no internal note events)
  const activity = await db
    .select()
    .from(ticketActivity)
    .where(
      and(
        eq(ticketActivity.ticketId, ticketId),
      )
    )
    .orderBy(asc(ticketActivity.createdAt));

  const visibleActivity = activity.filter((a) =>
    ["status_changed", "ticket_closed", "ticket_reopened", "ticket_created"].includes(a.action)
  );

  const isOpen = !(statusMap[ticket.status]?.isClosedState ?? false);
  const totalAttachments = attachments.length;

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
            <Link href="/my-tickets" className="text-stone hover:text-bark transition-colors">
              My Tickets
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-6">
        {/* Sidebar: the customer's other open tickets */}
        {hasOtherOpen && (
          <aside className="lg:w-72 shrink-0 space-y-2 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <h2 className="text-2xs font-medium text-stone uppercase tracking-wider px-1">
              Your open tickets
            </h2>
            <div className="bg-white rounded-xl border border-sand shadow-soft overflow-hidden divide-y divide-sand">
              {openTickets.map((t) => {
                const active = t.id === ticket.id;
                return (
                  <Link
                    key={t.id}
                    href={`/ticket/${t.id}?token=${t.customerToken}`}
                    aria-current={active ? "page" : undefined}
                    className={`block px-4 py-3 transition-colors ${
                      active ? "bg-cream border-l-2 border-bark" : "hover:bg-cream/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-2xs font-medium text-stone">
                        #{t.ticketNumber}
                      </span>
                      <span
                        className={`ml-auto inline-flex items-center rounded-md border px-2 py-0.5 text-2xs font-medium ${
                          COLOR_BADGE[statusMap[t.status]?.color ?? "slate"] ?? ""
                        }`}
                      >
                        {statusMap[t.status]?.label ?? t.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-bark truncate">{t.subject}</p>
                  </Link>
                );
              })}
            </div>
            <Link
              href={`/my-tickets/${signEmailToken(ticket.customerEmail)}`}
              className="block text-xs text-stone hover:text-bark px-1 pt-1 transition-colors"
            >
              View all my tickets →
            </Link>
          </aside>
        )}

        <main className="flex-1 min-w-0 space-y-6">
        {/* Ticket header */}
        <div className="bg-white rounded-xl border border-sand shadow-soft p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-stone">
                  #{ticket.ticketNumber}
                </span>
                <span className="text-stone text-xs">·</span>
                <span className="text-xs text-stone">
                  {categoryMap[ticket.category]?.label ?? ticket.category}
                </span>
              </div>
              <h1 className="text-xl font-semibold text-bark leading-snug">
                {ticket.subject}
              </h1>
              <p className="text-xs text-stone mt-1">
                Submitted by {ticket.customerName} · {formatDate(ticket.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${COLOR_BADGE[statusMap[ticket.status]?.color ?? "slate"] ?? ""}`}
              >
                {statusMap[ticket.status]?.label ?? ticket.status}
              </span>
              <TicketActions
                ticketId={ticket.id}
                token={token}
                isClosed={!isOpen}
              />
            </div>
          </div>
        </div>

        {/* Original description */}
        <div className="bg-white rounded-xl border border-sand shadow-soft p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-7 rounded-full bg-bark text-cream flex items-center justify-center text-xs font-medium shrink-0">
              {ticket.customerName[0]?.toUpperCase()}
            </div>
            <div>
              <span className="text-sm font-medium text-bark">{ticket.customerName}</span>
              <span className="text-xs text-stone ml-2">You · {formatDate(ticket.createdAt)}</span>
            </div>
          </div>
          <p className="text-sm text-bark whitespace-pre-wrap leading-relaxed">
            {ticket.description}
          </p>

          {ticketLevelAttachments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-sand">
              <TicketAttachments
                items={ticketLevelAttachments.map((a) => ({
                  id: a.id,
                  url: storage.url(a.storageKey),
                  filename: a.filename,
                  mimeType: a.mimeType,
                  fileSize: a.fileSize,
                }))}
              />
            </div>
          )}
        </div>

        {/* Comments thread */}
        {comments.length > 0 && (
          <div className="space-y-4">
            {comments.map((comment) => {
              const isAgent = comment.authorRole === "agent" || comment.authorRole === "admin";
              const commentAttachments = attachmentsByComment.get(comment.id) ?? [];
              return (
                <div
                  key={comment.id}
                  className={`rounded-xl border p-5 ${
                    isAgent
                      ? "bg-white border-sand"
                      : "bg-cream border-sand"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className={`size-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                        isAgent
                          ? "bg-stone text-white"
                          : "bg-bark text-cream"
                      }`}
                    >
                      {isAgent ? "S" : comment.authorName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-bark">
                        {isAgent ? "Support Team" : comment.authorName}
                      </span>
                      <span className="text-xs text-stone ml-2">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                  </div>
                  <RichTextContent content={comment.content} />

                  {commentAttachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-sand">
                      <TicketAttachments
                        items={commentAttachments.map((a) => ({
                          id: a.id,
                          url: storage.url(a.storageKey),
                          filename: a.filename,
                          mimeType: a.mimeType,
                          fileSize: a.fileSize,
                        }))}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Activity timeline */}
        {visibleActivity.length > 1 && (
          <div className="bg-white rounded-xl border border-sand shadow-soft p-5">
            <h2 className="text-sm font-medium text-bark mb-3 flex items-center gap-1.5">
              <ClockIcon className="size-4 text-stone" />
              Activity
            </h2>
            <div className="space-y-2">
              {visibleActivity.map((a) => {
                let label = "";
                if (a.action === "ticket_created") label = "Ticket submitted";
                else if (a.action === "ticket_closed") label = "Ticket closed";
                else if (a.action === "ticket_reopened") label = "Ticket reopened";
                else if (a.action === "status_changed") {
                  const m = a.metadata as { from?: string; to?: string } | null;
                  label = `Status changed from ${statusMap[m?.from ?? ""]?.label ?? m?.from} to ${statusMap[m?.to ?? ""]?.label ?? m?.to}`;
                }
                if (!label) return null;
                return (
                  <div key={a.id} className="flex items-center gap-2 text-xs text-stone">
                    <span className="size-1.5 rounded-full bg-sand shrink-0" />
                    <span>{label}</span>
                    <span className="ml-auto shrink-0">{formatDate(a.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reply form or closed notice */}
        {isOpen ? (
          <ReplyForm
            ticketId={ticket.id}
            token={token}
            totalAttachments={totalAttachments}
          />
        ) : (
          <div className="bg-white rounded-xl border border-sand shadow-soft p-6 text-center">
            <ChatCircleIcon className="size-8 text-sand mx-auto mb-2" />
            <p className="text-sm text-stone">This ticket is closed.</p>
            <p className="text-xs text-stone mt-0.5">
              Reopen it above if you need further assistance.
            </p>
          </div>
        )}
        </main>
      </div>
    </div>
  );
}
