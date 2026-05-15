import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";

/** path สำหรับเก็บไฟล์ (cwd = โฟลเดอร์ backend เวลารัน dev/start) */
export const MENU_UPLOAD_REL_DIR = "uploads/menu";

/** URL ที่เก็บใน DB และเสิร์ฟผ่าน express.static("/uploads") */
export const MENU_UPLOAD_URL_PREFIX = "/uploads/menu";

const absDir = path.join(process.cwd(), MENU_UPLOAD_REL_DIR);
fs.mkdirSync(absDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, absDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const safe = allowed.includes(ext) ? ext : ".jpg";
    cb(null, `${Date.now()}-${randomBytes(8).toString("hex")}${safe}`);
  },
});

export const menuImageUpload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("ใช้ได้เฉพาะไฟล์รูป JPG, PNG, WebP หรือ GIF"));
    }
  },
});
