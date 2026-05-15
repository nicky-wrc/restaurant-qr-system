import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { AppError } from "../lib/errors";

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "Missing or invalid Authorization header", "UNAUTHORIZED"));
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return next(new AppError(401, "Missing token", "UNAUTHORIZED"));
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    next(new AppError(401, "Invalid or expired access token", "INVALID_TOKEN"));
  }
}
