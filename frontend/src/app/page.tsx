import Link from "next/link";

export default function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 text-stone-900">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-amber-700">
            Phase 1 — Core backend & flows
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">ระบบสั่งอาหารผ่าน QR</h1>
          <p className="text-stone-600">
            ล็อกอินพนักงาน · เมนู/โต๊ะ/ออเดอร์ API · ลูกค้าสแกน QR สั่งได้ · ครัวรับ realtime
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/login"
            className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow"
          >
            <p className="text-sm font-semibold text-stone-900">พนักงาน</p>
            <p className="mt-1 text-sm text-stone-500">เข้าสู่ระบบ → แดชบอร์ด & KDS</p>
          </Link>
          <a
            href={`${apiUrl}/health`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300 hover:shadow"
          >
            <p className="text-sm font-semibold text-stone-900">API health</p>
            <p className="mt-1 text-sm text-stone-500">ตรวจสถานะ backend</p>
          </a>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-700">ลูกค้า (ต้องมีลิงก์โต๊ะ)</p>
          <p className="mt-2 text-sm text-stone-600">
            หลังล็อกอิน owner ไปที่{" "}
            <Link href="/staff/dashboard" className="font-medium text-amber-800 underline">
              แดชบอร์ด
            </Link>{" "}
            แล้วกด &quot;เปิดหน้าลูกค้า&quot; ตามโต๊ะ — หรือใช้ path{" "}
            <code className="rounded bg-stone-100 px-1 font-mono text-xs">/t/&lt;qrToken&gt;</code>
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/80 p-5 text-sm text-stone-600">
          <p className="font-medium text-stone-800">หมายเหตุ dev</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              Seed: <code className="font-mono text-xs">owner@example.com</code> / รหัสจากคำสั่ง{" "}
              <code className="font-mono text-xs">npm run db:seed</code>
            </li>
            <li>
              ต้องมี <code className="font-mono text-xs">JWT_*</code> ใน{" "}
              <code className="font-mono text-xs">backend/.env</code> (ดู .env.example)
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
