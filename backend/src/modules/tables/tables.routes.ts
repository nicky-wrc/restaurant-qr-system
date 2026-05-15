import { Router } from "express";
import { z } from "zod";
import { TableStatus, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { asyncHandler } from "../../lib/async-handler";
import { requireRoles } from "../../middleware/require-roles";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";

export const tablesRouter = Router();

tablesRouter.get(
  "/",
  requireRoles(UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER, UserRole.CHEF),
  asyncHandler(async (_req, res) => {
    const tables = await prisma.table.findMany({ orderBy: { label: "asc" } });
    res.json({
      tables: tables.map((t) => ({
        id: t.id,
        label: t.label,
        qrToken: t.qrToken,
        status: t.status,
        createdAt: t.createdAt,
      })),
    });
  }),
);

tablesRouter.post(
  "/",
  requireRoles(UserRole.OWNER, UserRole.MANAGER),
  asyncHandler(async (req, res) => {
    const body = z.object({ label: z.string().min(1).max(80) }).parse(req.body);
    const table = await prisma.table.create({
      data: { label: body.label, status: TableStatus.CLOSED },
    });
    res.status(201).json({ table });
  }),
);

tablesRouter.patch(
  "/:id",
  requireRoles(UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER),
  asyncHandler(async (req, res) => {
    const id = z.string().cuid().parse(req.params.id);
    const body = z
      .object({
        label: z.string().min(1).max(80).optional(),
        status: z.nativeEnum(TableStatus).optional(),
      })
      .parse(req.body);

    if (body.status && req.user!.role === UserRole.WAITER) {
      if (body.status !== TableStatus.OPEN && body.status !== TableStatus.CLOSED) {
        throw new AppError(400, "Invalid status", "BAD_REQUEST");
      }
    }

    try {
      const table = await prisma.table.update({
        where: { id },
        data: body,
      });
      res.json({ table });
    } catch {
      throw new AppError(404, "Table not found", "NOT_FOUND");
    }
  }),
);

tablesRouter.post(
  "/:id/regenerate-qr",
  requireRoles(UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER),
  asyncHandler(async (req, res) => {
    const id = z.string().cuid().parse(req.params.id);
    const qrToken = randomUUID();
    try {
      const table = await prisma.table.update({
        where: { id },
        data: { qrToken },
      });
      res.json({ table });
    } catch {
      throw new AppError(404, "Table not found", "NOT_FOUND");
    }
  }),
);

tablesRouter.delete(
  "/:id",
  requireRoles(UserRole.OWNER, UserRole.MANAGER),
  asyncHandler(async (req, res) => {
    const id = z.string().cuid().parse(req.params.id);
    await prisma.table.delete({ where: { id } }).catch(() => {
      throw new AppError(404, "Table not found", "NOT_FOUND");
    });
    res.status(204).send();
  }),
);
