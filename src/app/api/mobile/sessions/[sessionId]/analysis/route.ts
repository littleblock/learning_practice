import { UserRole } from "@prisma/client";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import { getRequestId, jsonWithRequestId, routeErrorResponse } from "@/server/http";
import { generatePracticeQuestionAiExplanation } from "@/server/services/practice-ai-service";

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
    const result = await generatePracticeQuestionAiExplanation(
      session.user.id,
      sessionId,
    );
    return jsonWithRequestId(result, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
