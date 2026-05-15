import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../lib/async-handler";
import { authenticate } from "../../middleware/authenticate";
import * as authService from "./auth.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body.email, body.password);
    res.json(result);
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const body = refreshSchema.parse(req.body);
    const result = await authService.refresh(body.refreshToken);
    res.json(result);
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const body = refreshSchema.parse(req.body);
    await authService.logout(body.refreshToken);
    res.status(204).send();
  }),
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.user!.id);
    res.json({ user });
  }),
);
