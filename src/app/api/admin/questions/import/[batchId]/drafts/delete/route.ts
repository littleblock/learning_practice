import { UserRole } from "@prisma/client";

import { deleteImportDraftsSchema } from "@/shared/schemas/question";
import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import {
  getRequestId,
  jsonWithRequestId,
  routeErrorResponse,
} from "@/server/http";
import { deleteQuestionImportDrafts } from "@/server/services/question-import-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.ADMIN);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const payload = deleteImportDraftsSchema.parse(await request.json());
    const { batchId } = await params;
    const result = await deleteQuestionImportDrafts(batchId, payload);
    return jsonWithRequestId(result, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
