import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

app.use(
  cors({
    origin: webOrigin,
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api" });
});

app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch {
    res.status(503).json({ ok: false, db: "down" });
  }
});

const httpServer = createServer(app);

export const io = new SocketIOServer(httpServer, {
  cors: { origin: webOrigin },
});

io.on("connection", (socket) => {
  socket.on("join:restaurant", (restaurantId: string) => {
    if (typeof restaurantId !== "string" || !restaurantId.trim()) return;
    void socket.join(`restaurant:${restaurantId.trim()}`);
  });
});

const port = Number(process.env.PORT) || 4000;

httpServer.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
