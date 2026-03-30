# Paperview

A self-hosted PDF viewer with text highlighting, threaded comments, and a shared review experience — built with Next.js and MongoDB.

## Features

- **Password protection** — A global password protects the app and the PDF file itself
- **Secure PDF delivery** — The PDF is not served from `public/`; instead it is streamed via `/api/document` with an auth check
- **PDF viewer** — Vertical scrolling through all pages, current page detected via IntersectionObserver
- **Text highlighting** — Select text in the PDF → popover → save a comment with highlight
- **Highlight overlay** — Other users' highlights are rendered on page load
- **Comments** — With or without text highlight, page number, author (stored locally)
- **Replies** — Every comment supports threaded replies
- **Resolve / Delete** — Comments can be resolved or deleted
- **Filters** — By page, by status (open / resolved / all)
- **Live sync** — Polling every 5 seconds

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | MongoDB + Mongoose |
| PDF rendering | react-pdf / pdfjs-dist |
| Auth | HMAC-SHA256 signed cookies |

---

## Setup

### 1. Prerequisites

- Node.js 18 or newer
- MongoDB (local or Atlas)

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in the values in `.env.local`:

```env
MONGODB_URI=mongodb://localhost:27017/document-comments
DOC_PASSWORD=your-secret-password
AUTH_SECRET=long-random-string
```

Generate an AUTH_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Place the PDF — IMPORTANT

The PDF file must be placed at:

```
protected-assets/document.pdf
```

**Not** in `public/` — otherwise it would be accessible without a password.

The file is served via `/api/document` (protected).

### 5. Start

```bash
npm run dev
# → http://localhost:3000
```

---

## Project Structure

```
paperview/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          → Redirect to /doc or /login
│   ├── globals.css
│   ├── login/page.tsx                    → Login
│   ├── doc/page.tsx                      → Protected document page
│   └── api/
│       ├── document/route.ts             → GET  /api/document (PDF stream, protected)
│       ├── login/route.ts                → POST /api/login
│       ├── logout/route.ts               → POST /api/logout
│       └── comments/
│           ├── route.ts                  → GET / POST /api/comments
│           └── [id]/
│               ├── route.ts              → PATCH / DELETE /api/comments/:id
│               └── replies/route.ts      → POST /api/comments/:id/replies
├── components/
│   ├── doc-client.tsx                    → Main client component
│   ├── pdf-viewer.tsx                    → Scroll viewer, highlights, selection
│   ├── comment-list.tsx                  → Comment list with replies / actions
│   └── comment-form.tsx                  → Form (localStorage, highlight prefill)
├── lib/
│   ├── auth.ts                           → HMAC token (Node.js)
│   └── mongodb.ts                        → Mongoose singleton
├── models/Comment.ts                     → Schema (quote, highlights, replies, resolved)
├── types/comment.ts                      → Shared TypeScript types
├── protected-assets/
│   └── document.pdf                      → ← Place your PDF here
├── proxy.ts                              → Next.js 16 Proxy (Edge Runtime)
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/document` | Stream PDF file (protected) |
| POST | `/api/login` | Verify password, set cookie |
| POST | `/api/logout` | Clear cookie |
| GET | `/api/comments` | All comments |
| GET | `/api/comments?page=2` | Comments for page 2 |
| GET | `/api/comments?status=open` | Only open comments |
| POST | `/api/comments` | Create a new comment |
| PATCH | `/api/comments/:id` | Resolve / reopen a comment |
| DELETE | `/api/comments/:id` | Delete comment + replies |
| POST | `/api/comments/:id/replies` | Add a reply |

### POST /api/comments — Body

```json
{
  "author": "Max",
  "page": 3,
  "text": "Very interesting section!",
  "quote": "The selected text",
  "highlightRects": [
    { "x": 10.5, "y": 23.1, "width": 55.3, "height": 1.8 }
  ]
}
```

- `author` optional → defaults to `"Anonym"`
- `page` required, integer ≥ 1
- `text` required
- `quote` + `highlightRects` optional (only present when text was selected)

### PATCH /api/comments/:id — Body

```json
{ "resolved": true }
```

---

## Using Highlights

1. Select text in the PDF with your mouse
2. A popover appears → click "Comment"
3. The form in the right panel is pre-filled with the selected text
4. Enter your comment and submit
5. The highlight appears for all users as a yellow overlay

Clicking a comment with a highlight: the PDF scrolls to the corresponding page.
Clicking a highlight in the PDF: the comment is focused in the panel.

---

## Security

- The PDF is stored in `protected-assets/` — **not** under `public/`
- `/api/document` checks the auth cookie before serving the file
- The password is read only from `.env.local`, never hardcoded
- Password comparison is timing-safe (`timingSafeEqual`)
- Auth cookie: `httpOnly`, `sameSite=lax`, `secure` in production, HMAC-signed
- Dual auth check: `proxy.ts` (Edge) + route handler (Node.js)

---

## Docker / Docker Compose

The entire app (Next.js + MongoDB) can be started with **a single command**.

### Prerequisites

- Docker and Docker Compose (v2) installed
- PDF file placed at `protected-assets/document.pdf`

### 1. Set up environment variables

```bash
cp .env.example .env
```

Set at least these values in `.env`:

```env
DOC_PASSWORD=your-secret-password
AUTH_SECRET=long-random-string
```

> `MONGODB_URI` does **not** need to be set — Docker Compose automatically configures it as `mongodb://mongodb:27017/document-comments`.

Generate an AUTH_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# or without Node:
openssl rand -hex 32
```

### 2. Start

```bash
docker compose up --build
```

The app is then available at: **http://localhost:7070**

On first start the Docker image is built — after that everything starts in seconds.

### 3. Start in background

```bash
docker compose up --build -d
```

### 4. Stop

```bash
# Stop containers (data is preserved)
docker compose down

# Stop containers AND delete MongoDB data
docker compose down -v
```

### 5. View logs

```bash
docker compose logs -f app
docker compose logs -f mongodb
```

### Architecture

| Service    | Container Name             | Description                      |
|------------|----------------------------|-----------------------------------|
| `app`      | document-comments-app      | Next.js 16 (standalone, host port 7070 → container 3000)|
| `mongodb`  | document-comments-mongo    | MongoDB 7 (host port 27018 → container 27017, persistent volume)|

- MongoDB data is stored in a Docker volume (`mongo-data`) and survives restarts.
- The app waits for the MongoDB healthcheck before starting.
- Both containers restart automatically (`unless-stopped`).

---

## Note on Next.js 16

This project uses Next.js 16 patterns: `proxy.ts` instead of `middleware.ts`, async `cookies()`, App Router.

If `npm install` fails with `^16.0.0`:
```json
"next": "^15.3.0"
```
All patterns are identical to Next.js 15.
