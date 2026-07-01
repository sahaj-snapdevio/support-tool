"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { isRichTextEmpty } from "@/lib/rich-text";
import { PaperclipIcon, XIcon } from "@phosphor-icons/react";

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
  token: string;
  totalAttachments: number;
}

export function ReplyForm({ ticketId, token, totalAttachments }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setError(`You can only add ${maxNewFiles} more file(s) to this ticket.`);
      return;
    }
    const oversized = combined.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setError(`"${oversized.name}" exceeds the 10 MB limit.`);
      return;
    }
    const badType = combined.find((f) => !ALLOWED_TYPES.has(f.type));
    if (badType) {
      setError(`"${badType.name}" is not an allowed file type.`);
      return;
    }
    setFiles(combined);
    setError(null);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isRichTextEmpty(content)) {
      setError("Please write a reply before sending.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const body = new FormData();
      body.append("content", content);
      body.append("token", token);
      files.forEach((f) => body.append("attachments", f));

      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        body,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const msg = data.error ?? "Failed to send reply.";
        setError(msg);
        toast.error(msg);
        return;
      }

      setContent("");
      setFiles([]);
      toast.success("Reply sent.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-sand shadow-soft p-6 space-y-4">
      <h2 className="text-sm font-medium text-bark">Send a Reply</h2>

      <RichTextEditor
        value={content}
        onChange={setContent}
        placeholder="Write your reply…"
        disabled={submitting}
      />

      {/* File attachments */}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md bg-cream border border-sand px-3 py-2 text-xs"
            >
              <PaperclipIcon className="size-3.5 text-stone shrink-0" />
              <span className="text-bark truncate flex-1">{f.name}</span>
              <span className="text-stone shrink-0">
                {(f.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-stone hover:text-bark"
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        {maxNewFiles > 0 ? (
          <label className="flex items-center gap-1.5 text-xs text-stone hover:text-bark cursor-pointer">
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
          <span className="text-xs text-stone">Max attachments reached</span>
        )}

        <Button
          type="submit"
          disabled={submitting || isRichTextEmpty(content)}
          className="bg-bark hover:bg-bark/90 text-white"
        >
          {submitting ? "Sending…" : "Send Reply"}
        </Button>
      </div>
    </form>
  );
}
