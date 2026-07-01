"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlusIcon, PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr";
import { COLOR_BADGE, COLOR_OPTIONS } from "@/lib/tickets";
import type { TicketStatus } from "@/lib/ticket-config";

interface Props {
  initialStatuses: TicketStatus[];
}

type FormState = {
  label: string;
  color: string;
  isDefault: boolean;
  isClosedState: boolean;
};

const EMPTY_FORM: FormState = {
  label: "",
  color: "blue",
  isDefault: false,
  isClosedState: false,
};

export function StatusesManager({ initialStatuses }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TicketStatus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TicketStatus | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setForm(EMPTY_FORM);
    setError(null);
    setAddOpen(true);
  }

  function openEdit(status: TicketStatus) {
    setForm({
      label: status.label,
      color: status.color,
      isDefault: status.isDefault,
      isClosedState: status.isClosedState,
    });
    setError(null);
    setEditTarget(status);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const isEdit = editTarget !== null;
      const url = isEdit
        ? `/api/admin/statuses/${editTarget.id}`
        : "/api/admin/statuses";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save.");
        return;
      }
      setAddOpen(false);
      setEditTarget(null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/statuses/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to delete.");
        setDeleting(false);
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Statuses</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Define the lifecycle stages for tickets.</p>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md gap-1.5" onClick={openAdd}>
          <PlusIcon className="size-4" />
          Add Status
        </Button>
      </div>

      <div className="divide-y divide-border/60">
        {initialStatuses.map((s) => (
          <div key={s.id} className="flex items-center gap-3 py-3">
            {/* Color swatch */}
            <span
              className={`size-4 rounded-full border shrink-0 ${COLOR_BADGE[s.color] ?? ""}`}
            />
            <span className="text-sm font-medium text-foreground flex-1">{s.label}</span>
            <span className="text-xs text-muted-foreground font-mono">{s.slug}</span>
            {s.isDefault && (
              <span className="text-xs bg-primary/10 text-foreground border border-primary/20 rounded px-1.5 py-0.5 font-medium">
                Default
              </span>
            )}
            {s.isClosedState && (
              <span className="text-xs bg-stone/10 text-muted-foreground border border-stone/20 rounded px-1.5 py-0.5 font-medium">
                Closed
              </span>
            )}
            <div className="flex gap-2 ml-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-border text-foreground hover:bg-accent rounded-md"
                onClick={() => openEdit(s)}
              >
                <PencilSimpleIcon className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-red-200 text-red-600 hover:bg-red-50 rounded-md"
                onClick={() => { setError(null); setDeleteTarget(s); }}
              >
                <TrashIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog
        open={addOpen || editTarget !== null}
        onOpenChange={(open) => {
          if (!open) { setAddOpen(false); setEditTarget(null); }
        }}
      >
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editTarget ? "Edit Status" : "Add Status"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editTarget ? "Update the status label, color, or flags." : "Create a new ticket status."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Label</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Waiting for Customer"
                className="rounded-md"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`size-7 rounded-full border-2 transition-all ${COLOR_BADGE[c]} ${
                      form.color === c ? "ring-2 ring-offset-1 ring-ring" : "border-transparent"
                    }`}
                    title={c}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Preview:{" "}
                <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${COLOR_BADGE[form.color] ?? ""}`}>
                  {form.label || "Status"}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={form.isDefault}
                onCheckedChange={(v: boolean | "indeterminate") => setForm((f) => ({ ...f, isDefault: v === true }))}
              />
              <Label htmlFor="isDefault" className="text-sm text-foreground cursor-pointer">
                Set as default status for new tickets
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isClosedState"
                checked={form.isClosedState}
                onCheckedChange={(v: boolean | "indeterminate") => setForm((f) => ({ ...f, isClosedState: v === true }))}
              />
              <Label htmlFor="isClosedState" className="text-sm text-foreground cursor-pointer">
                This is a closed / resolved state
              </Label>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="flex-1 border-border text-foreground rounded-md"
              onClick={() => { setAddOpen(false); setEditTarget(null); }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
              onClick={handleSave}
              disabled={saving || !form.label.trim()}
            >
              {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-red-100">
              <TrashIcon className="size-5 text-red-600" />
            </div>
            <DialogTitle className="text-foreground text-center">
              Delete &ldquo;{deleteTarget?.label}&rdquo;?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-center">
              This status will be permanently removed. Tickets currently using it cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-red-600 text-center">{error}</p>}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="flex-1 border-border text-foreground rounded-md"
              onClick={() => { setDeleteTarget(null); setError(null); }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-md"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
