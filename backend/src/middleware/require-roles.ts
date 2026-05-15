import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { AppError } from "../lib/errors";

export function requireRoles(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role) {
      return next(new AppError(401, "Unauthorized", "UNAUTHORIZED"));
    }
    if (!allowed.includes(role)) {
      return next(new AppError(403, "Insufficient permissions", "FORBIDDEN"));
    }
    next();
  };
}
