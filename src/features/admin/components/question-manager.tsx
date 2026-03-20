"use client";

import { Button, Tabs } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { QuestionFilters } from "@/features/admin/components/admin-filters";
import { AdminPagination } from "@/features/admin/components/admin-pagination";
import { QuestionEditorModal } from "@/features/admin/components/question-editor-modal";
import { QuestionImportModal } from "@/features/admin/components/question-import-modal";
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

  async function deleteQuestion(questionId: string) {
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

      router.refresh();
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

    router.push(`/admin/banks/${bankId}/questions?${searchParams.toString()}`);
  }

  return (
    <>
      <section className="admin-panel admin-tabs-panel">
        <Tabs
          className="admin-content-tabs"
          activeKey={activeTab}
          onChange={handleTabChange}
          items={[
            {
              key: "questions",
              label: `题目列表（${questionTotal}）`,
              children: (
                <div className="admin-tab-content">
                  <div className="admin-section-header" style={{ marginBottom: 16 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 20 }}>题目列表</h2>
                      <p className="page-note" style={{ marginTop: 8 }}>
                        支持分页查看、单题维护和导入后的结果核验。
                      </p>
                    </div>
                    <div className="inline-actions">
                      <Button type="primary" onClick={() => openEditor(null)}>
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

                  <p className="page-note" style={{ marginTop: 14 }}>
                    当前共筛选到 {questionTotal} 道题目。
                  </p>

                  <AdminPagination
                    basePath={`/admin/banks/${bankId}/questions`}
                    page={questionPage}
                    pageSize={questionPageSize}
                    total={questionTotal}
                    query={buildTabQuery("questions")}
                  />

                  {deleteError ? (
                    <div style={{ color: "var(--danger)", marginBottom: 12 }}>
                      {deleteError}
                    </div>
                  ) : null}

                  {questions.length === 0 ? (
                    <div className="admin-empty-state">
                      当前筛选结果为空，可以调整筛选条件，或通过新增题目、Excel 导入补充内容。
                    </div>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>序号</th>
                            <th>题目类型</th>
                            <th>题干</th>
                            <th>选项</th>
                            <th>正确答案</th>
                            <th>解析</th>
                            <th>答案来源</th>
                            <th>创建人</th>
                            <th>创建时间</th>
                            <th>更新人</th>
                            <th>更新时间</th>
                            <th>操作</th>
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
                                {truncateText(joinOptions(question.options), 120)}
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
                                  >
                                    编辑
                                  </button>
                                  <span className="admin-table-action-divider">|</span>
                                  <button
                                    type="button"
                                    className="admin-table-inline-button is-danger"
                                    onClick={() => void deleteQuestion(question.id)}
                                    disabled={deletingId === question.id}
                                  >
                                    {deletingId === question.id ? "删除中..." : "删除"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "imports",
              label: `导入记录（${importBatchTotal}）`,
              children: (
                <div className="admin-tab-content">
                  <div className="admin-section-header" style={{ marginBottom: 16 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 20 }}>导入记录</h2>
                      <p className="page-note" style={{ marginTop: 8 }}>
                        只有标准模板按规则解析，其他文件全部交给 AI 识别。每一行都会记录是否成功匹配为题目。
                      </p>
                    </div>
                    <div className="inline-actions">
                      <Link href="/api/admin/questions/import/template">
                        下载标准模板
                      </Link>
                      <Button onClick={() => router.refresh()}>刷新记录</Button>
                      <Button type="primary" onClick={() => openImport(null)}>
                        Excel 导入
                      </Button>
                    </div>
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

                  {importBatches.length === 0 ? (
                    <div className="admin-empty-state">
                      当前题库还没有导入记录，点击“Excel 导入”即可上传文件并查看解析结果。
                    </div>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>文件名</th>
                            <th>解析方式</th>
                            <th>状态</th>
                            <th>草稿数</th>
                            <th>工作表</th>
                            <th>上传时间</th>
                            <th>解析时间</th>
                            <th>确认时间</th>
                            <th>错误信息</th>
                            <th>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importBatches.map((batch) => (
                            <tr key={batch.id}>
                              <td title={batch.fileName}>
                                {truncateText(batch.fileName, 48)}
                              </td>
                              <td>{getImportTemplateTypeLabel(batch.templateType)}</td>
                              <td>{getBatchStatusLabel(batch.status)}</td>
                              <td>{batch.draftCount}</td>
                              <td title={batch.sourceSheetName || "-"}>
                                {truncateText(batch.sourceSheetName, 24)}
                              </td>
                              <td>{formatDateTime(batch.createdAt)}</td>
                              <td>{formatDateTime(batch.parsedAt)}</td>
                              <td>{formatDateTime(batch.confirmedAt)}</td>
                              <td title={batch.lastError || "-"}>
                                {truncateText(batch.lastError, 48)}
                              </td>
                              <td className="admin-table-actions-cell">
                                <div className="admin-table-action-links">
                                  <button
                                    type="button"
                                    className="admin-table-inline-button"
                                    onClick={() => openImport(batch.id)}
                                  >
                                    {getBatchActionLabel(batch.status)}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
        onSuccess={() => router.refresh()}
      />

      <QuestionImportModal
        bankId={bankId}
        open={importOpen}
        initialBatchId={activeBatchId}
        onClose={() => setImportOpen(false)}
        onSuccess={() => router.refresh()}
        onBatchChange={() => router.refresh()}
      />
    </>
  );
}
