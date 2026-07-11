import type { FastifyInstance } from "fastify";
import { getSettings, updateSettings } from "../db.js";
import { requireAdmin } from "../plugins/auth.js";
import type { Settings } from "../types.js";

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/settings", async () => {
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
