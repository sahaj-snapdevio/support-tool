"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { TicketCategory } from "@/lib/ticket-config";

interface Props {
  initialCategories: TicketCategory[];
}

type FormState = {
  label: string;
  color: string;
};

const EMPTY_FORM: FormState = { label: "", color: "slate" };

export function CategoriesManager({ initialCategories }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TicketCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TicketCategory | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setForm(EMPTY_FORM);
    setError(null);
    setAddOpen(true);
  }

  function openEdit(cat: TicketCategory) {
    setForm({ label: cat.label, color: cat.color });
    setError(null);
    setEditTarget(cat);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const isEdit = editTarget !== null;
      const url = isEdit
        ? `/api/admin/categories/${editTarget.id}`
        : "/api/admin/categories";
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
      const res = await fetch(`/api/admin/categories/${deleteTarget.id}`, {
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
          <h2 className="text-base font-semibold text-foreground">Categories</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Classify tickets by type for easier triage.</p>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md gap-1.5" onClick={openAdd}>
          <PlusIcon className="size-4" />
          Add Category
        </Button>
      </div>

      <div className="divide-y divide-border/60">
        {initialCategories.map((c) => (
          <div key={c.id} className="flex items-center gap-3 py-3">
            <span
              className={`size-4 rounded-full border shrink-0 ${COLOR_BADGE[c.color] ?? ""}`}
            />
            <span className="text-sm font-medium text-foreground flex-1">{c.label}</span>
            <span className="text-xs text-muted-foreground font-mono">{c.slug}</span>
            <div className="flex gap-2 ml-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-border text-foreground hover:bg-accent rounded-md"
                onClick={() => openEdit(c)}
              >
                <PencilSimpleIcon className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-red-200 text-red-600 hover:bg-red-50 rounded-md"
                onClick={() => { setError(null); setDeleteTarget(c); }}
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
              {editTarget ? "Edit Category" : "Add Category"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editTarget ? "Update the category label or color." : "Create a new ticket category."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Label</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Refund Request"
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
                  {form.label || "Category"}
                </span>
              </p>
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
              {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Category"}
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
              This category will be permanently removed. Categories in use by tickets cannot be deleted.
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
