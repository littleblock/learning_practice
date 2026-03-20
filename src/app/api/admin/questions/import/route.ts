import { UserRole } from "@prisma/client";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import {
  getRequestId,
  jsonWithRequestId,
  routeErrorResponse,
} from "@/server/http";
import { createQuestionImportBatch } from "@/server/services/question-import-service";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.ADMIN);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const formData = await request.formData();
    const bankId = String(formData.get("bankId") || "");
    const file = formData.get("file");

    if (!bankId) {
      return jsonWithRequestId({ message: "缺少 bankId" }, requestId, {
        status: 400,
      });
    }

    if (!(file instanceof File)) {
      return jsonWithRequestId({ message: "请选择 Excel 文件" }, requestId, {
        status: 400,
      });
    }

    const batch = await createQuestionImportBatch(
      bankId,
      file,
      session.user.id,
    );
    return jsonWithRequestId(
      { batchId: batch.id, status: batch.status },
      requestId,
    );
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
