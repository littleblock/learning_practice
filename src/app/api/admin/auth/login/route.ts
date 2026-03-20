import { UserRole } from "@prisma/client";
import { applySessionCookie, createSessionRecord } from "@/server/auth/session";
import { getRequestId, jsonWithRequestId, routeErrorResponse } from "@/server/http";
import { authenticateUser } from "@/server/services/auth-service";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const payload = await request.json();
    const user = await authenticateUser(payload, UserRole.ADMIN);

    if (!user) {
      return jsonWithRequestId({ message: "账号或密码错误" }, requestId, { status: 401 });
    }

    const session = await createSessionRecord(user.id);
    const response = jsonWithRequestId({
      success: true,
    }, requestId);

    applySessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return routeErrorResponse(error, requestId);
  }
}
