import { cookies } from "next/headers";
import {
  clearSessionCookie,
  deleteSessionByToken,
} from "@/server/auth/session";
import { SESSION_COOKIE_NAME } from "@/shared/constants/app";
import { getRequestId, jsonWithRequestId, routeErrorResponse } from "@/server/http";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await deleteSessionByToken(token);
    }

    const response = jsonWithRequestId({ success: true }, requestId);
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
