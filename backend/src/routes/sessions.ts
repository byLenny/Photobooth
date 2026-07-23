import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import {
  getSettings,
  insertSession,
  listSessions,
  listRandomSessions,
  countSessions,
  getSession,
} from "../db.js";
import { requireAdmin } from "../plugins/auth.js";
import { processSession } from "../services/imageProcessing.js";
import { paths } from "../config.js";
import type { SessionDetail, SessionRecord, SessionSummary } from "../types.js";

function toSummary(record: SessionRecord): SessionSummary {
  return {
    id: record.id,
    createdAt: record.createdAt,
    brandedUrl: `/files/${record.id}/${record.brandedFile}`,
    originalUrls: record.originalFiles.map((f) => `/files/${record.id}/${f}`),
    shareUrl: `/p/${record.id}`,
  };
}

function toDetail(record: SessionRecord): SessionDetail {
  return {
    ...toSummary(record),
    qrCodeUrl: `/api/photos/${record.id}/qrcode.png`,
  };
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/sessions", async (request, reply) => {
    const originals: Buffer[] = [];
    let email: string | null = null;
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "photo") {
        originals.push(await part.toBuffer());
      } else if (part.type === "field" && part.fieldname === "email") {
        const value = String(part.value).trim();
        if (value) email = value;
      }
    }

    if (originals.length === 0) {
      return reply.code(400).send({ error: "no_photos_uploaded" });
    }

    const settings = getSettings();
    const overlayPath =
      settings.overlayEnabled && settings.overlayFile
        ? path.join(paths.overlaysDir, settings.overlayFile)
        : null;

    const branded = await processSession(originals, settings, overlayPath);

    const id = crypto.randomUUID();
    const sessionDir = path.join(paths.photosDir, id);
    await fs.mkdir(sessionDir, { recursive: true });

    const originalFiles: string[] = [];
    for (let i = 0; i < originals.length; i++) {
      const filename = `original-${i + 1}.jpg`;
      await fs.writeFile(path.join(sessionDir, filename), originals[i]!);
      originalFiles.push(filename);
    }
    const brandedFile = "branded.jpg";
    await fs.writeFile(path.join(sessionDir, brandedFile), branded);
    if (email) {
      await fs.writeFile(path.join(sessionDir, "email.txt"), email);
    }

    const record: SessionRecord = {
      id,
      createdAt: Date.now(),
      filter: settings.filter,
      originalFiles,
      brandedFile,
    };
    insertSession(record);

    return reply.send(toDetail(record));
  });

  app.get<{ Querystring: { limit?: string } }>("/api/sessions", async (request) => {
    const settings = getSettings();
    if (!settings.galleryEnabled) return [];
    const limit = Math.min(Number(request.query.limit ?? 20) || 20, 100);
    const records =
      settings.galleryImageSource === "random" ? listRandomSessions(limit) : listSessions(limit);
    return records.map(toSummary);
  });

  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    "/api/admin/sessions",
    { preHandler: requireAdmin },
    async (request) => {
      const limit = Math.min(Number(request.query.limit ?? 20) || 20, 200);
      const offset = Math.max(Number(request.query.offset ?? 0) || 0, 0);
      return {
        total: countSessions(),
        items: listSessions(limit, offset).map(toDetail),
      };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/admin/sessions/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const record = getSession(request.params.id);
      if (!record) return reply.code(404).send({ error: "not_found" });
      return toDetail(record);
    },
  );
}
