import type { FastifyInstance } from "fastify";
import { getSettings } from "../db.js";
import { requireAdmin } from "../plugins/auth.js";
import { getRtspCameraManager } from "../services/rtspCamera.js";

function getConfiguredManager() {
  const settings = getSettings();
  if (settings.cameraSourceType !== "rtsp" || !settings.rtspUrl) return null;
  return getRtspCameraManager(settings.rtspUrl);
}

export async function cameraRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/camera/preview", async (request, reply) => {
    const manager = getConfiguredManager();
    if (!manager) {
      return reply.code(400).send({ error: "rtsp_not_configured" });
    }
    reply.hijack();
    manager.subscribe(reply.raw);
  });

  app.get("/api/camera/snapshot", async (request, reply) => {
    const manager = getConfiguredManager();
    if (!manager) {
      return reply.code(400).send({ error: "rtsp_not_configured" });
    }
    try {
      // Full-resolution grab, independent of the downscaled live preview —
      // this is what gets saved as the actual photo.
      const frame = await manager.captureFullFrame();
      reply.header("Content-Type", "image/jpeg");
      return reply.send(frame);
    } catch (err) {
      request.log.error(err, "Failed to capture RTSP snapshot");
      return reply.code(502).send({ error: "camera_unavailable" });
    }
  });

  app.get("/api/admin/camera/status", { preHandler: requireAdmin }, async (request, reply) => {
    const settings = getSettings();
    if (settings.cameraSourceType !== "rtsp" || !settings.rtspUrl) {
      return reply.send({ state: "idle" });
    }
    // Actively (re)connect and wait briefly for a frame so "Test connection"
    // reflects reality rather than a possibly-stale cached state.
    const manager = getRtspCameraManager(settings.rtspUrl);
    try {
      await manager.getLatestFrame();
    } catch {
      // fall through — manager.getStatus() below reports the failure reason
    }
    return reply.send(manager.getStatus());
  });
}
