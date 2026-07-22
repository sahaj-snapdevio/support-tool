"use client";

import {
  CaretDownIcon,
  EyeIcon,
  ArrowCounterClockwiseIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmailTemplateType } from "@/lib/email-templates";
import { cn } from "@/lib/utils";

interface MergeTag {
  tag: string;
  description: string;
}

interface TemplateItem {
  type: EmailTemplateType;
  label: string;
  description: string;
  defaultSubject: string;
  mergeTags: MergeTag[];
  subject: string | null;
  body: string | null;
}

interface Props {
  initialTemplates: TemplateItem[];
}

export function EmailTemplatesManager({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [openType, setOpenType] = useState<EmailTemplateType | null>(null);

  return (
    <div className="space-y-3">
      {templates.map((item) => (
        <TemplateCard
          isOpen={openType === item.type}
          item={item}
          key={item.type}
          onToggle={() =>
            setOpenType((cur) => (cur === item.type ? null : item.type))
          }
          onUpdated={(updated) =>
            setTemplates((prev) =>
              prev.map((t) => (t.type === updated.type ? updated : t))
            )
          }
        />
      ))}
    </div>
  );
}

function TemplateCard({
  item,
  isOpen,
  onToggle,
  onUpdated,
}: {
  item: TemplateItem;
  isOpen: boolean;
  onToggle: () => void;
  onUpdated: (item: TemplateItem) => void;
}) {
  const isCustomized = item.body !== null;
  const [subject, setSubject] = useState(item.subject ?? item.defaultSubject);
  const [body, setBody] = useState(item.body ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${item.type}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = (await res.json()) as {
        error?: string;
        subject?: string | null;
        body?: string | null;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save.");
        return;
      }
      onUpdated({ ...item, subject: data.subject ?? null, body: data.body ?? null });
      toast.success(`"${item.label}" template saved.`);
    } catch {
      toast.error("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${item.type}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: null, body: null }),
      });
      if (!res.ok) {
        toast.error("Failed to reset.");
        return;
      }
      setSubject(item.defaultSubject);
      setBody("");
      onUpdated({ ...item, subject: null, body: null });
      toast.success(`"${item.label}" reset to default.`);
    } catch {
      toast.error("Network error.");
    } finally {
      setResetting(false);
    }
  }

  async function handlePreview() {
    if (!body || body.trim().length === 0) {
      toast.error("Write a body first to preview it.");
      return;
    }
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${item.type}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = (await res.json()) as { error?: string; html?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to render preview.");
        setPreviewOpen(false);
        return;
      }
      setPreviewHtml(data.html ?? null);
    } catch {
      toast.error("Network error.");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
      <button
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{item.label}</h3>
            {isCustomized && (
              <span className="inline-flex items-center rounded border border-border bg-accent px-1.5 py-0.5 text-2xs font-medium text-foreground">
                Customized
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        </div>
        <CaretDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="border-t border-border p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Subject
                </Label>
                <Input
                  className="rounded-md font-mono text-xs"
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={item.defaultSubject}
                  value={subject}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Body
                </Label>
                <RichTextEditor
                  onChange={setBody}
                  placeholder="Write this email's body… use merge tags like {{customerName}}."
                  value={body}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
                  disabled={saving || !body.trim()}
                  onClick={handleSave}
                  size="sm"
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button
                  className="border-border text-foreground hover:bg-accent rounded-md gap-1.5"
                  onClick={handlePreview}
                  size="sm"
                  variant="outline"
                >
                  <EyeIcon className="size-3.5" />
                  Preview
                </Button>
                {isCustomized && (
                  <Button
                    className="border-border text-foreground hover:bg-accent rounded-md gap-1.5 ml-auto"
                    disabled={resetting}
                    onClick={handleReset}
                    size="sm"
                    variant="outline"
                  >
                    <ArrowCounterClockwiseIcon className="size-3.5" />
                    {resetting ? "Resetting…" : "Reset to Default"}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Merge tags
              </Label>
              <div className="rounded-md border border-border divide-y divide-border/60">
                {item.mergeTags.map((tag) => (
                  <div className="p-2.5" key={tag.tag}>
                    <code className="text-xs font-mono text-foreground">
                      {`{{${tag.tag}}}`}
                    </code>
                    <p className="text-2xs text-muted-foreground mt-0.5">
                      {tag.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog onOpenChange={setPreviewOpen} open={previewOpen}>
        <DialogContent className="rounded-xl max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Preview — {item.label}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-md border border-border overflow-hidden bg-white">
            {previewLoading ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Rendering…
              </div>
            ) : (
              <iframe
                className="w-full"
                height={500}
                srcDoc={previewHtml ?? ""}
                title="Email preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
