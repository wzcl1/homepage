# Homepage

A private, single-page dashboard for storing **links** and **text notes**. Data is persisted server-side in a single JSON file, so every device/browser pointed at the same server sees the same content.

Built as a minimal Express app with a vanilla HTML/CSS/JS frontend, packaged for Docker.

## Features

- **Links** — add, edit, and delete URL + optional label entries; URLs are validated (`http`/`https`).
- **Notes** — add, edit, and delete freeform text notes.
- **Collapsible panels** — the whole Links/Notes sections collapse on load; expand by clicking the heading.
- **Inline expandable notes** — long notes are clamped to 10 lines with a *Show more / Show less* toggle; note text renders like a code block (monospace, preserves indentation).
- **Newest first** — links and notes are displayed newest → oldest.
- **Atomic, race-safe storage** — writes are serialized through a queue and written atomically (temp file + rename), so concurrent edits can't corrupt the file.
- **Mobile-responsive** — single column on small screens, side-by-side on wide desktops (CSS `auto-fit`, no separate layouts).
- **Accessible** — labelled form fields, `aria-live` status messages, keyboard-friendly controls.

## Tech Stack

| Part | Technology |
| ---- | ---------- |
| Frontend | HTML5 + CSS3 + vanilla JavaScript (no framework) |
| Backend | Node.js + Express |
| Storage | A single `data.json` flat file on the server disk |
| Fonts | Manrope (UI), system monospace (notes) |

## Where Your Data Is Saved

All links and notes live in **one JSON file on the server**, created automatically on first run:

```json
{
  "links": [ { "id": "uuid", "label": "Perplexity", "url": "https://perplexity.ai", "createdAt": "ISO timestamp" } ],
  "notes": [ { "id": "uuid", "text": "Remember to renew domain", "createdAt": "ISO timestamp" } ]
}
```

- **Docker:** `./data/data.json` on the host, bind-mounted to `/app/data/data.json` inside the container (`DATA_PATH=/app/data/data.json`).
- **Bare metal:** `./data.json` next to `server.js` (override with the `DATA_PATH` env var).

There is **no database** — the flat file is the source of truth. Restarting the server or container never loses data.

> `data/`, `data.json`, and `node_modules/` are gitignored. Your personal data is **not** committed to git.

## Backup / Export & Import

**There is currently no export/import feature in the UI** (planned as a future enhancement).

To back up manually, copy the data file:

```bash
cp data/data.json ~/homepage-backup-$(date +%F).json
# or Docker:
docker cp homepage:/app/data/data.json ~/homepage-backup-$(date +%F).json
```

To **restore**, stop the container, replace the file, and start it again:

```bash
docker compose stop
cp ~/homepage-backup-2026-09-19.json data/data.json
docker compose start
```

Everything is JSON, so the file can also be edited by hand while the server is stopped.

## API Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET`   | `/api/data`      | Read full contents of `data.json` |
| `POST`  | `/api/links`     | Add a link (`{ url, label? }`) — returns updated list |
| `PUT`   | `/api/links/:id` | Edit a link |
| `DELETE`| `/api/links/:id` | Delete a link |
| `POST`  | `/api/notes`     | Add a note (`{ text }`) — returns updated list |
| `PUT`   | `/api/notes/:id` | Edit a note |
| `DELETE`| `/api/notes/:id` | Delete a note |

## File Structure

```
├── server.js           Express server: static frontend + API + file storage
├── package.json        Dependencies + start script
├── Dockerfile          Container build (node:20-alpine)
├── docker-compose.yml  Service: port 3000, restart policy, data volume
├── data/               Runtime data (gitignored) -> contains data.json
├── public/
│   ├── index.html      Single page structure
│   ├── style.css       Styling (dark violet theme)
│   └── app.js          Frontend logic: fetch, render, CRUD
└── AGENTS.md           Project spec / agent instructions
```

## Deployment

### Docker (recommended)

```bash
docker compose up -d --build
```

Open `http://<server-ip>:3000`. The container restarts automatically (`restart: unless-stopped`) and runs as UID 1000 so it can write the mounted data dir.

The first time you deploy on a *new* host, pre-create the data dir with the right owner (the container runs as UID 1000):

```bash
mkdir -p data && sudo chown 1000:1000 data
docker compose up -d --build
```

(On the machine where this was built, `./data` already exists and is owned correctly.)

### Bare metal

```bash
# Node.js >= 20 required
npm install
npm start            # or: node server.js
```

The server binds to `0.0.0.0` so it's reachable from other devices.

### Configuration (env vars)

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `3000` | Port the server listens on |
| `DATA_PATH` | `./data.json` | Path to the data file (e.g. `/app/data/data.json`) |

### Security note

This app is intentionally **single-user with no authentication** — anyone who can reach port 3000 can read *and* edit your links/notes. For a public VPS, put it behind a reverse proxy (e.g. Caddy/nginx with a password or TLS) or keep it private on your LAN/VPN. Basic HTTP auth is a planned future enhancement.

## HTTPS via Cloudflare Tunnel (recommended for public access)

No Caddy or open firewall ports needed — Cloudflare terminates TLS at its edge and pipes requests through an outbound-only tunnel to your server. The app's PWA/service worker work because the browser still sees `https://`.

1. Create a tunnel in the Cloudflare dashboard: **Zero Trust → Networks → Tunnels → Create a tunnel** (choose **Cloudflared**).
2. Copy the tunnel **token** and save it next to the compose file:

   ```bash
   cp .env.example .env   # then paste your token: TUNNEL_TOKEN=...
   ```

3. On the tunnel's **Public Hostname** page, wire a hostname to the service:

   ```
   Type: HTTP
   URL:  homepage:3000
   ```

   (`homepage` resolves to the container on the compose network internally.)

4. Start the tunnel container (the homepage service runs as usual):

   ```bash
   docker compose up -d --build          # homepage only
   docker compose --profile tunnel up -d # + cloudflared tunnel
   ```

Once the tunnel is up, your hostname serves the app over HTTPS. Anyone reaching it can edit your data — add Cloudflare Access (Zero Trust → Access → Applications) in front of the hostname if you want it password-protected.

> The `cloudflared` service is profile-gated so normal `docker compose up -d` never requires a token.