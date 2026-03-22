import { UserRole } from "@prisma/client";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import {
  getRequestId,
  jsonWithRequestId,
  routeErrorResponse,
} from "@/server/http";
import { getQuestionImportBatchDetail } from "@/server/services/question-import-service";

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseKeyword(value: string | null) {
  return value?.trim() ?? "";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.ADMIN);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  try {
    const { batchId } = await params;
    const url = new URL(request.url);
    const result = await getQuestionImportBatchDetail(batchId, {
      draftPage: parsePositiveInteger(url.searchParams.get("draftPage"), 1),
      draftPageSize: parsePositiveInteger(
        url.searchParams.get("draftPageSize"),
        10,
      ),
      draftKeyword: parseKeyword(url.searchParams.get("draftKeyword")),
      sourceRowPage: parsePositiveInteger(
        url.searchParams.get("sourceRowPage"),
        1,
      ),
      sourceRowPageSize: parsePositiveInteger(
        url.searchParams.get("sourceRowPageSize"),
        10,
      ),
    });
    return jsonWithRequestId(result, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
