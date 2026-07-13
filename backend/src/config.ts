import path from "node:path";

export const config = {
  port: Number(process.env.PORT ?? 8080),
  host: process.env.HOST ?? "0.0.0.0",
  dataDir: process.env.DATA_DIR ?? path.resolve(process.cwd(), "data"),
  adminPinSeed: process.env.ADMIN_PIN ?? "1234",
  cookieSecret: process.env.COOKIE_SECRET ?? "photoboth-dev-secret-change-me",
  tlsCertFile: process.env.TLS_CERT_FILE ?? null,
  tlsKeyFile: process.env.TLS_KEY_FILE ?? null,
};

export const paths = {
  dbFile: path.join(config.dataDir, "photobooth.db"),
  photosDir: path.join(config.dataDir, "photos"),
  overlaysDir: path.join(config.dataDir, "photos", "overlays"),
};
