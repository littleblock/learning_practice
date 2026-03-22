"use client";

import { Button, Tabs } from "antd";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { QuestionFilters } from "@/features/admin/components/admin-filters";
import { AdminPagination } from "@/features/admin/components/admin-pagination";
import type {
  QuestionImportBatchSummary,
  QuestionListItem,
} from "@/shared/types/domain";
import { getQuestionTypeLabel } from "@/shared/utils/answers";
import {
  formatDateTime,
  getBatchStatusLabel,
  getImportTemplateTypeLabel,
  joinOptions,
  truncateText,
} from "@/shared/utils/format";

const QuestionEditorModal = dynamic(() =>
  import("@/features/admin/components/question-editor-modal").then(
    (module) => module.QuestionEditorModal,
  ),
);
const QuestionImportModal = dynamic(() =>
  import("@/features/admin/components/question-import-modal").then(
    (module) => module.QuestionImportModal,
  ),
);

function getBatchActionLabel(status: QuestionImportBatchSummary["status"]) {
  switch (status) {
    case "READY":
      return "处理结果";
    case "PENDING":
    case "PROCESSING":
      return "查看进度";
    case "FAILED":
      return "查看失败";
    case "CONFIRMED":
      return "查看结果";
    default:
      return "查看";
  }
}

