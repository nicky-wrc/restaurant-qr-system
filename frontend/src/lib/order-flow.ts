/** สถานะออเดอร์ + กฎเปลี่ยนสถานะ (ตรงกับ backend order.service) */

export type OrderStatus = "PENDING" | "COOKING" | "DONE" | "SERVED";

export function nextOrderStatus(s: OrderStatus): OrderStatus | null {
  if (s === "PENDING") return "COOKING";
  if (s === "COOKING") return "DONE";
  if (s === "DONE") return "SERVED";
  return null;
}

export function canAdvanceOrder(role: string, from: OrderStatus, to: OrderStatus): boolean {
  if (from === "PENDING" && to === "COOKING")
    return ["CHEF", "MANAGER", "OWNER"].includes(role);
  if (from === "COOKING" && to === "DONE")
    return ["CHEF", "MANAGER", "OWNER"].includes(role);
  if (from === "DONE" && to === "SERVED")
    return ["WAITER", "MANAGER", "OWNER"].includes(role);
  return false;
}

export function orderAdvanceButtonLabel(status: OrderStatus): string {
  if (status === "PENDING") return "รับเข้าครัว";
  if (status === "COOKING") return "พร้อมเสิร์ฟ";
  if (status === "DONE") return "เสิร์ฟแล้ว";
  return "—";
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "รอครัว",
  COOKING: "กำลังทำ",
  DONE: "พร้อมเสิร์ฟ",
  SERVED: "เสิร์ฟแล้ว",
};
