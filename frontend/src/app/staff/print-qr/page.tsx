"use client";

import { Suspense, useCallback, useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import QRCodeLib from "react-qr-code";

type QrProps = { value: string; size?: number; level?: "L" | "M" | "Q" | "H" };
const QRCode = QRCodeLib as unknown as ComponentType<QrProps>;
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import { getCustomerMenuAbsoluteUrl } from "@/lib/public-app-url";

type Slip = { token: string; label: string };

function PrintQrInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const all = sp.get("all") === "1";
  const token = sp.get("token");
  const labelParam = sp.get("label");

  const [slips, setSlips] = useState<Slip[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const access = getAccessToken();
    if (!access) {
      router.replace("/login");
      return;
    }
    const data = await apiFetch<{ tables: { qrToken: string; label: string }[] }>("/api/v1/tables", {
      accessToken: access,
    });
    setSlips(data.tables.map((t) => ({ token: t.qrToken, label: t.label })));
  }, [router]);

  useEffect(() => {
    if (all) {
      setErr(null);
      void loadAll().catch((e: Error) => {
        setErr(e.message);
        setSlips([]);
      });
      return;
    }
    if (token) {
      setSlips([{ token, label: labelParam?.trim() || "โต๊ะ" }]);
      return;
    }
    setErr("ไม่พบพารามิเตอร์ — ใช้ ?token=…&label=… หรือ ?all=1");
    setSlips([]);
  }, [all, token, labelParam, loadAll]);

  return (
    <div className="min-h-screen bg-stone-100 print:bg-white">
      <div className="no-print sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-stone-800">ป้าย QR สั่งอาหาร</p>
          <div className="flex gap-2">
            <Link
              href="/staff/dashboard"
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
              กลับแดชบอร์ด
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800"
            >
              พิมพ์ / บันทึก PDF
            </button>
          </div>
        </div>
      </div>

      {err && (
        <p className="no-print mx-auto max-w-lg px-4 py-4 text-sm text-red-700">{err}</p>
      )}

      <div className="mx-auto max-w-lg px-4 py-6 print:max-w-none print:px-0 print:py-0">
        {slips === null && !err && <p className="text-sm text-stone-500">กำลังโหลด…</p>}
        {slips && slips.length === 0 && !err && (
          <p className="text-sm text-stone-600">ยังไม่มีโต๊ะในระบบ</p>
        )}
        {slips &&
          slips.length > 0 &&
          slips.map((s, i) => (
            <SlipCard key={`${s.token}-${i}`} slip={s} pageBreak={all && i < slips.length - 1} />
          ))}
      </div>

      <p className="no-print mx-auto max-w-lg px-4 pb-8 text-xs text-stone-500">
        เลือก &quot;พิมพ์ / บันทึก PDF&quot; แล้วเลือกเครื่องพิมพ์หรือ &quot;Save as PDF&quot; — ตัดเป็นใบเล็กแล้ววางบนโต๊ะได้
      </p>
    </div>
  );
}

function SlipCard({ slip, pageBreak }: { slip: Slip; pageBreak: boolean }) {
  const url = getCustomerMenuAbsoluteUrl(slip.token);
  return (
    <article
      className={`mb-8 rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm print:mb-0 print:rounded-none print:border-0 print:shadow-none ${
        pageBreak ? "print-slip-page" : ""
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">สแกนเพื่อสั่งอาหาร</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 print:text-3xl">{slip.label}</h1>
      <div className="mt-6 flex justify-center print:mt-8">
        <div className="rounded-xl bg-white p-3 ring-1 ring-stone-200 print:p-4">
          <QRCode value={url} size={200} level="M" />
        </div>
      </div>
      <p className="mt-4 break-all font-mono text-[10px] leading-tight text-stone-400 print:text-xs">{url}</p>
    </article>
  );
}

export default function PrintQrPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-stone-100 text-stone-600">
          กำลังโหลด…
        </div>
      }
    >
      <PrintQrInner />
    </Suspense>
  );
}
