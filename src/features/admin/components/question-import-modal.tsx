"use client";

import { Button, Modal, Pagination, Tabs } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { QuestionImportBatchDetail } from "@/shared/types/domain";
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

  if (batch.status === "READY" || batch.status === "CONFIRMED") {
    return 100;
  }

  return 0;
}

function getBatchProgressText(batch: QuestionImportBatchDetail) {
  const rowProgress =
    batch.totalSourceRows > 0
      ? `${batch.processedSourceRows}/${batch.totalSourceRows} 行`
      : batch.status === "READY" || batch.status === "CONFIRMED"
        ? "已完成"
        : batch.status === "FAILED"
          ? "已失败"
          : "等待生成来源行";
  const chunkProgress =
    batch.totalChunks > 0
      ? `${batch.processedChunks}/${batch.totalChunks} 块`
      : batch.status === "READY" || batch.status === "CONFIRMED"
        ? "分块完成"
        : batch.status === "FAILED"
          ? "分块中断"
          : "等待分块";
  const concurrencyText =
    batch.currentConcurrency > 0
      ? `当前并发 ${batch.currentConcurrency}`
      : null;

  return [rowProgress, chunkProgress, concurrencyText]
    .filter(Boolean)
    .join(" · ");
}

function getBatchProcessingHint(batch: QuestionImportBatchDetail) {
  if (batch.status === "PENDING") {
    return "文件已进入处理队列，系统正在准备解析。";
  }

  if (batch.status === "PROCESSING") {
    return "系统正在解析 Excel、拆分题目并更新来源行判定，请稍候。";
  }

  return "";
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

  const refreshBatch = useCallback(
    async (
      batchId: string,
      options?: {
        resetPagination?: boolean;
        draftPage?: number;
        draftPageSize?: number;
        draftKeyword?: string;
        sourceRowPage?: number;
        sourceRowPageSize?: number;
      },
    ) => {
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
            `/api/admin/questions/import/${batchId}?${searchParams.toString()}`,
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

        const safeDraftPage = getSafePage(
          payload.draftTotal,
          nextDraftPageSize,
          nextDraftPage,
        );
        const safeSourceRowPage = getSafePage(
          payload.sourceRowTotal,
          nextSourceRowPageSize,
          nextSourceRowPage,
        );

        setBatch(payload);
        setErrorMessage("");
        setSelectedDraftIds((current) =>
          current.filter((draftId) =>
            payload.drafts.some((draft) => draft.id === draftId),
          ),
        );
        setDraftPage(safeDraftPage);
        setDraftPageSize(nextDraftPageSize);
        setDraftKeyword(nextDraftKeyword);
        setDraftKeywordInput(nextDraftKeyword);
        setSourceRowPage(safeSourceRowPage);
        setSourceRowPageSize(nextSourceRowPageSize);
      } catch {
        setErrorMessage("获取导题批次详情失败");
      } finally {
        setIsRefreshingBatch(false);
      }
    },
    [],
  );

  const closeBatchEventStream = useCallback(() => {
    if (!eventSourceRef.current) {
      return;
    }

    eventSourceRef.current.close();
    eventSourceRef.current = null;
  }, []);

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
      setIsRefreshingBatch(false);
      closeBatchEventStream();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (initialBatchId) {
      void refreshBatch(initialBatchId, {
        resetPagination: true,
        draftKeyword: "",
      });
    }
  }, [closeBatchEventStream, initialBatchId, open, refreshBatch]);

  useEffect(() => {
    if (
      !open ||
      !batchId ||
      !["PENDING", "PROCESSING"].includes(batchStatus ?? "")
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

    const mergeDrafts = (items: QuestionImportBatchDetail["drafts"]) => {
      setBatch((current) => {
        if (!current) {
          return current;
        }

        const seen = new Set(current.drafts.map((draft) => draft.id));
        const nextDrafts = [...current.drafts];
        for (const item of items) {
          if (!seen.has(item.id)) {
            nextDrafts.push(item);
            seen.add(item.id);
          }
        }

        nextDrafts.sort((left, right) => left.sortOrder - right.sortOrder);
        const nextDraftTotal = Math.max(current.draftTotal, nextDrafts.length);
        setDraftPage((page) =>
          Math.max(page, Math.ceil(nextDraftTotal / draftPageSize)),
        );
        return {
          ...current,
          draftTotal: nextDraftTotal,
          drafts: nextDrafts,
        };
      });
    };

    const mergeSourceRows = (items: QuestionImportBatchDetail["sourceRows"]) => {
      setBatch((current) => {
        if (!current) {
          return current;
        }

        const seen = new Set(current.sourceRows.map((row) => row.id));
        const nextSourceRows = [...current.sourceRows];
        for (const item of items) {
          if (!seen.has(item.id)) {
            nextSourceRows.push(item);
            seen.add(item.id);
          }
        }

        nextSourceRows.sort((left, right) => left.rowNumber - right.rowNumber);
        const nextSourceRowTotal = Math.max(
          current.sourceRowTotal,
          nextSourceRows.length,
        );
        setSourceRowPage((page) =>
          Math.max(page, Math.ceil(nextSourceRowTotal / sourceRowPageSize)),
        );
        return {
          ...current,
          sourceRowTotal: nextSourceRowTotal,
          sourceRows: nextSourceRows,
        };
      });
    };

    const updateSummary = (payload: Partial<QuestionImportBatchDetail>) => {
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
      const payload = JSON.parse((event as MessageEvent).data) as Partial<QuestionImportBatchDetail>;
      updateSummary(payload);
    });

    eventSource.addEventListener("drafts_appended", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as QuestionImportBatchDetail["drafts"];
      mergeDrafts(payload);
    });

    eventSource.addEventListener("source_rows_appended", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as QuestionImportBatchDetail["sourceRows"];
      mergeSourceRows(payload);
    });

    eventSource.addEventListener("completed", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as Partial<QuestionImportBatchDetail>;
      updateSummary(payload);
      closeBatchEventStream();
    });

    eventSource.addEventListener("failed", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as
        | Partial<QuestionImportBatchDetail>
        | { message?: string };
      const message =
        "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "";
      if (!("id" in payload)) {
        if (message) {
          setErrorMessage(message);
        }
      } else {
        updateSummary(payload);
        setErrorMessage("");
      }
      closeBatchEventStream();
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
    draftPageSize,
    lastDraftSortOrder,
    lastSourceRowNumber,
    open,
    sourceRowPageSize,
  ]);

  const allDraftIds = useMemo(
    () => batch?.drafts.map((draft) => draft.id) ?? [],
    [batch],
  );
  const isAllSelected =
    allDraftIds.length > 0 && selectedDraftIds.length === allDraftIds.length;
  const isStreamingBatch =
    !!batch && ["PENDING", "PROCESSING"].includes(batch.status);
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
  const canShowResultTabs =
    !!batch &&
    (["READY", "CONFIRMED", "FAILED"].includes(batch.status) ||
      batch.draftTotal > 0 ||
      batch.sourceRowTotal > 0);
  const progressPercent = batch ? getBatchProgressPercent(batch) : 0;

  async function handleDraftPaginationChange(page: number, pageSize: number) {
    setDraftPage(page);
    setDraftPageSize(pageSize);

    if (!batch || isStreamingBatch) {
      return;
    }

    await refreshBatch(batch.id, {
      draftPage: page,
      draftPageSize: pageSize,
    });
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

    const nextKeyword = draftKeywordInput.trim();
    await refreshBatch(batch.id, {
      draftPage: 1,
      draftKeyword: nextKeyword,
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

      setDraftKeyword("");
      setDraftKeywordInput("");
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

  async function handleDeleteDraft(draftId: string) {
    if (!batch) {
      return;
    }

    if (!window.confirm("删除后该草稿将不会导入题库，确认删除吗？")) {
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

      await refreshBatch(batch.id);
      setSelectedDraftIds((current) =>
        current.filter((item) => item !== draftId),
      );
      setDraftPage(1);
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

      await refreshBatch(batch.id);
      setSelectedDraftIds([]);
      setDraftPage(1);
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

    if (
      !window.confirm(
          `确认将当前保留的 ${batch.draftCount} 道题目导入正式题库吗？`,
      )
    ) {
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

      await refreshBatch(batch.id);
      setSelectedDraftIds([]);
      setSuccessMessage(`导入完成，共纳入 ${payload.draftCount} 道题目。`);
      onSuccess();
    } catch {
      setErrorMessage("确认导入失败");
    } finally {
      setIsMutating(false);
    }
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
            只有符合标准模板的文件才按规则解析，其他文件统一交给 AI
            识别。每一行都会记录是否能形成题目。
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
          </div>
        </form>

        {batch ? (
          <>
            <section className="admin-summary-grid is-import-compact">
              <div className="admin-summary-card">
                <span>文件名</span>
                <strong title={batch.fileName}>
                  {truncateText(batch.fileName, 32)}
                </strong>
              </div>
              <div className="admin-summary-card">
                <span>解析方式</span>
                <strong>
                  {getImportTemplateTypeLabel(batch.templateType)}
                </strong>
              </div>
              <div className="admin-summary-card">
                <span>状态</span>
                <strong>{getBatchStatusLabel(batch.status)}</strong>
              </div>
              <div className="admin-summary-card">
                <span>草稿数量</span>
                <strong>{batch.draftCount}</strong>
              </div>
              <div className="admin-summary-card">
                <span>来源行数</span>
                <strong>
                  {batch.totalSourceRows || batch.sourceRows.length}
                </strong>
              </div>
              <div className="admin-summary-card">
                <span>工作表</span>
                <strong>{batch.sourceSheetName || "-"}</strong>
              </div>
              <div className="admin-summary-card">
                <span>上传时间</span>
                <strong>{formatDateTime(batch.createdAt)}</strong>
              </div>
              <div className="admin-summary-card">
                <span>解析时间</span>
                <strong>{formatDateTime(batch.parsedAt)}</strong>
              </div>
              <div className="admin-summary-card">
                <span>确认时间</span>
                <strong>{formatDateTime(batch.confirmedAt)}</strong>
              </div>
            </section>

            {["PENDING", "PROCESSING"].includes(batch.status) ? (
              <section className="admin-progress-panel">
                <div className="admin-progress-panel-head">
                  <div>
                    <strong>当前处理进度</strong>
                    <p className="page-note" style={{ margin: "6px 0 0" }}>
                      {getBatchProcessingHint(batch)}
                    </p>
                  </div>
                  <span className="admin-progress-percent">
                    {progressPercent}%
                  </span>
                </div>
                <div className="progress-track admin-progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="admin-progress-meta">
                  <span>{getBatchProgressText(batch)}</span>
                  {isRefreshingBatch ? <span>正在刷新批次状态…</span> : null}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section className="admin-empty-state">
            上传 Excel
            后，解析结果会显示在这里。你可以删除不合理草稿，也可以查看失败行原因。
          </section>
        )}

        {canShowResultTabs ? (
          <Tabs
            className="admin-modal-tabs is-compact"
            items={[
              {
                key: "drafts",
                        label: `待确认题目（${batch?.draftCount ?? 0}）`,
                children: (
                  <div className="list-grid">
                    {batch?.status === "READY" ? (
                      <div className="inline-actions">
                        <Button
                          onClick={() =>
                            setSelectedDraftIds(() =>
                              isAllSelected ? [] : allDraftIds,
                            )
                          }
                          disabled={isMutating}
                        >
                          {isAllSelected ? "取消全选" : "全选"}
                        </Button>
                        <Button
                          danger
                          disabled={selectedDraftIds.length === 0 || isMutating}
                          onClick={() => void handleDeleteSelected()}
                        >
                          删除已选
                        </Button>
                          <Button
                            type="primary"
                            loading={isMutating}
                            disabled={batch.draftCount === 0}
                            onClick={() => void handleConfirmImport()}
                          >
                            确认导入 {batch?.draftCount ?? 0} 道题
                        </Button>
                      </div>
                    ) : batch?.status === "CONFIRMED" ? (
                      <div className="page-note">
                        当前批次已完成导入，以下结果为只读展示。
                      </div>
                    ) : (
                      <div className="page-note">
                        当前批次没有可确认题目时，会在“来源行判定”中展示失败原因。
                      </div>
                    )}

                    {batch?.status === "PENDING" ||
                    batch?.status === "PROCESSING" ? (
                      <div className="page-note">
                        已识别完成的题目会实时追加到下方列表，无需等待整批处理结束再查看。
                      </div>
                    ) : null}

                    <form
                      onSubmit={(event) => void handleDraftSearchSubmit(event)}
                      className="admin-import-search-form"
                    >
                      <input
                        className="admin-import-search-input"
                        type="search"
                        placeholder="搜索题干、来源说明或来源行"
                        value={draftKeywordInput}
                        onChange={(event) =>
                          setDraftKeywordInput(event.target.value)
                        }
                        disabled={isStreamingBatch || isRefreshingBatch}
                      />
                      <Button
                        htmlType="submit"
                        size="small"
                        disabled={isStreamingBatch || isRefreshingBatch}
                      >
                        搜索
                      </Button>
                      <Button
                        size="small"
                        onClick={() => void handleDraftSearchReset()}
                        disabled={
                          isStreamingBatch ||
                          isRefreshingBatch ||
                          (!draftKeyword && !draftKeywordInput)
                        }
                      >
                        清空
                      </Button>
                      {draftKeyword ? (
                        <span className="page-note">
                          当前命中 {batch?.draftTotal ?? 0} 条，批次总草稿{" "}
                          {batch?.draftCount ?? 0} 条
                        </span>
                      ) : null}
                    </form>

                    {batch?.draftTotal ? (
                      <>
                        <div className="admin-table-wrap">
                          <table className="admin-table is-import-detail-table">
                            <thead>
                              <tr>
                                <th style={{ width: 54 }}>选择</th>
                                <th style={{ width: 88 }}>序号</th>
                                <th style={{ width: 108 }}>题型</th>
                                <th style={{ width: "24%" }}>题干</th>
                                <th style={{ width: "24%" }}>选项</th>
                                <th style={{ width: 132 }}>正确答案</th>
                                <th style={{ width: "18%" }}>解析</th>
                                <th style={{ width: 180 }}>答案来源</th>
                                <th style={{ width: 140 }}>来源行号</th>
                                <th style={{ width: 120 }}>操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pagedDrafts?.map((draft) => (
                                <tr key={draft.id}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={selectedDraftIds.includes(
                                        draft.id,
                                      )}
                                      disabled={batch.status !== "READY"}
                                      onChange={(event) =>
                                        setSelectedDraftIds((current) =>
                                          event.target.checked
                                            ? [...current, draft.id]
                                            : current.filter(
                                                (item) => item !== draft.id,
                                              ),
                                        )
                                      }
                                    />
                                  </td>
                                  <td>{draft.sortOrder}</td>
                                  <td>{getQuestionTypeLabel(draft.type)}</td>
                                  <td title={draft.stem}>
                                    {truncateText(draft.stem, 80)}
                                  </td>
                                  <td title={joinOptions(draft.options)}>
                                    {truncateText(
                                      joinOptions(draft.options),
                                      120,
                                    )}
                                  </td>
                                  <td>{draft.correctAnswers.join(", ")}</td>
                                  <td title={draft.analysis || "-"}>
                                    {truncateText(draft.analysis, 60)}
                                  </td>
                                  <td title={draft.lawSource || "-"}>
                                    {truncateText(draft.lawSource, 40)}
                                  </td>
                                  <td
                                    title={
                                      draft.sourceLabel ||
                                      draft.sourceRowNumbers.join(", ") ||
                                      "-"
                                    }
                                  >
                                    {draft.sourceLabel ||
                                      draft.sourceRowNumbers.join(", ") ||
                                      "-"}
                                  </td>
                                  <td>
                                    {batch.status === "READY" ? (
                                      <Button
                                        danger
                                        size="small"
                                        disabled={isMutating}
                                        onClick={() =>
                                          void handleDeleteDraft(draft.id)
                                        }
                                      >
                                        删除
                                      </Button>
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <Pagination
                          size="small"
                          current={draftPage}
                          pageSize={draftPageSize}
                          total={batch.draftTotal}
                          pageSizeOptions={draftPageSizeOptions.map(String)}
                          showSizeChanger
                          onChange={(page, pageSize) =>
                            void handleDraftPaginationChange(page, pageSize)
                          }
                        />
                      </>
                    ) : (
                      <div className="admin-empty-state">
                        当前批次没有可确认的题目草稿。
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "rows",
                label: `来源行判定（${batch?.sourceRowTotal ?? 0}）`,
                children: batch?.sourceRowTotal ? (
                  <div className="list-grid">
                    <div className="admin-table-wrap">
                      <table className="admin-table is-import-detail-table">
                        <thead>
                          <tr>
                            <th style={{ width: 88 }}>行号</th>
                            <th style={{ width: 120 }}>状态</th>
                            <th style={{ width: 132 }}>命中题号</th>
                            <th style={{ width: "38%" }}>原始内容</th>
                            <th style={{ width: "30%" }}>原因说明</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedSourceRows?.map((row) => (
                            <tr key={row.id}>
                              <td>{row.rowNumber}</td>
                              <td>{getImportSourceStatusLabel(row.status)}</td>
                              <td>
                                {row.matchedSortOrders.length > 0
                                  ? row.matchedSortOrders.join(", ")
                                  : "-"}
                              </td>
                              <td title={row.content}>
                                {truncateText(row.content, 120)}
                              </td>
                              <td title={row.reason || "-"}>
                                {truncateText(row.reason, 80)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <Pagination
                      size="small"
                      current={sourceRowPage}
                      pageSize={sourceRowPageSize}
                      total={batch.sourceRowTotal}
                      pageSizeOptions={sourceRowPageSizeOptions.map(String)}
                      showSizeChanger
                      onChange={(page, pageSize) =>
                        void handleSourceRowPaginationChange(page, pageSize)
                      }
                    />
                  </div>
                ) : (
                  <div className="admin-empty-state">
                    当前批次还没有来源行记录。
                  </div>
                ),
              },
            ]}
          />
        ) : null}

        {batch?.status === "FAILED" ? (
          <div style={{ color: "var(--danger)" }}>
            {batch.lastError || "导题解析失败，请检查文件内容或模型配置。"}
          </div>
        ) : null}

        {errorMessage ? (
          <div style={{ color: "var(--danger)" }}>{errorMessage}</div>
        ) : null}

        {successMessage ? (
          <div style={{ color: "var(--success)" }}>{successMessage}</div>
        ) : null}
      </div>
    </Modal>
  );
}
