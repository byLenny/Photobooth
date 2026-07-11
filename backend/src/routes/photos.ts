import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSession, getSettings, updateSettings } from "../db.js";
import { requireAdmin } from "../plugins/auth.js";
import { generateQrPng } from "../services/qrcode.js";
import { paths } from "../config.js";

function resolveBaseUrl(request: FastifyRequest): string {
  const settings = getSettings();
  if (settings.baseUrl) return settings.baseUrl.replace(/\/$/, "");
  const host = request.headers.host ?? `localhost`;
  return `${request.protocol}://${host}`;
}

export async function photoRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>("/p/:id", async (request, reply) => {
    const record = getSession(request.params.id);
    if (!record) return reply.code(404).send("Not found");
    const imageUrl = `/files/${record.id}/${record.brandedFile}`;
    reply.type("text/html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Photoboth</title>
<style>
  body { margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
    background:#111; color:#fff; font-family:system-ui,sans-serif; gap:1.25rem; padding:1.5rem; box-sizing:border-box; }
  img { max-width:100%; max-height:70vh; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,.5); }
  a.button { background:#fff; color:#111; text-decoration:none; padding:.9rem 1.6rem; border-radius:999px;
    font-weight:600; font-size:1.05rem; }
</style>
</head>
<body>
  <img src="${imageUrl}" alt="Your photo" />
  <a class="button" href="${imageUrl}" download>Download photo</a>
</body>
</html>`);
  });

  app.get<{ Params: { id: string } }>("/api/photos/:id/qrcode.png", async (request, reply) => {
    const record = getSession(request.params.id);
    if (!record) return reply.code(404).send({ error: "not_found" });
    const targetUrl = `${resolveBaseUrl(request)}/p/${record.id}`;
    const png = await generateQrPng(targetUrl);
    reply.type("image/png").send(png);
  });

  app.post(
    "/api/admin/overlay",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const file = await request.file();
      if (!file) return reply.code(400).send({ error: "no_file" });
      const filename = `overlay-${Date.now()}.png`;
      const buffer = await file.toBuffer();
      await fs.writeFile(path.join(paths.overlaysDir, filename), buffer);
      updateSettings({ overlayFile: filename, overlayEnabled: true });
      return reply.send({ ok: true, overlayFile: filename });
    },
  );
}
