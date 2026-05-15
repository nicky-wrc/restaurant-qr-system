"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { apiFetch, getApiBase } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import {
  type OrderStatus,
  canAdvanceOrder,
  nextOrderStatus,
  orderAdvanceButtonLabel,
} from "@/lib/order-flow";
import { notifyError } from "@/lib/notify";

type Order = {
  id: string;
  status: OrderStatus;
  total: string | null;
  createdAt: string;
  table: { id: string; label: string };
  items: { id: string; quantity: number; menuItem: { name: string }; notes?: string | null }[];
};

export default function KitchenPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [role, setRole] = useState<string>("");

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const data = await apiFetch<{ orders: Order[] }>("/api/v1/orders", {
      accessToken: token,
    });
    setOrders(data.orders.filter((o) => o.status !== "SERVED"));
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    void apiFetch<{ user: { role: string } }>("/api/v1/auth/me", { accessToken: token }).then((d) =>
      setRole(d.user.role),
    );

    const s = io(getApiBase(), { transports: ["websocket", "polling"] });
    s.emit("join:kitchen");
    s.emit("join:restaurant", "default");
    s.on("order:created", () => void load());
    s.on("order:updated", () => void load());

    void load().catch((e: Error) => void notifyError("โหลดออเดอร์ไม่สำเร็จ", e.message));

    return () => {
      s.disconnect();
    };
  }, [router, load]);

  async function advance(order: Order) {
    const n = nextOrderStatus(order.status);
    if (!n || !canAdvanceOrder(role, order.status, n)) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch(`/api/v1/orders/${order.id}/status`, {
        method: "PATCH",
        accessToken: token,
        body: JSON.stringify({ status: n }),
      });
      await load();
    } catch (e) {
      void notifyError(
        "อัปเดตสถานะไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Kitchen Display</h1>
          <p className="text-xs text-stone-400">Realtime · role {role || "…"}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => {
            const n = nextOrderStatus(o.status);
            const enabled = n && canAdvanceOrder(role, o.status, n);
            const label = orderAdvanceButtonLabel(o.status);
            return (
              <article
                key={o.id}
                className="rounded-xl border border-stone-700 bg-stone-900 p-4 shadow-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-stone-500">{o.table.label}</p>
                    <p className="mt-1 font-mono text-xs text-stone-500">{o.id.slice(0, 8)}…</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.status === "PENDING"
                        ? "bg-amber-500/20 text-amber-300"
                        : o.status === "COOKING"
                          ? "bg-orange-500/20 text-orange-200"
                          : "bg-emerald-500/20 text-emerald-200"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-stone-300">
                  {o.items.map((i) => (
                    <li key={i.id}>
                      ×{i.quantity} {i.menuItem.name}
                      {i.notes ? (
                        <span className="block text-xs text-stone-500">({i.notes})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-stone-400">รวม {o.total ?? "—"} บาท</p>
                {n && (
                  <button
                    type="button"
                    disabled={!enabled}
                    onClick={() => void advance(o)}
                    className="mt-4 w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {label}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        {orders.length === 0 && (
          <p className="mt-8 text-center text-stone-500">ยังไม่มีออเดอร์ที่ต้องจัดการ</p>
        )}
      </main>
    </div>
  );
}
