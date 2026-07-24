"use client";

import { WarningCircleIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  userEmail: string;
  userId: string;
  userName: string;
}

export function PendingUserActions({ userId, userName, userEmail }: Props) {
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleResend() {
    setResending(true);
    try {
      const res = await fetch(`/api/users/${userId}/resend-invite`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Failed to resend invitation.");
        return;
      }
      toast.success(`Invitation resent to ${userEmail}.`);
    } catch {
      toast.error("Network error.");
    } finally {
      setResending(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Failed to cancel invitation.");
        return;
      }
      setCancelOpen(false);
      toast.success(`Invitation for ${userEmail} cancelled.`);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          className="h-7 px-2.5 text-xs border-border text-foreground hover:bg-accent"
          disabled={resending}
          onClick={handleResend}
          size="sm"
          variant="outline"
        >
          {resending ? "Sending…" : "Resend"}
        </Button>
        <Button
          className="h-7 px-2.5 text-xs border-red-200 text-red-600 hover:bg-red-50"
          onClick={() => setCancelOpen(true)}
          size="sm"
          variant="outline"
        >
          Cancel
        </Button>
      </div>

      <Dialog onOpenChange={setCancelOpen} open={cancelOpen}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-red-100">
              <WarningCircleIcon className="size-5 text-red-600" />
            </div>
            <DialogTitle className="text-foreground text-center">
              Cancel invitation?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-center">
              <strong className="text-foreground">{userName}</strong> (
              {userEmail}) will no longer be able to accept this invitation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              className="flex-1 border-border text-foreground rounded-md"
              disabled={cancelling}
              onClick={() => setCancelOpen(false)}
              variant="outline"
            >
              Keep
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-md"
              disabled={cancelling}
              onClick={handleCancel}
            >
              {cancelling ? "Cancelling…" : "Cancel Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
