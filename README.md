# Paperview

A self-hosted multi-file sharing and review platform — upload, preview, comment on, and collaborate over documents, code, images, videos, audio, and more.

## Features

- **Multi-type file sharing** — PDF, code, images, video, audio, text, markdown, and more
- **Immutable versioning** — every upload creates a new version; old versions and their comments are preserved
- **Threaded comments** — with replies, resolve/reopen, and delete
- **Real-time updates** — Server-Sent Events (SSE) push comment and version changes live (no polling)
- **User system** — admin and user roles with bootstrap admin on first startup
- **Share access control** — private, public, or password-protected shares with viewer/commenter/editor roles
- **Expiration dates** — shares can auto-expire
- **Content viewers** — per-type preview with syntax highlighting, PDF rendering, media players
- **Dark mode** — system-aware with manual toggle
- **Docker support** — single-command startup with Docker Compose

## Supported File Types

| Type | Extensions | Preview | Comments | Download | Notes |
|------|-----------|---------|----------|----------|-------|
| PDF | pdf | ✅ Viewer | ✅ | ✅ | Embedded iframe viewer |
| Code | js, ts, jsx, tsx, py, cs, java, cpp, c, go, rs, php, rb, swift, kt, scala, sh, bash, ps1, sql, html, css, scss | ✅ Syntax highlighted | ✅ | ✅ | Line numbers, language detection |
| Image | png, jpg, jpeg, gif, webp, svg | ✅ Viewer | ❌ | ✅ | Responsive display |
| Video | mp4, webm, ogg | ✅ Player | ❌ | ✅ | HTML5 video with controls |
| Audio | mp3, wav, ogg, m4a | ✅ Player | ❌ | ✅ | HTML5 audio with controls |
| Markdown | md, markdown | ✅ Rendered | ✅ | ✅ | Rendered with remark-gfm |
| Text/Data | txt, json, yaml, yml, xml, toml, csv, log, env, conf | ✅ Viewer | ✅ | ✅ | Monospace with line numbers |
| Office | docx, xlsx, pptx, odt, ods, odp | ❌ | ❌ | ✅ | Download only (MVP) |
| Archives | zip, 7z, rar, tar, gz | ❌ | ❌ | ✅ | Download only |
| Unknown | * | ❌ | ❌ | ✅ | Download only |

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | MongoDB + Mongoose |
| Auth | bcrypt + HMAC-SHA256 signed cookies |
| Real-time | Server-Sent Events (SSE) |
| Storage | Local filesystem (protected, not in public/) |

---

## Setup

### 1. Prerequisites

