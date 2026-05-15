"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { apiFetch, getApiBase } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";

type OrderStatus = "PENDING" | "COOKING" | "DONE" | "SERVED";

type Order = {
  id: string;
  status: OrderStatus;
  total: string | null;
  createdAt: string;
  table: { id: string; label: string };
  items: { id: string; quantity: number; menuItem: { name: string } }[];
};

function nextStatus(s: OrderStatus): OrderStatus | null {
  if (s === "PENDING") return "COOKING";
  if (s === "COOKING") return "DONE";
  if (s === "DONE") return "SERVED";
  return null;
}

function canClick(role: string, from: OrderStatus, to: OrderStatus): boolean {
  if (from === "PENDING" && to === "COOKING")
    return ["CHEF", "MANAGER", "OWNER"].includes(role);
  if (from === "COOKING" && to === "DONE")
    return ["CHEF", "MANAGER", "OWNER"].includes(role);
  if (from === "DONE" && to === "SERVED")
    return ["WAITER", "MANAGER", "OWNER"].includes(role);
  return false;
}

export default function KitchenPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [role, setRole] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

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

    void load().catch((e: Error) => setErr(e.message));

    return () => {
      s.disconnect();
    };
  }, [router, load]);

  async function advance(order: Order) {
    const n = nextStatus(order.status);
    if (!n || !canClick(role, order.status, n)) return;
    const token = getAccessToken();
    if (!token) return;
    setErr(null);
    try {
      await apiFetch(`/api/v1/orders/${order.id}/status`, {
        method: "PATCH",
        accessToken: token,
        body: JSON.stringify({ status: n }),
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 bg-stone-900 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Kitchen Display</h1>
            <p className="text-xs text-stone-400">Role: {role || "…"} · Realtime</p>
          </div>
          <Link href="/staff/dashboard" className="text-sm text-amber-400 hover:underline">
            แดชบอร์ด
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {err && <p className="mb-4 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-200">{err}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => {
            const n = nextStatus(o.status);
            const enabled = n && canClick(role, o.status, n);
            const label =
              o.status === "PENDING"
                ? "รับเข้าครัว"
                : o.status === "COOKING"
                  ? "พร้อมเสิร์ฟ"
                  : o.status === "DONE"
                    ? "เสิร์ฟแล้ว"
                    : "—";
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
