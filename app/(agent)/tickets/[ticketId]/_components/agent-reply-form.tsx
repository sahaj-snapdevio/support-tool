"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { isRichTextEmpty } from "@/lib/rich-text";
import { PaperclipIcon, XIcon, LockSimpleIcon, ChatCircleIcon } from "@phosphor-icons/react";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/zip",
  "text/plain",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface Props {
  ticketId: string;
  totalAttachments: number;
}

export function AgentReplyForm({ ticketId, totalAttachments }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isInternal, setIsInternal] = useState(false);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const maxNewFiles = Math.max(0, 5 - totalAttachments);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const combined = [...files, ...selected];
    if (combined.length > maxNewFiles) {
      setError(`Only ${maxNewFiles} more file(s) allowed.`);
      return;
    }
    const oversized = combined.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) { setError(`"${oversized.name}" exceeds 10 MB.`); return; }
    const badType = combined.find((f) => !ALLOWED_TYPES.has(f.type));
    if (badType) { setError(`"${badType.name}" is not an allowed type.`); return; }
    setFiles(combined);
    setError(null);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isRichTextEmpty(content)) { setError("Write something before sending."); return; }
    setError(null);
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("content", content);
      body.append("isInternal", String(isInternal));
      files.forEach((f) => body.append("attachments", f));

      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const msg = data.error ?? "Failed to send.";
        setError(msg);
        toast.error(msg);
        return;
      }
      setContent("");
      setFiles([]);
      toast.success(isInternal ? "Internal note added." : "Reply sent to customer.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Toggle: Reply / Internal Note */}
      <div className="flex gap-1 p-1 bg-accent rounded-lg border border-border w-fit">
        <button
          type="button"
          onClick={() => setIsInternal(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            !isInternal
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ChatCircleIcon className="size-3.5" />
          Reply to Customer
        </button>
        <button
          type="button"
          onClick={() => setIsInternal(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            isInternal
              ? "bg-amber-100 text-amber-800 shadow-sm border border-amber-200"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LockSimpleIcon className="size-3.5" />
          Internal Note
        </button>
      </div>

      <RichTextEditor
        value={content}
        onChange={setContent}
        placeholder={isInternal ? "Write an internal note (only visible to agents)…" : "Write a reply to the customer…"}
        tone={isInternal ? "warning" : "default"}
        disabled={submitting}
      />

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md bg-accent border border-border px-3 py-2 text-xs">
              <PaperclipIcon className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-foreground truncate flex-1">{f.name}</span>
              <span className="text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        {maxNewFiles > 0 ? (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            <PaperclipIcon className="size-3.5" />
            Attach file
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf,.zip,.txt"
              className="hidden"
              onChange={handleFileChange}
              disabled={submitting}
            />
          </label>
        ) : (
          <span className="text-xs text-muted-foreground">Attachment limit reached</span>
        )}

        <Button
          type="submit"
          disabled={submitting || isRichTextEmpty(content)}
          className={isInternal
            ? "bg-amber-600 hover:bg-amber-700 text-white"
            : "bg-primary hover:bg-primary/90 text-primary-foreground"
          }
        >
          {submitting
            ? "Sending…"
            : isInternal
            ? "Add Note"
            : "Send Reply"}
        </Button>
      </div>
    </form>
  );
}
