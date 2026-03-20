import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/server/auth/session";
import { jsonWithRequestId } from "@/server/http";

export async function requirePageRole(role: UserRole, loginPath: string) {
  const session = await getCurrentSession();

  if (!session || session.user.role !== role) {
    redirect(loginPath);
  }

  return session;
}

export async function requireApiRole(role: UserRole) {
  const session = await getCurrentSession();

  if (!session || session.user.role !== role) {
    return null;
  }

  return session;
}

export function unauthorizedResponse(message = "未登录或无权限", requestId?: string) {
  return jsonWithRequestId(
    {
      message,
    },
    requestId ?? "unauthorized",
    { status: 401 },
  );
}
