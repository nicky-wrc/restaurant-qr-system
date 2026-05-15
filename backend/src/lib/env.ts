import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 characters"),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().min(1).max(30).default(7),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;

  const isProd = process.env.NODE_ENV === "production";
  const env = { ...process.env } as Record<string, string | undefined>;

  if (!isProd) {
    if (!env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET.length < 16) {
      console.warn(
        "[env] JWT_ACCESS_SECRET missing or too short — using a dev-only default. Set JWT_ACCESS_SECRET in backend/.env before production.",
      );
      env.JWT_ACCESS_SECRET = "dev-only-jwt-access-secret-min-16-chars";
    }
    if (!env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET.length < 16) {
      console.warn(
        "[env] JWT_REFRESH_SECRET missing or too short — using a dev-only default. Set JWT_REFRESH_SECRET in backend/.env before production.",
      );
      env.JWT_REFRESH_SECRET = "dev-only-jwt-refresh-secret-min-16-chars";
    }
  }

  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment: ${JSON.stringify(msg)}`);
  }
  cached = parsed.data;
  return cached;
}