- Node.js 18+ (or Docker)
- MongoDB (local, Atlas, or via Docker)

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
MONGODB_URI=mongodb://localhost:27017/paperview
AUTH_SECRET=long-random-string
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=change-me-on-first-login
```

Generate an AUTH_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Start

```bash
npm run dev
# → http://localhost:3000
```

### 5. First login

On first startup, a bootstrap admin account is created automatically from the `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` environment variables.

When you log in with the bootstrap admin:
1. Authentication succeeds
2. You are redirected to a **mandatory password change** page
3. You must set a new password before using the platform
4. After changing, `mustChangePassword` is set to `false`

---

## Architecture

### Versioning / Snapshots

- A **Share** is the stable top-level object (the link users share)
- A **ShareVersion** is an immutable snapshot of the content
- The share always points to one **currentVersionId**
- Comments belong to a specific **version**, not the share
- Uploading a new file creates a new version — old versions with their comments remain accessible
- Restoring an old version creates a **new version** based on it (history is never mutated)

Example: v1 → v2 → v3 → restore v1 → creates v4 (copy of v1's content)

### Real-time Updates (SSE)

All polling has been replaced with Server-Sent Events:
- Each share version has an SSE endpoint at `/api/shares/:id/versions/:versionId/events`
- Comment creation, updates, deletion, and replies are pushed to all connected clients
- In-memory pub/sub channels with automatic cleanup on disconnect

### Access Control

| Visibility | Who can access |
|---|---|
| `private` | Owner, admin, and invited collaborators only |
| `public` | Anyone with the link |
| `public_password` | Anyone with the link + correct share password |

Collaborator roles: `viewer`, `commenter`, `editor`

### Security

- User passwords hashed with bcrypt (12 rounds)
- Share passwords hashed with bcrypt (10 rounds)
- Auth tokens: HMAC-SHA256 signed, `httpOnly`, `sameSite=lax`, `secure` in production
- Files stored outside `public/` — served through authenticated route handlers
- Expired shares deny access (admin/owner can still manage)

---

## Project Structure

```
paperview/
├── app/
│   ├── layout.tsx                        → Root layout with AuthProvider
│   ├── page.tsx                          → Redirect to dashboard/login
│   ├── globals.css
│   ├── login/page.tsx                    → Username + password login
│   ├── change-password/page.tsx          → Forced password change flow
│   ├── dashboard/page.tsx                → Share list with active/expired sections
│   ├── shares/
│   │   ├── new/page.tsx                  → Upload and create share
│   │   └── [id]/page.tsx                 → Share detail, viewer, comments
│   ├── admin/users/page.tsx              → User management (admin only)
│   └── api/
│       ├── auth/                         → login, logout, change-password, me
│       ├── admin/users/                  → User CRUD (admin only)
│       └── shares/                       → Share CRUD, versions, comments, SSE, files
├── components/
│   ├── layout/app-shell.tsx              → App shell with sidebar nav
│   ├── viewers/                          → Per-type content viewers
│   └── shares/comment-panel.tsx          → Comments with replies, SSE updates
├── hooks/
│   ├── useAuth.tsx                       → Auth context provider
│   ├── useSSE.ts                         → EventSource hook with auto-reconnect
│   └── useTheme.ts                       → Dark mode toggle
├── lib/
│   ├── auth.ts                           → Password hashing, token signing
│   ├── bootstrap.ts                      → Admin auto-creation on startup
│   ├── access.ts                         → Share-level permission checks
│   ├── storage.ts                        → File I/O for uploaded content
│   ├── sse.ts                            → In-memory pub/sub for SSE
│   └── mongodb.ts                        → Mongoose connection singleton
├── models/                               → Mongoose schemas
├── types/                                → TypeScript interfaces and type maps
├── storage/                              → Uploaded files (gitignored)
├── proxy.ts                              → Next.js 16 auth proxy (Edge Runtime)
└── docker-compose.yml
```

---

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login with username + password |
| POST | `/api/auth/logout` | Clear auth cookie |
| POST | `/api/auth/change-password` | Change password (required for bootstrap admin) |
| GET | `/api/auth/me` | Get current user info |

### Admin
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users` | Create a new user |
| PATCH | `/api/admin/users/:id` | Update user (deactivate, reset password) |
| DELETE | `/api/admin/users/:id` | Delete user |

### Shares
| Method | Path | Description |
|---|---|---|
| GET | `/api/shares` | List shares accessible to current user |
| POST | `/api/shares` | Create a new share (multipart form upload) |
| GET | `/api/shares/:id` | Get share details + versions |
| PATCH | `/api/shares/:id` | Update share metadata |
| DELETE | `/api/shares/:id` | Delete share and all versions |
| POST | `/api/shares/:id/access` | Unlock password-protected share |

### Versions
| Method | Path | Description |
|---|---|---|
| POST | `/api/shares/:id/versions` | Upload new version |
| POST | `/api/shares/:id/versions/:vId/restore` | Restore old version (creates new) |
| GET | `/api/shares/:id/versions/:vId/file` | Download file |
| GET | `/api/shares/:id/versions/:vId/content` | Preview content (text/binary stream) |
| GET | `/api/shares/:id/versions/:vId/events` | SSE event stream |

