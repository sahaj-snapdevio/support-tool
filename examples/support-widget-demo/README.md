# Acme Cloud — Support Tool API demo

A tiny, **zero-dependency** example website that shows how a customer would
integrate Support Tool's [public API](../../docs/api.md) into their own product
to offer customer support — without sending users to the built-in customer
portal.

It exercises every endpoint the API currently offers:

| What the page does | Support Tool endpoint |
|---|---|
| Build the ticket form's category/priority menus | `GET /api/v1/config` |
| Submit a support request | `POST /api/v1/tickets` |
| "Track my requests" list | `GET /api/v1/tickets?email=` |
| Ticket status on the detail view | `GET /api/v1/tickets/:id` |
| The conversation thread (agent replies) | `GET /api/v1/tickets/:id/comments` |

## The important pattern: server-to-server

The API key is a **secret**. This demo never puts it in the browser. Instead:

```
browser  ──►  this demo's backend (server.mjs)  ──►  Support Tool API
              adds  Authorization: Bearer <key>
```

The page calls its own `/support/*` endpoints; `server.mjs` attaches the key and
forwards to Support Tool. Open your browser's Network tab — you'll see the key
appears nowhere. That's exactly how you should integrate it in production.

## Run it

1. **Get an API key.** In Support Tool, sign in as an admin, go to
   `/admin/api-keys`, create a key, and copy the raw value (shown once).

2. **Configure the demo:**

   ```bash
   cd examples/support-widget-demo
   cp .env.example .env
   # edit .env — set SUPPORT_TOOL_API_KEY (and SUPPORT_TOOL_URL if not localhost:3000)
   ```

3. **Start it** (needs Node 20.12+ — no `npm install` required):

   ```bash
   npm start
   # → http://localhost:4321
   ```

4. Open http://localhost:4321, submit a ticket, then check it appears in
   Support Tool's agent dashboard. Reply from an agent, and it shows up under
   "Track my requests" here.

## Files

- `server.mjs` — the backend-for-frontend proxy (the only place the key lives).
- `public/index.html` — the customer-facing page (form + ticket tracking).
- `.env.example` — copy to `.env` and fill in.

## Not covered (API limitations — see docs/api.md)

- File attachments and posting replies from your own widget aren't supported by
  the API yet — send the customer the ticket's `portalUrl` for those.
- No webhooks yet — this demo would poll `GET .../comments` for new replies.
