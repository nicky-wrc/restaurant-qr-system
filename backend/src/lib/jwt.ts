import jwt, { type SignOptions } from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { loadEnv } from "./env";

export type AccessPayload = {
  sub: string;
  email: string;
  role: UserRole;
  typ: "access";
};

export function signAccessToken(parts: {
  sub: string;
  email: string;
  role: UserRole;
}): string {
  const env = loadEnv();
  const payload: AccessPayload = { ...parts, typ: "access" };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  const env = loadEnv();
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
  if (decoded.typ !== "access") {
    throw new Error("Invalid token");
  }
  return decoded;
}
