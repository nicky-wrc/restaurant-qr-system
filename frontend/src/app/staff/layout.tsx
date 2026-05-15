"use client";

import { usePathname } from "next/navigation";
import { StaffNav } from "@/components/staff/StaffNav";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname?.startsWith("/staff/print-qr");

  return (
    <div className={hideNav ? "min-h-screen bg-stone-100 print:bg-white" : "min-h-screen bg-stone-50"}>
      {!hideNav && <StaffNav />}
      {children}
    </div>
  );
}
