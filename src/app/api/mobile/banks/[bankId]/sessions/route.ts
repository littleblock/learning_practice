import { UserRole } from "@prisma/client";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import { getRequestId, jsonWithRequestId, routeErrorResponse } from "@/server/http";
import { createPracticeSession } from "@/server/services/practice-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bankId: string }> },
) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.LEARNER);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const payload = await request.json();
    const { bankId } = await params;
    const practiceSession = await createPracticeSession(session.user.id, bankId, payload);
    return jsonWithRequestId({
      sessionId: practiceSession.id,
    }, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
