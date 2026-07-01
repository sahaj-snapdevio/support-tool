// Helpers for working with reply content stored as Tiptap JSON.
//
// Replies (customer + agent) are stored as a serialized Tiptap document so they
// can carry basic formatting. Older comments were plain text — every helper here
// gracefully falls back to treating a non-JSON string as plain text.

interface TiptapNode {
  content?: TiptapNode[];
  text?: string;
  type?: string;
}

function parseDoc(content: string): TiptapNode | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as TiptapNode;
  } catch {
    return null;
  }
}

function collectText(node: TiptapNode, out: string[]): void {
  if (node.text) {
    out.push(node.text);
  }
  if (node.content) {
    for (const child of node.content) {
      collectText(child, out);
    }
  }
  // Block-level nodes imply a line break between them.
  if (
    node.type &&
    ["paragraph", "heading", "listItem", "blockquote"].includes(node.type)
  ) {
    out.push("\n");
  }
}

/**
 * Flatten reply content to plain text for previews, emails, notifications, and
 * push bodies. Accepts Tiptap JSON or a legacy plain-text string.
 */
export function richTextToPlainText(content: string): string {
  const doc = parseDoc(content);
  if (!doc) {
    return content;
  }
  const parts: string[] = [];
  collectText(doc, parts);
  return parts
    .join("")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** True when the reply has no visible text (empty Tiptap doc or blank string). */
export function isRichTextEmpty(content: string): boolean {
  return richTextToPlainText(content).trim().length === 0;
}
