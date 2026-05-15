/**
 * ฐาน URL ที่ลูกค้าใช้เปิดหน้าสั่งอาหาร (ต้องตรงกับที่เข้ารหัสใน QR)
 * ตั้ง `NEXT_PUBLIC_APP_URL` เมื่อเข้าระบบด้วย IP ใน LAN หรือโดเมนจริง — ไม่เช่นนั้นใช้ origin ของเบราว์เซอร์ตอนเปิดแดชบอร์ด
 */
export function getPublicAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

/** URL เต็มสำหรับสแกน QR / แชร์ลูกค้า */
export function getCustomerMenuAbsoluteUrl(qrToken: string): string {
  return `${getPublicAppBaseUrl()}/t/${encodeURIComponent(qrToken)}`;
}
