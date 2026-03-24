"use client";

import { Button, Modal, Pagination, Tabs } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  QuestionImportBatchDetail,
  QuestionImportDraftItem,
  QuestionImportSourceRowItem,
} from "@/shared/types/domain";
import { withAppBasePath } from "@/shared/utils/app-path";
import { getQuestionTypeLabel } from "@/shared/utils/answers";
import {
  formatDateTime,
  getBatchStatusLabel,
  getImportSourceStatusLabel,
  getImportTemplateTypeLabel,
  joinOptions,
  truncateText,
} from "@/shared/utils/format";

const draftPageSizeOptions = [10, 20, 50, 100];
const sourceRowPageSizeOptions = [10, 20, 50, 100];

function getSafePage(total: number, pageSize: number, page: number) {
  return Math.min(Math.max(page, 1), Math.max(1, Math.ceil(total / pageSize)));
}

function getBatchProgressPercent(batch: QuestionImportBatchDetail) {
  if (batch.totalSourceRows > 0) {
    return Math.min(
      100,
      Math.round((batch.processedSourceRows / batch.totalSourceRows) * 100),
    );
  }

  if (
    batch.status === "READY" ||
    batch.status === "CONFIRMED" ||
    batch.status === "CANCELLED"
  ) {
    return 100;
  }

  return 0;
}

function getBatchProgressText(batch: QuestionImportBatchDetail) {
  const rowProgress =
    batch.totalSourceRows > 0
      ? `${batch.processedSourceRows}/${batch.totalSourceRows} 行`
      : batch.status === "READY" || batch.status === "CONFIRMED"
        ? "来源行已处理完成"
        : batch.status === "CANCELLED"
          ? "来源行处理已终止"
          : batch.status === "FAILED"
            ? "来源行处理失败"
            : "等待生成来源行";
  const chunkProgress =
    batch.totalChunks > 0
      ? `${batch.processedChunks}/${batch.totalChunks} 个分块`
      : batch.status === "READY" || batch.status === "CONFIRMED"
        ? "分块处理完成"
        : batch.status === "CANCELLED"
          ? "分块处理已终止"
          : batch.status === "FAILED"
            ? "分块处理失败"
            : "等待生成分块";
  const concurrencyText =
    batch.currentConcurrency > 0
      ? `当前并发 ${batch.currentConcurrency}`
      : null;

  return [rowProgress, chunkProgress, concurrencyText]
    .filter(Boolean)
    .join(" / ");
}

function getBatchProcessingHint(batch: QuestionImportBatchDetail) {
  if (batch.status === "PENDING") {
    return "文件已进入处理队列，系统正在准备解析。";
  }

  if (batch.status === "PROCESSING") {
    return "系统正在解析 Excel、拆分题目并刷新来源行状态，请稍候。";
  }

  if (batch.status === "READY") {
    return "解析已经完成，请检查草稿并决定确认导入或终止本批次。";
  }

  if (batch.status === "CANCELLED") {
    return "当前批次已终止，已生成的草稿和来源行已作废，不会继续导入题库。";
  }

  if (batch.status === "FAILED") {
    return "当前批次解析失败，请根据错误信息修正文件后重新上传。";
  }

  if (batch.status === "CONFIRMED") {
    return "当前批次已经确认导入，草稿结果仅保留用于追溯。";
  }

  return "";
}

function getBatchStatusTone(status: QuestionImportBatchDetail["status"]) {
  switch (status) {
    case "READY":
    case "CONFIRMED":
      return "is-active";
    default:
      return "is-inactive";
  }
}

function isBatchCancelable(status: QuestionImportBatchDetail["status"]) {
  return ["PENDING", "PROCESSING", "READY"].includes(status);
}

function isTerminalBatchStatus(status: QuestionImportBatchDetail["status"]) {
  return ["READY", "CONFIRMED", "FAILED", "CANCELLED"].includes(status);
}

