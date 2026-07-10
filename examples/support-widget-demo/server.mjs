// Acme Cloud — a fictional customer website that integrates Support Tool's
// public API (docs/api.md) exactly the way a real integrator should:
// SERVER-TO-SERVER. The secret API key lives only here, on this backend. The
// browser talks to *this* server's /support/* endpoints; this server adds the
// `Authorization: Bearer <key>` header and forwards to Support Tool. The key is
// never sent to, or visible in, the customer's browser.
//
// Run:  SUPPORT_TOOL_API_KEY=stk_live_... node server.mjs
// (or copy .env.example to .env and fill it in — this file auto-loads .env)

import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (existsSync(join(__dirname, ".env"))) {
  // Node 20.12+/22 built-in — same helper the Support Tool scripts use.
  process.loadEnvFile(join(__dirname, ".env"));
}

const SUPPORT_TOOL_URL = (
  process.env.SUPPORT_TOOL_URL || "http://localhost:3000"
).replace(/\/$/, "");
const API_KEY = process.env.SUPPORT_TOOL_API_KEY || "";
const PORT = Number(process.env.PORT || 4321);

const PUBLIC_DIR = join(__dirname, "public");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// The one place the API key is attached. Forwards to Support Tool and relays
// the status + JSON straight back to our own frontend.
async function proxy(res, path, init = {}) {
  if (!API_KEY) {
    return sendJson(res, 500, {
      error:
        "This demo has no SUPPORT_TOOL_API_KEY configured. Generate a key at /admin/api-keys in Support Tool, then set it in examples/support-widget-demo/.env",
    });
  }

  try {
    const upstream = await fetch(`${SUPPORT_TOOL_URL}${path}`, {
      method: init.method || "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body,
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(text),
    });
    res.end(text || "{}");
  } catch (err) {
    sendJson(res, 502, {
      error: `Could not reach Support Tool at ${SUPPORT_TOOL_URL}. Is it running? (${
        err instanceof Error ? err.message : String(err)
      })`,
    });
  }
}

async function serveStatic(res, urlPath) {
  // Strip leading slashes and map "/" to index.html. Do NOT rely on
  // normalize(urlPath) === "/" — on Windows normalize("/") returns "\", which
  // would resolve to the directory itself and blow up with EISDIR.
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, "");
  const filePath = normalize(join(PUBLIC_DIR, rel === "" ? "index.html" : rel));
  if (
    !filePath.startsWith(PUBLIC_DIR) ||
    !existsSync(filePath) ||
    statSync(filePath).isDirectory()
  ) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }
  const data = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
  });
  res.end(data);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // --- Backend-for-frontend: maps our page's calls onto the Support Tool API.
  if (path.startsWith("/support/")) {
    // GET /support/config  ->  GET /api/v1/config
    if (path === "/support/config" && req.method === "GET") {
      return proxy(res, "/api/v1/config");
    }

    // POST /support/tickets  ->  POST /api/v1/tickets
    if (path === "/support/tickets" && req.method === "POST") {
      const body = await readBody(req);
      return proxy(res, "/api/v1/tickets", { method: "POST", body });
    }

    // GET /support/tickets?email=  ->  GET /api/v1/tickets?email=
    if (path === "/support/tickets" && req.method === "GET") {
      const email = url.searchParams.get("email") || "";
      return proxy(
        res,
        `/api/v1/tickets?email=${encodeURIComponent(email)}`
      );
    }

    // GET /support/tickets/:id/comments  ->  GET /api/v1/tickets/:id/comments
    const commentsMatch = path.match(/^\/support\/tickets\/([^/]+)\/comments$/);
    if (commentsMatch && req.method === "GET") {
      const id = encodeURIComponent(commentsMatch[1]);
      return proxy(res, `/api/v1/tickets/${id}/comments`);
    }

    // GET /support/tickets/:id  ->  GET /api/v1/tickets/:id
    const idMatch = path.match(/^\/support\/tickets\/([^/]+)$/);
    if (idMatch && req.method === "GET") {
      const id = encodeURIComponent(idMatch[1]);
      return proxy(res, `/api/v1/tickets/${id}`);
    }

    return sendJson(res, 404, { error: "Unknown support endpoint." });
  }

  // Expose config to the page so it can label itself (never the API key).
  if (path === "/whoami" && req.method === "GET") {
    return sendJson(res, 200, {
      supportToolUrl: SUPPORT_TOOL_URL,
      hasApiKey: Boolean(API_KEY),
    });
  }

  return serveStatic(res, path);
});

server.listen(PORT, () => {
  console.log(`\n  Acme Cloud demo running:  http://localhost:${PORT}`);
  console.log(`  Talking to Support Tool:  ${SUPPORT_TOOL_URL}`);
  console.log(
    API_KEY
      ? "  API key:                  configured ✓\n"
      : "  API key:                  MISSING ✗  (set SUPPORT_TOOL_API_KEY in .env)\n"
  );
});
