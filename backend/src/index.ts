import { createServer } from "node:http";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { configureApp } from "./app";

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: webOrigin },
});

configureApp(app, io);

io.on("connection", (socket) => {
  socket.on("join:restaurant", (restaurantId: string) => {
    if (typeof restaurantId !== "string" || !restaurantId.trim()) return;
    void socket.join(`restaurant:${restaurantId.trim()}`);
  });
  socket.on("join:kitchen", () => {
    void socket.join("kitchen");
  });
});

const port = Number(process.env.PORT) || 4000;

httpServer.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

process.on("SIGTERM", () => {
  httpServer.close();
});
