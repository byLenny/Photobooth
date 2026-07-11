# Photoboth

A self-hosted photobooth webapp. Runs in Docker, uses a webcam connected to
the machine it's displayed on, saves photos to disk, and is configured
entirely through a web-based admin panel — no printing, no cloud services.

- **Kiosk screen** (`/`) — touch-first capture flow: tap **Take Photo**,
  countdown, single shot or multi-shot collage, optional filter/branding
  overlay, on-screen gallery, and a QR code / download link for guests.
- **Admin panel** (`/admin`) — PIN-protected settings (countdown length,
  shot mode, filters, branding overlay, gallery/QR toggles, retention) and a
  session history browser to revisit any past session and its QR code.

## How camera access works

The **browser** captures photos via `getUserMedia`, not the Docker
container — the container never touches `/dev/video*`. This is why the app
works identically on Linux, macOS, and **Windows**, and why no `--device`
flags or privileged containers are needed.

Practical implication: the browser tab showing the kiosk screen must be
running on **the same physical machine the webcam is plugged into**, opened
at `http://localhost:<port>` (browsers treat `localhost` as a secure
context, so camera permission works with plain HTTP). If you want the kiosk
display to be a *different* device than the Docker host, you'll need to
serve the app over HTTPS (e.g. a reverse proxy with a self-signed
certificate) — not set up out of the box.

## Quick start

Requires Docker with Compose v2 (Docker Desktop on macOS/Windows, or
Docker Engine + the `docker compose` plugin on Linux).

```bash
docker compose up --build
```

Then, **on the machine the webcam is attached to**, open a browser at:

```
http://localhost:8080
```

Grant camera permission when prompted, pick a camera if more than one is
connected, and tap **Take Photo**.

### Windows

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
and enable the **WSL2** backend (Settings → General → "Use the WSL 2 based
engine"). No other Windows-specific configuration is required — run
`docker compose up --build` from PowerShell/WSL in the project folder, then
open `http://localhost:8080` in Edge or Chrome on the same PC as the
webcam and allow camera access when prompted.

### macOS / Linux

Same command, same URL. On Linux, make sure your user can run Docker
without `sudo` (or prefix commands with `sudo`), and that the webcam shows
up under `/dev/video*` on the host — the browser will list it once you
grant camera permission.

## First-run setup

1. Open `http://localhost:8080/admin`.
2. Log in with the default PIN `1234` (set via the `ADMIN_PIN` environment
   variable in `docker-compose.yml` — change it here before going live).
3. Immediately set a new PIN under **Admin PIN** on the settings page.
4. Configure countdown length, shot mode (single vs. collage), filter, and
   optionally upload a branding overlay (a transparent PNG the same
   aspect ratio as your camera feed works best).
5. If the booth will be reached from other devices under a LAN hostname or
   IP (e.g. for admins visiting `/admin` from a phone), set **Public base
   URL** so QR codes point to a reachable address instead of `localhost`.

The **session history** tab under `/admin/history` lists every past
session — open one to view its original and branded photos and re-display
its QR code / share link.

## Data & backups

Everything lives under a single directory mounted at `/data` inside the
container (the `photoboth-data` named volume in `docker-compose.yml`):

```
/data/
  photobooth.db       # settings + session metadata (SQLite)
  photos/
    <sessionId>/
      original-1.jpg  # unedited shot(s)
      branded.jpg      # filtered/branded result shown to guests
    overlays/          # uploaded branding assets
```

To back up, stop the container and copy the volume (or bind-mount `/data`
to a host folder instead of a named volume and back that up directly). To
restore, put the directory back before starting the container again.

## Building the image yourself

The `Dockerfile` is multi-stage and builds cleanly for both `linux/amd64`
and `linux/arm64` (e.g. Raspberry Pi), since both native dependencies used
by the backend (`sharp` for image processing, `better-sqlite3` for
storage) ship prebuilt binaries for those platforms:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t photoboth:latest .
```

## Local development (without Docker)

```bash
npm install
npm run dev:backend    # Fastify API on :8080, writes to ./backend/data
npm run dev:frontend   # Vite dev server on :5173, proxies /api to :8080
```

Open `http://localhost:5173` while developing the UI; use
`http://localhost:8080` once you've run `npm run build` to test the
production build served directly by the backend.

## Scope / limitations

- USB and integrated **webcams only** (standard browser camera APIs) — no
  DSLR/gphoto2 support.
- No printing support.
- Single kiosk display per instance; the admin panel can be used from any
  device on the same network.
