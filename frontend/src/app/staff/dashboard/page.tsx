"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import { notifyConfirm, notifyError, notifySuccess } from "@/lib/notify";

type Table = { id: string; label: string; qrToken: string; status: string };
type Role = string;

export default function StaffDashboardPage() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [role, setRole] = useState<Role>("");
  const [newLabel, setNewLabel] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const [tRes, meRes] = await Promise.all([
      apiFetch<{ tables: Table[] }>("/api/v1/tables", { accessToken: token }),
      apiFetch<{ user: { role: string } }>("/api/v1/auth/me", { accessToken: token }),
    ]);
    setTables(tRes.tables);
    setRole(meRes.user.role);
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    void load().catch((e: Error) =>
      void notifyError("โหลดข้อมูลไม่สำเร็จ", e.message),
    );
  }, [router, load]);

  const canManageTables = role === "OWNER" || role === "MANAGER";

  async function patchTable(id: string, status: "OPEN" | "CLOSED") {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(id);
    try {
      await apiFetch(`/api/v1/tables/${id}`, {
        method: "PATCH",
        accessToken: token,
        body: JSON.stringify({ status }),
      });
      await load();
      void notifySuccess(
        "บันทึกแล้ว",
        status === "OPEN" ? "เปิดโต๊ะรับออเดอร์แล้ว" : "ปิดโต๊ะแล้ว",
      );
    } catch (e) {
      void notifyError(
        "อัปเดตสถานะไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function regenerateQr(id: string) {
    const ok = await notifyConfirm(
      "สร้าง QR ใหม่?",
      "ลิงก์เดิมจะใช้งานไม่ได้อีกต่อไป",
    );
    if (!ok) return;
    const token = getAccessToken();
    if (!token) return;
    setBusyId(id);
    try {
      await apiFetch(`/api/v1/tables/${id}/regenerate-qr`, {
        method: "POST",
        accessToken: token,
      });
      await load();
      void notifySuccess("สร้าง QR ใหม่แล้ว", "คัดลอกลิงก์ใหม่จากรายการโต๊ะได้เลย");
    } catch (e) {
      void notifyError(
        "สร้าง QR ไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch("/api/v1/tables", {
        method: "POST",
        accessToken: token,
        body: JSON.stringify({ label }),
      });
      setNewLabel("");
      await load();
      void notifySuccess("สร้างโต๊ะแล้ว", `เพิ่มโต๊ะ "${label}" ในระบบแล้ว`);
    } catch (e) {
      void notifyError(
        "สร้างโต๊ะไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    }
  }

  async function deleteTable(id: string, label: string) {
    const ok = await notifyConfirm(
      `ลบโต๊ะ "${label}"?`,
      "การลบจะลบข้อมูลที่เกี่ยวข้องกับโต๊ะนี้ และไม่สามารถกู้คืนได้",
      { confirmText: "ลบ", cancelText: "ยกเลิก" },
    );
    if (!ok) return;
    const token = getAccessToken();
    if (!token) return;
    setBusyId(id);
    try {
      await apiFetch(`/api/v1/tables/${id}`, { method: "DELETE", accessToken: token });
      await load();
      void notifySuccess("ลบโต๊ะแล้ว");
    } catch (e) {
      void notifyError(
        "ลบโต๊ะไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">แดชบอร์ด</h1>
        <p className="mt-1 text-sm text-stone-600">
          จัดการโต๊ะและลิงก์ให้ลูกค้าสั่งอาหาร
        </p>
      </div>

      {canManageTables && (
        <section className="mb-10 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            เพิ่มโต๊ะใหม่
          </h2>
          <form onSubmit={createTable} className="mt-3 flex flex-wrap gap-2">
            <input
              className="min-w-[200px] flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder="ชื่อโต๊ะ เช่น โต๊ะ 3"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              สร้างโต๊ะ
            </button>
          </form>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          โต๊ะและลิงก์ลูกค้า
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          โต๊ะต้องเป็น <strong>เปิด</strong> ลูกค้าถึงจะสั่งได้
        </p>
        <ul className="mt-4 space-y-3">
          {tables.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-stone-900">{t.label}</p>
                <p className="text-xs text-stone-500">
                  สถานะ:{" "}
                  <span className={t.status === "OPEN" ? "text-emerald-700" : "text-stone-600"}>
                    {t.status === "OPEN" ? "เปิดรับออเดอร์" : "ปิด"}
                  </span>
                </p>
                <p className="mt-1 max-w-md truncate font-mono text-xs text-stone-400">
                  /t/{t.qrToken}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-stone-500">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/t/${t.qrToken}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => {
                    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/t/${t.qrToken}`;
                    void navigator.clipboard.writeText(url).then(
                      () => void notifySuccess("คัดลอกลิงก์แล้ว", "นำไปแชร์ให้ลูกค้าได้เลย"),
                      () => void notifyError("คัดลอกไม่สำเร็จ", "ลองเลือกข้อความแล้วคัดลอกด้วยมือ"),
                    );
                  }}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-40"
                >
                  คัดลอกลิงก์
                </button>
                <Link
                  href={`/t/${t.qrToken}`}
                  className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
                >
                  เปิดหน้าลูกค้า
                </Link>
                <button
                  type="button"
                  disabled={busyId === t.id || t.status === "OPEN"}
                  onClick={() => void patchTable(t.id, "OPEN")}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-40"
                >
                  เปิดโต๊ะ
                </button>
                <button
                  type="button"
                  disabled={busyId === t.id || t.status === "CLOSED"}
                  onClick={() => void patchTable(t.id, "CLOSED")}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                >
                  ปิดโต๊ะ
                </button>
                <button
                  type="button"
                  disabled={busyId === t.id}
                  onClick={() => void regenerateQr(t.id)}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:bg-amber-100 disabled:opacity-40"
                >
                  QR ใหม่
                </button>
                {canManageTables && (
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => void deleteTable(t.id, t.label)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
                  >
                    ลบ
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
