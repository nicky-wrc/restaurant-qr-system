import "dotenv/config";
import path from "node:path";
import type { Express } from "express";
import express from "express";
import cors from "cors";
import type { Server as SocketIOServer } from "socket.io";
import { loadEnv } from "./lib/env";
import { prisma } from "./lib/prisma";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./modules/auth/auth.routes";
import { usersRouter } from "./modules/users/users.routes";
import { menuRouter } from "./modules/menu/menu.routes";
import { tablesRouter } from "./modules/tables/tables.routes";
import { ordersRouter } from "./modules/orders/orders.routes";
import { publicRouter } from "./modules/public/public.routes";
import { reportsRouter } from "./modules/reports/reports.routes";
import { authenticate } from "./middleware/authenticate";

export function configureApp(app: Express, io: SocketIOServer) {
  loadEnv();

  app.set("io", io);

  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

  app.use(
    cors({
      origin: webOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "api", version: "1" });
  });

  app.get("/health/db", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: "up" });
    } catch {
      res.status(503).json({ ok: false, db: "down" });
    }
  });

  app.use("/api/v1/public", publicRouter);
  app.use("/api/v1/auth", authRouter);

  const api = express.Router();
  api.use(authenticate);
  api.use("/users", usersRouter);
  api.use("/menu", menuRouter);
  api.use("/tables", tablesRouter);
  api.use("/orders", ordersRouter);
  api.use("/reports", reportsRouter);
  app.use("/api/v1", api);

  app.use(errorHandler);
}
