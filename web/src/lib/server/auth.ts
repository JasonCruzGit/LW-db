import type { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";
import { verifyToken, type JwtPayload } from "./jwt";

export function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export function requireAuth(req: NextRequest): JwtPayload | { error: string; status: number } {
  const token = bearerToken(req);
  if (!token) return { error: "Unauthorized", status: 401 };
  try {
    return verifyToken(token);
  } catch {
    return { error: "Invalid token", status: 401 };
  }
}

export function requireRole(
  payload: JwtPayload | { error: string; status: number },
  ...roles: UserRole[]
): { ok: true; user: JwtPayload } | { ok: false; status: number; error: string } {
  if ("error" in payload) return { ok: false, status: payload.status, error: payload.error };
  if (!roles.includes(payload.role)) return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true, user: payload };
}

