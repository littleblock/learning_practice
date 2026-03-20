import { UserRole, JobType } from "@prisma/client";

import { EXCEL_MAX_SIZE_BYTES } from "@/shared/constants/app";
import { isAllowedExcelFile, isAllowedExcelMimeType } from "@/shared/utils/file";
import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import { getRequestId, jsonWithRequestId, routeErrorResponse } from "@/server/http";
import { enqueueJob } from "@/server/repositories/job-repository";
import { assertBankExists } from "@/server/services/bank-service";
import { saveUploadedFile } from "@/server/storage/file-storage";

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
      return jsonWithRequestId({ message: "缺少 bankId" }, requestId, { status: 400 });
    }

    if (!(file instanceof File)) {
      return jsonWithRequestId({ message: "请选择 Excel 文件" }, requestId, { status: 400 });
    }

    if (!isAllowedExcelFile(file.name)) {
      return jsonWithRequestId({ message: "仅支持 xlsx、xls、csv 文件" }, requestId, { status: 400 });
    }

    if (!isAllowedExcelMimeType(file.type)) {
      return jsonWithRequestId(
        { message: "Excel 文件 MIME 类型不受支持" },
        requestId,
        { status: 400 },
      );
    }

    if (file.size > EXCEL_MAX_SIZE_BYTES) {
      return jsonWithRequestId(
        { message: "Excel 文件过大，请控制在 5MB 以内" },
        requestId,
        { status: 400 },
      );
    }

    await assertBankExists(bankId);

    const storagePath = await saveUploadedFile(file, "imports");
    await enqueueJob(JobType.IMPORT_QUESTIONS, {
      bankId,
      storagePath,
      fileName: file.name,
    });

    return jsonWithRequestId({ success: true }, requestId);
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
