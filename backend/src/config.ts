import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// backend/src/config.ts (dev) and backend/dist/config.js (build) are both
// two levels below the repo root, so this holds regardless of cwd.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const localCertFile = path.join(repoRoot, "certs", "cert.pem");
const localKeyFile = path.join(repoRoot, "certs", "key.pem");
const hasLocalCerts = fs.existsSync(localCertFile) && fs.existsSync(localKeyFile);

export const config = {
  port: Number(process.env.PORT ?? 8080),
  host: process.env.HOST ?? "0.0.0.0",
  dataDir: process.env.DATA_DIR ?? path.resolve(process.cwd(), "data"),
  adminPinSeed: process.env.ADMIN_PIN ?? "1234",
  cookieSecret: process.env.COOKIE_SECRET ?? "photoboth-dev-secret-change-me",
  tlsCertFile: process.env.TLS_CERT_FILE ?? (hasLocalCerts ? localCertFile : null),
  tlsKeyFile: process.env.TLS_KEY_FILE ?? (hasLocalCerts ? localKeyFile : null),
};

export const paths = {
  dbFile: path.join(config.dataDir, "photobooth.db"),
  photosDir: path.join(config.dataDir, "photos"),
  overlaysDir: path.join(config.dataDir, "photos", "overlays"),
};
