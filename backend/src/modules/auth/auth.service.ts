import type { UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { loadEnv } from "../../lib/env";
import { signAccessToken } from "../../lib/jwt";
import { generateRefreshToken, hashToken } from "../../lib/tokens";
import { verifyPassword, hashPassword } from "../../lib/password";

export async function login(email: string, password: string) {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const refreshRaw = generateRefreshToken();
  const env = loadEnv();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRES_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshRaw),
      expiresAt,
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    accessToken,
    refreshToken: refreshRaw,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export async function refresh(refreshToken: string) {
  const hash = hashToken(refreshToken);
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: { user: true },
  });
  if (!record || record.revokedAt) {
    throw new AppError(401, "Invalid refresh token", "INVALID_REFRESH");
  }
  if (record.expiresAt < new Date()) {
    throw new AppError(401, "Refresh token expired", "REFRESH_EXPIRED");
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const newRaw = generateRefreshToken();
  const env = loadEnv();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRES_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId: record.userId,
      tokenHash: hashToken(newRaw),
      expiresAt,
    },
  });

  const accessToken = signAccessToken({
    sub: record.user.id,
    email: record.user.email,
    role: record.user.role,
  });

  return {
    accessToken,
    refreshToken: newRaw,
    user: {
      id: record.user.id,
      email: record.user.email,
      name: record.user.name,
      role: record.user.role,
    },
  };
}

export async function logout(refreshToken: string) {
  const hash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError(404, "User not found", "NOT_FOUND");
  return user;
}

export async function createStaffUser(input: {
  email: string;
  password: string;
  name?: string | null;
  role: UserRole;
}) {
  const email = input.email.toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new AppError(409, "Email already registered", "EMAIL_IN_USE");
  }
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: input.name ?? null,
      role: input.role,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return user;
}
