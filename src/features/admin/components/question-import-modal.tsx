"use client";

import { Button, Modal, Pagination, Tabs } from "antd";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { QuestionImportBatchDetail } from "@/shared/types/domain";
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
  const [batch, setBatch] = useState<QuestionImportBatchDetail | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [isRefreshingBatch, setIsRefreshingBatch] = useState(false);
  const [draftPage, setDraftPage] = useState(1);
  const [draftPageSize, setDraftPageSize] = useState(10);
  const [sourceRowPage, setSourceRowPage] = useState(1);
  const [sourceRowPageSize, setSourceRowPageSize] = useState(10);

  const refreshBatch = useCallback(
    async (
      batchId: string,
      options?: {
        resetPagination?: boolean;
      },
    ) => {
      setIsRefreshingBatch(true);

      try {
        const response = await fetch(`/api/admin/questions/import/${batchId}`);
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
        setSelectedDraftIds((current) =>
          current.filter((draftId) =>
            payload.drafts.some((draft) => draft.id === draftId),
          ),
        );

        if (options?.resetPagination) {
          setDraftPage(1);
          setSourceRowPage(1);
        }
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
      setSourceRowPage(1);
      setSourceRowPageSize(10);
      setIsRefreshingBatch(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (initialBatchId) {
      void refreshBatch(initialBatchId, { resetPagination: true });
    }
  }, [initialBatchId, open, refreshBatch]);

  useEffect(() => {
    if (!open || !batch || !["PENDING", "PROCESSING"].includes(batch.status)) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshBatch(batch.id);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [batch, open, refreshBatch]);

  const allDraftIds = useMemo(
    () => batch?.drafts.map((draft) => draft.id) ?? [],
    [batch],
  );
  const isAllSelected =
    allDraftIds.length > 0 && selectedDraftIds.length === allDraftIds.length;
  const pagedDrafts = batch?.drafts.slice(
    (draftPage - 1) * draftPageSize,
    draftPage * draftPageSize,
  );
  const pagedSourceRows = batch?.sourceRows.slice(
    (sourceRowPage - 1) * sourceRowPageSize,
    sourceRowPage * sourceRowPageSize,
  );
  const canShowResultTabs =
    !!batch &&
    (["READY", "CONFIRMED", "FAILED"].includes(batch.status) ||
      batch.drafts.length > 0 ||
      batch.sourceRows.length > 0);
  const progressPercent = batch ? getBatchProgressPercent(batch) : 0;

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

      const response = await fetch("/api/admin/questions/import", {
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

      await refreshBatch(payload.batchId, { resetPagination: true });
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
        `/api/admin/questions/import/${batch.id}/drafts/${draftId}`,
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
        `/api/admin/questions/import/${batch.id}/drafts/delete`,
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
      setDraftPage(1);
      onBatchChange?.();
    } catch {
      setErrorMessage("批量删除草稿失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleConfirmImport() {
    if (!batch || batch.drafts.length === 0) {
      return;
    }

    if (
      !window.confirm(
        `确认将当前保留的 ${batch.drafts.length} 道题目导入正式题库吗？`,
      )
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsMutating(true);

    try {
      const response = await fetch(
        `/api/admin/questions/import/${batch.id}/confirm`,
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
      open={open}
      title="Excel 导题"
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width="min(1160px, calc(100vw - 32px))"
      styles={{
        body: {
          maxHeight: "74vh",
          overflow: "auto",
          paddingTop: 12,
        },
      }}
    >
      <div className="list-grid">
        <form onSubmit={handleUpload} className="admin-modal-upload">
          <div className="page-note">
            只有符合标准模板的文件才按规则解析，其他文件统一交给 AI
            识别。每一行都会记录是否能形成题目。
          </div>
          <div className="inline-actions">
            <Link href="/api/admin/questions/import/template" prefetch={false}>
              下载标准模板
            </Link>
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
            <section className="admin-summary-grid">
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
            className="admin-modal-tabs"
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
                          disabled={batch.drafts.length === 0}
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

                    {batch?.drafts.length ? (
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
                          total={batch.drafts.length}
                          pageSizeOptions={draftPageSizeOptions.map(String)}
                          showSizeChanger
                          onChange={(page, pageSize) => {
                            setDraftPage(page);
                            setDraftPageSize(pageSize);
                          }}
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
                label: `来源行判定（${batch?.sourceRows.length ?? 0}）`,
                children: batch?.sourceRows.length ? (
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
                      total={batch.sourceRows.length}
                      pageSizeOptions={sourceRowPageSizeOptions.map(String)}
                      showSizeChanger
                      onChange={(page, pageSize) => {
                        setSourceRowPage(page);
                        setSourceRowPageSize(pageSize);
                      }}
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