function appendUniqueById<T extends { id: string }>(current: T[], incoming: T[]) {
  if (incoming.length === 0) {
    return current;
  }

  const existingIds = new Set(current.map((item) => item.id));
  const appended = incoming.filter((item) => !existingIds.has(item.id));
  if (appended.length === 0) {
    return current;
  }

  return [...current, ...appended];
}

interface RefreshBatchOptions {
  resetPagination?: boolean;
  draftPage?: number;
  draftPageSize?: number;
  draftKeyword?: string;
  sourceRowPage?: number;
  sourceRowPageSize?: number;
}

export function QuestionImportModal({
  bankId,
  open,
  initialBatchId,
  onClose,
  onSuccess,
  onBatchChange,
}: {
  bankId: string;
  open: boolean;
  initialBatchId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
  onBatchChange?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [batch, setBatch] = useState<QuestionImportBatchDetail | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isRefreshingBatch, setIsRefreshingBatch] = useState(false);
  const [draftPage, setDraftPage] = useState(1);
  const [draftPageSize, setDraftPageSize] = useState(10);
  const [draftKeywordInput, setDraftKeywordInput] = useState("");
  const [draftKeyword, setDraftKeyword] = useState("");
  const [sourceRowPage, setSourceRowPage] = useState(1);
  const [sourceRowPageSize, setSourceRowPageSize] = useState(10);
  const draftPageRef = useRef(draftPage);
  const draftPageSizeRef = useRef(draftPageSize);
  const draftKeywordRef = useRef(draftKeyword);
  const sourceRowPageRef = useRef(sourceRowPage);
  const sourceRowPageSizeRef = useRef(sourceRowPageSize);
  const batchId = batch?.id ?? null;
  const batchStatus = batch?.status ?? null;
  const lastDraftSortOrder = batch?.drafts.at(-1)?.sortOrder ?? 0;
  const lastSourceRowNumber = batch?.sourceRows.at(-1)?.rowNumber ?? 0;

  useEffect(() => {
    draftPageRef.current = draftPage;
  }, [draftPage]);

  useEffect(() => {
    draftPageSizeRef.current = draftPageSize;
  }, [draftPageSize]);

  useEffect(() => {
    draftKeywordRef.current = draftKeyword;
  }, [draftKeyword]);

  useEffect(() => {
    sourceRowPageRef.current = sourceRowPage;
  }, [sourceRowPage]);

  useEffect(() => {
    sourceRowPageSizeRef.current = sourceRowPageSize;
  }, [sourceRowPageSize]);

  const closeBatchEventStream = useCallback(() => {
    if (!eventSourceRef.current) {
      return;
    }

    eventSourceRef.current.close();
    eventSourceRef.current = null;
  }, []);

  const refreshBatch = useCallback(
    async (currentBatchId: string, options?: RefreshBatchOptions) => {
      const nextDraftPageSize =
        options?.draftPageSize ?? draftPageSizeRef.current;
      const nextSourceRowPageSize =
        options?.sourceRowPageSize ?? sourceRowPageSizeRef.current;
      const nextDraftPage = options?.resetPagination
        ? 1
        : (options?.draftPage ?? draftPageRef.current);
      const nextSourceRowPage = options?.resetPagination
        ? 1
        : (options?.sourceRowPage ?? sourceRowPageRef.current);
      const nextDraftKeyword =
        options?.draftKeyword ?? draftKeywordRef.current;

      setIsRefreshingBatch(true);

      try {
        const searchParams = new URLSearchParams({
          draftPage: String(nextDraftPage),
          draftPageSize: String(nextDraftPageSize),
          draftKeyword: nextDraftKeyword,
          sourceRowPage: String(nextSourceRowPage),
          sourceRowPageSize: String(nextSourceRowPageSize),
        });
        const response = await fetch(
          withAppBasePath(
            `/api/admin/questions/import/${currentBatchId}?${searchParams.toString()}`,
          ),
        );
        const payload = (await response
          .json()
          .catch(() => ({}))) as QuestionImportBatchDetail & {
          message?: string;
        };

        if (!response.ok) {
          setErrorMessage(payload.message ?? "获取导题批次详情失败");
          return;
        }

        setBatch(payload);
        setErrorMessage("");
        setSelectedDraftIds((current) =>
          current.filter((draftId) =>
            payload.drafts.some((draft) => draft.id === draftId),
          ),
        );
        setDraftPage(
          getSafePage(payload.draftTotal, nextDraftPageSize, nextDraftPage),
        );
        setDraftPageSize(nextDraftPageSize);
        setDraftKeyword(nextDraftKeyword);
        setDraftKeywordInput(nextDraftKeyword);
        setSourceRowPage(
          getSafePage(
            payload.sourceRowTotal,
            nextSourceRowPageSize,
            nextSourceRowPage,
          ),
        );
        setSourceRowPageSize(nextSourceRowPageSize);
      } catch {
        setErrorMessage("获取导题批次详情失败");
      } finally {
        setIsRefreshingBatch(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) {
      setBatch(null);
      setSelectedDraftIds([]);
      setErrorMessage("");
      setSuccessMessage("");
      setDraftPage(1);
      setDraftPageSize(10);
      setDraftKeyword("");
      setDraftKeywordInput("");
      setSourceRowPage(1);
      setSourceRowPageSize(10);
      closeBatchEventStream();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (!initialBatchId) {
      setBatch(null);
      setSelectedDraftIds([]);
      setErrorMessage("");
      setSuccessMessage("");
      setDraftPage(1);
      setDraftPageSize(10);
      setDraftKeyword("");
      setDraftKeywordInput("");
      setSourceRowPage(1);
      setSourceRowPageSize(10);
      closeBatchEventStream();
      return;
    }

    void refreshBatch(initialBatchId, {
      resetPagination: true,
      draftKeyword: "",
    });
  }, [closeBatchEventStream, initialBatchId, open, refreshBatch]);

  useEffect(() => {
    if (
      !open ||
      !batchId ||
      !batchStatus ||
      !["PENDING", "PROCESSING"].includes(batchStatus)
    ) {
      closeBatchEventStream();
      return;
    }

    closeBatchEventStream();
    const searchParams = new URLSearchParams({
      lastDraftSortOrder: String(lastDraftSortOrder),
      lastSourceRowNumber: String(lastSourceRowNumber),
    });
    const eventSource = new EventSource(
      withAppBasePath(
        `/api/admin/questions/import/${batchId}/events?${searchParams.toString()}`,
      ),
    );
    eventSourceRef.current = eventSource;

    const replaceSummary = (payload: Partial<QuestionImportBatchDetail>) => {
      setBatch((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          ...payload,
          drafts: current.drafts,
          sourceRows: current.sourceRows,
          draftTotal: payload.draftCount ?? current.draftTotal,
          sourceRowTotal: current.sourceRowTotal,
        };
      });
    };

    eventSource.addEventListener("progress", (event) => {
      const payload = JSON.parse(
        (event as MessageEvent).data,
      ) as Partial<QuestionImportBatchDetail>;
      replaceSummary(payload);
    });

    eventSource.addEventListener("drafts_appended", (event) => {
      const payload = JSON.parse(
        (event as MessageEvent).data,
      ) as QuestionImportDraftItem[];
      setBatch((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          drafts: appendUniqueById(current.drafts, payload),
          draftTotal: Math.max(current.draftTotal, current.drafts.length + payload.length),
        };
      });
    });

    eventSource.addEventListener("source_rows_appended", (event) => {
      const payload = JSON.parse(
        (event as MessageEvent).data,
      ) as QuestionImportSourceRowItem[];
      setBatch((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          sourceRows: appendUniqueById(current.sourceRows, payload),
          sourceRowTotal: Math.max(
            current.sourceRowTotal,
            current.sourceRows.length + payload.length,
          ),
        };
      });
    });

    eventSource.addEventListener("completed", (event) => {
      const payload = JSON.parse(
        (event as MessageEvent).data,
      ) as Partial<QuestionImportBatchDetail>;
      replaceSummary(payload);
      closeBatchEventStream();
      void refreshBatch(batchId);
    });

    eventSource.addEventListener("failed", (event) => {
      const payload = JSON.parse(
        (event as MessageEvent).data,
      ) as Partial<QuestionImportBatchDetail> & { message?: string };
      replaceSummary(payload);
      if (payload.message) {
        setErrorMessage(payload.message);
      }
      closeBatchEventStream();
      void refreshBatch(batchId);
    });

    eventSource.addEventListener("cancelled", (event) => {
      const payload = JSON.parse(
        (event as MessageEvent).data,
      ) as Partial<QuestionImportBatchDetail>;
      replaceSummary(payload);
      setSuccessMessage("导题批次已终止");
      closeBatchEventStream();
      void refreshBatch(batchId);
    });

    eventSource.onerror = () => {
      if (!eventSourceRef.current) {
        return;
      }

      setErrorMessage((current) =>
        current || "导题进度连接已中断，可手动刷新当前批次后继续查看。",
      );
    };

    return () => {
      closeBatchEventStream();
    };
  }, [
    batchId,
    batchStatus,
    closeBatchEventStream,
    lastDraftSortOrder,
    lastSourceRowNumber,
    open,
    refreshBatch,
  ]);

  const allDraftIds = useMemo(
    () => batch?.drafts.map((draft) => draft.id) ?? [],
    [batch],
  );
  const isAllSelected =
    allDraftIds.length > 0 &&
    allDraftIds.every((draftId) => selectedDraftIds.includes(draftId));
  const isStreamingBatch =
    !!batch && ["PENDING", "PROCESSING"].includes(batch.status);
  const canShowResultTabs =
    !!batch &&
    (isTerminalBatchStatus(batch.status) ||
      batch.draftTotal > 0 ||
      batch.sourceRowTotal > 0);
  const canManageDrafts = batch?.status === "READY";
  const progressPercent = batch ? getBatchProgressPercent(batch) : 0;
  const pagedDrafts = isStreamingBatch
    ? batch?.drafts.slice(
        (draftPage - 1) * draftPageSize,
        draftPage * draftPageSize,
      )
    : batch?.drafts;
  const pagedSourceRows = isStreamingBatch
    ? batch?.sourceRows.slice(
        (sourceRowPage - 1) * sourceRowPageSize,
        sourceRowPage * sourceRowPageSize,
      )
    : batch?.sourceRows;

  async function handleDraftPaginationChange(page: number, pageSize: number) {
    setDraftPage(page);
    setDraftPageSize(pageSize);

    if (!batch || isStreamingBatch) {
      return;
    }

    await refreshBatch(batch.id, { draftPage: page, draftPageSize: pageSize });
  }

  async function handleSourceRowPaginationChange(
    page: number,
    pageSize: number,
  ) {
    setSourceRowPage(page);
    setSourceRowPageSize(pageSize);

    if (!batch || isStreamingBatch) {
      return;
    }

    await refreshBatch(batch.id, {
      sourceRowPage: page,
      sourceRowPageSize: pageSize,
    });
  }

  async function handleDraftSearchSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!batch || isStreamingBatch) {
      return;
    }

    await refreshBatch(batch.id, {
      draftPage: 1,
      draftKeyword: draftKeywordInput.trim(),
    });
  }

  async function handleDraftSearchReset() {
    setDraftKeywordInput("");

    if (!batch || isStreamingBatch) {
      setDraftKeyword("");
      return;
    }

    await refreshBatch(batch.id, {
      draftPage: 1,
      draftKeyword: "",
    });
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUploading) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setErrorMessage("请选择 Excel 文件");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("bankId", bankId);
      formData.append("file", file);

      const response = await fetch(withAppBasePath("/api/admin/questions/import"), {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        batchId?: string;
        message?: string;
      };

      if (!response.ok || !payload.batchId) {
        setErrorMessage(payload.message ?? "创建导题批次失败");
        return;
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await refreshBatch(payload.batchId, {
        resetPagination: true,
        draftKeyword: "",
      });
      setSuccessMessage("文件已上传，系统正在解析题目。");
      onBatchChange?.();
    } catch {
      setErrorMessage("创建导题批次失败");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCancelBatch() {
    if (!batch || !isBatchCancelable(batch.status)) {
      return;
    }

    if (
      !window.confirm(
        "终止后当前批次会被作废，已生成的草稿不会继续导入，确认终止吗？",
      )
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsMutating(true);

    try {
      const response = await fetch(
        withAppBasePath(`/api/admin/questions/import/${batch.id}/cancel`),
        {
          method: "POST",
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as QuestionImportBatchDetail & {
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.message ?? "终止导题批次失败");
        return;
      }

      closeBatchEventStream();
      setBatch(payload);
      setSelectedDraftIds([]);
      setSuccessMessage("导题批次已终止");
      onBatchChange?.();
    } catch {
      setErrorMessage("终止导题批次失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteDraft(draftId: string) {
    if (!batch) {
      return;
    }

    if (!window.confirm("删除后该草稿将不再导入题库，确认删除吗？")) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsMutating(true);

    try {
      const response = await fetch(
        withAppBasePath(`/api/admin/questions/import/${batch.id}/drafts/${draftId}`),
        {
          method: "DELETE",
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as QuestionImportBatchDetail & {
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.message ?? "删除草稿失败");
        return;
      }

      setBatch(payload);
      setSelectedDraftIds((current) => current.filter((item) => item !== draftId));
      onBatchChange?.();
    } catch {
      setErrorMessage("删除草稿失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteSelected() {
    if (!batch || selectedDraftIds.length === 0) {
      return;
    }

    if (
      !window.confirm(
        `确认删除已选中的 ${selectedDraftIds.length} 条草稿吗？删除后将不会进入正式题库。`,
      )
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsMutating(true);

    try {
      const response = await fetch(
        withAppBasePath(`/api/admin/questions/import/${batch.id}/drafts/delete`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            draftIds: selectedDraftIds,
          }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as QuestionImportBatchDetail & {
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.message ?? "批量删除草稿失败");
        return;
      }

      setBatch(payload);
      setSelectedDraftIds([]);
      onBatchChange?.();
    } catch {
      setErrorMessage("批量删除草稿失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleConfirmImport() {
    if (!batch || batch.draftCount === 0) {
      return;
    }

    if (!window.confirm(`确认将当前保留的 ${batch.draftCount} 道题目导入正式题库吗？`)) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsMutating(true);

    try {
      const response = await fetch(
        withAppBasePath(`/api/admin/questions/import/${batch.id}/confirm`),
        {
          method: "POST",
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as QuestionImportBatchDetail & {
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(payload.message ?? "确认导入失败");
        return;
      }

      setBatch(payload);
      setSelectedDraftIds([]);
      setSuccessMessage(`导入完成，共导入 ${payload.draftCount} 道题目。`);
      onSuccess();
    } catch {
      setErrorMessage("确认导入失败");
    } finally {
      setIsMutating(false);
    }
  }

  function toggleDraftSelection(draftId: string) {
    setSelectedDraftIds((current) =>
      current.includes(draftId)
        ? current.filter((item) => item !== draftId)
        : [...current, draftId],
    );
  }

  function toggleAllDraftSelection() {
    if (isAllSelected) {
      setSelectedDraftIds((current) =>
        current.filter((draftId) => !allDraftIds.includes(draftId)),
      );
      return;
    }

    setSelectedDraftIds((current) => [
      ...current.filter((draftId) => !allDraftIds.includes(draftId)),
      ...allDraftIds,
    ]);
  }

  return (
    <Modal
      className="admin-import-modal"
      open={open}
      title="Excel 导题"
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width="min(1020px, calc(100vw - 24px))"
      styles={{
        body: {
          maxHeight: "74vh",
          overflow: "auto",
          paddingTop: 8,
        },
      }}
    >
      <div className="list-grid admin-import-modal-content">
        <form onSubmit={handleUpload} className="admin-modal-upload">
          <div className="page-note">
            标准模板会按字段规则解析，非标准模板会交给 AI 识别。系统会保留每一行来源记录，便于排查题目草稿与失败原因。
          </div>
          <div className="inline-actions">
            <a href={withAppBasePath("/api/admin/questions/import/template")}>
              下载标准模板
            </a>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={isUploading || isMutating}
            />
            <Button htmlType="submit" type="primary" loading={isUploading}>
              上传并解析
            </Button>
            {batch ? (
              <Button
                onClick={() => void refreshBatch(batch.id)}
                loading={isRefreshingBatch}
                disabled={isUploading || isMutating}
              >
                刷新当前批次
              </Button>
            ) : null}
            {batch && isBatchCancelable(batch.status) ? (
              <Button
                danger
                onClick={() => void handleCancelBatch()}
                loading={isMutating}
                disabled={isUploading}
              >
                终止导入
              </Button>
            ) : null}
          </div>
        </form>

        {errorMessage ? (
          <div className="mobile-feedback is-error">{errorMessage}</div>
        ) : null}
        {successMessage ? (
          <div className="mobile-feedback is-success">{successMessage}</div>
        ) : null}

        {!batch ? (
          <div className="admin-empty-state">
            上传 Excel 后会生成一个独立的导题批次。解析中的批次支持实时查看进度，待确认的批次可以继续删草稿或直接终止。
          </div>
        ) : (
          <>
            <div className="admin-summary-grid is-import-compact">
              <article className="admin-summary-card">
                <span>当前状态</span>
                <strong>{getBatchStatusLabel(batch.status)}</strong>
              </article>
              <article className="admin-summary-card">
                <span>解析方式</span>
                <strong>{getImportTemplateTypeLabel(batch.templateType)}</strong>
              </article>
              <article className="admin-summary-card">
                <span>可用草稿</span>
                <strong>{batch.draftCount} 道</strong>
              </article>
              <article className="admin-summary-card">
                <span>来源行</span>
                <strong>{batch.totalSourceRows} 行</strong>
              </article>
              <article className="admin-summary-card">
                <span>上传时间</span>
                <strong>{formatDateTime(batch.createdAt)}</strong>
              </article>
              <article className="admin-summary-card">
                <span>
                  {batch.status === "CONFIRMED"
                    ? "确认时间"
                    : batch.status === "CANCELLED"
                      ? "终止时间"
                      : "解析完成时间"}
                </span>
                <strong>
                  {formatDateTime(
                    batch.status === "CONFIRMED"
                      ? batch.confirmedAt
                      : batch.status === "CANCELLED"
                        ? batch.cancelledAt
                        : batch.parsedAt,
                  )}
                </strong>
              </article>
            </div>

            <section className="admin-progress-panel">
              <div className="admin-progress-panel-head">
                <div className="admin-page-header-copy is-compact">
                  <h2>{truncateText(batch.fileName, 60)}</h2>
                  <p>{getBatchProcessingHint(batch)}</p>
                </div>
                <span
                  className={`admin-status-pill ${getBatchStatusTone(batch.status)}`}
                >
                  {getBatchStatusLabel(batch.status)}
                </span>
              </div>
              <div className="progress-row">
                <span>{getBatchProgressText(batch)}</span>
                <strong className="admin-progress-percent">{progressPercent}%</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {batch.schemaMode || batch.sourceSheetName ? (
                <div className="page-note">
                  {batch.schemaMode ? `结构识别：${batch.schemaMode}` : null}
                  {batch.schemaMode && batch.sourceSheetName ? " / " : null}
                  {batch.sourceSheetName
                    ? `工作表：${batch.sourceSheetName}`
                    : null}
                </div>
              ) : null}
              {batch.lastError ? (
                <div className="mobile-feedback is-error">{batch.lastError}</div>
              ) : null}
            </section>

            {batch.status === "READY" ? (
              <div className="inline-actions">
                <Button
                  type="primary"
                  onClick={() => void handleConfirmImport()}
                  loading={isMutating}
                  disabled={batch.draftCount === 0 || isUploading}
                >
                  确认导入 {batch.draftCount} 道题目
                </Button>
                <Button
                  onClick={() => void handleDeleteSelected()}
                  disabled={
                    selectedDraftIds.length === 0 || isMutating || isUploading
                  }
                >
                  删除已选草稿
                </Button>
                <Button
                  danger
                  onClick={() => void handleCancelBatch()}
                  loading={isMutating}
                  disabled={isUploading}
                >
                  终止当前批次
                </Button>
              </div>
            ) : null}

            {canShowResultTabs ? (
              <Tabs
                className="admin-modal-tabs is-compact"
                destroyOnHidden
                items={[
                  {
                    key: "drafts",
                    label: `题目草稿 (${batch.draftTotal})`,
                    children: (
                      <div className="list-grid">
                        <form
                          className="admin-import-search-form"
                          onSubmit={handleDraftSearchSubmit}
                        >
                          <input
                            className="admin-import-search-input"
                            value={draftKeywordInput}
                            onChange={(event) =>
                              setDraftKeywordInput(event.target.value)
                            }
                            placeholder="搜索题干、法条来源或原始内容"
                            disabled={isStreamingBatch}
                          />
                          <Button
                            htmlType="submit"
                            disabled={isStreamingBatch || isMutating}
                          >
                            搜索草稿
                          </Button>
                          <Button
                            onClick={() => void handleDraftSearchReset()}
                            disabled={isStreamingBatch || isMutating}
                          >
                            重置
                          </Button>
                          {draftKeyword ? (
                            <span className="page-note">
                              当前关键词：{draftKeyword}
                            </span>
                          ) : null}
                        </form>

                        {canManageDrafts && batch.drafts.length > 0 ? (
                          <div className="inline-actions">
                            <Button
                              onClick={toggleAllDraftSelection}
                              disabled={isMutating}
                            >
                              {isAllSelected ? "取消全选" : "全选当前页"}
                            </Button>
                            <span className="page-note">
                              已选 {selectedDraftIds.length} 条草稿
                            </span>
                          </div>
                        ) : null}

                        {pagedDrafts && pagedDrafts.length > 0 ? (
                          <>
                            <div className="admin-table-wrap">
                              <table className="admin-table is-import-detail-table">
                                <thead>
                                  <tr>
                                    {canManageDrafts ? (
                                      <th style={{ width: 56 }}>选择</th>
                                    ) : null}
                                    <th style={{ width: 88 }}>序号</th>
                                    <th style={{ width: 96 }}>题型</th>
                                    <th style={{ width: "28%" }}>题干</th>
                                    <th style={{ width: "24%" }}>选项</th>
                                    <th style={{ width: 140 }}>正确答案</th>
                                    <th style={{ width: 160 }}>来源行</th>
                                    <th style={{ width: "22%" }}>原始内容</th>
                                    {canManageDrafts ? (
                                      <th style={{ width: 120 }}>操作</th>
                                    ) : null}
                                  </tr>
                                </thead>
                                <tbody>
                                  {pagedDrafts.map((draft) => (
                                    <tr key={draft.id}>
                                      {canManageDrafts ? (
                                        <td>
                                          <input
                                            type="checkbox"
                                            checked={selectedDraftIds.includes(draft.id)}
                                            onChange={() => toggleDraftSelection(draft.id)}
                                            disabled={isMutating}
                                          />
                                        </td>
                                      ) : null}
                                      <td>{draft.sortOrder}</td>
                                      <td>{getQuestionTypeLabel(draft.type)}</td>
                                      <td title={draft.stem}>
                                        {truncateText(draft.stem, 120)}
                                      </td>
                                      <td title={joinOptions(draft.options)}>
                                        {truncateText(joinOptions(draft.options), 120)}
                                      </td>
                                      <td>{draft.correctAnswers.join(", ") || "-"}</td>
                                      <td>
                                        {draft.sourceRowNumbers.length > 0
                                          ? draft.sourceRowNumbers.join(", ")
                                          : "-"}
                                      </td>
                                      <td title={draft.sourceContent || "-"}>
                                        {truncateText(draft.sourceContent, 100)}
                                      </td>
                                      {canManageDrafts ? (
                                        <td>
                                          <button
                                            type="button"
                                            className="admin-table-inline-button is-danger"
                                            onClick={() => void handleDeleteDraft(draft.id)}
                                            disabled={isMutating}
                                          >
                                            删除草稿
                                          </button>
                                        </td>
                                      ) : null}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <Pagination
                              current={draftPage}
                              pageSize={draftPageSize}
                              total={batch.draftTotal}
                              pageSizeOptions={draftPageSizeOptions.map(String)}
                              showSizeChanger
                              showTotal={(total) => `共 ${total} 条草稿`}
                              onChange={(page, pageSize) =>
                                void handleDraftPaginationChange(page, pageSize)
                              }
                            />
                          </>
                        ) : (
                          <div className="admin-empty-state">
                            {isStreamingBatch
                              ? "当前还没有生成可展示的题目草稿，请继续等待解析。"
                              : "当前批次没有可展示的题目草稿。"}
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "sourceRows",
                    label: `来源行 (${batch.sourceRowTotal})`,
                    children: (
                      <div className="list-grid">
                        {pagedSourceRows && pagedSourceRows.length > 0 ? (
                          <>
                            <div className="admin-table-wrap">
                              <table className="admin-table is-import-detail-table">
                                <thead>
                                  <tr>
                                    <th style={{ width: 88 }}>行号</th>
                                    <th style={{ width: 108 }}>状态</th>
                                    <th style={{ width: 160 }}>匹配题号</th>
                                    <th style={{ width: 180 }}>失败原因</th>
                                    <th style={{ width: "48%" }}>原始内容</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pagedSourceRows.map((row) => (
                                    <tr key={row.id}>
                                      <td>{row.rowNumber}</td>
                                      <td>{getImportSourceStatusLabel(row.status)}</td>
                                      <td>
                                        {row.matchedSortOrders.length > 0
                                          ? row.matchedSortOrders.join(", ")
                                          : "-"}
                                      </td>
                                      <td title={row.reason || "-"}>
                                        {truncateText(row.reason, 80)}
                                      </td>
                                      <td title={row.content}>
                                        {truncateText(row.content, 180)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <Pagination
                              current={sourceRowPage}
                              pageSize={sourceRowPageSize}
                              total={batch.sourceRowTotal}
                              pageSizeOptions={sourceRowPageSizeOptions.map(String)}
                              showSizeChanger
                              showTotal={(total) => `共 ${total} 行来源记录`}
                              onChange={(page, pageSize) =>
                                void handleSourceRowPaginationChange(page, pageSize)
                              }
                            />
                          </>
                        ) : (
                          <div className="admin-empty-state">
                            {isStreamingBatch
                              ? "来源行正在生成中，稍后会自动展示。"
                              : "当前批次没有来源行记录。"}
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