function getBatchProgressPercent(batch: QuestionImportBatchSummary) {
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

function getBatchProgressText(batch: QuestionImportBatchSummary) {
  const rowProgress =
    batch.totalSourceRows > 0
      ? `${batch.processedSourceRows}/${batch.totalSourceRows} 行`
      : batch.status === "READY" || batch.status === "CONFIRMED"
        ? "已完成"
        : batch.status === "FAILED"
          ? "已失败"
          : "等待开始";
  const chunkProgress =
    batch.totalChunks > 0
      ? `${batch.processedChunks}/${batch.totalChunks} 块`
      : batch.status === "READY" || batch.status === "CONFIRMED"
        ? "分块完成"
        : batch.status === "FAILED"
          ? "分块中断"
          : "未生成分块";
  const concurrencyText =
    batch.currentConcurrency > 0
      ? `当前并发 ${batch.currentConcurrency}`
      : null;

  return [rowProgress, chunkProgress, concurrencyText]
    .filter(Boolean)
    .join(" · ");
}

export function QuestionManager({
  bankId,
  questions,
  nextSortOrder,
  importBatches,
  importBatchPage,
  importBatchPageSize,
  importBatchTotal,
  questionQuery,
  questionPage,
  questionPageSize,
  questionTotal,
  activeTab,
  keyword,
  type,
  lawSource,
  recordPage,
  recordPageSize,
}: {
  bankId: string;
  questions: QuestionListItem[];
  nextSortOrder: number;
  importBatches: QuestionImportBatchSummary[];
  importBatchPage: number;
  importBatchPageSize: number;
  importBatchTotal: number;
  questionQuery: Record<string, string | undefined>;
  questionPage: number;
  questionPageSize: number;
  questionTotal: number;
  activeTab: "questions" | "imports";
  keyword: string;
  type: string;
  lawSource: string;
  recordPage: string;
  recordPageSize: string;
}) {
  const router = useRouter();
  const [editingQuestion, setEditingQuestion] =
    useState<QuestionListItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isSwitchingTab, startTabTransition] = useTransition();

  function refreshCurrentPage() {
    startRefreshTransition(() => {
      router.refresh();
    });
  }

  async function deleteQuestion(questionId: string) {
    if (!window.confirm("删除题目后将同步刷新匹配结果，确认删除吗？")) {
      return;
    }

    setDeletingId(questionId);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/admin/questions/${questionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        setDeleteError(payload.message ?? "删除题目失败");
        return;
      }

      refreshCurrentPage();
    } catch (error) {
      console.error("删除题目失败", error);
      setDeleteError("删除题目失败");
    } finally {
      setDeletingId(null);
    }
  }

  function openEditor(question: QuestionListItem | null) {
    setEditingQuestion(question);
    setEditorOpen(true);
  }

  function openImport(batchId: string | null = null) {
    setActiveBatchId(batchId);
    setImportOpen(true);
  }

  function buildTabQuery(tab: "questions" | "imports") {
    return {
      ...questionQuery,
      tab,
    };
  }

  function handleTabChange(tab: string) {
    const targetTab = tab === "imports" ? "imports" : "questions";
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(buildTabQuery(targetTab))) {
      if (value) {
        searchParams.set(key, value);
      }
    }

    startTabTransition(() => {
      router.push(
        `/admin/banks/${bankId}/questions?${searchParams.toString()}`,
      );
    });
  }

  return (
    <>
      <section className="admin-panel admin-tabs-panel">
        <Tabs
          className="admin-content-tabs"
          activeKey={activeTab}
          onChange={handleTabChange}
          destroyOnHidden
          items={[
            {
              key: "questions",
              label: `题目列表（${questionTotal}）`,
              children: (
                <div className="admin-tab-content">
                  <div
                    className="admin-section-header"
                    style={{ marginBottom: 16 }}
                  >
                    <div>
                      <h2 style={{ margin: 0, fontSize: 20 }}>题目列表</h2>
                      <p className="page-note" style={{ marginTop: 8 }}>
                        支持分页查看、单题维护和导入后的结果核验。
                      </p>
                    </div>
                    <div className="inline-actions">
                      <Button
                        type="primary"
                        onClick={() => openEditor(null)}
                        disabled={isRefreshing || isSwitchingTab}
                      >
                        新增题目
                      </Button>
                    </div>
                  </div>

                  <QuestionFilters
                    bankId={bankId}
                    keyword={keyword}
                    type={type}
                    lawSource={lawSource}
                    pageSize={String(questionPageSize)}
                    preservedQuery={{
                      tab: "questions",
                      recordPage,
                      recordPageSize,
                    }}
                  />

                  <div className="admin-inline-status-row">
                    <p className="page-note" style={{ margin: 0 }}>
                      当前共筛选到 {questionTotal} 道题目。
                    </p>
                    {isRefreshing ? (
                      <span className="admin-inline-status">
                        正在刷新当前列表…
                      </span>
                    ) : null}
                    {isSwitchingTab ? (
                      <span className="admin-inline-status">正在切换标签…</span>
                    ) : null}
                  </div>

                  {deleteError ? (
                    <div style={{ color: "var(--danger)" }}>{deleteError}</div>
                  ) : null}

                  {questions.length === 0 ? (
                    <div className="admin-empty-state">
                      当前筛选结果为空，可以调整筛选条件，或通过新增题目、Excel
                      导入补充内容。
                    </div>
                  ) : (
                    <>
                      <div className="admin-table-wrap">
                        <table className="admin-table is-question-table">
                          <thead>
                            <tr>
                              <th style={{ width: 88 }}>序号</th>
                              <th style={{ width: 108 }}>题目类型</th>
                              <th style={{ width: "24%" }}>题干</th>
                              <th style={{ width: "24%" }}>选项</th>
                              <th style={{ width: 132 }}>正确答案</th>
                              <th style={{ width: "18%" }}>解析</th>
                              <th style={{ width: 180 }}>答案来源</th>
                              <th style={{ width: 110 }}>创建人</th>
                              <th style={{ width: 168 }}>创建时间</th>
                              <th style={{ width: 110 }}>更新人</th>
                              <th style={{ width: 168 }}>更新时间</th>
                              <th style={{ width: 180 }}>操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {questions.map((question) => (
                              <tr key={question.id}>
                                <td>{question.sortOrder}</td>
                                <td>{getQuestionTypeLabel(question.type)}</td>
                                <td title={question.stem}>
                                  {truncateText(question.stem, 80)}
                                </td>
                                <td title={joinOptions(question.options)}>
                                  {truncateText(
                                    joinOptions(question.options),
                                    120,
                                  )}
                                </td>
                                <td>{question.correctAnswers.join(", ")}</td>
                                <td title={question.analysis || "-"}>
                                  {truncateText(question.analysis, 60)}
                                </td>
                                <td title={question.lawSource || "-"}>
                                  {truncateText(question.lawSource, 40)}
                                </td>
                                <td>{question.createdByName || "-"}</td>
                                <td>{formatDateTime(question.createdAt)}</td>
                                <td>{question.updatedByName || "-"}</td>
                                <td>{formatDateTime(question.updatedAt)}</td>
                                <td className="admin-table-actions-cell">
                                  <div className="admin-table-action-links">
                                    <button
                                      type="button"
                                      className="admin-table-inline-button"
                                      onClick={() => openEditor(question)}
                                      disabled={isRefreshing || isSwitchingTab}
                                    >
                                      编辑
                                    </button>
                                    <span className="admin-table-action-divider">
                                      |
                                    </span>
                                    <button
                                      type="button"
                                      className="admin-table-inline-button is-danger"
                                      onClick={() =>
                                        void deleteQuestion(question.id)
                                      }
                                      disabled={
                                        deletingId === question.id ||
                                        isRefreshing ||
                                        isSwitchingTab
                                      }
                                    >
                                      {deletingId === question.id
                                        ? "删除中..."
                                        : "删除"}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <AdminPagination
                        basePath={`/admin/banks/${bankId}/questions`}
                        page={questionPage}
                        pageSize={questionPageSize}
                        total={questionTotal}
                        query={buildTabQuery("questions")}
                      />
                    </>
                  )}
                </div>
              ),
            },
            {
              key: "imports",
              label: `导入记录（${importBatchTotal}）`,
              children: (
                <div className="admin-tab-content">
                  <div
                    className="admin-section-header"
                    style={{ marginBottom: 16 }}
                  >
                    <div>
                      <h2 style={{ margin: 0, fontSize: 20 }}>导入记录</h2>
                      <p className="page-note" style={{ marginTop: 8 }}>
                        只有标准模板按规则解析，其他文件全部交给 AI
                        识别。每一行都会记录是否成功匹配为题目。
                      </p>
                    </div>
                    <div className="inline-actions">
                      <Link
                        href="/api/admin/questions/import/template"
                        prefetch={false}
                      >
                        下载标准模板
                      </Link>
                      <Button
                        onClick={refreshCurrentPage}
                        loading={isRefreshing}
                        disabled={isSwitchingTab}
                      >
                        刷新记录
                      </Button>
                      <Button
                        type="primary"
                        onClick={() => openImport(null)}
                        disabled={isRefreshing || isSwitchingTab}
                      >
                        Excel 导入
                      </Button>
                    </div>
                  </div>

                  <div className="admin-inline-status-row">
                    <p className="page-note" style={{ margin: 0 }}>
                      当前共有 {importBatchTotal}{" "}
                      条导入记录，可查看解析进度与失败原因。
                    </p>
                    {isRefreshing ? (
                      <span className="admin-inline-status">
                        正在刷新导入记录…
                      </span>
                    ) : null}
                    {isSwitchingTab ? (
                      <span className="admin-inline-status">正在切换标签…</span>
                    ) : null}
                  </div>

                  {importBatches.length === 0 ? (
                    <div className="admin-empty-state">
                      当前题库还没有导入记录，点击“Excel
                      导入”即可上传文件并查看解析结果。
                    </div>
                  ) : (
                    <>
                      <div className="admin-table-wrap">
                        <table className="admin-table is-import-table">
                          <thead>
                            <tr>
                              <th style={{ width: "23%" }}>文件名</th>
                              <th style={{ width: 120 }}>解析方式</th>
                              <th style={{ width: 112 }}>状态</th>
                              <th style={{ width: "24%" }}>进度</th>
                              <th style={{ width: 96 }}>草稿数</th>
                              <th style={{ width: 150 }}>工作表</th>
                              <th style={{ width: 168 }}>上传时间</th>
                              <th style={{ width: 168 }}>解析时间</th>
                              <th style={{ width: "18%" }}>错误信息</th>
                              <th style={{ width: 140 }}>操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importBatches.map((batch) => {
                              const progressPercent =
                                getBatchProgressPercent(batch);

                              return (
                                <tr key={batch.id}>
                                  <td title={batch.fileName}>
                                    {truncateText(batch.fileName, 48)}
                                  </td>
                                  <td>
                                    {getImportTemplateTypeLabel(
                                      batch.templateType,
                                    )}
                                  </td>
                                  <td>{getBatchStatusLabel(batch.status)}</td>
                                  <td>
                                    <div className="admin-progress-cell">
                                      <div className="progress-track admin-progress-track">
                                        <div
                                          className="progress-fill"
                                          style={{
                                            width: `${progressPercent}%`,
                                          }}
                                        />
                                      </div>
                                      <div className="admin-progress-meta">
                                        <span>{progressPercent}%</span>
                                        <span>
                                          {getBatchProgressText(batch)}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td>{batch.draftCount}</td>
                                  <td title={batch.sourceSheetName || "-"}>
                                    {truncateText(batch.sourceSheetName, 24)}
                                  </td>
                                  <td>{formatDateTime(batch.createdAt)}</td>
                                  <td>{formatDateTime(batch.parsedAt)}</td>
                                  <td title={batch.lastError || "-"}>
                                    {truncateText(batch.lastError, 48)}
                                  </td>
                                  <td className="admin-table-actions-cell">
                                    <div className="admin-table-action-links">
                                      <button
                                        type="button"
                                        className="admin-table-inline-button"
                                        onClick={() => openImport(batch.id)}
                                        disabled={
                                          isRefreshing || isSwitchingTab
                                        }
                                      >
                                        {getBatchActionLabel(batch.status)}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <AdminPagination
                        basePath={`/admin/banks/${bankId}/questions`}
                        page={importBatchPage}
                        pageSize={importBatchPageSize}
                        total={importBatchTotal}
                        query={buildTabQuery("imports")}
                        pageParam="recordPage"
                        pageSizeParam="recordPageSize"
                      />
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </section>

      <QuestionEditorModal
        bankId={bankId}
        open={editorOpen}
        question={editingQuestion}
        nextSortOrder={nextSortOrder}
        onClose={() => setEditorOpen(false)}
        onSuccess={refreshCurrentPage}
      />

      <QuestionImportModal
        bankId={bankId}
        open={importOpen}
        initialBatchId={activeBatchId}
        onClose={() => setImportOpen(false)}
        onSuccess={refreshCurrentPage}
        onBatchChange={refreshCurrentPage}
      />
    </>
  );
}
