import { Router } from "express";
import { z } from "zod";
import { OrderStatus, UserRole } from "@prisma/client";
import { asyncHandler } from "../../lib/async-handler";
import { requireRoles } from "../../middleware/require-roles";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";

export const reportsRouter = Router();

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ใช้รูปแบบ YYYY-MM-DD");

function utcDayStart(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function utcDayEnd(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

reportsRouter.get(
  "/summary",
  requireRoles(UserRole.OWNER, UserRole.MANAGER),
  asyncHandler(async (req, res) => {
    const today = new Date();
    const defaultTo = today.toISOString().slice(0, 10);
    const defaultFromDate = new Date(today);
    defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - 30);
    const defaultFrom = defaultFromDate.toISOString().slice(0, 10);

    const fromStr = req.query.from ? ymd.parse(String(req.query.from)) : defaultFrom;
    const toStr = req.query.to ? ymd.parse(String(req.query.to)) : defaultTo;

    const rangeStart = utcDayStart(fromStr);
    const rangeEnd = utcDayEnd(toStr);
    if (rangeStart > rangeEnd) {
      throw new AppError(400, "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด", "BAD_RANGE");
    }
    const maxMs = 400 * 24 * 60 * 60 * 1000;
    if (rangeEnd.getTime() - rangeStart.getTime() > maxMs) {
      throw new AppError(400, "ช่วงวันที่ยาวเกิน 400 วัน", "RANGE_TOO_LONG");
    }

    const createdFilter = { gte: rangeStart, lte: rangeEnd };

    const [orderCount, servedAgg, statusGroups, topGroups] = await Promise.all([
      prisma.order.count({ where: { createdAt: createdFilter } }),
      prisma.order.aggregate({
        where: {
          createdAt: createdFilter,
          status: OrderStatus.SERVED,
          total: { not: null },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { createdAt: createdFilter },
        _count: { _all: true },
      }),
      prisma.orderItem.groupBy({
        by: ["menuItemId"],
        where: {
          order: {
            createdAt: createdFilter,
            status: OrderStatus.SERVED,
          },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      }),
    ]);

    const revenue = servedAgg._sum.total;
    const servedCount = servedAgg._count._all;
    const revenueStr = revenue != null ? revenue.toString() : "0";
    const avgStr =
      servedCount > 0 && revenue != null
        ? (Number(revenue.toString()) / servedCount).toFixed(2)
        : null;

    const menuIds = topGroups.map((g) => g.menuItemId);
    const menuRows =
      menuIds.length > 0
        ? await prisma.menuItem.findMany({
            where: { id: { in: menuIds } },
            select: { id: true, name: true },
          })
        : [];
    const nameById = new Map(menuRows.map((m) => [m.id, m.name]));

    const topItems = topGroups.map((g) => ({
      menuItemId: g.menuItemId,
      name: nameById.get(g.menuItemId) ?? "—",
      quantitySold: g._sum.quantity ?? 0,
    }));

    const byStatus = Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count._all]),
    ) as Record<string, number>;

    res.json({
      from: fromStr,
      to: toStr,
      orderCount,
      servedOrderCount: servedCount,
      revenueBaht: revenueStr,
      averageServedOrderBaht: avgStr,
      byStatus,
      topItems,
    });
  }),
);
