import type { FastifyInstance } from "fastify";
import {
  createAdminSession,
  destroyAdminSession,
  getAdminPinHash,
  setAdminPin,
  verifyPin,
} from "../db.js";
import { ADMIN_COOKIE, requireAdmin } from "../plugins/auth.js";

const COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 12 * 60 * 60,
};

export async function adminAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { pin: string } }>("/api/admin/login", async (request, reply) => {
    const { pin } = request.body ?? {};
    if (!pin || !verifyPin(pin, getAdminPinHash())) {
      return reply.code(401).send({ error: "invalid_pin" });
    }
    const token = createAdminSession();
    reply.setCookie(ADMIN_COOKIE, token, COOKIE_OPTS);
    return reply.send({ ok: true });
  });

  app.post(
    "/api/admin/logout",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const token = request.cookies[ADMIN_COOKIE];
      if (token) destroyAdminSession(token);
      reply.clearCookie(ADMIN_COOKIE, { path: "/" });
      return reply.send({ ok: true });
    },
  );

  app.get("/api/admin/me", { preHandler: requireAdmin }, async (_request, reply) => {
    return reply.send({ ok: true });
  });

  app.post<{ Body: { currentPin: string; newPin: string } }>(
    "/api/admin/change-pin",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { currentPin, newPin } = request.body ?? {};
      if (!currentPin || !newPin || newPin.length < 4) {
        return reply.code(400).send({ error: "invalid_request" });
      }
      if (!verifyPin(currentPin, getAdminPinHash())) {
        return reply.code(401).send({ error: "invalid_pin" });
      }
      setAdminPin(newPin);
      return reply.send({ ok: true });
    },
  );
}
