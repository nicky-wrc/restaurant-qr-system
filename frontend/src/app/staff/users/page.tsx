"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import { notifyError, notifySuccess } from "@/lib/notify";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
};

const ROLES = ["WAITER", "CHEF", "MANAGER", "OWNER"] as const;

export default function StaffUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [myRole, setMyRole] = useState<string>("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "WAITER" as (typeof ROLES)[number],
  });

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const [u, me] = await Promise.all([
      apiFetch<{ users: UserRow[] }>("/api/v1/users", { accessToken: token }),
      apiFetch<{ user: { role: string } }>("/api/v1/auth/me", { accessToken: token }),
    ]);
    setUsers(u.users);
    setMyRole(me.user.role);
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    void load().catch((e: Error) => void notifyError("โหลดไม่สำเร็จ", e.message));
  }, [router, load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch("/api/v1/users", {
        method: "POST",
        accessToken: token,
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim() || null,
          role: form.role,
        }),
      });
      setForm({ email: "", password: "", name: "", role: "WAITER" });
      await load();
      void notifySuccess("สร้างบัญชีแล้ว");
    } catch (e) {
      void notifyError(
        "สร้างบัญชีไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    }
  }

  const roleOptions =
    myRole === "OWNER" ? ROLES : ROLES.filter((r) => r !== "OWNER");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-stone-900">พนักงาน</h1>
      <p className="mt-1 text-sm text-stone-600">เฉพาะ OWNER / MANAGER</p>

      <section className="mt-8 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          เพิ่มบัญชี
        </h2>
        <form onSubmit={createUser} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-stone-600">อีเมล</span>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-stone-600">รหัสผ่าน (อย่างน้อย 8 ตัว)</span>
            <input
              type="password"
              required
              minLength={8}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">ชื่อที่แสดง</span>
            <input
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">บทบาท</span>
            <select
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({ ...f, role: e.target.value as (typeof ROLES)[number] }))
              }
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
            >
              สร้างบัญชี
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          รายชื่อ
        </h2>
        <ul className="mt-3 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-medium text-stone-900">{u.email}</p>
                {u.name && <p className="text-sm text-stone-500">{u.name}</p>}
              </div>
              <span className="rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700">
                {u.role}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
