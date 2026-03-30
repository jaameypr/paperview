# Dokument Kommentare

Eine passwortgeschützte Webanwendung zum gemeinsamen Kommentieren eines PDF-Dokuments.

## Features

- **Passwortschutz** — Globales Passwort schützt die App und die PDF-Datei selbst
- **Geschützte PDF-Auslieferung** — PDF liegt nicht in `public/`, sondern wird über `/api/document` mit Auth-Check ausgeliefert
- **PDF-Viewer** — Vertikales Scrollen aller Seiten, aktuelle Seite per IntersectionObserver ermittelt
- **Text markieren** — Text im PDF auswählen → Popover → Kommentar mit Markierung speichern
- **Highlight-Overlay** — Markierungen anderer Nutzer werden beim Laden wieder angezeigt
- **Kommentare** — Mit oder ohne Textmarkierung, Seite, Autor (lokal gespeichert)
- **Antworten** — Jeder Kommentar kann Antworten erhalten
- **Auflösen / Löschen** — Kommentare können aufgelöst oder gelöscht werden
- **Filter** — Nach Seite, nach Status (offen / aufgelöst / alle)
- **Live-Sync** — Polling alle 5 Sekunden

## Tech Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Sprache | TypeScript |
| Styling | Tailwind CSS |
| Datenbank | MongoDB + Mongoose |
| PDF-Anzeige | react-pdf / pdfjs-dist |
| Auth | HMAC-SHA256-signierte Cookies |

---

## Setup

### 1. Voraussetzungen

- Node.js 18 oder neuer
- MongoDB (lokal oder Atlas)

### 2. Abhängigkeiten installieren

```bash
npm install
```

### 3. Environment-Variablen

```bash
cp .env.example .env.local
```

Werte in `.env.local` eintragen:

```env
MONGODB_URI=mongodb://localhost:27017/document-comments
DOC_PASSWORD=dein-geheimes-passwort
AUTH_SECRET=langer-zufaelliger-string
```

AUTH_SECRET generieren:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. PDF ablegen — WICHTIG

Die PDF-Datei muss hier abgelegt werden:

```
protected-assets/document.pdf
```

**Nicht** in `public/` — sonst ist sie ohne Passwort erreichbar.

Die Datei wird über `/api/document` (geschützt) ausgeliefert.

### 5. Starten

```bash
npm run dev
# → http://localhost:3000
```

---

## Projektstruktur

