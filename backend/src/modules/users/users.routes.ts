import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../lib/async-handler";
import { requireRoles } from "../../middleware/require-roles";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import * as authService from "../auth/auth.service";

export const usersRouter = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().max(120).optional().nullable(),
  role: z.nativeEnum(UserRole),
});

usersRouter.get(
  "/",
  requireRoles(UserRole.OWNER, UserRole.MANAGER),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    res.json({ users });
  }),
);

usersRouter.post(
  "/",
  requireRoles(UserRole.OWNER, UserRole.MANAGER),
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body);
    if (body.role === UserRole.OWNER && req.user!.role !== UserRole.OWNER) {
      throw new AppError(403, "Only OWNER can create OWNER accounts", "FORBIDDEN");
    }
    const user = await authService.createStaffUser(body);
    res.status(201).json({ user });
  }),
);
