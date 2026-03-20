import { UserRole } from "@prisma/client";

import { isAllowedStatuteMimeType } from "@/shared/utils/file";
import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import { getRequestId, jsonWithRequestId, routeErrorResponse } from "@/server/http";
import { uploadStatuteDocument } from "@/server/services/statute-service";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.ADMIN);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const formData = await request.formData();
    const bankId = String(formData.get("bankId") || "");
    const title = String(formData.get("title") || "");
    const file = formData.get("file");

    if (!bankId) {
      return jsonWithRequestId({ message: "缺少 bankId" }, requestId, { status: 400 });
    }

    if (!(file instanceof File)) {
      return jsonWithRequestId({ message: "请选择法条资料文件" }, requestId, { status: 400 });
    }

    if (!isAllowedStatuteMimeType(file.type)) {
      return jsonWithRequestId(
        { message: "法条资料文件 MIME 类型不受支持" },
        requestId,
        { status: 400 },
      );
    }

    const result = await uploadStatuteDocument(bankId, title || file.name, file);
    return jsonWithRequestId(result, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
