"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/order-flow";
import { notifyError } from "@/lib/notify";

type Summary = {
  from: string;
  to: string;
  orderCount: number;
  servedOrderCount: number;
  revenueBaht: string;
  averageServedOrderBaht: string | null;
  byStatus: Partial<Record<OrderStatus, number>>;
  topItems: { menuItemId: string; name: string; quantitySold: number }[];
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  return { from: toYmd(from), to: toYmd(to) };
}

export default function StaffReportsPage() {
  const router = useRouter();
  const init = defaultRange();
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f: string, t: string) => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ from: f, to: t });
      const data = await apiFetch<Summary>(`/api/v1/reports/summary?${q}`, { accessToken: token });
      setSummary(data);
    } catch (e) {
      setSummary(null);
      void notifyError(
        "โหลดรายงานไม่สำเร็จ",
        e instanceof Error ? e.message : "ตรวจสอบสิทธิ์ (เฉพาะ OWNER / MANAGER)",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const d = defaultRange();
    void load(d.from, d.to);
  }, [router, load]);

  function applyRange(e: React.FormEvent) {
    e.preventDefault();
    void load(from, to);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">รายงานสรุป</h1>
        <p className="mt-1 text-sm text-stone-600">
          ยอดขายจากออเดอร์สถานะ <strong>เสิร์ฟแล้ว</strong> ในช่วงวันที่ที่เลือก (เฉพาะ OWNER / MANAGER)
        </p>
      </div>

      <form
        onSubmit={applyRange}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
      >
        <label className="text-sm">
          <span className="text-stone-600">จาก</span>
          <input
            type="date"
            required
            className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="text-stone-600">ถึง</span>
          <input
            type="date"
            required
            className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {loading ? "กำลังโหลด…" : "โหลดรายงาน"}
        </button>
      </form>

      {summary && !loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="ออเดอร์ทั้งหมด" value={String(summary.orderCount)} hint="ทุกสถานะ" />
            <StatCard
              title="ออเดอร์ที่เสิร์ฟแล้ว"
              value={String(summary.servedOrderCount)}
              hint="ใช้คำนวณยอดขาย"
            />
            <StatCard title="รายได้รวม (บาท)" value={formatMoney(summary.revenueBaht)} hint="เฉพาะ SERVED" />
            <StatCard
              title="เฉลี่ยต่อบิล (บาท)"
              value={summary.averageServedOrderBaht ? formatMoney(summary.averageServedOrderBaht) : "—"}
              hint="เฉพาะที่เสิร์ฟแล้ว"
            />
          </div>

          <section className="mt-10 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              ออเดอร์ตามสถานะ
            </h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((st) => {
                const n = summary.byStatus[st] ?? 0;
                return (
                  <li
                    key={st}
                    className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm"
                  >
                    <span className="font-medium text-stone-800">{ORDER_STATUS_LABELS[st]}</span>
                    <span className="ml-2 tabular-nums text-stone-600">{n}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              เมนูขายดี (จำนวนจาน — ออเดอร์ที่เสิร์ฟแล้ว)
            </h2>
            {summary.topItems.length === 0 ? (
              <p className="mt-4 text-sm text-stone-500">ยังไม่มีข้อมูลในช่วงนี้</p>
            ) : (
              <ol className="mt-4 divide-y divide-stone-100">
                {summary.topItems.map((it, idx) => (
                  <li key={it.menuItemId} className="flex items-center justify-between py-3 text-sm">
                    <span className="text-stone-700">
                      <span className="mr-2 font-mono text-xs text-stone-400">{idx + 1}.</span>
                      {it.name}
                    </span>
                    <span className="tabular-nums font-semibold text-stone-900">{it.quantitySold} ที่</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      {loading && (
        <p className="text-center text-sm text-stone-500">กำลังโหลดรายงาน…</p>
      )}
    </main>
  );
}

function StatCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
      <p className="mt-1 text-xs text-stone-500">{hint}</p>
    </div>
  );
}

function formatMoney(s: string): string {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