```
document-comments/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          → Redirect zu /doc oder /login
│   ├── globals.css
│   ├── login/page.tsx                    → Login
│   ├── doc/page.tsx                      → Geschützte Dokumentseite
│   └── api/
│       ├── document/route.ts             → GET  /api/document (PDF-Stream, geschützt)
│       ├── login/route.ts                → POST /api/login
│       ├── logout/route.ts               → POST /api/logout
│       └── comments/
│           ├── route.ts                  → GET / POST /api/comments
│           └── [id]/
│               ├── route.ts              → PATCH / DELETE /api/comments/:id
│               └── replies/route.ts      → POST /api/comments/:id/replies
├── components/
│   ├── doc-client.tsx                    → Haupt-Client-Komponente
│   ├── pdf-viewer.tsx                    → Scroll-Viewer, Highlights, Selektion
│   ├── comment-list.tsx                  → Kommentarliste mit Replies / Aktionen
│   └── comment-form.tsx                  → Formular (localStorage, Markierungs-Prefill)
├── lib/
│   ├── auth.ts                           → HMAC-Token (Node.js)
│   └── mongodb.ts                        → Mongoose-Singleton
├── models/Comment.ts                     → Schema (quote, highlights, replies, resolved)
├── types/comment.ts                      → Gemeinsame TypeScript-Typen
├── protected-assets/
│   └── document.pdf                      → ← HIER deine PDF ablegen
├── proxy.ts                              → Next.js 16 Proxy (Edge Runtime)
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## API-Endpunkte

| Method | Pfad | Beschreibung |
|---|---|---|
| GET | `/api/document` | PDF-Datei streamen (geschützt) |
| POST | `/api/login` | Passwort prüfen, Cookie setzen |
| POST | `/api/logout` | Cookie löschen |
| GET | `/api/comments` | Alle Kommentare |
| GET | `/api/comments?page=2` | Kommentare für Seite 2 |
| GET | `/api/comments?status=open` | Nur offene Kommentare |
| POST | `/api/comments` | Neuen Kommentar anlegen |
| PATCH | `/api/comments/:id` | Kommentar auflösen / erneut öffnen |
| DELETE | `/api/comments/:id` | Kommentar + Replies löschen |
| POST | `/api/comments/:id/replies` | Antwort hinzufügen |

### POST /api/comments – Body

```json
{
  "author": "Max",
  "page": 3,
  "text": "Sehr interessanter Abschnitt!",
  "quote": "Der markierte Text",
  "highlightRects": [
    { "x": 10.5, "y": 23.1, "width": 55.3, "height": 1.8 }
  ]
}
```

- `author` optional → Standard: `"Anonym"`
- `page` Pflicht, ganze Zahl ≥ 1
- `text` Pflicht
- `quote` + `highlightRects` optional (nur wenn Text markiert wurde)

### PATCH /api/comments/:id – Body

```json
{ "resolved": true }
```

---

## Markierungen verwenden

1. Text in der PDF mit der Maus auswählen
2. Popover erscheint → „Kommentieren" klicken
3. Das Formular im rechten Panel wird mit dem markierten Text vorausgefüllt
4. Kommentartext eingeben und absenden
5. Markierung erscheint bei allen Nutzern als gelbe Überlagerung

Beim Klick auf einen Kommentar mit Markierung: PDF scrollt zur entsprechenden Seite.
Beim Klick auf eine Markierung im PDF: Kommentar wird im Panel hervorgehoben.

---

## Sicherheit

- PDF liegt in `protected-assets/` — **nicht** unter `public/`
- `/api/document` prüft Auth-Cookie vor der Auslieferung
- Passwort nur aus `.env.local`, niemals im Code
- Passwortvergleich timing-safe (`timingSafeEqual`)
- Auth-Cookie: `httpOnly`, `sameSite=lax`, `secure` in Production, HMAC-signiert
- Doppelte Auth-Prüfung: `proxy.ts` (Edge) + Route Handler (Node.js)

---

## Docker / Docker Compose

Die gesamte App (Next.js + MongoDB) lässt sich mit **einem einzigen Befehl** starten.

### Voraussetzungen

- Docker und Docker Compose (v2) installiert
- PDF-Datei unter `protected-assets/document.pdf` abgelegt

### 1. Environment-Variablen anlegen

```bash
cp .env.example .env
```

In `.env` mindestens diese Werte setzen:

```env
DOC_PASSWORD=dein-geheimes-passwort
AUTH_SECRET=langer-zufaelliger-string
```

> `MONGODB_URI` muss **nicht** gesetzt werden — Docker Compose setzt es automatisch auf `mongodb://mongodb:27017/document-comments`.

AUTH_SECRET generieren:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# oder ohne Node:
openssl rand -hex 32
```

### 2. Starten

```bash
docker compose up --build
```

Die App ist danach erreichbar unter: **http://localhost:7070**

Beim ersten Start wird das Docker-Image gebaut — danach startet alles in Sekunden.

### 3. Im Hintergrund starten

```bash
docker compose up --build -d
```

### 4. Stoppen

```bash
# Container stoppen (Daten bleiben erhalten)
docker compose down

# Container stoppen UND MongoDB-Daten löschen
docker compose down -v
```

### 5. Logs ansehen

```bash
docker compose logs -f app
docker compose logs -f mongodb
```

### Architektur

| Service    | Container-Name             | Beschreibung                      |
|------------|----------------------------|-----------------------------------|
| `app`      | document-comments-app      | Next.js 16 (Standalone, Host-Port 7070 → Container 3000)|
| `mongodb`  | document-comments-mongo    | MongoDB 7 (Host-Port 27018 → Container 27017, persistentes Volume)|

- MongoDB-Daten werden in einem Docker-Volume (`mongo-data`) gespeichert und überleben Neustarts.
- Die App wartet auf den MongoDB-Healthcheck, bevor sie startet.
- Beide Container starten automatisch neu (`unless-stopped`).

---

## Hinweis zu Next.js 16

Dieses Projekt nutzt Next.js 16-Muster: `proxy.ts` statt `middleware.ts`, async `cookies()`, App Router.

Falls `npm install` mit `^16.0.0` fehlschlägt:
```json
"next": "^15.3.0"
```
Alle Patterns sind mit Next.js 15 identisch.
