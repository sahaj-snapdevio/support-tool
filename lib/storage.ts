import fs from "node:fs/promises";
import path from "node:path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export const storage = {
  /**
   * Store a file. Key format: `tickets/{ticketId}/{uuid}/{filename}`
   * Returns the key (never a full URL).
   */
  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const dest = path.join(UPLOADS_DIR, ...key.split("/"));
    await ensureDir(path.dirname(dest));
    await fs.writeFile(dest, buffer);
  },

  /** Read a file as a Buffer. */
  async download(key: string): Promise<Buffer> {
    const src = path.join(UPLOADS_DIR, ...key.split("/"));
    return fs.readFile(src);
  },

  /** Delete a file. Does not throw if the file does not exist. */
  async delete(key: string): Promise<void> {
    const target = path.join(UPLOADS_DIR, ...key.split("/"));
    await fs.unlink(target).catch(() => undefined);
  },

  /** Return the URL to serve the file from. */
  url(key: string): string {
    return `/api/files/${key}`;
  },
};
