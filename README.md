# Photoboth

A self-hosted photobooth webapp. Runs in Docker, uses a webcam connected to
the machine it's displayed on, saves photos to disk, and is configured
entirely through a web-based admin panel — no printing, no cloud services.

- **Kiosk screen** (`/`) — touch-first capture flow: tap **Take Photo**,
  countdown, single shot or multi-shot collage, optional filter/branding
  overlay, on-screen gallery, and a QR code / download link for guests.
- **Admin panel** (`/admin`) — PIN-protected settings (countdown length,
  photos per session (1–5), filters, branding overlay, gallery/QR toggles,
  retention) that auto-save as you change them, a camera/resolution/frame-rate
  picker, and a session history browser to revisit any past session and its
  QR code.

## How camera access works

Photoboth supports two camera sources, picked in **Admin → Settings →
Camera → Camera source**:

- **Webcam (default).** The **browser** captures photos via `getUserMedia`,
  not the Docker container — the container never touches `/dev/video*`.
  This is why the app works identically on Linux, macOS, and **Windows**,
  and why no `--device` flags or privileged containers are needed.

  Practical implication: the browser tab showing the kiosk screen must be
  running on **the same physical machine the webcam is plugged into**,
  opened at `http://localhost:<port>` (browsers treat `localhost` as a
  secure context, so camera permission works with plain HTTP). If you want
  the kiosk display to be a *different* device than the Docker host, you'll
  need to serve the app over HTTPS — see "Enabling HTTPS" below.

- **RTSP stream.** For a network/IP camera, set **Camera source** to "RTSP
  stream" and enter its `rtsp://` URL (credentials can be embedded in the
  URL, e.g. `rtsp://user:pass@192.168.1.50:554/stream`). Unlike the webcam
  path, this is handled entirely by the **backend**: it shells out to
  `ffmpeg` to decode the stream and re-serve it to browsers as an MJPEG
  preview (`GET /api/camera/preview`) and on-demand still frames
  (`GET /api/camera/snapshot`) for each shot. This means the kiosk browser
  no longer needs local camera permission or to run on the camera's
  machine — only the backend needs network access to the RTSP source. The
  RTSP URL itself is only ever readable from the authenticated admin
  settings endpoint, never the public one the kiosk uses, since it can
  carry credentials. Use **Test connection** on the settings page to
  confirm the backend can reach the stream before going live.

  The Docker image already includes `ffmpeg`. Running the backend outside
  Docker (see "Local development" below) requires `ffmpeg` to be installed
  and on `PATH` yourself if you want to use the RTSP source — it's not
  needed for the webcam source.

## Enabling HTTPS (for a kiosk on a different device)

Only needed if the browser will open the app from something other than
`localhost`/`127.0.0.1` (e.g. a LAN IP or hostname) — browsers block camera
access outside of a secure context. The backend can terminate TLS itself if
you give it a certificate and key.

