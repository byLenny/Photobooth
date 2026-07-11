import path from "node:path";
import fs from "node:fs";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { config, paths } from "./config.js";
import { settingsRoutes } from "./routes/settings.js";
import { adminAuthRoutes } from "./routes/admin.js";
import { sessionRoutes } from "./routes/sessions.js";
import { photoRoutes } from "./routes/photos.js";

const FRONTEND_DIST = path.resolve(process.cwd(), "public");

export async function buildApp() {
  const app = Fastify({ logger: true });

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

  return app;
}
