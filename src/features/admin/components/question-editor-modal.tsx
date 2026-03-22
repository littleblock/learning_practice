"use client";

import { QuestionType } from "@prisma/client";
import { Button, Input, Modal, Select } from "antd";
import { useEffect, useMemo, useState } from "react";

import type { QuestionListItem } from "@/shared/types/domain";
import { getQuestionTypeLabel } from "@/shared/utils/answers";
import { withAppBasePath } from "@/shared/utils/app-path";

interface QuestionFormState {
  type: QuestionType;
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  optionF: string;
  correctAnswers: string;
  analysis: string;
  lawSource: string;
  sortOrder: number;
}

const emptyForm: QuestionFormState = {
  type: QuestionType.SINGLE,
  stem: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  optionE: "",
  optionF: "",
  correctAnswers: "",
  analysis: "",
  lawSource: "",
  sortOrder: 1,
};

function toFormState(
  question?: QuestionListItem,
  nextSortOrder = 1,
): QuestionFormState {
  if (!question) {
    return {
      ...emptyForm,
      sortOrder: nextSortOrder,
    };
  }

  const optionMap = new Map(
    question.options.map((item) => [item.label.toUpperCase(), item.text]),
  );
  const isJudge = question.type === QuestionType.JUDGE;

  return {
    type: question.type,
    stem: question.stem,
    optionA:
      optionMap.get("A") ?? (isJudge ? (optionMap.get("T") ?? "正确") : ""),
    optionB:
      optionMap.get("B") ?? (isJudge ? (optionMap.get("F") ?? "错误") : ""),
    optionC: optionMap.get("C") ?? "",
    optionD: optionMap.get("D") ?? "",
    optionE: optionMap.get("E") ?? "",
    optionF: optionMap.get("F") ?? "",
    correctAnswers: question.correctAnswers.join(","),
    analysis: question.analysis ?? "",
    lawSource: question.lawSource ?? "",
    sortOrder: question.sortOrder,
  };
}

function normalizeJudgeAnswerToken(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return "";
  }

  if (["A", "T", "TRUE", "正确", "对", "Y", "YES"].includes(normalized)) {
    return "A";
  }

  if (["B", "F", "FALSE", "错误", "错", "N", "NO"].includes(normalized)) {
    return "B";
  }

  return normalized;
}

