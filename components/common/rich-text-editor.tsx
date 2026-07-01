"use client";

import {
  CodeBlockIcon,
  CodeIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  QuotesIcon,
  TextBIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
} from "@phosphor-icons/react";
import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  baseRichTextExtensions,
  parseRichTextContent,
} from "./rich-text-extensions";
import { SlashCommand } from "./slash-command";

interface Props {
  className?: string;
  disabled?: boolean;
  onChange: (json: string) => void;
  placeholder?: string;
  /** Visual accent — "warning" tints the frame amber (agent internal notes). */
  tone?: "default" | "warning";
  value: string;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      className={cn(
        "flex size-7 items-center justify-center rounded transition-colors disabled:opacity-40",
        active
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function Toolbar({
  editor,
  tone,
}: {
  editor: Editor;
  tone: "default" | "warning";
}) {
  const divider = (
    <div
      className={cn(
        "mx-1 h-4 w-px shrink-0",
        tone === "warning" ? "bg-amber-200" : "bg-muted"
      )}
    />
  );
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5",
        tone === "warning" ? "border-amber-200" : "border-border"
      )}
    >
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <TextBIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <TextItalicIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Ctrl+U)"
      >
        <TextUnderlineIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <TextStrikethroughIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      >
        <CodeIcon className="size-4" />
      </ToolbarButton>
      {divider}
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <ListBulletsIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ListNumbersIcon className="size-4" />
      </ToolbarButton>
      {divider}
      <ToolbarButton
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code block"
      >
        <CodeBlockIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Quote"
      >
        <QuotesIcon className="size-4" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write a reply…",
  disabled = false,
  tone = "default",
  className,
}: Props) {
  const editor = useEditor({
    extensions: [
      ...baseRichTextExtensions(),
      Placeholder.configure({ placeholder }),
      SlashCommand,
    ],
    content: parseRichTextContent(value),
    onUpdate: ({ editor }) => onChange(JSON.stringify(editor.getJSON())),
    editorProps: {
      attributes: {
        class: "tiptap-content focus:outline-none min-h-[96px] px-4 py-3",
      },
    },
    immediatelyRender: false,
  });

  // Reflect external resets (e.g. parent clears the field after a successful send).
  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }
    const current = JSON.stringify(editor.getJSON());
    if (value === "" && !editor.isEmpty) {
      editor.commands.clearContent(false);
    } else if (value && value !== current) {
      editor.commands.setContent(parseRichTextContent(value), {
        emitUpdate: false,
      });
    }
  }, [value, editor]);

  // Keep the editor's editable state in sync with `disabled`.
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-md border bg-card overflow-hidden focus-within:ring-1 transition-colors",
        tone === "warning"
          ? "border-amber-200 bg-amber-50 focus-within:border-amber-400 focus-within:ring-amber-400"
          : "border-input focus-within:border-primary focus-within:ring-ring",
        disabled && "opacity-60",
        className
      )}
    >
      <Toolbar editor={editor} tone={tone} />
      <EditorContent editor={editor} />
    </div>
  );
}