The easiest way to get a certificate your browser trusts (no "unsafe site"
warning, which would otherwise block the camera permission prompt) is
[mkcert](https://github.com/FiloSottile/mkcert):

```bash
# Install mkcert (macOS: brew install mkcert; see its README for other OSes),
# then install its local CA into your system/browser trust store once:
mkcert -install

# Generate a cert for however the kiosk browser will address the booth —
# hostname, LAN IP, or both:
mkdir -p certs
mkcert -cert-file certs/cert.pem -key-file certs/key.pem photobooth.local 192.168.1.50
```

> **Host path vs. container path:** `certs/cert.pem` above is where the file
> lands on your machine. `TLS_CERT_FILE`/`TLS_KEY_FILE` are read *inside the
> container*, where the working directory is `/app/backend`, not your repo
> checkout — so they must be set to the **absolute path where the volume is
> mounted**, i.e. `/certs/cert.pem`/`/certs/key.pem`, matching the
> `./certs:/certs:ro` mount below. Reusing the relative `certs/cert.pem`
> host path for these variables causes
> `ENOENT: no such file or directory, open './certs/cert.pem'`.

Then point the container at the cert and key, either via your
`docker-compose.yml` (copied from `docker-compose-template.yml` — uncomment
the `TLS_CERT_FILE`/`TLS_KEY_FILE` environment variables and the
`./certs:/certs:ro` volume mount) or directly:

```bash
docker run -p 8443:8443 \
  -e PORT=8443 -e TLS_CERT_FILE=/certs/cert.pem -e TLS_KEY_FILE=/certs/key.pem \
  -v ./certs:/certs:ro -v photoboth-data:/data \
  photoboth:latest
```

Then open `https://photobooth.local:8443` (or whichever host/port you used)
on the kiosk machine.

If you don't want to install mkcert's CA everywhere, a plain OpenSSL
self-signed cert works too — the browser will show an "unsafe site"
warning once, which you click through, and the camera permission prompt
works normally after that. See "Self-signed cert on Ubuntu" below for a
full walkthrough.

### Self-signed cert on Ubuntu

OpenSSL is preinstalled on Ubuntu. Modern browsers ignore the certificate's
`CN` and require a `subjectAltName` (SAN) instead, so generate the cert
with a config file that lists every hostname/IP the kiosk browser will use
to reach the booth:

```bash
mkdir -p certs
cat > certs/san.cnf <<'EOF'
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = photobooth.local

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = photobooth.local
IP.1 = 192.168.1.50
EOF

openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout certs/key.pem -out certs/cert.pem \
  -config certs/san.cnf -extensions v3_req
```

Replace `photobooth.local` and `192.168.1.50` with however the kiosk
browser will actually address the machine (LAN hostname, IP, or both —
keep only the `DNS.n`/`IP.n` lines you need).

Copy the template if you haven't already (`cp docker-compose-template.yml
docker-compose.yml` — your `docker-compose.yml` is gitignored, so it's safe
to edit freely), then uncomment the `TLS_CERT_FILE`/`TLS_KEY_FILE`
environment variables, the `PORT: "8443"` change, and the `./certs:/certs:ro`
volume mount (or set them directly, see the `docker run` example above),
and expose the port:

```yaml
ports:
  - "8443:8443"
environment:
  PORT: "8443"
  TLS_CERT_FILE: "/certs/cert.pem"
  TLS_KEY_FILE: "/certs/key.pem"
volumes:
  - photoboth-data:/data
  - ./certs:/certs:ro
```

If Ubuntu's firewall is enabled, allow the port:

```bash
sudo ufw allow 8443/tcp
```

Restart the stack (`docker compose up --build -d`), then open
`https://photobooth.local:8443` (or whichever host/port you used) on the
kiosk machine. Chrome/Firefox on Ubuntu will show a privacy warning
("Your connection is not private" / "Warning: Potential Security Risk")
the first time — click **Advanced → Proceed** (Chrome) or **Advanced →
Accept the Risk and Continue** (Firefox) once, and the camera permission
prompt will work normally after that, since the browser now treats the
page as a secure context.

## Quick start

Requires Docker with Compose v2 (Docker Desktop on macOS/Windows, or
Docker Engine + the `docker compose` plugin on Linux).

Copy the compose template once (the resulting `docker-compose.yml` is
gitignored, so it's yours to customize — e.g. `ADMIN_PIN`, `BASE_URL`, TLS):

```bash
cp docker-compose-template.yml docker-compose.yml
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
4. Configure countdown length, photos per session (1 = single photo, 2–5
   are combined into a collage), filter, and optionally upload a branding
   overlay (a transparent PNG the same aspect ratio as your camera feed
   works best). Each change saves to the server automatically — there's no
   separate save button.
5. Under **Camera**, pick a **Camera source**:
   - **Webcam**: click **Detect cameras** to list every camera this browser
     can see (built-in and USB) and pick one, plus a resolution, frame
     rate, and mirror option. **Do this from the browser on the booth
     machine itself** — unlike the settings above, camera preferences are
     saved in that browser's local storage, not the server, since a
     deviceId is only meaningful on the machine that enumerated it. Opening
     `/admin` from a different device shows that device's own cameras and
     its own separately saved preferences, not the booth's. The kiosk
     screen (`/`) picks up these preferences automatically as long as it's
     the same browser; if the configured camera isn't found when the kiosk
     starts, it falls back to any available camera.
   - **RTSP stream**: enter the camera's `rtsp://` URL and click **Test
     connection**. This setting is saved server-side, so it applies to the
     kiosk regardless of which browser/device opens it — see "How camera
     access works" above.
6. If the booth will be reached from other devices under a LAN hostname or
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

- USB/integrated webcams (standard browser camera APIs) or a single RTSP
  network camera — no DSLR/gphoto2 support.
- No printing support.
- Single kiosk display per instance; the admin panel can be used from any
  device on the same network.
