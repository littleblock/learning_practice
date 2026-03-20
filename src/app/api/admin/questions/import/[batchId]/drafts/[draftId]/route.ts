import { UserRole } from "@prisma/client";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import {
  getRequestId,
  jsonWithRequestId,
  routeErrorResponse,
} from "@/server/http";
import { deleteQuestionImportDraft } from "@/server/services/question-import-service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ batchId: string; draftId: string }> },
) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.ADMIN);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const { batchId, draftId } = await params;
    const result = await deleteQuestionImportDraft(batchId, draftId);
    return jsonWithRequestId(result, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
