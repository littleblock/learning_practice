"use client";

import { Button, Modal, Pagination, Tabs } from "antd";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

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

const draftPageSizeOptions = [10, 20, 50];
const sourceRowPageSizeOptions = [10, 20, 50];

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
  const [draftPage, setDraftPage] = useState(1);
  const [draftPageSize, setDraftPageSize] = useState(10);
  const [sourceRowPage, setSourceRowPage] = useState(1);
  const [sourceRowPageSize, setSourceRowPageSize] = useState(10);

  const refreshBatch = useCallback(async (batchId: string) => {
    try {
      const response = await fetch(`/api/admin/questions/import/${batchId}`);
      const payload = (await response.json()) as QuestionImportBatchDetail & {
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
      setDraftPage(1);
      setSourceRowPage(1);
    } catch (error) {
      console.error("获取导题批次详情失败", error);
      setErrorMessage("获取导题批次详情失败");
    }
  }, []);

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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (initialBatchId) {
      void refreshBatch(initialBatchId);
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

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      const payload = (await response.json()) as {
        batchId?: string;
        message?: string;
      };

      if (!response.ok || !payload.batchId) {
        setErrorMessage(payload.message ?? "创建导题批次失败");
        return;
      }

      onBatchChange?.();
      await refreshBatch(payload.batchId);
      setSuccessMessage("文件已上传，系统正在解析题目。");
    } catch (error) {
      console.error("创建导题批次失败", error);
      setErrorMessage("创建导题批次失败");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteDraft(draftId: string) {
    if (!batch) {
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
      const payload = (await response.json()) as QuestionImportBatchDetail & {
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
    } catch (error) {
      console.error("删除草稿失败", error);
      setErrorMessage("删除草稿失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteSelected() {
    if (!batch || selectedDraftIds.length === 0) {
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

      const payload = (await response.json()) as QuestionImportBatchDetail & {
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
    } catch (error) {
      console.error("批量删除草稿失败", error);
      setErrorMessage("批量删除草稿失败");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleConfirmImport() {
    if (!batch) {
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

      const payload = (await response.json()) as QuestionImportBatchDetail & {
        message?: string;
      };
      if (!response.ok) {
        setErrorMessage(payload.message ?? "确认导入失败");
        return;
      }

      setBatch(payload);
      setSelectedDraftIds([]);
      setSuccessMessage(`导入完成，共纳入 ${payload.draftCount} 道题目。`);
      onBatchChange?.();
      onSuccess();
    } catch (error) {
      console.error("确认导入失败", error);
      setErrorMessage("确认导入失败");
    } finally {
      setIsMutating(false);
    }
  }

  const allDraftIds = batch?.drafts.map((draft) => draft.id) ?? [];
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

  return (
    <Modal
      open={open}
      title="Excel 导题"
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width="min(1040px, calc(100vw - 48px))"
      styles={{
        body: {
          maxHeight: "72vh",
          overflow: "auto",
          paddingTop: 12,
        },
      }}
    >
      <div className="list-grid">
        <form onSubmit={handleUpload} className="list-grid">
          <div className="page-note">
            只有符合标准模板的文件才按规则解析，其他文件一律交给 AI 识别。每一行都会记录是否能形成题目。
          </div>
          <div className="inline-actions">
            <Link href="/api/admin/questions/import/template">下载标准模板</Link>
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
                disabled={isUploading || isMutating}
              >
                刷新当前批次
              </Button>
            ) : null}
          </div>
        </form>

        {batch ? (
          <section className="admin-empty-state">
            <div>文件名：{batch.fileName}</div>
            <div>解析方式：{getImportTemplateTypeLabel(batch.templateType)}</div>
            <div>状态：{getBatchStatusLabel(batch.status)}</div>
            <div>草稿数量：{batch.draftCount}</div>
            <div>来源行数：{batch.sourceRows.length}</div>
            <div>工作表：{batch.sourceSheetName || "-"}</div>
            <div>上传时间：{formatDateTime(batch.createdAt)}</div>
            <div>解析时间：{formatDateTime(batch.parsedAt)}</div>
            <div>确认时间：{formatDateTime(batch.confirmedAt)}</div>
          </section>
        ) : (
          <section className="admin-empty-state">
            上传 Excel 后，解析结果会显示在这里。你可以删除不合理草稿，也可以查看失败行原因。
          </section>
        )}

        {batch && ["PENDING", "PROCESSING"].includes(batch.status) ? (
          <div className="admin-empty-state">
            系统正在解析 Excel 并拆分题目，请稍后刷新当前批次查看结果。
          </div>
        ) : null}

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
                            setSelectedDraftIds(() => (isAllSelected ? [] : allDraftIds))
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
                          onClick={() => void handleConfirmImport()}
                        >
                          确认导入 {batch?.draftCount ?? 0} 道题
                        </Button>
                      </div>
                    ) : batch?.status === "CONFIRMED" ? (
                      <div className="page-note">当前批次已完成导入，以下结果为只读展示。</div>
                    ) : (
                      <div className="page-note">当前批次没有可确认题目时，会在“来源行判定”中展示失败原因。</div>
                    )}

                    {batch?.drafts.length ? (
                      <>
                        <div className="admin-table-wrap">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th style={{ width: 54 }}>选择</th>
                                <th>序号</th>
                                <th>题型</th>
                                <th>题干</th>
                                <th>选项</th>
                                <th>正确答案</th>
                                <th>解析</th>
                                <th>答案来源</th>
                                <th>来源行号</th>
                                <th>操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pagedDrafts?.map((draft) => (
                                <tr key={draft.id}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={selectedDraftIds.includes(draft.id)}
                                      disabled={batch.status !== "READY"}
                                      onChange={(event) =>
                                        setSelectedDraftIds((current) =>
                                          event.target.checked
                                            ? [...current, draft.id]
                                            : current.filter((item) => item !== draft.id),
                                        )
                                      }
                                    />
                                  </td>
                                  <td>{draft.sortOrder}</td>
                                  <td>{getQuestionTypeLabel(draft.type)}</td>
                                  <td title={draft.stem}>{truncateText(draft.stem, 80)}</td>
                                  <td title={joinOptions(draft.options)}>
                                    {truncateText(joinOptions(draft.options), 120)}
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
                                    {batch?.status === "READY" ? (
                                      <Button
                                        danger
                                        size="small"
                                        disabled={isMutating}
                                        onClick={() => void handleDeleteDraft(draft.id)}
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
                      <div className="admin-empty-state">当前批次没有可确认的题目草稿。</div>
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
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>行号</th>
                            <th>状态</th>
                            <th>命中题号</th>
                            <th>原始内容</th>
                            <th>原因说明</th>
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
                              <td title={row.content}>{truncateText(row.content, 120)}</td>
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
                  <div className="admin-empty-state">当前批次还没有来源行记录。</div>
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
