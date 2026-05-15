"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
};

type Category = { id: string; name: string; items: MenuItem[] };

export default function CustomerMenuPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const [tableLabel, setTableLabel] = useState("");
  const [tableStatus, setTableStatus] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    void apiFetch<{ table: { label: string; status: string }; categories: Category[] }>(
      `/api/v1/public/tables/${encodeURIComponent(token)}/menu`,
    )
      .then((d) => {
        setTableLabel(d.table.label);
        setTableStatus(d.table.status);
        setCategories(d.categories);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const total = useMemo(() => {
    const priceById = new Map<string, string>();
    for (const c of categories) {
      for (const i of c.items) priceById.set(i.id, i.price);
    }
    let sum = 0;
    for (const [id, qty] of Object.entries(cart)) {
      const p = parseFloat(priceById.get(id) ?? "0");
      sum += p * qty;
    }
    return sum.toFixed(2);
  }, [cart, categories]);

  function addItem(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }

  function decItem(id: string) {
    setCart((c) => {
      const next = { ...c };
      const n = (next[id] ?? 0) - 1;
      if (n <= 0) {
        delete next[id];
        return next;
      }
      next[id] = n;
      return next;
    });
  }

  async function submit() {
    setMsg(null);
    setErr(null);
    const items = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
    if (items.length === 0) {
      setErr("เลือกเมนูอย่างน้อย 1 รายการ");
      return;
    }
    try {
      await apiFetch(`/api/v1/public/tables/${encodeURIComponent(token)}/orders`, {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      setCart({});
      setMsg("ส่งออเดอร์แล้ว — ครัวได้รับแล้ว");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "สั่งไม่สำเร็จ");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-600">
        กำลังโหลดเมนู…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 px-4 py-4 backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">สั่งอาหาร</p>
        <h1 className="text-xl font-semibold text-stone-900">{tableLabel}</h1>
        {tableStatus !== "OPEN" && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            โต๊ะยังไม่เปิดรับออเดอร์ — แจ้งพนักงานให้เปิดโต๊ะในระบบก่อน
          </p>
        )}
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">
        {err && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>
        )}
        {msg && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p>
        )}
        <div className="space-y-8">
          {categories.map((cat) => (
            <section key={cat.id}>
              <h2 className="border-b border-stone-200 pb-2 text-lg font-semibold text-stone-800">
                {cat.name}
              </h2>
              <ul className="mt-3 space-y-3">
                {cat.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-900">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-stone-500">{item.description}</p>
                      )}
                      <p className="mt-1 text-sm font-semibold text-stone-800">{item.price} ฿</p>
                    </div>
                    <div className="flex flex-col items-end justify-center gap-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => decItem(item.id)}
                          className="h-9 w-9 rounded-lg border border-stone-300 text-lg leading-none text-stone-700 hover:bg-stone-100"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-medium">
                          {cart[item.id] ?? 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => addItem(item.id)}
                          className="h-9 w-9 rounded-lg bg-stone-900 text-lg leading-none text-white hover:bg-stone-800"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <div className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          <div>
            <p className="text-xs text-stone-500">ยอดรวม</p>
            <p className="text-lg font-bold text-stone-900">{total} ฿</p>
          </div>
          <button
            type="button"
            disabled={tableStatus !== "OPEN"}
            onClick={() => void submit()}
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            สั่งเลย
          </button>
        </div>
      </div>
    </div>
  );
}
