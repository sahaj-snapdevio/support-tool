# Agent Portal

## Overview

The agent portal is where support agents manage tickets. Agents must be authenticated (magic link or Google OAuth). Access is restricted to users with `role: agent` or `role: admin`.

All routes under `/(agent)/` require a valid session.

---

## Routes

| Route | Description |
|-------|-------------|
| `/dashboard` | Stats overview |
| `/tickets` | All tickets list |
| `/tickets/{ticketId}` | Ticket detail + management |

---

## 1. Ticket List (`/tickets`)

The main workspace for agents. Shows all tickets across all customers.

### Default View

- Sorted by `updatedAt` descending (most recently active first).
- Paginated — 25 tickets per page.
- Each ticket row shows: ticket number, subject, category badge, status badge, customer name, assigned agent avatar (or "Unassigned"), created date, last updated date.

### Search

- Search input at the top of the list.
- Searches across: ticket number (`#1042`), subject, customer name, customer email.
- Real-time search as the agent types (debounced — 300ms).

### Filters

Agents can filter the list by:

| Filter | Options |
|--------|---------|
| Status | All / Open / In Progress / Closed |
| Category | All / Bug / Issue / Feature Request / Billing / General Query |
| Assigned To | All / Unassigned / Me / [Specific agent] |
| Date Range | Created in last 7 / 30 / 90 days / Custom |

Filters are combinable. Active filters are shown as removable chips above the list.

### Bulk Actions (Admin only)

- Select multiple tickets with checkboxes.
- Bulk assign to an agent.
- Bulk change status.
- Bulk delete (spam — admin only).

---

## 2. Ticket Detail (`/tickets/{ticketId}`)

The full ticket view for agents. Split into two panels:

**Left / Main panel:**
- Ticket subject and description (from customer).
- Full comment thread (all public replies + internal notes — agents see everything).
- Reply form at the bottom.

**Right / Sidebar:**
- Ticket information (ID, status, category, created, updated, closed date).
- Customer information (name, email).
- Assigned agent (with "Assign to me" shortcut).
- Activity history (full audit trail).

### Ticket Information Sidebar

| Item | Editable |
|------|----------|
| Ticket # | No |
| Subject | No |
| Category | Yes (agent can change) |
| Status | Yes |
| Assigned Agent | Yes |
| Customer Name | No |
| Customer Email | No |
| Created Date | No |
| Updated Date | No |
| Closed Date | No (auto-set on close) |

### Changing Status

- Dropdown or button group in the sidebar: Open / In Progress / Closed.
- Changing to "Closed" asks for confirmation: "Close this ticket? The customer will be notified."
- Status change logs to activity history and triggers an email notification to the customer (if closing).

### Assigning an Agent

- Dropdown: shows all users with `role: agent` or `role: admin`.
- "Assign to me" shortcut button.
- Assigning logs to activity history.
- Unassign: select "Unassigned" from the dropdown.

### Reply Form (Public Reply)

- Agent composes a message to the customer.
- Rich text editor (Tiptap) — same shared editor and toolbar as the customer reply form. Content is stored as Tiptap JSON and rendered read-only via Tiptap. See the **Rich Text (Replies)** convention in `CLAUDE.md`.
- Can attach files (up to 5 total per ticket).
- Submit button: "Send Reply".
- After submit: appears in the thread, customer receives an email notification (email/notification previews use a plain-text flattening of the reply).

### Internal Note

- Toggled via a tab or toggle above the reply form: "Reply" / "Internal Note".
- Internal notes have a visually distinct style (e.g. amber/yellow background, lock icon).
- Never visible to the customer.
- Other agents can see and reply within the internal thread.
- Logged in activity as `internal_note_added`.

### Attachments

- Agents can attach files to their replies (public or internal).
- Existing attachments on the ticket and comments are listed with: filename, size, download link.
- Agents (and admins) can delete any attachment on the ticket.

### Close Ticket

- "Close Ticket" button in the sidebar.
- Confirmation dialog required.
- On confirm: status → `closed`, `closedAt` set, customer notified by email.

### Reopen Ticket

- "Reopen" button shown when status is `closed`.
- No confirmation dialog needed.
- Status → `open`, activity logged.

---

## 3. Activity History

Shown in the sidebar on the ticket detail page (collapsible section at the bottom).

Each event shows:
- Actor name + role
- Action description
- Timestamp

Events visible to agents:
- All events including internal note additions.

Events visible to customers (on the customer portal):
- Status changes, replies only — no internal events.

---

## 4. UI Notes

- Agent portal uses a full sidebar navigation layout.
- Sidebar links: Dashboard, All Tickets, (Admin only: Users).
- Top bar shows: agent name + avatar + sign-out.
- Ticket list uses a table layout on desktop, card layout on mobile.
- Status badges and category badges use consistent colors (see [design-system.md](./design-system.md)).
- All interactive elements use shadcn/ui.

---

## 5. Business Rules

1. Agents can see all tickets from all customers.
2. Agents cannot see `customerToken` — it is stripped from all agent-facing API responses.
3. Agents can change status, assign, reply, add internal notes, and close/reopen.
4. Agents cannot delete tickets (admin-only).
5. Agents cannot manage users (admin-only).
6. An agent can assign a ticket to themselves or to any other agent/admin.
7. Sending a reply automatically bumps `ticket.updatedAt`.
8. Closing a ticket triggers a customer email notification.
