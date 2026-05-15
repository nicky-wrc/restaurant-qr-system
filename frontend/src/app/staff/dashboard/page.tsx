"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getCustomerMenuAbsoluteUrl } from "@/lib/public-app-url";
import { getAccessToken } from "@/lib/auth-storage";
import { notifyConfirm, notifyError, notifySuccess } from "@/lib/notify";

type Table = { id: string; label: string; qrToken: string; status: string };
type Role = string;

const TABLES_PAGE_SIZE = 10;

function sortTablesByLabel(a: Table, b: Table): number {
  return a.label.localeCompare(b.label, "th", { numeric: true, sensitivity: "base" });
}

function TablesPaginationBar({
  sortedLength,
  rangeStart,
  rangeEnd,
  page,
  pageCount,
  onPrev,
  onNext,
  className = "",
}: {
  sortedLength: number;
  rangeStart: number;
  rangeEnd: number;
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  if (sortedLength <= TABLES_PAGE_SIZE) return null;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200/80 bg-stone-50/80 px-4 py-3 text-sm text-stone-700 ring-1 ring-stone-900/5 ${className}`}
    >
      <p>
        แสดง{" "}
        <span className="font-medium text-stone-900">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        จาก {sortedLength} โต๊ะ · หน้า {page}/{pageCount}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={onPrev}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ก่อนหน้า
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={onNext}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}

export default function StaffDashboardPage() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [role, setRole] = useState<Role>("");
  const [newLabel, setNewLabel] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);

  const sortedTables = useMemo(() => [...tables].sort(sortTablesByLabel), [tables]);
  const tablePageCount = Math.max(1, Math.ceil(sortedTables.length / TABLES_PAGE_SIZE));
  const safeTablePage = Math.min(tablePage, tablePageCount);
  const pagedTables = useMemo(
    () =>
      sortedTables.slice(
        (safeTablePage - 1) * TABLES_PAGE_SIZE,
        safeTablePage * TABLES_PAGE_SIZE,
      ),
    [sortedTables, safeTablePage],
  );
  const tableRangeStart = sortedTables.length === 0 ? 0 : (safeTablePage - 1) * TABLES_PAGE_SIZE + 1;
  const tableRangeEnd = Math.min(safeTablePage * TABLES_PAGE_SIZE, sortedTables.length);

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

  useEffect(() => {
    setTablePage((p) => Math.min(p, tablePageCount));
  }, [tablePageCount]);

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

  function closeDetailsMenu(target: EventTarget & HTMLElement) {
    const root = target.closest("details");
    if (root) root.open = false;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">แดชบอร์ด</h1>
        <p className="mt-1 text-sm text-stone-600">
          จัดการโต๊ะและลิงก์ให้ลูกค้าสั่งอาหาร
        </p>
      </div>

      {canManageTables && (
        <section className="mb-10 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm ring-1 ring-stone-900/5">
          <h2 className="text-sm font-semibold text-stone-800">เพิ่มโต๊ะใหม่</h2>
          <form onSubmit={createTable} className="mt-3 flex flex-wrap gap-2">
            <input
              className="min-w-[200px] flex-1 rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2.5 text-sm outline-none ring-stone-900/10 transition placeholder:text-stone-400 focus:border-stone-300 focus:bg-white focus:ring-2"
              placeholder="ชื่อโต๊ะ เช่น โต๊ะ 3"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              สร้างโต๊ะ
            </button>
          </form>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-stone-800">โต๊ะและลิงก์ลูกค้า</h2>
          {tables.length > 0 && (
            <Link
              href="/staff/print-qr?all=1"
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
            >
              พิมพ์ QR ทุกโต๊ะ
            </Link>
          )}
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
          โต๊ะต้องอยู่สถานะ <span className="font-medium text-stone-700">เปิดรับออเดอร์</span>{" "}
          ลูกค้าถึงจะสั่งได้ — พิมพ์ป้าย QR ให้ลูกค้าสแกนด้วยกล้องมือถือได้โดยไม่ต้องพิมพ์ลิงก์
        </p>
        <TablesPaginationBar
          className="mt-4"
          sortedLength={sortedTables.length}
          rangeStart={tableRangeStart}
          rangeEnd={tableRangeEnd}
          page={safeTablePage}
          pageCount={tablePageCount}
          onPrev={() => setTablePage((p) => Math.max(1, p - 1))}
          onNext={() => setTablePage((p) => Math.min(tablePageCount, p + 1))}
        />

        <ul className="mt-5 space-y-4">
          {pagedTables.map((t) => {
            const menuUrl = getCustomerMenuAbsoluteUrl(t.qrToken);
            const isOpen = t.status === "OPEN";
            const busy = busyId === t.id;
            return (
              <li
                key={t.id}
                className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm ring-1 ring-stone-900/5 sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-lg font-semibold tracking-tight text-stone-900">{t.label}</h3>
                      <span
                        className={
                          isOpen
                            ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-600/15"
                            : "rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600 ring-1 ring-stone-500/10"
                        }
                      >
                        {isOpen ? "เปิดรับออเดอร์" : "ปิด"}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5 rounded-xl bg-stone-50 px-2.5 py-2 ring-1 ring-stone-900/5">
                      <code
                        className="min-w-0 flex-1 truncate font-mono text-xs text-stone-600"
                        title={menuUrl}
                      >
                        /t/{t.qrToken}
                      </code>
                      <button
                        type="button"
                        disabled={busy}
                        title="คัดลอกลิงก์เต็ม"
                        onClick={() => {
                          void navigator.clipboard.writeText(menuUrl).then(
                            () =>
                              void notifySuccess("คัดลอกลิงก์แล้ว", "นำไปแชร์ให้ลูกค้าได้เลย"),
                            () =>
                              void notifyError(
                                "คัดลอกไม่สำเร็จ",
                                "ลองเลือกข้อความแล้วคัดลอกด้วยมือ",
                              ),
                          );
                        }}
                        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-white hover:text-stone-800 disabled:opacity-40"
                      >
                        <span className="sr-only">คัดลอกลิงก์</span>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                      <Link
                        href={`/t/${t.qrToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="เปิดหน้าลูกค้าในแท็บใหม่"
                        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-white hover:text-stone-800"
                      >
                        <span className="sr-only">เปิดหน้าลูกค้า</span>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:flex-nowrap">
                    <div
                      className="inline-flex self-start rounded-xl border border-stone-200 bg-stone-50/80 p-1 shadow-inner"
                      role="group"
                      aria-label="สถานะโต๊ะ"
                    >
                      <button
                        type="button"
                        disabled={busy || isOpen}
                        onClick={() => void patchTable(t.id, "OPEN")}
                        className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                          isOpen
                            ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-900/5"
                            : "text-stone-500 hover:text-stone-800"
                        } disabled:opacity-40`}
                      >
                        เปิด
                      </button>
                      <button
                        type="button"
                        disabled={busy || !isOpen}
                        onClick={() => void patchTable(t.id, "CLOSED")}
                        className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                          !isOpen
                            ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-900/5"
                            : "text-stone-500 hover:text-stone-800"
                        } disabled:opacity-40`}
                      >
                        ปิด
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/t/${t.qrToken}`}
                        className="inline-flex items-center justify-center rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800"
                      >
                        หน้าลูกค้า
                      </Link>
                      <Link
                        href={`/staff/print-qr?token=${encodeURIComponent(t.qrToken)}&label=${encodeURIComponent(t.label)}`}
                        className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
                      >
                        พิมพ์ QR
                      </Link>

                      <details className="relative">
                        <summary
                          title="เพิ่มเติม"
                          className="flex cursor-pointer list-none items-center justify-center rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 [&::-webkit-details-marker]:hidden"
                        >
                          <span className="sr-only">เมนูเพิ่มเติม</span>
                          <svg className="h-5 w-5 text-stone-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path d="M12 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                          </svg>
                        </summary>
                        <div className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg ring-1 ring-stone-900/5">
                          <button
                            type="button"
                            disabled={busy}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                            onClick={(e) => {
                              closeDetailsMenu(e.currentTarget);
                              void navigator.clipboard.writeText(menuUrl).then(
                                () =>
                                  void notifySuccess("คัดลอกลิงก์แล้ว", "นำไปแชร์ให้ลูกค้าได้เลย"),
                                () =>
                                  void notifyError(
                                    "คัดลอกไม่สำเร็จ",
                                    "ลองเลือกข้อความแล้วคัดลอกด้วยมือ",
                                  ),
                              );
                            }}
                          >
                            คัดลอกลิงก์เต็ม
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                            onClick={(e) => {
                              closeDetailsMenu(e.currentTarget);
                              void regenerateQr(t.id);
                            }}
                          >
                            สร้าง QR ใหม่
                          </button>
                          {canManageTables && (
                            <button
                              type="button"
                              disabled={busy}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
                              onClick={(e) => {
                                closeDetailsMenu(e.currentTarget);
                                void deleteTable(t.id, t.label);
                              }}
                            >
                              ลบโต๊ะ
                            </button>
                          )}
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <TablesPaginationBar
          className="mt-4"
          sortedLength={sortedTables.length}
          rangeStart={tableRangeStart}
          rangeEnd={tableRangeEnd}
          page={safeTablePage}
          pageCount={tablePageCount}
          onPrev={() => setTablePage((p) => Math.max(1, p - 1))}
          onNext={() => setTablePage((p) => Math.min(tablePageCount, p + 1))}
        />
      </section>
    </main>
  );
}
