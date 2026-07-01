# File Uploads

## Overview

Customers and agents can attach files to tickets and comments. Files are stored via files-sdk — local filesystem in development, S3-compatible object storage in production.

---

## Rules

| Rule | Value |
|------|-------|
| Allowed types | JPG, JPEG, PNG, PDF, ZIP, TXT |
| Max file size | 10 MB per file |
| Max attachments per ticket | 5 total (across the ticket itself + all comments) |
| Max attachments per comment | 5, subject to the ticket-level limit |

The 5-file limit is enforced at the ticket level, not per upload action. If a ticket already has 3 attachments, the next upload can only add 2 more.

---

## Validation

Validation is enforced **both client-side and server-side**. Client-side validation gives immediate feedback; server-side validation is the authoritative check.

### Allowed MIME Types

```
image/jpeg
image/png
application/pdf
application/zip
text/plain
```

### Checks (server-side)

1. File size ≤ 10 MB.
2. MIME type is in the allowed list (checked from `Content-Type` — not just file extension).
3. Total attachments on the ticket after this upload ≤ 5.
4. The customer token (or agent session) is valid for the ticket.

If any check fails, return `400` with a descriptive `{ error: string }`.

---

## Storage

Files are stored via files-sdk (`lib/storage.ts`).

### Storage Key Format

```
tickets/{ticketId}/{uuid}/{originalFilename}
```

Example: `tickets/cm3abc123/cm9xyz456/screenshot.png`

The `uuid` segment ensures no filename collisions if the same filename is uploaded multiple times.

### Local Development

- Driver: `fs`
- Files stored in `./uploads/` at the project root.
- Served via `/api/files/[...key]` route.

### Production

- Set `STORAGE_DRIVER=s3` and the corresponding S3/R2/GCS credentials in env.
- No app code changes required — the adapter layer handles it.

### DB Storage

- The `ticket_attachments` table stores the **storage key**, never a full URL.
- Serving URLs are generated on demand: `storage.url(key)` → `/api/files/{key}` or a signed S3 URL.
- Never persist URLs in the database.

---

## Upload Flow

### Customer Upload (during ticket creation)

1. Customer selects files in the create ticket form.
2. Files are uploaded via `POST /api/tickets/{id}/attachments` immediately on form submit (multipart/form-data).
3. Server validates and stores each file, returns `storageKey`.
4. `ticket_attachments` records are created.

### Agent/Customer Upload (on comment)

1. Files are selected in the reply form.
2. Submitted as multipart/form-data alongside the comment content.
3. Server creates the comment first, then creates attachment records linked to `commentId`.

---

## Deletion

When an attachment is deleted (admin action):

1. `storage.delete(storageKey)` is called first.
2. If storage delete fails: log the error but proceed (orphaned storage files are acceptable — unrecoverable attachments are worse).
3. `ticket_attachments` record is deleted from DB.

When a ticket is deleted (admin spam deletion):

1. Fetch all `ticket_attachments.storageKey` for the ticket.
2. Delete each file from storage.
3. Then delete all DB records (cascade handles tickets → comments → attachments).

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/tickets/{id}/attachments` | Customer (token) or Agent | Upload attachment(s) |
| GET | `/api/files/[...key]` | Public | Serve file from storage |
| DELETE | `/api/tickets/{id}/attachments/{attachmentId}` | Agent/Admin | Delete attachment |

---

## UI Notes

- The file input uses shadcn `Button` styled as a file picker — not a native `<input type="file">` left unstyled.
- Show a file list below the picker with: filename, file size (human-readable), a remove button.
- Show a progress indicator during upload.
- Show clear error messages for each failure type:
  - "File too large. Maximum size is 10 MB."
  - "File type not allowed. Accepted types: JPG, PNG, PDF, ZIP, TXT."
  - "Maximum 5 attachments per ticket."
- Allowed types and size limit are shown as helper text below the file picker (always visible, not only on error).