export function QuestionEditorModal({
  bankId,
  open,
  question,
  nextSortOrder,
  onClose,
  onSuccess,
}: {
  bankId: string;
  open: boolean;
  question?: QuestionListItem | null;
  nextSortOrder: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formState, setFormState] = useState<QuestionFormState>(() =>
    toFormState(undefined, nextSortOrder),
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setErrorMessage("");
      return;
    }

    setFormState(toFormState(question ?? undefined, nextSortOrder));
    setErrorMessage("");
  }, [nextSortOrder, open, question]);

  const optionLabels = useMemo(
    () =>
      formState.type === QuestionType.JUDGE
        ? (["A", "B"] as const)
        : (["A", "B", "C", "D", "E", "F"] as const),
    [formState.type],
  );

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const options = optionLabels
        .map((label) => ({
          label,
          text: formState[
            `option${label}` as keyof QuestionFormState
          ] as string,
        }))
        .filter((item) => item.text.trim().length > 0);

      const correctAnswers = formState.correctAnswers
        .split(/[\s,，；、/]+/)
        .map((item) =>
          formState.type === QuestionType.JUDGE
            ? normalizeJudgeAnswerToken(item)
            : item.trim().toUpperCase(),
        )
        .filter(Boolean);

      const payload = {
        type: formState.type,
        stem: formState.stem,
        options,
        correctAnswers,
        analysis: formState.analysis || null,
        lawSource: formState.lawSource || null,
        sortOrder: Number(formState.sortOrder),
      };

      const endpoint = question
        ? `/api/admin/questions/${question.id}`
        : `/api/admin/questions?bankId=${bankId}`;
      const method = question ? "PATCH" : "POST";

      const response = await fetch(withAppBasePath(endpoint), {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        setErrorMessage(result.message ?? "保存题目失败");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setErrorMessage("保存题目失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={question ? `编辑题目 #${question.sortOrder}` : "新增题目"}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={920}
    >
      <div className="list-grid">
        <div className="admin-modal-section">
          <div className="admin-modal-section-title">基础信息</div>
          <div className="page-note">
            先确定题型、题干和排序，再补充选项、正确答案与解析。
          </div>
        </div>

        <Select
          value={formState.type}
          options={[
            {
              value: QuestionType.SINGLE,
              label: getQuestionTypeLabel(QuestionType.SINGLE),
            },
            {
              value: QuestionType.MULTIPLE,
              label: getQuestionTypeLabel(QuestionType.MULTIPLE),
            },
            {
              value: QuestionType.JUDGE,
              label: getQuestionTypeLabel(QuestionType.JUDGE),
            },
          ]}
          onChange={(value) =>
            setFormState((current) => ({
              ...current,
              type: value as QuestionType,
              optionA:
                value === QuestionType.JUDGE
                  ? current.optionA || "正确"
                  : current.optionA,
              optionB:
                value === QuestionType.JUDGE
                  ? current.optionB || "错误"
                  : current.optionB,
              correctAnswers:
                value === QuestionType.JUDGE
                  ? normalizeJudgeAnswerToken(current.correctAnswers || "A")
                  : current.correctAnswers,
            }))
          }
        />
        <Input.TextArea
          rows={4}
          placeholder="题干"
          value={formState.stem}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              stem: event.target.value,
            }))
          }
        />
        <Input
          type="number"
          placeholder="序号"
          value={String(formState.sortOrder)}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              sortOrder: Number(event.target.value || nextSortOrder),
            }))
          }
        />

        <div className="admin-modal-section">
          <div className="admin-modal-section-title">选项与答案</div>
          <div className="page-note">
            {formState.type === QuestionType.JUDGE
              ? "判断题仅保留两个选项，默认使用 A=正确、B=错误。正确答案可填写 A/B，也支持填写 正确/错误 或 T/F。"
              : "正确答案可填写 A、B、C 等选项标识，多选题请用逗号分隔。"}
          </div>
        </div>

        <div className="admin-option-grid">
          {optionLabels.map((label) => (
            <Input
              key={label}
              placeholder={`选项 ${label}`}
              value={
                formState[`option${label}` as keyof QuestionFormState] as string
              }
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  [`option${label}`]: event.target.value,
                }))
              }
            />
          ))}
        </div>
        <Input
          placeholder={
            formState.type === QuestionType.JUDGE
              ? "正确答案，例如 A、B、正确、错误、T、F"
              : "正确答案，多个答案请用逗号分隔"
          }
          value={formState.correctAnswers}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              correctAnswers: event.target.value,
            }))
          }
        />

        <div className="admin-modal-section">
          <div className="admin-modal-section-title">解析与来源</div>
          <div className="page-note">用于学员答题后展示解释和答案依据。</div>
        </div>

        <Input
          placeholder="答案来源"
          value={formState.lawSource}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              lawSource: event.target.value,
            }))
          }
        />
        <Input.TextArea
          rows={4}
          placeholder="解析"
          value={formState.analysis}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              analysis: event.target.value,
            }))
          }
        />
        {errorMessage ? (
          <div style={{ color: "var(--danger)" }}>{errorMessage}</div>
        ) : null}
        <div className="inline-actions">
          <Button
            type="primary"
            onClick={() => void handleSubmit()}
            loading={isSubmitting}
          >
            {question ? "保存修改" : "创建题目"}
          </Button>
          <Button onClick={onClose} disabled={isSubmitting}>
            取消
          </Button>
        </div>
      </div>
    </Modal>
  );
}
