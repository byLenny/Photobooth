import path from "node:path";
import fs from "node:fs";
import Fastify, { FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { config, paths } from "./config.js";
import { settingsRoutes } from "./routes/settings.js";
import { adminAuthRoutes } from "./routes/admin.js";
import { sessionRoutes } from "./routes/sessions.js";
import { photoRoutes } from "./routes/photos.js";
import { cameraRoutes } from "./routes/camera.js";

const FRONTEND_DIST = path.resolve(process.cwd(), "public");

function loadTlsOptions() {
  if (!config.tlsCertFile && !config.tlsKeyFile) return undefined;
  if (!config.tlsCertFile || !config.tlsKeyFile) {
    throw new Error("TLS_CERT_FILE and TLS_KEY_FILE must both be set to enable HTTPS");
  }
  return {
    cert: fs.readFileSync(config.tlsCertFile),
    key: fs.readFileSync(config.tlsKeyFile),
  };
}

export async function buildApp() {
  const tls = loadTlsOptions();
  const app: FastifyInstance = tls
    ? (Fastify({ logger: true, https: tls }) as unknown as FastifyInstance)
    : Fastify({ logger: true });

  await app.register(fastifyCookie, { secret: config.cookieSecret });
  await app.register(fastifyMultipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  });

  await app.register(fastifyStatic, {
    root: paths.photosDir,
    prefix: "/files/",
  });

  if (fs.existsSync(FRONTEND_DIST)) {
    await app.register(fastifyStatic, {
      root: FRONTEND_DIST,
      prefix: "/",
      decorateReply: false,
    });

    app.setNotFoundHandler((request, reply) => {
      if (
        request.raw.method === "GET" &&
        !request.url.startsWith("/api/") &&
        !request.url.startsWith("/files/") &&
        !request.url.startsWith("/p/")
      ) {
        return reply.sendFile("index.html", FRONTEND_DIST);
      }
      reply.code(404).send({ error: "not_found" });
    });
  }

  await app.register(settingsRoutes);
  await app.register(adminAuthRoutes);
  await app.register(sessionRoutes);
  await app.register(photoRoutes);
  await app.register(cameraRoutes);

  return app;
}
