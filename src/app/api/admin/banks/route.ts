import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import { getRequestId, jsonWithRequestId, routeErrorResponse } from "@/server/http";
import { createBank, listBanksForAdmin } from "@/server/services/bank-service";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.ADMIN);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const result = await listBanksForAdmin(Object.fromEntries(request.nextUrl.searchParams.entries()));
    return jsonWithRequestId(result, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.ADMIN);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const payload = await request.json();
    const result = await createBank(payload);
    return jsonWithRequestId(result, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
