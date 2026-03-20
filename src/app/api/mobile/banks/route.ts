import { UserRole } from "@prisma/client";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import { listMobileBankSummaries } from "@/server/services/bank-service";
import { getRequestId, jsonWithRequestId, routeErrorResponse } from "@/server/http";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.LEARNER);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const result = await listMobileBankSummaries(session.user.id);
    return jsonWithRequestId(result, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
