"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { apiFetch, getApiBase } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
  canAdvanceOrder,
  nextOrderStatus,
  orderAdvanceButtonLabel,
} from "@/lib/order-flow";
import { notifyError, notifySuccess } from "@/lib/notify";

type OrderLine = {
  id: string;
  quantity: number;
  notes: string | null;
  menuItem: { name: string };
};

type Order = {
  id: string;
  status: OrderStatus;
  total: string | null;
  createdAt: string;
  updatedAt: string;
  table: { id: string; label: string };
  items: OrderLine[];
};

type FilterKey = "ALL" | OrderStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "ทั้งหมด" },
  { key: "PENDING", label: ORDER_STATUS_LABELS.PENDING },
  { key: "COOKING", label: ORDER_STATUS_LABELS.COOKING },
  { key: "DONE", label: ORDER_STATUS_LABELS.DONE },
  { key: "SERVED", label: ORDER_STATUS_LABELS.SERVED },
];

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function StaffOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [role, setRole] = useState<string>("");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const data = await apiFetch<{ orders: Order[] }>("/api/v1/orders", { accessToken: token });
    setOrders(data.orders);
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

  const filtered = useMemo(() => {
    if (filter === "ALL") return orders;
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  async function advance(order: Order) {
    const n = nextOrderStatus(order.status);
    if (!n || !canAdvanceOrder(role, order.status, n)) return;
    const token = getAccessToken();
    if (!token) return;
    setBusyId(order.id);
    try {
      await apiFetch(`/api/v1/orders/${order.id}/status`, {
        method: "PATCH",
        accessToken: token,
        body: JSON.stringify({ status: n }),
      });
      await load();
      void notifySuccess("อัปเดตสถานะแล้ว");
    } catch (e) {
      void notifyError(
        "อัปเดตไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">ออเดอร์ทั้งหมด</h1>
          <p className="mt-1 text-sm text-stone-600">
            กรองตามสถานะ · อัปเดตแบบ realtime · บทบาท {role || "…"}
          </p>
        </div>
        <Link
          href="/staff/kitchen"
          className="text-sm font-medium text-amber-800 underline decoration-amber-800/30 hover:decoration-amber-800"
        >
          ไปมุมมองครัว (KDS) →
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.key === "ALL" ? orders.length : orders.filter((o) => o.status === f.key).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
              }`}
            >
              {f.label}
              <span className="ml-1 tabular-nums opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      <ul className="space-y-3">
        {filtered.map((o) => {
          const next = nextOrderStatus(o.status);
          const canAct = next ? canAdvanceOrder(role, o.status, next) : false;
          const statusClass =
            o.status === "PENDING"
              ? "bg-amber-100 text-amber-900"
              : o.status === "COOKING"
                ? "bg-orange-100 text-orange-900"
                : o.status === "DONE"
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-stone-200 text-stone-700";

          return (
            <li
              key={o.id}
              className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-900">{o.table.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                      {ORDER_STATUS_LABELS[o.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    {formatTime(o.createdAt)} · ID {o.id.slice(0, 8)}…
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-stone-900">{o.total ?? "—"} ฿</p>
                  {next && (
                    <button
                      type="button"
                      disabled={!canAct || busyId === o.id}
                      onClick={() => void advance(o)}
                      className="mt-2 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busyId === o.id ? "…" : orderAdvanceButtonLabel(o.status)}
                    </button>
                  )}
                  {!next && (
                    <p className="mt-2 text-xs text-stone-400">จบลูปแล้ว</p>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 border-t border-stone-100 pt-3 text-sm text-stone-700">
                {o.items.map((i) => (
                  <li key={i.id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <span>
                      ×{i.quantity} {i.menuItem.name}
                    </span>
                    {i.notes && (
                      <span className="text-xs text-stone-500 sm:ml-2">หมายเหตุ: {i.notes}</span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <p className="mt-12 text-center text-sm text-stone-500">ไม่มีออเดอร์ในตัวกรองนี้</p>
      )}
    </main>
  );
}
