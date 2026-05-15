"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, mediaUrl, uploadMenuItemImage } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import { notifyConfirm, notifyError, notifySuccess } from "@/lib/notify";

type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
};

type Category = {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
};

export default function StaffMenuPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [itemForm, setItemForm] = useState({
    categoryId: "",
    name: "",
    price: "",
    description: "",
  });
  const [addImageFile, setAddImageFile] = useState<File | null>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const addImagePreview = useMemo(
    () => (addImageFile ? URL.createObjectURL(addImageFile) : null),
    [addImageFile],
  );
  useEffect(() => {
    return () => {
      if (addImagePreview) URL.revokeObjectURL(addImagePreview);
    };
  }, [addImagePreview]);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const data = await apiFetch<{ categories: Category[] }>("/api/v1/menu/tree", {
      accessToken: token,
    });
    setCategories(data.categories);
    setItemForm((f) =>
      f.categoryId ? f : { ...f, categoryId: data.categories[0]?.id ?? "" },
    );
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    void load().catch((e: Error) => {
      if (e.message.includes("403") || e.message.toLowerCase().includes("permission")) {
        void notifyError("ไม่มีสิทธิ์", "บัญชีนี้ไม่สามารถจัดการเมนูได้");
      } else {
        void notifyError("โหลดเมนูไม่สำเร็จ", e.message);
      }
    });
  }, [router, load]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch("/api/v1/menu/categories", {
        method: "POST",
        accessToken: token,
        body: JSON.stringify({ name }),
      });
      setNewCatName("");
      await load();
      void notifySuccess("เพิ่มหมวดแล้ว");
    } catch (e) {
      void notifyError(
        "เพิ่มหมวดไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    }
  }

  async function renameCategory(id: string, name: string) {
    const n = name.trim();
    if (!n) {
      void notifyError("ชื่อหมวดไม่ถูกต้อง", "กรุณากรอกชื่อหมวด");
      return;
    }
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch(`/api/v1/menu/categories/${id}`, {
        method: "PATCH",
        accessToken: token,
        body: JSON.stringify({ name: n }),
      });
      await load();
      void notifySuccess("บันทึกชื่อหมวดแล้ว");
    } catch (e) {
      void notifyError(
        "บันทึกไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    }
  }

  async function deleteCategory(id: string) {
    const ok = await notifyConfirm(
      "ลบหมวดนี้?",
      "รายการอาหารในหมวดจะถูกลบด้วย และไม่สามารถกู้คืนได้",
      { confirmText: "ลบ", cancelText: "ยกเลิก" },
    );
    if (!ok) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch(`/api/v1/menu/categories/${id}`, { method: "DELETE", accessToken: token });
      await load();
      void notifySuccess("ลบหมวดแล้ว");
    } catch (e) {
      void notifyError(
        "ลบหมวดไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !itemForm.categoryId) return;
    const price = itemForm.price.trim();
    if (!itemForm.name.trim() || !price) return;
    try {
      let imageUrl: string | null = null;
      if (addImageFile) {
        const up = await uploadMenuItemImage(addImageFile, token);
        imageUrl = up.imageUrl;
      }
      const body: Record<string, unknown> = {
        categoryId: itemForm.categoryId,
        name: itemForm.name.trim(),
        price,
        description: itemForm.description.trim() || null,
        isAvailable: true,
      };
      if (imageUrl) body.imageUrl = imageUrl;
      await apiFetch("/api/v1/menu/items", {
        method: "POST",
        accessToken: token,
        body: JSON.stringify(body),
      });
      setItemForm((f) => ({ ...f, name: "", price: "", description: "" }));
      setAddImageFile(null);
      if (addFileInputRef.current) addFileInputRef.current.value = "";
      await load();
      void notifySuccess("เพิ่มเมนูแล้ว");
    } catch (e) {
      void notifyError(
        "เพิ่มเมนูไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    }
  }

  async function toggleItem(item: MenuItem) {
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch(`/api/v1/menu/items/${item.id}`, {
        method: "PATCH",
        accessToken: token,
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      await load();
    } catch (e) {
      void notifyError(
        "อัปเดตไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    }
  }

  async function deleteItem(id: string) {
    const ok = await notifyConfirm(
      "ลบรายการนี้?",
      "การลบไม่สามารถกู้คืนได้",
      { confirmText: "ลบ", cancelText: "ยกเลิก" },
    );
    if (!ok) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch(`/api/v1/menu/items/${id}`, { method: "DELETE", accessToken: token });
      await load();
      void notifySuccess("ลบเมนูแล้ว");
    } catch (e) {
      void notifyError(
        "ลบเมนูไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    }
  }

  async function updateItemPrice(item: MenuItem, price: string) {
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch(`/api/v1/menu/items/${item.id}`, {
        method: "PATCH",
        accessToken: token,
        body: JSON.stringify({ price }),
      });
      await load();
    } catch (e) {
      void notifyError(
        "บันทึกราคาไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-stone-900">จัดการเมนู</h1>
      <p className="mt-1 text-sm text-stone-600">หมวดหมู่และราคา (OWNER / MANAGER)</p>

      <section className="mt-8 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          เพิ่มหมวด
        </h2>
        <form onSubmit={addCategory} className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
            placeholder="ชื่อหมวด"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
          >
            เพิ่มหมวด
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          เพิ่มรายการอาหาร
        </h2>
        <form onSubmit={addItem} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-stone-600">หมวด</span>
            <select
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={itemForm.categoryId}
              onChange={(e) => setItemForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">ชื่อเมนู</span>
            <input
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={itemForm.name}
              onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">ราคา (บาท)</span>
            <input
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              inputMode="decimal"
              value={itemForm.price}
              onChange={(e) => setItemForm((f) => ({ ...f, price: e.target.value }))}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-stone-600">คำอธิบาย (ไม่บังคับ)</span>
            <input
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={itemForm.description}
              onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <div className="sm:col-span-2">
            <span className="block text-sm text-stone-600">รูปภาพ (ไม่บังคับ)</span>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-700 hover:bg-stone-100">
                <input
                  ref={addFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setAddImageFile(f);
                  }}
                />
                เลือกไฟล์รูป
              </label>
              {addImageFile && (
                <button
                  type="button"
                  className="text-sm text-stone-500 underline"
                  onClick={() => {
                    setAddImageFile(null);
                    if (addFileInputRef.current) addFileInputRef.current.value = "";
                  }}
                >
                  ล้างรูป
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-stone-500">JPG, PNG, WebP หรือ GIF — ไม่เกิน 3 MB</p>
            {addImagePreview && (
              <img
                src={addImagePreview}
                alt=""
                className="mt-3 h-28 w-28 rounded-lg border border-stone-200 object-cover"
              />
            )}
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={categories.length === 0}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              เพิ่มเมนู
            </button>
            {categories.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">สร้างหมวดก่อนจึงจะเพิ่มเมนูได้</p>
            )}
          </div>
        </form>
      </section>

      <div className="mt-8 space-y-8">
        {categories.map((cat) => (
          <CategoryBlock
            key={cat.id}
            category={cat}
            onRename={(name) => void renameCategory(cat.id, name)}
            onDelete={() => void deleteCategory(cat.id)}
            onToggleItem={toggleItem}
            onDeleteItem={deleteItem}
            onSavePrice={updateItemPrice}
            onEditItem={setEditingItem}
          />
        ))}
      </div>

      {editingItem && (
        <EditMenuItemModal
          key={editingItem.id}
          item={editingItem}
          categories={categories}
          onClose={() => setEditingItem(null)}
          onSaved={load}
        />
      )}
    </main>
  );
}

function EditMenuItemModal({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: MenuItem;
  categories: Category[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price);
  const [description, setDescription] = useState(item.description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const currentImg = !removeImage ? mediaUrl(item.imageUrl) : null;

  async function save() {
    const token = getAccessToken();
    if (!token) return;
    const n = name.trim();
    const p = price.trim();
    if (!n || !p) {
      void notifyError("ข้อมูลไม่ครบ", "กรอกชื่อเมนูและราคา");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        categoryId,
        name: n,
        price: p,
        description: description.trim() || null,
      };
      if (file) {
        const up = await uploadMenuItemImage(file, token);
        body.imageUrl = up.imageUrl;
      } else if (removeImage) {
        body.imageUrl = null;
      }

      await apiFetch(`/api/v1/menu/items/${item.id}`, {
        method: "PATCH",
        accessToken: token,
        body: JSON.stringify(body),
      });
      await onSaved();
      void notifySuccess("บันทึกเมนูแล้ว");
      onClose();
    } catch (e) {
      void notifyError(
        "บันทึกไม่สำเร็จ",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-[1px] sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-labelledby="edit-menu-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="edit-menu-title" className="text-lg font-semibold text-stone-900">
          แก้ไขเมนู
        </h2>
        <div className="mt-4 grid gap-3">
          <label className="block text-sm">
            <span className="text-stone-600">หมวด</span>
            <select
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">ชื่อเมนู</span>
            <input
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">ราคา (บาท)</span>
            <input
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-stone-600">คำอธิบาย</span>
            <input
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div>
            <span className="block text-sm text-stone-600">รูปภาพ</span>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    if (f) setRemoveImage(false);
                  }}
                />
                เลือกรูปใหม่
              </label>
              {(file || currentImg) && (
                <button
                  type="button"
                  className="text-sm text-stone-500 underline"
                  onClick={() => {
                    setFile(null);
                    setRemoveImage(true);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  เอารูปออก
                </button>
              )}
            </div>
            <div className="mt-3 flex gap-3">
              {currentImg && !filePreview && (
                <img
                  src={currentImg}
                  alt=""
                  className="h-24 w-24 rounded-lg border border-stone-200 object-cover opacity-100"
                  style={{ display: removeImage ? "none" : undefined }}
                />
              )}
              {filePreview && (
                <img
                  src={filePreview}
                  alt=""
                  className="h-24 w-24 rounded-lg border border-stone-200 object-cover"
                />
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2 border-t border-stone-100 pt-4">
          <button
            type="button"
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            onClick={onClose}
            disabled={saving}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={saving}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            onClick={() => void save()}
          >
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryBlock({
  category,
  onRename,
  onDelete,
  onToggleItem,
  onDeleteItem,
  onSavePrice,
  onEditItem,
}: {
  category: Category;
  onRename: (name: string) => void;
  onDelete: () => void;
  onToggleItem: (item: MenuItem) => void;
  onDeleteItem: (id: string) => void;
  onSavePrice: (item: MenuItem, price: string) => void;
  onEditItem: (item: MenuItem) => void;
}) {
  const [name, setName] = useState(category.name);

  useEffect(() => {
    setName(category.name);
  }, [category.id, category.name]);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
          <input
            className="min-w-[160px] flex-1 rounded-lg border border-stone-300 px-3 py-2 font-medium text-stone-900"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            onClick={() => onRename(name.trim())}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50"
          >
            บันทึกชื่อหมวด
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-sm text-red-600 hover:underline"
        >
          ลบหมวด
        </button>
      </div>
      <ul className="mt-4 divide-y divide-stone-100">
        {category.items.map((item) => {
          const thumb = mediaUrl(item.imageUrl);
          return (
            <li
              key={item.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg border border-stone-200 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-stone-200 bg-stone-50 text-[10px] text-stone-400">
                    ไม่มีรูป
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-stone-900">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-stone-500">{item.description}</p>
                  )}
                  <p className="text-xs text-stone-400">
                    {item.isAvailable ? "แสดงในเมนู" : "ซ่อน"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="w-24 rounded border border-stone-300 px-2 py-1 text-sm"
                  defaultValue={item.price}
                  key={item.id + item.price}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== item.price) onSavePrice(item, v);
                  }}
                />
                <span className="text-sm text-stone-500">฿</span>
                <button
                  type="button"
                  onClick={() => onToggleItem(item)}
                  className="rounded-lg border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50"
                >
                  {item.isAvailable ? "ซ่อน" : "แสดง"}
                </button>
                <button
                  type="button"
                  onClick={() => onEditItem(item)}
                  className="rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-50"
                >
                  แก้ไข
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  ลบ
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
