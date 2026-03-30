import jwt, { type SignOptions } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret";

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export function signToken(payload: JwtPayload, expiresIn: string = "7d"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

