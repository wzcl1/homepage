AGENTS.md
Project Overview
Build a simple, single-page web portal for a single user to store links and text notes. Data is persisted server-side in a flat file (e.g., a JSON file on disk), so opening the page from any device hits the same file and shows the same content — no database, no accounts, no multi-user logic needed.
Think of it as a tiny personal dashboard with a lightweight server acting as the shared storage point.
Goals
One HTML page, no page reloads or routing.
Add, edit, and delete links (URL + label).
Add, edit, and delete text notes (freeform text).
Data lives in a single flat file on the server, so it's the same no matter which device/browser opens the page.
No login, no accounts — this is for one person's private use.
Clean, minimal UI — usable on both desktop and mobile.
Non-Goals
No multi-user support or authentication (single user by design).
No database (Postgres/Mongo/etc.) — a flat file is sufficient given the small, simple data.
No complex rich-text editing (plain text notes only for v1).
Tech Stack
Frontend: HTML5 + CSS3 + vanilla JavaScript.
Backend: A minimal server is required (a flat file can't be read/written directly from client-side JS across devices) — use a small Node.js + Express app (or Python + Flask, whichever the agent/user prefers).
Storage: A single `data.json` file on the server's disk, holding all links and notes.
Hosting: Any host that supports a small persistent process with writable disk (e.g., a Raspberry Pi, home server, VPS, or a platform like Render/Fly.io with a persistent volume). Note: purely static/serverless hosts (e.g., GitHub Pages) won't work since they can't write files.
File Structure
```
/server.js        -> Express app: serves the page + API routes for reading/writing data.json
/data.json         -> flat file storing all links and notes (created on first run if missing)
/public/
  index.html       -> page structure (single page)
  style.css        -> styling
  app.js           -> frontend logic (fetch/save via API, render)
```
Data Model
`data.json` holds one JSON object:
```json
{
  "links": [
    { "id": "uuid", "label": "Perplexity", "url": "https://perplexity.ai", "createdAt": "ISO timestamp" }
  ],
  "notes": [
    { "id": "uuid", "text": "Remember to renew domain", "createdAt": "ISO timestamp" }
  ]
}
```
API Endpoints (server.js)
`GET /api/data` — read and return the full contents of `data.json`.
`POST /api/links` — add a new link, append to file, return updated list.
`PUT /api/links/:id` — edit an existing link.
`DELETE /api/links/:id` — remove a link.
`POST /api/notes` — add a new note.
`PUT /api/notes/:id` — edit an existing note.
`DELETE /api/notes/:id` — remove a note.
All writes should read the current file, modify the in-memory object, then write the whole file back (simple read-modify-write is fine at this scale — no need for a real database or locking library, though a basic write queue/mutex is worth adding if edits could ever overlap).
Core Features / Tasks
Server setup
Express server serves the static frontend from `/public` and exposes the API routes above.
On startup, create `data.json` with an empty `{ "links": [], "notes": [] }` structure if it doesn't already exist.
Frontend load
On page open, `fetch('/api/data')` and render whatever links/notes come back.
Add link
Input for URL and optional label; validate URL format.
`POST` to `/api/links`; on success, re-render list with the new item.
Add note
Textarea for freeform text.
`POST` to `/api/notes`; on success, re-render list.
Edit / Delete
Inline controls on each item call the corresponding `PUT`/`DELETE` endpoint.
Re-render (or optimistically update, then reconcile) after each change.
Cross-device consistency
Since the file lives on the server, any device hitting the same URL sees the same data after a fetch — no client-side sync logic needed.
Refresh the page (or re-fetch periodically) to pick up changes made from another device.
Acceptance Criteria
Opening the page from a different device/browser (pointed at the same server) shows the same links and notes.
Adding, editing, or deleting an item updates `data.json` on disk and is reflected the next time any device loads or refreshes the page.
Restarting the server does not lose data (file persists on disk between restarts).
No console or server errors during normal add/edit/delete/read operations.
Concurrent edits don't corrupt `data.json` (basic safeguard: serialize writes, e.g., one write at a time).
Style Guidelines
Minimal, uncluttered design: light background, clear typography, generous spacing.
Mobile-responsive: single column on small screens.
Use accessible form labels and sufficient color contrast.
Future Enhancements (optional, do not block v1)
Basic HTTP auth (a single shared password) if the server is ever exposed to the public internet, to keep it private.
Automatic periodic re-fetch or WebSocket push so changes from another device appear without a manual refresh.
Back up `data.json` periodically (e.g., timestamped copies) in case of accidental corruption.
Export/download the raw `data.json` as a backup file from the UI.
Migrate to a real embedded database (e.g., SQLite) later if the flat-file read/write approach ever becomes a bottleneck — unlikely at personal-use scale.
Agent Instructions
Keep the backend as small as possible: one Express file, one JSON data file, no ORM or database engine.
Do not add authentication/accounts — this is explicitly single-user.
Ensure `data.json` writes are atomic enough to avoid corruption (write to a temp file then rename, or serialize writes with a simple in-memory lock/queue).
Make sure the server binds to a host/port reachable from any device the user wants to use (not just `localhost`), since cross-device access is the whole point.
After implementing, verify by adding/editing/deleting from one device, then loading the page from a second device (or a different browser) and confirming the data matches.
