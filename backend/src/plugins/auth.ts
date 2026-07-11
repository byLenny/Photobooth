import type { FastifyReply, FastifyRequest } from "fastify";
import { isValidAdminSession } from "../db.js";

export const ADMIN_COOKIE = "photoboth_admin";

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[ADMIN_COOKIE];
  if (!token || !isValidAdminSession(token)) {
    reply.code(401).send({ error: "unauthorized" });
  }
}
