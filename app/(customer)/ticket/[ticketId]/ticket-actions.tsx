"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  ticketId: string;
  token: string;
  isClosed: boolean;
}

export function TicketActions({ ticketId, token, isClosed }: Props) {
  const router = useRouter();
  const [closeOpen, setCloseOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClose() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/close`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const msg = data.error ?? "Failed to close ticket.";
        setError(msg);
        toast.error(msg);
        return;
      }
      setCloseOpen(false);
      toast.success("Ticket closed.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReopen() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/reopen`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const msg = data.error ?? "Failed to reopen ticket.";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Ticket reopened.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!isClosed && (
        <Button
          variant="outline"
          size="sm"
          className="border-sand text-stone hover:text-bark hover:border-bark"
          onClick={() => setCloseOpen(true)}
          disabled={loading}
        >
          Close ticket
        </Button>
      )}

      {isClosed && (
        <Button
          variant="outline"
          size="sm"
          className="border-sand text-stone hover:text-bark hover:border-bark"
          onClick={handleReopen}
          disabled={loading}
        >
          {loading ? "Reopening…" : "Reopen ticket"}
        </Button>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-bark">Close this ticket?</DialogTitle>
            <DialogDescription className="text-stone">
              Are you sure you want to close this ticket? You can reopen it at
              any time if you need further assistance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-sand text-bark"
              onClick={() => setCloseOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="bg-bark hover:bg-bark/90 text-white"
              onClick={handleClose}
              disabled={loading}
            >
              {loading ? "Closing…" : "Close Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
