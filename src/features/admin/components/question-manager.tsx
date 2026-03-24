"use client";

import { Button, Tabs } from "antd";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { QuestionFilters } from "@/features/admin/components/admin-filters";
import { AdminPagination } from "@/features/admin/components/admin-pagination";
import type {
  QuestionImportBatchSummary,
  QuestionListItem,
} from "@/shared/types/domain";
import { withAppBasePath } from "@/shared/utils/app-path";
import { getQuestionTypeLabel } from "@/shared/utils/answers";
import {
  formatDateTime,
  formatDurationBetween,
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

const questionColumnDefinitions = [
  { key: "sortOrder", label: "序号", width: 78, minWidth: 64 },
  { key: "type", label: "题型", width: 96, minWidth: 84 },
  { key: "stem", label: "题干", width: 360, minWidth: 260 },
  { key: "options", label: "选项", width: 320, minWidth: 240 },
  { key: "correctAnswers", label: "正确答案", width: 128, minWidth: 108 },
  { key: "analysis", label: "解析", width: 210, minWidth: 160 },
  { key: "lawSource", label: "答案来源", width: 240, minWidth: 180 },
  { key: "createdBy", label: "创建人", width: 108, minWidth: 92 },
  { key: "createdAt", label: "创建时间", width: 188, minWidth: 164 },
  { key: "updatedBy", label: "更新人", width: 108, minWidth: 92 },
  { key: "updatedAt", label: "更新时间", width: 188, minWidth: 164 },
  { key: "actions", label: "操作", width: 128, minWidth: 116 },
] as const;

type QuestionColumnKey = (typeof questionColumnDefinitions)[number]["key"];

const defaultQuestionColumnWidths = Object.fromEntries(
  questionColumnDefinitions.map((column) => [column.key, column.width]),
) as Record<QuestionColumnKey, number>;

const questionColumnMinWidths = Object.fromEntries(
  questionColumnDefinitions.map((column) => [column.key, column.minWidth]),
) as Record<QuestionColumnKey, number>;

function getBatchActionLabel(status: QuestionImportBatchSummary["status"]) {
  switch (status) {
    case "READY":
      return "处理结果";
    case "PENDING":
    case "PROCESSING":
      return "查看进度";
    case "CANCELLED":
      return "查看终止";
    case "FAILED":
      return "查看失败";
    case "CONFIRMED":
      return "查看结果";
    default:
      return "查看";
  }
}

function isBatchCancelable(status: QuestionImportBatchSummary["status"]) {
  return ["PENDING", "PROCESSING", "READY"].includes(status);
}

function getBatchProgressPercent(batch: QuestionImportBatchSummary) {
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

function getBatchProgressSummary(batch: {
  totalSourceRows: number;
  processedSourceRows: number;
  status: string;
}) {
  if (batch.totalSourceRows > 0) {
    return `${batch.processedSourceRows}/${batch.totalSourceRows} 行`;
  }

  if (batch.status === "READY" || batch.status === "CONFIRMED") {
    return "已完成";
  }

  if (batch.status === "CANCELLED") {
    return "已终止";
  }

  if (batch.status === "CANCELLED") {
    return "批次已终止";
  }

  if (batch.status === "FAILED") {
    return "已失败";
  }

  return "等待开始";
}

function getBatchProgressDetail(batch: {
  totalChunks: number;
  processedChunks: number;
  status: string;
}) {
  if (batch.totalChunks > 0) {
    return `已完成 ${batch.processedChunks}/${batch.totalChunks} 个分块`;
  }

  if (batch.status === "READY" || batch.status === "CONFIRMED") {
    return "分块解析已完成";
  }

  if (batch.status === "FAILED") {
    return "分块解析中断";
  }

  return "尚未生成分块";
}

function getBatchParseDuration(batch: {
  parsedAt: string | null;
  createdAt: string;
  status: string;
}) {
  if (batch.parsedAt) {
    return formatDurationBetween(batch.createdAt, batch.parsedAt);
  }

  if (batch.status === "PROCESSING") {
    return "进行中";
  }

  if (batch.status === "PENDING") {
    return "等待解析";
  }

  if (batch.status === "CANCELLED") {
    return "已终止";
  }

  return "-";
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
  const [cancelingBatchId, setCancelingBatchId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [questionColumnWidths, setQuestionColumnWidths] = useState(
    defaultQuestionColumnWidths,
  );
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isSwitchingTab, startTabTransition] = useTransition();
  const [resizingColumn, setResizingColumn] =
    useState<QuestionColumnKey | null>(null);
  const resizeStateRef = useRef<{
    key: QuestionColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    if (!resizingColumn) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const state = resizeStateRef.current;
      if (!state) {
        return;
      }

      const nextWidth = Math.max(
        questionColumnMinWidths[state.key],
        state.startWidth + event.clientX - state.startX,
      );

      setQuestionColumnWidths((current) => {
        if (current[state.key] === nextWidth) {
          return current;
        }

        return {
          ...current,
          [state.key]: nextWidth,
        };
      });
    }

    function stopResize() {
      resizeStateRef.current = null;
      setResizingColumn(null);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, [resizingColumn]);

  function refreshCurrentPage() {
    startRefreshTransition(() => {
      router.refresh();
    });
  }

  async function deleteQuestion(questionId: string) {
    if (
      !window.confirm("删除题目后将同步刷新匹配结果，确认删除吗？")
    ) {
      return;
    }

    setDeletingId(questionId);
    setDeleteError(null);

    try {
      const response = await fetch(
        withAppBasePath(`/api/admin/questions/${questionId}`),
        {
          method: "DELETE",
        },
      );

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

  async function cancelBatch(batchId: string) {
    if (!window.confirm("终止后当前导题批次会被作废，已生成草稿不会继续导入，确认终止吗？")) {
      return;
    }

    setCancelingBatchId(batchId);
    setDeleteError(null);

    try {
      const response = await fetch(
        withAppBasePath(`/api/admin/questions/import/${batchId}/cancel`),
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        setDeleteError(payload.message ?? "终止导题批次失败");
        return;
      }

      refreshCurrentPage();
    } catch {
      setDeleteError("终止导题批次失败");
    } finally {
      setCancelingBatchId(null);
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
      router.push(`/admin/banks/${bankId}/questions?${searchParams.toString()}`);
    });
  }

  function startColumnResize(
    key: QuestionColumnKey,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      key,
      startX: event.clientX,
      startWidth: questionColumnWidths[key],
    };
    setResizingColumn(key);
  }

  return (
    <>
      <section className="admin-panel admin-tabs-panel">
        <Tabs
          className="admin-content-tabs is-compact"
          activeKey={activeTab}
          onChange={handleTabChange}
          destroyOnHidden
          items={[
            {
              key: "questions",
              label: `题目列表 (${questionTotal})`,
              children: (
                <div className="admin-tab-content">
                  <div className="admin-section-header is-compact">
                    <div className="admin-page-header-copy is-compact">
                      <h2>题目列表</h2>
                      <p>支持分页查看、单题维护和导入后的结果校验。</p>
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
                        正在刷新当前列表
                      </span>
                    ) : null}
                    {isSwitchingTab ? (
                      <span className="admin-inline-status">正在切换页签</span>
                    ) : null}
                  </div>

                  {deleteError ? (
                    <div style={{ color: "var(--danger)" }}>{deleteError}</div>
                  ) : null}

                  {questions.length === 0 ? (
                    <div className="admin-empty-state">
                      当前筛选结果为空，可以调整筛选条件，或者通过新增题目、Excel
                      导入补充内容。
                    </div>
                  ) : (
                    <>
                      <div className="admin-table-wrap">
                        <table className="admin-table is-question-table is-resizable">
                          <colgroup>
                            {questionColumnDefinitions.map((column) => (
                              <col
                                key={column.key}
                                style={{
                                  width: `${questionColumnWidths[column.key]}px`,
                                }}
                              />
                            ))}
                          </colgroup>
                          <thead>
                            <tr>
                              {questionColumnDefinitions.map((column) => (
                                <th key={column.key}>
                                  <div className="admin-table-head-content">
                                    <span>{column.label}</span>
                                    <button
                                      type="button"
                                      className={
                                        resizingColumn === column.key
                                          ? "admin-column-resizer is-active"
                                          : "admin-column-resizer"
                                      }
                                      aria-label={`调整${column.label}列宽`}
                                      onMouseDown={(event) =>
                                        startColumnResize(column.key, event)
                                      }
                                    />
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {questions.map((question) => (
                              <tr key={question.id}>
                                <td>{question.sortOrder}</td>
                                <td>{getQuestionTypeLabel(question.type)}</td>
                                <td title={question.stem}>
                                  {truncateText(question.stem, 120)}
                                </td>
                                <td title={joinOptions(question.options)}>
                                  {truncateText(
                                    joinOptions(question.options),
                                    180,
                                  )}
                                </td>
                                <td>{question.correctAnswers.join(", ")}</td>
                                <td title={question.analysis || "-"}>
                                  {truncateText(question.analysis, 120)}
                                </td>
                                <td title={question.lawSource || "-"}>
                                  {truncateText(question.lawSource, 90)}
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
                                      /
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
              label: `导入记录 (${importBatchTotal})`,
              children: (
                <div className="admin-tab-content">
                  <div className="admin-section-header is-compact">
                    <div className="admin-page-header-copy is-compact">
                      <h2>导入记录</h2>
                      <p>
                        标准模板按规则解析，其他文件由 AI
                        识别，每一行都会记录解析结果。
                      </p>
                    </div>
                    <div className="inline-actions">
                      <a href={withAppBasePath("/api/admin/questions/import/template")}>
                        下载模板
                      </a>
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
                      当前共有 {importBatchTotal} 条导入记录，可查看解析进度与失败原因。
                    </p>
                    {isRefreshing ? (
                      <span className="admin-inline-status">
                        正在刷新导入记录
                      </span>
                    ) : null}
                    {isSwitchingTab ? (
                      <span className="admin-inline-status">正在切换页签</span>
                    ) : null}
                  </div>

                  {importBatches.length === 0 ? (
                    <div className="admin-empty-state">
                      当前题库还没有导入记录，点击“Excel 导入”即可上传文件并查看解析结果。
                    </div>
                  ) : (
                    <>
                      <div className="admin-table-wrap">
                        <table className="admin-table is-import-table">
                          <thead>
                            <tr>
                              <th style={{ width: "28%" }}>文件名</th>
                              <th style={{ width: 120 }}>解析方式</th>
                              <th style={{ width: 112 }}>状态</th>
                              <th style={{ width: 220 }}>进度</th>
                              <th style={{ width: 96 }}>草稿数</th>
                              <th style={{ width: 168 }}>工作表</th>
                              <th style={{ width: 188 }}>上传时间</th>
                              <th style={{ width: 148 }}>解析耗时</th>
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
                                    {truncateText(batch.fileName, 72)}
                                  </td>
                                  <td>
                                    {getImportTemplateTypeLabel(
                                      batch.templateType,
                                    )}
                                  </td>
                                  <td>{getBatchStatusLabel(batch.status)}</td>
                                  <td>
                                    <div className="admin-progress-cell is-compact">
                                      <div className="progress-track admin-progress-track">
                                        <div
                                          className="progress-fill"
                                          style={{
                                            width: `${progressPercent}%`,
                                          }}
                                        />
                                      </div>
                                      <div className="admin-progress-copy">
                                        <strong>
                                          {progressPercent}% ·{" "}
                                          {getBatchProgressSummary(batch)}
                                        </strong>
                                        <span>
                                          {getBatchProgressDetail(batch)}
                                        </span>
                                        {batch.currentConcurrency > 0 ? (
                                          <span>
                                            当前并发 {batch.currentConcurrency}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </td>
                                  <td>{batch.draftCount}</td>
                                  <td title={batch.sourceSheetName || "-"}>
                                    {truncateText(batch.sourceSheetName, 40)}
                                  </td>
                                  <td>{formatDateTime(batch.createdAt)}</td>
                                  <td>{getBatchParseDuration(batch)}</td>
                                  <td title={batch.lastError || "-"}>
                                    {truncateText(batch.lastError, 64)}
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
                                    {isBatchCancelable(batch.status) ? (
                                      <>
                                        <span className="admin-table-action-divider">
                                          /
                                        </span>
                                        <button
                                          type="button"
                                          className="admin-table-inline-button is-danger"
                                          onClick={() =>
                                            void cancelBatch(batch.id)
                                          }
                                          disabled={
                                            cancelingBatchId === batch.id ||
                                            isRefreshing ||
                                            isSwitchingTab
                                          }
                                        >
                                          {cancelingBatchId === batch.id
                                            ? "终止中..."
                                            : "终止导入"}
                                        </button>
                                      </>
                                    ) : null}
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
