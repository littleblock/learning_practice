import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import { getRequestId, jsonWithRequestId, routeErrorResponse } from "@/server/http";
import { createQuestion, listQuestionsForAdmin } from "@/server/services/question-service";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.ADMIN);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const bankId = request.nextUrl.searchParams.get("bankId");
    if (!bankId) {
      return jsonWithRequestId({ message: "缺少 bankId" }, requestId, { status: 400 });
    }

    const result = await listQuestionsForAdmin(bankId, Object.fromEntries(request.nextUrl.searchParams.entries()));
    return jsonWithRequestId(result, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.ADMIN);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const bankId = request.nextUrl.searchParams.get("bankId");
    if (!bankId) {
      return jsonWithRequestId({ message: "缺少 bankId" }, requestId, { status: 400 });
    }

    const payload = await request.json();
    const result = await createQuestion(bankId, payload);
    return jsonWithRequestId(result, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