### Comments
| Method | Path | Description |
|---|---|---|
| GET | `/api/shares/:id/versions/:vId/comments` | List comments |
| POST | `/api/shares/:id/versions/:vId/comments` | Create comment |
| PATCH | `/api/shares/:id/versions/:vId/comments/:cId` | Update/resolve comment |
| DELETE | `/api/shares/:id/versions/:vId/comments/:cId` | Delete comment |
| POST | `/api/shares/:id/versions/:vId/comments/:cId/replies` | Add reply |

### Collaborators
| Method | Path | Description |
|---|---|---|
| GET | `/api/shares/:id/collaborators` | List collaborators |
| POST | `/api/shares/:id/collaborators` | Add collaborator |
| DELETE | `/api/shares/:id/collaborators/:userId` | Remove collaborator |

---

## Docker / Docker Compose

Start the entire platform (Next.js + MongoDB) with **one command**.

### Prerequisites

- Docker and Docker Compose (v2) installed

### 1. Environment variables

```bash
cp .env.example .env
```

Set in `.env`:
```env
AUTH_SECRET=long-random-string
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=change-me-on-first-login
```

> `MONGODB_URI` is set automatically by Docker Compose.

Generate a secret:
```bash
openssl rand -hex 32
```

### 2. Start

```bash
docker compose up --build
```

App available at: **http://localhost:7070**

### 3. Background mode

```bash
docker compose up --build -d
```

### 4. Stop

```bash
# Stop containers (data preserved)
docker compose down

# Stop and delete all data (MongoDB + uploaded files)
docker compose down -v
```

### 5. Logs

```bash
docker compose logs -f app
docker compose logs -f mongodb
```

### Container architecture

| Service | Container | Description |
|---------|-----------|-------------|
| `app` | paperview-app | Next.js 16 standalone (host 7070 → container 3000) |
| `mongodb` | paperview-mongo | MongoDB 7 (host 27018 → container 27017) |

- MongoDB data persists in `mongo-data` volume
- Uploaded files persist in `file-storage` volume
- MongoDB healthcheck gates app startup
- Both containers restart automatically (`unless-stopped`)

---

## Reverse Proxy / Tunnel Deployment

Paperview works behind Cloudflare Tunnel, Nginx, Traefik, Caddy, or any reverse proxy.

### Requirements

Your proxy must forward these headers to the Next.js container:

| Header | Value | Example |
|--------|-------|---------|
| `Host` | The public hostname | `shareables.example.com` |
| `X-Forwarded-Proto` | `https` | `https` |
| `X-Forwarded-For` | Client IP | `203.0.113.42` |

### Cloudflare Tunnel

Cloudflare Tunnel forwards these headers automatically. Just point the tunnel to your Docker host:

```yaml
# ~/.cloudflared/config.yml
ingress:
  - hostname: shareables.example.com
    service: http://localhost:7070
  - service: http_status:404
```

No extra environment variables are needed — `next.config.ts` includes `experimental.trustHostHeader: true` which tells Next.js to use the forwarded Host header for URL construction and routing. The Dockerfile patches this flag into the standalone build (Next.js hardcodes it to `false` for non-Vercel deployments).

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name shareables.example.com;

    location / {
        proxy_pass http://localhost:7070;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
    }
}
```

### Important notes

- `HOSTNAME=0.0.0.0` in the Dockerfile is the **bind address** only. With `trustHostHeader` enabled, the proxy's `Host` header is used for URL construction — not `HOSTNAME`.
- Auth cookies use `secure: true` in production (`NODE_ENV=production`), so HTTPS is required for login to work behind a proxy.
- The proxy (middleware) reads `X-Forwarded-Host` and `X-Forwarded-Proto` to build correct redirect URLs.

---

## Note on Next.js 16

This project uses Next.js 16: `proxy.ts` instead of `middleware.ts`, async `cookies()`, route params as `Promise`. Compatible with Next.js 15.3+.
