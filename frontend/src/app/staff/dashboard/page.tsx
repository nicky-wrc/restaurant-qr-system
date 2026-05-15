"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";

type Table = { id: string; label: string; qrToken: string; status: string };

export default function StaffDashboardPage() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    void apiFetch<{ tables: Table[] }>("/api/v1/tables", { accessToken: token })
      .then((d) => setTables(d.tables))
      .catch((e: Error) => setErr(e.message));
  }, [router]);

  function logout() {
    clearTokens();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold text-stone-900">แดชบอร์ด</h1>
          <div className="flex gap-3 text-sm">
            <Link
              href="/staff/kitchen"
              className="rounded-lg bg-amber-600 px-3 py-2 font-medium text-white hover:bg-amber-700"
            >
              ห้องครัว (KDS)
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-stone-300 px-3 py-2 text-stone-700 hover:bg-stone-100"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500">
            ลิงก์สั่งอาหาร (ลูกค้า)
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            ส่งลิงก์ตามโต๊ะให้ลูกค้าเปิดบนมือถือ — โต๊ะต้องเป็น OPEN ถึงจะสั่งได้
          </p>
          {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
          <ul className="mt-4 space-y-3">
            {tables.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-4"
              >
                <div>
                  <p className="font-medium text-stone-900">{t.label}</p>
                  <p className="text-xs text-stone-500">
                    สถานะ: {t.status === "OPEN" ? "เปิดรับออเดอร์" : "ปิด"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/t/${t.qrToken}`}
                    className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
                  >
                    เปิดหน้าลูกค้า
                  </Link>
                  <span className="max-w-xs truncate rounded bg-stone-100 px-2 py-2 font-mono text-xs text-stone-600">
                    /t/{t.qrToken}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
