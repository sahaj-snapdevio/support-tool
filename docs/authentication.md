# Authentication

## Overview

Support Tool has two completely separate authentication flows:

| Actor | Flow | Login Required |
|-------|------|----------------|
| Customer | No account. Name + email on ticket form. Access tickets via secure email link. | No |
| Agent | Full Better Auth session via magic link or Google OAuth | Yes |
| Admin | Full Better Auth session via magic link or Google OAuth | Yes |

Customers are never redirected to the agent login page. Agents and admins are never shown the customer portal without a valid session.

---

## 1. Customer Access (No Login)

Customers do not create an account or set a password. They identify themselves by providing their **name and email** when submitting a ticket.

### Creating a Ticket

1. Customer visits `/` (public — no auth required).
2. Fills in: Full Name, Email Address, Subject, Description, Category, optional file attachments.
3. Submits the form.
4. System creates the ticket and sends a **confirmation email** to the provided address containing:
   - Ticket number and subject
   - A **secure ticket link** valid indefinitely: `/ticket/{ticketId}?token={ticketToken}`
   - A link to view all their tickets: `/my-tickets` (prompts for email, sends an access link)

### Accessing a Ticket

- Customer clicks the link in their email.
- The `ticketToken` is validated against the DB (`ticket.customer_token`).
- If valid: the ticket detail page is shown — no session created.
- If invalid/missing: show an error page with a link to request a new access email.

The `ticketToken` is a cuid2 generated at ticket creation time and stored in the `ticket` row. It never expires. Customers can bookmark the link.

### Viewing All Tickets

If a customer wants to see all tickets they have submitted:

1. They go to `/my-tickets`.
2. They enter their email address.
3. The system sends an email with links to all open tickets for that email (the individual per-ticket secure links, not a session).
4. No session is created — each link navigates to the individual ticket detail.

This is not a traditional "login" — it is simply a convenience email listing their tickets.

### Security for Customer Access

- `ticket.customer_token` is never exposed in any agent/admin API response.
- A customer can only access a ticket via its token — they cannot guess or enumerate other ticket IDs.
- Internal notes (`is_internal = true`) are always stripped from customer-facing API responses server-side.
- The "view all tickets" email only sends ticket links for the requesting email address — never for other customers.

---

## 2. Agent & Admin Login (Better Auth)

Agents and admins authenticate via Better Auth with two supported methods:

| Method | Description |
|--------|-------------|
| Magic Link | Agent enters email → receives a one-time sign-in link → clicks it → session created |
| Google OAuth | Agent clicks "Sign in with Google" → OAuth flow → session created (if Google is configured) |

Google OAuth is optional — it is only available when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in the environment.

### Sign-In Flow

1. Agent/admin visits `/login`.
2. Chooses magic link (enter email) or Google OAuth.
3. **Magic link:** Always shows: `"If this email is valid, a sign-in link has been sent."` regardless of whether the email exists (prevents account enumeration).
4. **Google OAuth:** Redirects to Google → returns to the app → session created.
5. On success: redirected to `/dashboard`.
6. On failure (invalid/expired magic link): `"This link has expired or has already been used. Request a new one."` with a link back to `/login`.

### Magic Link Rules

- Valid for **15 minutes**.
- Single-use — invalidated immediately after the session is created.
- If a new link is requested while a previous one is valid, the old link is invalidated.
- Rate limited: max **5 requests** per email per 15 minutes (Better Auth built-in).

### Session Rules

- Database-backed sessions (stored in `session` table).
- Default TTL: **7 days** with sliding expiry — TTL resets on each authenticated request.
- A banned user's sessions are revoked immediately by the Better Auth Admin Plugin.

---

## 3. Roles

Roles are stored in `user.role`:

| Role | Value | How it is assigned |
|------|-------|--------------------|
| Agent | `agent` | Admin assigns in admin panel |
| Admin | `admin` | `pnpm make:admin email@...` or promoted in admin panel |

There is no `customer` role — customers are not users in the system. They are identified only by the email stored on each ticket.

New users who sign in via magic link or Google for the first time are created with no role by default and cannot access the agent portal until an admin assigns the `agent` or `admin` role.

---

## 4. Better Auth Admin Plugin

The Better Auth Admin Plugin gives platform admins additional capabilities:

| Feature | Description |
|---------|-------------|
| Ban user | Revokes all sessions. User cannot sign in. |
| Unban user | Restores sign-in access. |
| Impersonate user | Admin logs in as any user for support. Opens a separate session. |
| Revoke sessions | Revoke any user's sessions individually or all at once. |

These are accessible via the Orbit panel at `/orbit`.

---

## 5. Route Protection

| Route | Guard |
|-------|-------|
| `/` and `/ticket/*` | Public — no auth. Customer token validated per-request for ticket pages. |
| `/my-tickets` | Public — validates by email then sends link. |
| `/login` | Public — redirect to `/dashboard` if already signed in. |
| `/dashboard`, `/tickets/*` (agent) | Requires session with `role: agent` or `role: admin`. |
| `/admin/*` | Requires session with `role: admin`. |
| `/orbit/*` | Requires session with `role: admin`. |

---

## 6. API Auth Pattern

### Agent/Admin API Routes

Every agent/admin API route checks the session first:

```typescript
const session = await auth.api.getSession({ headers: await headers() })
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
if (!['agent', 'admin'].includes(session.user.role)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

### Customer API Routes

Customer-facing routes (e.g. posting a reply on a ticket) validate the customer token:

```typescript
const token = searchParams.get('token')
const ticket = await db.query.tickets.findFirst({
  where: and(eq(tickets.id, ticketId), eq(tickets.customerToken, token))
})
if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

---

## 7. Data Model (Auth Tables)

Managed by Better Auth:

```
user
+-- id                text PK (cuid2)
+-- email             text unique
+-- name              text
+-- email_verified    boolean default false
+-- image             text (avatar storage key, nullable)
+-- role              text  ← 'agent' | 'admin' | null (unassigned)
+-- banned            boolean default false
+-- ban_reason        text nullable
+-- ban_expires       timestamp nullable
+-- created_at        timestamp
+-- updated_at        timestamp

session
+-- id                text PK
+-- user_id           text → user.id (cascade delete)
+-- token             text unique
+-- expires_at        timestamp
+-- ip_address        text nullable
+-- user_agent        text nullable
+-- impersonated_by   text nullable
+-- created_at / updated_at

account
+-- id                text PK
+-- user_id           text → user.id (cascade delete)
+-- provider_id       text  ← 'google' | 'magic-link'
+-- account_id        text
+-- created_at / updated_at

verification
+-- id                text PK
+-- identifier        text  ← email address
+-- value             text  ← hashed magic link token
+-- expires_at        timestamp (15 min from creation)
+-- created_at
```

---

## 8. Security Notes

| Concern | Mitigation |
|---------|-----------|
| Customer ticket enumeration | Per-ticket cuid2 token in URL — not guessable |
| Internal notes leak | Stripped server-side before any customer response |
| Magic link abuse | Rate limit: 5 requests per 15 min per email |
| Email enumeration | Magic link always returns same response |
| Session hijacking | Database-backed sessions; token hashed in DB |
| CSRF | Better Auth handles CSRF on all POST routes |
| Token reuse | Magic links are single-use |
| Banned users | Sessions revoked immediately on ban |

---

## Out of Scope (MVP)

- Password-based authentication
- Customer accounts with passwords
- 2FA / TOTP
- SSO / SAML
