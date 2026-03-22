import { UserRole } from "@prisma/client";

import { requireApiRole, unauthorizedResponse } from "@/server/auth/guards";
import { getRequestId } from "@/server/http";
import {
  getQuestionImportBatchSnapshot,
  listQuestionImportDraftsAfter,
  listQuestionImportSourceRowsAfter,
} from "@/server/services/question-import-service";

export const runtime = "nodejs";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInteger(value: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
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

  const { batchId } = await params;
  const url = new URL(request.url);
  let lastDraftSortOrder = parsePositiveInteger(
    url.searchParams.get("lastDraftSortOrder"),
  );
  let lastSourceRowNumber = parsePositiveInteger(
    url.searchParams.get("lastSourceRowNumber"),
  );
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let lastProgressPayload = "";
      let lastHeartbeatAt = 0;

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        controller.close();
      };

      const send = (event: string, payload: unknown) => {
        if (closed) {
          return;
        }

        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
        );
      };

      const sendHeartbeat = () => {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
      };

      const onAbort = () => {
        close();
      };

      request.signal.addEventListener("abort", onAbort);

      void (async () => {
        try {
          while (!closed) {
            const [snapshot, drafts, sourceRows] = await Promise.all([
              getQuestionImportBatchSnapshot(batchId),
              listQuestionImportDraftsAfter(batchId, lastDraftSortOrder),
              listQuestionImportSourceRowsAfter(batchId, lastSourceRowNumber),
            ]);

            const progressPayload = JSON.stringify(snapshot);
            if (progressPayload !== lastProgressPayload) {
              send("progress", snapshot);
              lastProgressPayload = progressPayload;
            }

            if (drafts.length > 0) {
              lastDraftSortOrder = drafts[drafts.length - 1]?.sortOrder ?? lastDraftSortOrder;
              send("drafts_appended", drafts);
            }

            if (sourceRows.length > 0) {
              lastSourceRowNumber =
                sourceRows[sourceRows.length - 1]?.rowNumber ?? lastSourceRowNumber;
              send("source_rows_appended", sourceRows);
            }

            if (
              snapshot.status === "READY" ||
              snapshot.status === "CONFIRMED" ||
              snapshot.status === "FAILED"
            ) {
              send(snapshot.status === "FAILED" ? "failed" : "completed", snapshot);
              close();
              break;
            }

            if (Date.now() - lastHeartbeatAt >= 15_000) {
              sendHeartbeat();
              lastHeartbeatAt = Date.now();
            }

            await delay(1000);
          }
        } catch (error) {
          send("failed", {
            message: error instanceof Error ? error.message : "导题事件流中断",
          });
          close();
        } finally {
          request.signal.removeEventListener("abort", onAbort);
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Request-Id": requestId,
    },
  });
}
