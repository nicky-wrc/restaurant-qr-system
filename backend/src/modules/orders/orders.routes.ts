import { Router } from "express";
import { z } from "zod";
import { OrderStatus, UserRole } from "@prisma/client";
import type { Server } from "socket.io";
import { asyncHandler } from "../../lib/async-handler";
import { requireRoles } from "../../middleware/require-roles";
import * as orderService from "./order.service";

export const ordersRouter = Router();

type OrderWithRelations = Awaited<ReturnType<typeof orderService.getOrder>>;

function orderToJson(order: OrderWithRelations) {
  return {
    id: order.id,
    tableId: order.tableId,
    status: order.status,
    total: order.total?.toString() ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    table: order.table,
    items: order.items.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      unitPrice: i.unitPrice.toString(),
      notes: i.notes,
      menuItem: i.menuItem,
    })),
  };
}

ordersRouter.get(
  "/",
  requireRoles(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF, UserRole.WAITER),
  asyncHandler(async (req, res) => {
    const status = req.query.status
      ? z.nativeEnum(OrderStatus).parse(req.query.status)
      : undefined;
    const orders = await orderService.listOrders(status);
    res.json({
      orders: orders.map((o) => orderToJson(o as OrderWithRelations)),
    });
  }),
);

ordersRouter.get(
  "/:id",
  requireRoles(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF, UserRole.WAITER),
  asyncHandler(async (req, res) => {
    const id = z.string().cuid().parse(req.params.id);
    const order = await orderService.getOrder(id);
    res.json({ order: orderToJson(order) });
  }),
);

ordersRouter.patch(
  "/:id/status",
  requireRoles(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF, UserRole.WAITER),
  asyncHandler(async (req, res) => {
    const id = z.string().cuid().parse(req.params.id);
    const body = z.object({ status: z.nativeEnum(OrderStatus) }).parse(req.body);
    const io = req.app.get("io") as Server;
    const updated = await orderService.setOrderStatus(id, body.status, req.user!.role);
    const full = await orderService.getOrder(updated.id);
    const payload = { order: orderToJson(full) };
    io.to("restaurant:default").emit("order:updated", payload);
    io.to("kitchen").emit("order:updated", payload);
    res.json(payload);
  }),
);
