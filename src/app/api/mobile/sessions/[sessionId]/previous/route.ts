import { UserRole } from "@prisma/client";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import { getRequestId, jsonWithRequestId, routeErrorResponse } from "@/server/http";
import { moveToPreviousQuestion } from "@/server/services/practice-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.LEARNER);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const { sessionId } = await params;
    const result = await moveToPreviousQuestion(session.user.id, sessionId);
    return jsonWithRequestId(result, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
