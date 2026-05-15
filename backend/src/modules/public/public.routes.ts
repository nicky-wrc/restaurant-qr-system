import { Router } from "express";
import { z } from "zod";
import { Prisma, TableStatus } from "@prisma/client";
import type { Server } from "socket.io";
import { asyncHandler } from "../../lib/async-handler";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";

export const publicRouter = Router();

publicRouter.get(
  "/tables/:qrToken/menu",
  asyncHandler(async (req, res) => {
    const qrToken = z.string().min(8).max(80).parse(req.params.qrToken);
    const table = await prisma.table.findUnique({ where: { qrToken } });
    if (!table) throw new AppError(404, "Table not found", "NOT_FOUND");

    const categories = await prisma.menuCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: { name: "asc" },
        },
      },
    });

    res.json({
      table: { id: table.id, label: table.label, status: table.status },
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        items: c.items.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          price: i.price.toString(),
          imageUrl: i.imageUrl,
        })),
      })),
    });
  }),
);

const orderItemSchema = z.object({
  menuItemId: z.string().cuid(),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().max(500).optional().nullable(),
});

const createPublicOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(50),
});

publicRouter.post(
  "/tables/:qrToken/orders",
  asyncHandler(async (req, res) => {
    const qrToken = z.string().min(8).max(80).parse(req.params.qrToken);
    const body = createPublicOrderSchema.parse(req.body);

    const table = await prisma.table.findUnique({ where: { qrToken } });
    if (!table) throw new AppError(404, "Table not found", "NOT_FOUND");
    if (table.status !== TableStatus.OPEN) {
      throw new AppError(400, "Table is not open for ordering", "TABLE_CLOSED");
    }

    const menuItemIds = [...new Set(body.items.map((i) => i.menuItemId))];
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, isAvailable: true },
    });
    if (menuItems.length !== menuItemIds.length) {
      throw new AppError(400, "One or more menu items are invalid or unavailable", "INVALID_ITEMS");
    }

    const priceById = new Map(menuItems.map((m) => [m.id, m.price]));

    const io = req.app.get("io") as Server;

    const order = await prisma.$transaction(async (tx) => {
      let total = new Prisma.Decimal(0);
      const lineCreates = body.items.map((line) => {
        const unitPrice = priceById.get(line.menuItemId)!;
        total = total.add(unitPrice.mul(line.quantity));
        return {
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          unitPrice,
          notes: line.notes ?? null,
        };
      });

      return tx.order.create({
        data: {
          tableId: table.id,
          total,
          items: { create: lineCreates },
        },
        include: {
          table: { select: { id: true, label: true } },
          items: { include: { menuItem: { select: { id: true, name: true } } } },
        },
      });
    });

    const payload = {
      order: {
        id: order.id,
        tableId: order.tableId,
        status: order.status,
        total: order.total?.toString() ?? null,
        createdAt: order.createdAt,
        table: order.table,
        items: order.items.map((i) => ({
          id: i.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toString(),
          notes: i.notes,
          menuItem: i.menuItem,
        })),
      },
    };

    io.to("restaurant:default").emit("order:created", payload);
    io.to("kitchen").emit("order:created", payload);

    res.status(201).json(payload);
  }),
);
