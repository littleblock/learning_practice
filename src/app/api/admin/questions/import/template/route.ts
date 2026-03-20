import { UserRole } from "@prisma/client";
import * as XLSX from "xlsx";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import { getRequestId } from "@/server/http";

const templateRows = [
  [
    "题型",
    "题干",
    "选项A",
    "选项B",
    "选项C",
    "选项D",
    "选项E",
    "选项F",
    "正确答案",
    "解析",
    "答案来源",
    "序号",
  ],
  [
    "single",
    "示例：生产经营单位主要负责人应当履行的职责包括哪一项？",
    "建立并落实全员安全生产责任制",
    "不需要组织制定应急预案",
    "可以不安排安全生产投入",
    "无需开展事故隐患排查",
    "",
    "",
    "A",
    "示例解析：主要负责人应当组织建立并落实全员安全生产责任制。",
    "《安全生产法》第二十一条",
    "1",
  ],
];

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const session = await requireApiRole(UserRole.ADMIN);
  if (!session) {
    return unauthorizedResponse("未登录或无权限", requestId);
  }

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(templateRows);
  XLSX.utils.book_append_sheet(workbook, sheet, "题目模板");
  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
  const body = new Uint8Array(buffer);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        "attachment; filename*=UTF-8''question-import-standard-template.xlsx",
      "Cache-Control": "no-store, max-age=0",
      "x-request-id": requestId,
    },
  });
}
