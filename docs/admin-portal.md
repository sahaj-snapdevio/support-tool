# Admin Portal

## Overview

The admin portal gives admins full control over the support tool — everything an agent can do, plus user management, role assignment, and spam ticket deletion.

Admins use the same agent portal routes (`/dashboard`, `/tickets`) with additional capabilities unlocked by their role. Admin-only sections live under `/(admin)/`.

Access requires a session with `role: admin`.

---

## Admin Capabilities (vs. Agent)

| Capability | Agent | Admin |
|------------|-------|-------|
| View all tickets | Yes | Yes |
| Search & filter tickets | Yes | Yes |
| Assign tickets | Yes | Yes |
| Reply to customers | Yes | Yes |
| Add internal notes | Yes | Yes |
| Change ticket status | Yes | Yes |
| Close / Reopen tickets | Yes | Yes |
| Delete tickets (spam) | No | **Yes** |
| View all users | No | **Yes** |
| Assign / change user roles | No | **Yes** |
| Ban / unban users | No | **Yes** |
| Promote to admin | No | **Yes** (or via CLI) |

---

## 1. User Management (`/admin/users`)

### User List

Shows all registered users (agents + admins). Paginated — 25 per page.

Each row shows:
- Avatar + name + email
- Role badge (Agent / Admin)
- Status (Active / Banned)
- Joined date

### Search

Search by name or email.

### Actions Per User

| Action | Description |
|--------|-------------|
| Change Role | Set to `agent` or `admin` |
| Ban User | Immediately revokes all sessions. User cannot sign in. Optionally enter a ban reason. |
| Unban User | Restores sign-in access. |
| Delete User | Hard delete — removes user record and their sessions. Their tickets remain unassigned. Their comment `authorName` is preserved as their name at time of deletion. |

### Assign Role Flow

1. Admin clicks "Change Role" on a user row.
2. A small popover/dialog appears: "Set role for [name]" — radio: Agent / Admin.
3. Confirm.
4. Role updated immediately. If the user is currently signed in, their next request will reflect the new role (session is not revoked — role is read from DB on each request).

### Ban Flow

1. Admin clicks "Ban User".
2. Dialog: "Ban [name]? They will be signed out immediately and cannot sign in until unbanned."
3. Optional: enter a ban reason (shown in the user list for admin reference).
4. Confirm.
5. Better Auth revokes all active sessions for that user.

### Delete User Flow

1. Admin clicks "Delete User".
2. Confirmation dialog: "Permanently delete [name]? This cannot be undone. Their assigned tickets will become unassigned."
3. Admin must type the user's email to confirm.
4. On confirm:
   - All sessions deleted.
   - `account` and `user` records deleted.
   - Any tickets assigned to this user set `assignedAgentId = null`.
   - Comment `authorName` is preserved (already stored at write time).

---

## 2. Delete Ticket (Spam) (`/tickets/{ticketId}`)

Admins see a "Delete Ticket" button in the ticket detail sidebar that agents do not see.

### Flow

1. Admin clicks "Delete Ticket".
2. Confirmation dialog: "Permanently delete ticket #1042? All comments and attachments will be deleted. This cannot be undone."
3. On confirm:
   - All attachments deleted from storage first (files deleted before DB records).
   - All `ticket_comments` deleted (cascade).
   - All `ticket_activity` deleted (cascade).
   - All `ticket_attachments` deleted (cascade).
   - `ticket` record deleted.
4. Admin redirected to `/tickets`.

---

## 3. Ticket Configuration (`/admin/ticket-config`)

Admins can manage the statuses and categories used across all tickets. Changes take effect immediately for all new and existing ticket displays.

### 3a. Statuses

Displays all ticket statuses in `sortOrder` order.

Each status row shows:
- Color swatch + label + slug (read-only)
- **Default** badge (if `isDefault = true`) — shown as a green "Default" chip
- **Closed State** badge (if `isClosedState = true`) — shown as a gray "Closed State" chip
- Edit + Delete buttons

**Add Status** — a form/dialog with:
- Label (text input) — slug auto-generated from label on creation, shown as read-only preview
- Color (preset picker: Blue / Amber / Slate / Red / Orange / Purple / Green / Teal / Pink / Indigo)
- Mark as default (checkbox)
- Mark as closed state (checkbox)

**Edit Status** — dialog pre-filled with existing values. Slug is read-only (immutable after creation).

**Delete Status** — blocked if:
- It is the only remaining status
- It is the current default status
- Any tickets currently use this status slug (show count in error)

**Setting a new default** — when admin marks a status as default, the previous default is automatically unset. There is always exactly one default.

### 3b. Categories

Same pattern as statuses, minus the `isDefault` and `isClosedState` flags.

**Add Category** — label + color picker.

**Edit Category** — label and color only (slug immutable).

**Delete Category** — blocked if any tickets currently use this category slug.

### 3c. Color Presets

Both statuses and categories use a fixed set of named color presets for badge styling. Stored as a color name in the DB, resolved to Tailwind classes at render time via `COLOR_BADGE` in `lib/tickets.ts`:

| Name | Badge classes |
|------|--------------|
| `blue` | `bg-sky-100 text-sky-700 border-sky-200` |
| `amber` | `bg-amber-100 text-amber-700 border-amber-200` |
| `slate` | `bg-stone-100 text-stone-600 border-stone-200` |
| `red` | `bg-red-50 text-red-700 border-red-200` |
| `orange` | `bg-orange-50 text-orange-700 border-orange-200` |
| `purple` | `bg-purple-50 text-purple-700 border-purple-200` |
| `green` | `bg-emerald-50 text-emerald-700 border-emerald-200` |
| `teal` | `bg-teal-50 text-teal-700 border-teal-200` |
| `pink` | `bg-pink-50 text-pink-700 border-pink-200` |
| `indigo` | `bg-indigo-50 text-indigo-700 border-indigo-200` |

### 3d. Seeding Defaults

On a fresh install, run `pnpm seed` to populate `ticket_statuses` and `ticket_categories` with the default values documented in `docs/tickets.md`. This is idempotent — it skips rows that already exist by slug.

---

## 4. Admin Access to Orbit Panel

Admins also have access to the Better Auth Orbit panel at `/orbit`:
- View all user sessions.
- Impersonate any user (for debugging).
- View email outbox (sent emails).
- View job queue state (pg-boss).

This is provided by the scaffold — no custom implementation needed.

---

## 5. Business Rules

1. There must always be at least one admin in the system. Prevent the last admin from being demoted or deleted.
2. An admin cannot ban themselves.
3. Deleting a user does not delete their tickets or comments — tickets become unassigned.
4. Ticket deletion is hard delete — no soft delete, no recovery.
5. When deleting a ticket, always delete storage files before the DB record.
6. Role changes take effect on the user's next API request — no need to force sign-out.
7. Admins can manage users created by any auth method (magic link, Google).

---

## 6. UI Notes

- Admin-only items (Delete Ticket button, Users nav link) are conditionally rendered based on `session.user.role === 'admin'`.
- The Users page (`/admin/users`) is not linked in the agent sidebar — only visible to admins.
- Destructive actions (delete ticket, delete user, ban user) always use shadcn `Dialog` with explicit confirmation — never `window.confirm()`.
- Use Phosphor Icons: `TrashIcon` for delete, `ProhibitIcon` for ban, `ShieldCheckIcon` for admin role.
