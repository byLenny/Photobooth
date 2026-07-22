import type { FastifyInstance } from "fastify";
import { getSettings, updateSettings } from "../db.js";
import { requireAdmin } from "../plugins/auth.js";
import { ADMIN_ONLY_SETTINGS_KEYS, type PublicSettings, type Settings } from "../types.js";

function toPublicSettings(settings: Settings): PublicSettings {
  const sanitized: Partial<Settings> = { ...settings };
  for (const key of ADMIN_ONLY_SETTINGS_KEYS) delete sanitized[key];
  return sanitized as PublicSettings;
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // Unauthenticated — consumed by the kiosk screen, so it must never include
  // admin-only fields like rtspUrl (which can embed stream credentials).
  app.get("/api/settings", async () => {
    return toPublicSettings(getSettings());
  });

  // Authenticated — backs the admin settings form, which needs the full
  // record (including rtspUrl) to display and edit it.
  app.get("/api/admin/settings", { preHandler: requireAdmin }, async () => {
    return getSettings();
  });

  app.put<{ Body: Partial<Settings> }>(
    "/api/admin/settings",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const updated = updateSettings(request.body);
      return reply.send(updated);
    },
  );
}
