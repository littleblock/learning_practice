import crypto from "node:crypto";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { logger } from "@/server/logger";
import { captureServerException } from "@/server/monitoring/sentry";

export function getRequestId(request: Request) {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}

export function jsonWithRequestId(
  payload: unknown,
  requestId: string,
  init?: ResponseInit,
) {
  const response = NextResponse.json(payload, init);
  response.headers.set("x-request-id", requestId);
  return response;
}

export function routeErrorResponse(error: unknown, requestId: string) {
  logger.error({ error, requestId }, "接口处理失败");
  captureServerException(error, { requestId });

  if (error instanceof ZodError) {
    return jsonWithRequestId(
      {
        message: error.issues[0]?.message ?? "请求参数不合法",
      },
      requestId,
      { status: 400 },
    );
  }

  if (error instanceof Error) {
    return jsonWithRequestId(
      {
        message: error.message || "请求处理失败",
      },
      requestId,
      { status: 400 },
    );
  }

  return jsonWithRequestId(
    {
      message: "服务器内部错误",
    },
    requestId,
    { status: 500 },
  );
}
