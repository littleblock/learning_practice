import crypto from "node:crypto";

import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/shared/constants/app";
import { prisma } from "@/server/db/client";
import { getServerEnv } from "@/server/env";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  displayName: string;
  loginName: string;
}

export interface AuthenticatedSession {
  sessionId: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSessionRecord(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const session = await prisma.userSession.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  });

  return {
    token,
    sessionId: session.id,
    expiresAt,
  };
}

export async function deleteSessionByToken(token: string) {
  await prisma.userSession.deleteMany({
    where: {
      tokenHash: hashSessionToken(token),
    },
  });
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.userSession.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          role: true,
          displayName: true,
          loginName: true,
          status: true,
        },
      },
    },
  });

  if (!session || session.user.status !== "ACTIVE") {
    return null;
  }

  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      role: session.user.role,
      displayName: session.user.displayName,
      loginName: session.user.loginName,
    },
  } satisfies AuthenticatedSession;
}

export function applySessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
) {
  const { COOKIE_SECURE } = getServerEnv();

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: getServerEnv().COOKIE_SECURE,
    path: "/",
    expires: new Date(0),
  });
}
