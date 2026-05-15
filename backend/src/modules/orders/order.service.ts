import type { UserRole } from "@prisma/client";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";

function canTransition(from: OrderStatus, to: OrderStatus, role: UserRole): boolean {
  if (from === to) return false;
  const steps: Partial<Record<OrderStatus, OrderStatus>> = {
    [OrderStatus.PENDING]: OrderStatus.COOKING,
    [OrderStatus.COOKING]: OrderStatus.DONE,
    [OrderStatus.DONE]: OrderStatus.SERVED,
  };
  if (steps[from] !== to) return false;

  if (from === OrderStatus.PENDING && to === OrderStatus.COOKING) {
    return ["CHEF", "MANAGER", "OWNER"].includes(role);
  }
  if (from === OrderStatus.COOKING && to === OrderStatus.DONE) {
    return ["CHEF", "MANAGER", "OWNER"].includes(role);
  }
  if (from === OrderStatus.DONE && to === OrderStatus.SERVED) {
    return ["WAITER", "MANAGER", "OWNER"].includes(role);
  }
  return false;
}

export async function listOrders(status?: OrderStatus) {
  return prisma.order.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      table: { select: { id: true, label: true } },
      items: {
        include: {
          menuItem: { select: { id: true, name: true } },
        },
      },
    },
    take: 200,
  });
}

export async function getOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      table: true,
      items: { include: { menuItem: true } },
    },
  });
  if (!order) throw new AppError(404, "Order not found", "NOT_FOUND");
  return order;
}

export async function setOrderStatus(id: string, next: OrderStatus, role: UserRole) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError(404, "Order not found", "NOT_FOUND");
  if (order.status === next) {
    return prisma.order.findUniqueOrThrow({
      where: { id },
      include: {
        table: { select: { id: true, label: true } },
        items: { include: { menuItem: { select: { id: true, name: true } } } },
      },
    });
  }
  if (!canTransition(order.status, next, role)) {
    throw new AppError(
      400,
      `Cannot change status from ${order.status} to ${next} with role ${role}`,
      "INVALID_TRANSITION",
    );
  }
  const updated = await prisma.order.update({
    where: { id },
    data: { status: next },
    include: {
      table: { select: { id: true, label: true } },
      items: {
        include: {
          menuItem: { select: { id: true, name: true } },
        },
      },
    },
  });
  return updated;
}
