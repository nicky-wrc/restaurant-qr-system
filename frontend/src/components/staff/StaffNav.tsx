"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { clearTokens, getAccessToken } from "@/lib/auth-storage";

type Role = "OWNER" | "MANAGER" | "CHEF" | "WAITER" | "";

const links: { href: string; label: string; roles?: Role[] }[] = [
  { href: "/staff/dashboard", label: "แดชบอร์ด" },
  { href: "/staff/orders", label: "ออเดอร์" },
  { href: "/staff/kitchen", label: "ครัว (KDS)" },
  { href: "/staff/reports", label: "รายงาน", roles: ["OWNER", "MANAGER"] },
  { href: "/staff/menu", label: "จัดการเมนู", roles: ["OWNER", "MANAGER"] },
  { href: "/staff/users", label: "พนักงาน", roles: ["OWNER", "MANAGER"] },
];

export function StaffNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    void apiFetch<{ user: { role: Role } }>("/api/v1/auth/me", { accessToken: token })
      .then((d) => setRole(d.user.role))
      .catch(() => setRole(""));
  }, []);

  function logout() {
    clearTokens();
    window.location.href = "/login";
  }

  const visible = links.filter((l) => !l.roles || (role && l.roles.includes(role)));

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <nav className="flex flex-wrap gap-1">
          {visible.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-stone-900 text-white"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 text-sm text-stone-600">
          {role && <span className="hidden sm:inline">Role: {role}</span>}
          <Link href="/" className="text-stone-500 hover:text-stone-800">
            หน้าแรก
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-stone-700 hover:bg-stone-50"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </header>
  );
}
