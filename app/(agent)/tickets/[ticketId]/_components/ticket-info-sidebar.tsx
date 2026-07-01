"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/common/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COLOR_BADGE, formatTicketDateTime } from "@/lib/tickets";
import type { TicketStatus, TicketCategory } from "@/lib/ticket-config";
import { ClockIcon, UserIcon, TrashIcon } from "@phosphor-icons/react";

type Agent = { id: string; name: string | null; email: string };

interface Activity {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  metadata: unknown;
  createdAt: Date;
}

interface Props {
  ticket: {
    id: string;
    ticketNumber: number;
    subject: string;
    status: string;
    category: string;
    customerName: string;
    customerEmail: string;
    assignedAgentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    closedAt: Date | null;
  };
  agents: Agent[];
  activity: Activity[];
  statuses: TicketStatus[];
  categories: TicketCategory[];
  currentUserId: string;
  isAdmin?: boolean;
}

export function TicketInfoSidebar({ ticket, agents, activity, statuses, categories, currentUserId, isAdmin = false }: Props) {
  const statusMap = Object.fromEntries(statuses.map((s) => [s.slug, s]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c]));
  const closedStatus = statuses.find((s) => s.isClosedState);
  const defaultStatus = statuses.find((s) => s.isDefault);

  const ACTION_LABELS: Record<string, (a: Activity) => string> = {
    ticket_created: () => "Ticket submitted",
    ticket_closed: () => "Ticket closed",
    ticket_reopened: () => "Ticket reopened",
    status_changed: (a) => {
      const m = a.metadata as { from?: string; to?: string } | null;
      return `Status: ${statusMap[m?.from ?? ""]?.label ?? m?.from} → ${statusMap[m?.to ?? ""]?.label ?? m?.to}`;
    },
    assigned: (a) => {
      const m = a.metadata as { agentName?: string } | null;
      return `Assigned to ${m?.agentName ?? "agent"}`;
    },
    unassigned: () => "Unassigned",
    comment_added: (a) => `${a.actorRole === "customer" ? "Customer" : "Agent"} replied`,
    internal_note_added: () => "Internal note added",
    attachment_added: () => "Attachment added",
  };
  const router = useRouter();

  const [status, setStatus] = useState(ticket.status);
  const [category, setCategory] = useState(ticket.category);
  const [assignedAgentId, setAssignedAgentId] = useState<string | null>(
    ticket.assignedAgentId
  );
  const [closeOpen, setCloseOpen] = useState(false);
  const [pendingClose, setPendingClose] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: object) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const msg = data.error ?? "Update failed.";
        setError(msg);
        toast.error(msg);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error.");
      toast.error("Network error.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    // Moving to a closed state needs confirmation (it notifies the customer).
    if (statusMap[newStatus]?.isClosedState) {
      setPendingClose(newStatus);
      setCloseOpen(true);
      return;
    }
    const ok = await patch({ status: newStatus });
    if (ok) {
      setStatus(newStatus);
      toast.success(`Status changed to ${statusMap[newStatus]?.label ?? newStatus}.`);
    }
  }

  async function handleConfirmClose() {
    const target = pendingClose ?? closedStatus?.slug;
    if (!target) { setCloseOpen(false); return; }
    const ok = await patch({ status: target });
    if (ok) {
      setStatus(target);
      setCloseOpen(false);
      setPendingClose(null);
      toast.success("Ticket closed. The customer has been notified.");
    }
  }

  async function handleCategoryChange(newCategory: string) {
    const ok = await patch({ category: newCategory });
    if (ok) {
      setCategory(newCategory);
      toast.success(`Category changed to ${categoryMap[newCategory]?.label ?? newCategory}.`);
    }
  }

  async function handleAssignChange(agentId: string) {
    const newId = agentId === "unassigned" ? null : agentId;
    const ok = await patch({ assignedAgentId: newId });
    if (ok) {
      setAssignedAgentId(newId);
      toast.success(newId ? "Ticket assigned." : "Ticket unassigned.");
    }
  }

  async function handleReopen() {
    const res = await fetch(`/api/tickets/${ticket.id}/reopen`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { status?: string } | null;
      setStatus(data?.status ?? defaultStatus?.slug ?? status);
      toast.success("Ticket reopened.");
      router.refresh();
    } else {
      toast.error("Failed to reopen ticket.");
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Ticket deleted.");
        router.push("/tickets");
      } else {
        toast.error("Failed to delete ticket.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <aside className="space-y-5">
      {/* Ticket Info */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-4 space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Ticket Info
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Number</span>
            <span className="text-xs font-mono font-medium text-foreground">
              #{ticket.ticketNumber}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Status</span>
            <SearchableSelect
              value={status}
              onValueChange={handleStatusChange}
              disabled={loading}
              triggerClassName={`h-8 w-full text-xs border ${COLOR_BADGE[statusMap[status]?.color ?? "slate"] ?? "border-border"}`}
              searchPlaceholder="Search status…"
              options={statuses.map((s) => ({ value: s.slug, label: s.label }))}
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Category</span>
            <SearchableSelect
              value={category}
              onValueChange={handleCategoryChange}
              disabled={loading}
              triggerClassName="h-8 w-full text-xs"
              searchPlaceholder="Search category…"
              options={categories.map((c) => ({
                value: c.slug,
                label: categoryMap[c.slug]?.label ?? c.label,
              }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Created</span>
            <span className="text-xs text-foreground">
              {formatTicketDateTime(ticket.createdAt)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Updated</span>
            <span className="text-xs text-foreground">
              {formatTicketDateTime(ticket.updatedAt)}
            </span>
          </div>
          {ticket.closedAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Closed</span>
              <span className="text-xs text-foreground">
                {formatTicketDateTime(ticket.closedAt)}
              </span>
            </div>
          )}
        </div>

        {statusMap[status]?.isClosedState ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-border text-foreground hover:bg-accent text-xs"
            onClick={handleReopen}
            disabled={loading}
          >
            Reopen Ticket
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-red-200 text-red-600 hover:bg-red-50 text-xs"
            onClick={() => { setPendingClose(null); setCloseOpen(true); }}
            disabled={loading}
          >
            Close Ticket
          </Button>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* Customer Info */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Customer
        </h3>
        <div className="flex items-start gap-2.5">
          <div className="size-7 rounded-full bg-accent border border-border flex items-center justify-center text-xs font-medium text-foreground shrink-0">
            {ticket.customerName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {ticket.customerName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{ticket.customerEmail}</p>
          </div>
        </div>
      </div>

      {/* Assigned Agent */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Assigned Agent
        </h3>
        <SearchableSelect
          value={assignedAgentId ?? "unassigned"}
          onValueChange={handleAssignChange}
          disabled={loading}
          triggerClassName="h-8 w-full text-xs"
          searchPlaceholder="Search agents…"
          options={[
            { value: "unassigned", label: "Unassigned" },
            ...agents.map((a) => ({ value: a.id, label: a.name ?? a.email })),
          ]}
        />
        {assignedAgentId !== currentUserId && (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-border text-foreground hover:bg-accent text-xs flex items-center gap-1.5"
            onClick={() => handleAssignChange(currentUserId)}
            disabled={loading}
          >
            <UserIcon className="size-3" />
            Assign to me
          </Button>
        )}
      </div>

      {/* Activity */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <ClockIcon className="size-3.5" />
          Activity
        </h3>
        <div className="space-y-3">
          {activity.map((a) => {
            const label = ACTION_LABELS[a.action]?.(a) ?? a.action;
            return (
              <div key={a.id} className="flex gap-2 text-xs">
                <span className="size-1.5 rounded-full bg-muted mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground">{label}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {a.actorName} · {formatTicketDateTime(a.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Admin: Delete Ticket */}
      {isAdmin && (
        <div className="bg-card rounded-xl border border-red-200 p-4">
          <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">
            Danger Zone
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="w-full border-red-200 text-red-600 hover:bg-red-50 text-xs flex items-center gap-1.5"
            onClick={() => setDeleteOpen(true)}
          >
            <TrashIcon className="size-3.5" />
            Delete Ticket
          </Button>
        </div>
      )}

      {/* Close confirmation dialog */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Close this ticket?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              The ticket will be marked as closed and the customer will be
              notified by email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-border text-foreground"
              onClick={() => setCloseOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleConfirmClose}
              disabled={loading}
            >
              {loading ? "Closing…" : "Close Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Ticket dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-red-100">
              <TrashIcon className="size-5 text-red-600" />
            </div>
            <DialogTitle className="text-foreground text-center">
              Delete ticket #{ticket.ticketNumber}?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-center">
              All comments and attachments will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="flex-1 border-border text-foreground"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
