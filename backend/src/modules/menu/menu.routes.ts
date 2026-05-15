import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { Prisma, UserRole } from "@prisma/client";
import { asyncHandler } from "../../lib/async-handler";
import { requireRoles } from "../../middleware/require-roles";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { menuImageUpload, MENU_UPLOAD_URL_PREFIX } from "./menu-image-upload";

export const menuRouter = Router();

const priceSchema = z.union([z.number().positive(), z.string().regex(/^\d+(\.\d{1,2})?$/)]);

function toDecimal(v: z.infer<typeof priceSchema>): Prisma.Decimal {
  return new Prisma.Decimal(typeof v === "number" ? v.toString() : v);
}

function isAllowedMenuImageUrl(s: string | null): boolean {
  if (s == null) return true;
  if (s.length > 2000) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (!s.startsWith(`${MENU_UPLOAD_URL_PREFIX}/`)) return false;
  const file = s.slice(MENU_UPLOAD_URL_PREFIX.length + 1);
  return file.length > 0 && !file.includes("/") && !file.includes("..") && /^[a-zA-Z0-9._-]+$/.test(file);
}

const imageUrlField = z.preprocess(
  (v) => (v === "" ? null : v),
  z
    .union([z.undefined(), z.null(), z.string().max(2000)])
    .refine((s) => s === undefined || isAllowedMenuImageUrl(s), "Invalid imageUrl"),
);

menuRouter.get(
  "/tree",
  requireRoles(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF, UserRole.WAITER),
  asyncHandler(async (_req, res) => {
    const categories = await prisma.menuCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        items: { orderBy: { name: "asc" } },
      },
    });
    res.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        items: c.items.map((i) => ({
          id: i.id,
          categoryId: i.categoryId,
          name: i.name,
          description: i.description,
          price: i.price.toString(),
          imageUrl: i.imageUrl,
          isAvailable: i.isAvailable,
        })),
      })),
    });
  }),
);

const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  sortOrder: z.number().int().optional(),
});

menuRouter.post(
  "/categories",
  requireRoles(UserRole.OWNER, UserRole.MANAGER),
  asyncHandler(async (req, res) => {
    const body = createCategorySchema.parse(req.body);
    const cat = await prisma.menuCategory.create({
      data: {
        name: body.name,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    res.status(201).json({ category: cat });
  }),
);

menuRouter.patch(
  "/categories/:id",
  requireRoles(UserRole.OWNER, UserRole.MANAGER),
  asyncHandler(async (req, res) => {
    const id = z.string().cuid().parse(req.params.id);
    const body = createCategorySchema.partial().parse(req.body);
    try {
      const cat = await prisma.menuCategory.update({
        where: { id },
        data: body,
      });
      res.json({ category: cat });
    } catch {
      throw new AppError(404, "Category not found", "NOT_FOUND");
    }
  }),
);

menuRouter.delete(
  "/categories/:id",
  requireRoles(UserRole.OWNER, UserRole.MANAGER),
  asyncHandler(async (req, res) => {
    const id = z.string().cuid().parse(req.params.id);
    await prisma.menuCategory.delete({ where: { id } }).catch(() => {
      throw new AppError(404, "Category not found", "NOT_FOUND");
    });
    res.status(204).send();
  }),
);

const createItemSchema = z.object({
  categoryId: z.string().cuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  price: priceSchema,
  imageUrl: imageUrlField,
  isAvailable: z.boolean().optional(),
});

menuRouter.post(
  "/items/upload-image",
  requireRoles(UserRole.OWNER, UserRole.MANAGER),
  (req, res, next) => {
    menuImageUpload.single("image")(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return next(new AppError(400, "ไฟล์ใหญ่เกิน 3 MB", "FILE_TOO_LARGE"));
          }
          return next(new AppError(400, err.message, "UPLOAD_ERROR"));
        }
        return next(
          new AppError(
            400,
            err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ",
            "UPLOAD_ERROR",
          ),
        );
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, "กรุณาเลือกไฟล์รูป", "NO_FILE");
    }
    const imageUrl = `${MENU_UPLOAD_URL_PREFIX}/${req.file.filename}`;
    res.status(201).json({ imageUrl });
  }),
);

menuRouter.post(
  "/items",
  requireRoles(UserRole.OWNER, UserRole.MANAGER),
  asyncHandler(async (req, res) => {
    const body = createItemSchema.parse(req.body);
    const cat = await prisma.menuCategory.findUnique({ where: { id: body.categoryId } });
    if (!cat) throw new AppError(400, "Invalid category", "BAD_REQUEST");
    const item = await prisma.menuItem.create({
      data: {
        categoryId: body.categoryId,
        name: body.name,
        description: body.description ?? null,
        price: toDecimal(body.price),
        imageUrl: body.imageUrl ?? null,
        isAvailable: body.isAvailable ?? true,
      },
    });
    res.status(201).json({
      item: {
        ...item,
        price: item.price.toString(),
      },
    });
  }),
);

const updateItemSchema = createItemSchema.partial().omit({ categoryId: true }).extend({
  categoryId: z.string().cuid().optional(),
});

menuRouter.patch(
  "/items/:id",
  requireRoles(UserRole.OWNER, UserRole.MANAGER),
  asyncHandler(async (req, res) => {
    const id = z.string().cuid().parse(req.params.id);
    const body = updateItemSchema.parse(req.body);
    const data: Prisma.MenuItemUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.price !== undefined) data.price = toDecimal(body.price);
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
    if (body.isAvailable !== undefined) data.isAvailable = body.isAvailable;
    if (body.categoryId !== undefined) {
      const cat = await prisma.menuCategory.findUnique({ where: { id: body.categoryId } });
      if (!cat) throw new AppError(400, "Invalid category", "BAD_REQUEST");
      data.category = { connect: { id: body.categoryId } };
    }
    try {
      const item = await prisma.menuItem.update({ where: { id }, data });
      res.json({ item: { ...item, price: item.price.toString() } });
    } catch {
      throw new AppError(404, "Item not found", "NOT_FOUND");
    }
  }),
);

menuRouter.delete(
  "/items/:id",
  requireRoles(UserRole.OWNER, UserRole.MANAGER),
  asyncHandler(async (req, res) => {
    const id = z.string().cuid().parse(req.params.id);
    await prisma.menuItem.delete({ where: { id } }).catch(() => {
      throw new AppError(404, "Item not found", "NOT_FOUND");
    });
    res.status(204).send();
  }),
);
