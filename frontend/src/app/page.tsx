export default function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Phase 0 — scaffold
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            ระบบสั่งอาหารผ่าน QR
          </h1>
          <p className="text-zinc-600">
            Monorepo: Next.js (ลูกค้า / แดชบอร์ดภายหลัง) + Express + Prisma +
            Socket.io (แบ็กเอนด์) พร้อม schema พื้นฐานสำหรับเมนู โต๊ะ และออเดอร์
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-700">API base URL</p>
          <p className="mt-1 break-all font-mono text-sm text-zinc-900">{apiUrl}</p>
          <p className="mt-3 text-sm text-zinc-600">
            ลองเปิด{" "}
            <a
              className="font-medium text-zinc-900 underline underline-offset-4"
              href={`${apiUrl}/health`}
              target="_blank"
              rel="noreferrer"
            >
              /health
            </a>{" "}
            และ{" "}
            <a
              className="font-medium text-zinc-900 underline underline-offset-4"
              href={`${apiUrl}/health/db`}
              target="_blank"
              rel="noreferrer"
            >
              /health/db
            </a>{" "}
            หลังตั้งค่า PostgreSQL แล้ว
          </p>
        </div>
      </div>
    </main>
  );
}
