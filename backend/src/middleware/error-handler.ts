import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isAppError } from "../lib/errors";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (isAppError(err)) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code ?? "ERROR" },
    });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: err.flatten(),
      },
    });
  }
  console.error(err);
  return res.status(500).json({
    error: { message: "Internal server error", code: "INTERNAL" },
  });
}
