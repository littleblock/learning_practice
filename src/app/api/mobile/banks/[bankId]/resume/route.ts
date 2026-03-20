import { UserRole } from "@prisma/client";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import { getRequestId, jsonWithRequestId, routeErrorResponse } from "@/server/http";
import { getResumeSessionId } from "@/server/services/practice-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bankId: string }> },
) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.LEARNER);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const { bankId } = await params;
    const sessionId = await getResumeSessionId(session.user.id, bankId);
    return jsonWithRequestId({ sessionId }, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
