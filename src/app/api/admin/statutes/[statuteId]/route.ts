import { UserRole } from "@prisma/client";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import { getRequestId, jsonWithRequestId, routeErrorResponse } from "@/server/http";
import { prisma } from "@/server/db/client";
import { deleteStatuteDocumentById } from "@/server/services/statute-service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ statuteId: string }> },
) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.ADMIN);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const { statuteId } = await params;
    const document = await prisma.statuteDocument.findUnique({
      where: { id: statuteId },
      select: { bankId: true },
    });

    if (!document) {
      return jsonWithRequestId({ message: "法条资料不存在" }, requestId, { status: 404 });
    }

    await deleteStatuteDocumentById(document.bankId, statuteId);
    return jsonWithRequestId({ success: true }, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
